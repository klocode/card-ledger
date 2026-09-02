"use server";

import { revalidatePath } from "next/cache";

import { parseBulkAddInput, type BulkAddFormat } from "@/lib/bulk-add";
import { matchCard } from "@/lib/card-matching";
import { syncCardFromAcquisitions } from "@/lib/card-ownership";
import { db } from "@/lib/db";
import {
  findProductMatch,
  summarizePacks,
  type PackSummary,
  type SealedPurchaseLot,
} from "@/lib/pack-value";
import { fetchTrackedPrice } from "@/lib/scryfall";
import {
  addPullsSchema,
  openPackSchema,
  recordSealedPurchaseSchema,
  type AddPullsInput,
  type OpenPackInput,
  type RecordSealedPurchaseInput,
} from "@/lib/validations/pack";

/**
 * Everything the pack math needs, in one shape.
 *
 * The latest price rides along per pulled card so `pullValue(…, "now")` can
 * mark the pulls without a second pass — same trick `listCards` uses to attach
 * `latestPrice`.
 */
const PURCHASE_INCLUDE = {
  openings: {
    // Ascending so pack numbering ("pack 3 of 12") counts up in the order the
    // packs were actually opened; the page reverses for display.
    orderBy: { createdAt: "asc" },
    include: {
      pulls: {
        orderBy: { createdAt: "asc" },
        include: {
          card: {
            select: {
              id: true,
              status: true,
              priceEntries: { orderBy: { date: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  },
} as const;

type PurchaseWithOpenings = {
  packCount: number;
  unitPrice: number;
  fees: number | null;
  openings: {
    pulls: {
      qty: number;
      valueAtOpen: number | null;
      card: { priceEntries: { price: number }[] } | null;
    }[];
  }[];
};

/** Strip a loaded purchase down to what the pure math takes. */
function toLots(purchases: PurchaseWithOpenings[]): SealedPurchaseLot[] {
  return purchases.map((purchase) => ({
    packCount: purchase.packCount,
    unitPrice: purchase.unitPrice,
    fees: purchase.fees,
    openings: purchase.openings.map((opening) => ({
      pulls: opening.pulls.map((pull) => ({
        qty: pull.qty,
        valueAtOpen: pull.valueAtOpen,
        latestPrice: pull.card?.priceEntries[0]?.price ?? null,
      })),
    })),
  }));
}

export type PackFilters = { game?: string };

/**
 * Worst first: a product or set that's losing money is the one worth knowing
 * about, and burying it under the winners is how you keep buying it. Anything
 * with nothing opened yet has no verdict, so it sorts to the bottom by name.
 */
function byNetThenName<T extends { name: string; summary: PackSummary }>(
  a: T,
  b: T
): number {
  const aOpen = a.summary.packsOpened > 0;
  const bOpen = b.summary.packsOpened > 0;
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  if (!aOpen) return a.name.localeCompare(b.name);
  return a.summary.netNow - b.summary.netNow;
}

/**
 * Every product with its rollup, grouped by set, plus the all-in total.
 *
 * Every level is the same `summarizePacks` over a different slice of the same
 * lots — product, set, and header alike — so a set's total is its product
 * lines by construction rather than by a second calculation that could drift.
 *
 * Sets are keyed case-insensitively for the same reason product names are:
 * SQLite can't group case-insensitively, and "Edge of Eternities" typed twice
 * with different capitals would otherwise split one set into two.
 */
export async function listPacks(filters: PackFilters = {}) {
  const products = await db.sealedProduct.findMany({
    where: filters.game ? { game: filters.game } : {},
    include: { purchases: { orderBy: { date: "desc" }, include: PURCHASE_INCLUDE } },
  });

  const allLots: SealedPurchaseLot[] = [];
  const groups = new Map<
    string,
    {
      key: string;
      /** Null for products recorded without a set. */
      setName: string | null;
      setCode: string | null;
      lots: SealedPurchaseLot[];
      products: {
        id: string;
        name: string;
        game: string;
        summary: PackSummary;
      }[];
    }
  >();

  for (const product of products) {
    const lots = toLots(product.purchases);
    allLots.push(...lots);

    const key = product.setName?.trim().toLowerCase() ?? "";
    const group = groups.get(key) ?? {
      key,
      setName: product.setName?.trim() || null,
      setCode: product.setCode?.trim() || null,
      lots: [],
      products: [],
    };
    // First non-null wins, so a set code recorded on one product line labels
    // the whole set rather than depending on which product loaded first.
    group.setCode ??= product.setCode?.trim() || null;
    group.lots.push(...lots);
    group.products.push({
      id: product.id,
      name: product.name,
      game: product.game,
      summary: summarizePacks(lots),
    });
    groups.set(key, group);
  }

  const setRows = Array.from(groups.values()).map(({ lots, ...group }) => ({
    ...group,
    products: group.products.sort(byNetThenName),
    summary: summarizePacks(lots),
  }));

  // Ungrouped products trail the real sets — they're a to-do (add a set), not
  // a category anyone wants at the top of the page.
  setRows.sort((a, b) => {
    if (!a.setName !== !b.setName) return a.setName ? -1 : 1;
    return byNetThenName(
      { name: a.setName ?? "", summary: a.summary },
      { name: b.setName ?? "", summary: b.summary }
    );
  });

  return { sets: setRows, totals: summarizePacks(allLots) };
}

export type PackSetRow = Awaited<ReturnType<typeof listPacks>>["sets"][number];
export type PackProductRow = PackSetRow["products"][number];

export async function getPackGames() {
  const products = await db.sealedProduct.findMany({ select: { game: true } });
  return Array.from(new Set(products.map((p) => p.game))).sort();
}

export async function getPackProduct(id: string) {
  const product = await db.sealedProduct.findUnique({
    where: { id },
    include: { purchases: { orderBy: { date: "desc" }, include: PURCHASE_INCLUDE } },
  });
  if (!product) return null;
  return { ...product, summary: summarizePacks(toLots(product.purchases)) };
}

/** Find the product this buy belongs to, or start one. */
async function findOrCreateProduct(data: RecordSealedPurchaseInput) {
  const name = data.productName.trim();
  const game = data.game.trim();

  // Every product is loaded rather than filtering by game in SQL, because the
  // game name is matched case-insensitively too and SQLite can't do that in a
  // `where`. See findProductMatch for why this isn't left to the unique index.
  const candidates = await db.sealedProduct.findMany();
  const existing = findProductMatch(candidates, { game, name });

  if (existing) {
    // Backfill, never overwrite: a product recorded before set was captured
    // should pick one up from the next buy that supplies it, but a later buy
    // left blank must not wipe the set off an existing product.
    const setCode = data.setCode?.trim() || null;
    const setName = data.setName?.trim() || null;
    const patch = {
      ...(setCode && !existing.setCode ? { setCode } : {}),
      ...(setName && !existing.setName ? { setName } : {}),
    };
    const product = Object.keys(patch).length
      ? await db.sealedProduct.update({ where: { id: existing.id }, data: patch })
      : existing;
    return { product, created: false };
  }

  const product = await db.sealedProduct.create({
    data: {
      name,
      game,
      setCode: data.setCode?.trim() || null,
      setName: data.setName?.trim() || null,
    },
  });
  return { product, created: true };
}

export type RecordSealedPurchaseResult = {
  purchaseId: string;
  productId: string;
  productName: string;
  /** False when this buy joined a product that already existed. */
  createdProduct: boolean;
  packsBoughtForProduct: number;
};

export async function recordSealedPurchase(
  input: RecordSealedPurchaseInput
): Promise<RecordSealedPurchaseResult> {
  const data = recordSealedPurchaseSchema.parse(input);

  const { product, created } = await findOrCreateProduct(data);

  const purchase = await db.sealedPurchase.create({
    data: {
      productId: product.id,
      packCount: data.packCount,
      unitPrice: data.unitPrice,
      fees: data.fees ?? null,
      date: new Date(data.date),
      source: data.source?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });

  const totals = await db.sealedPurchase.aggregate({
    where: { productId: product.id },
    _sum: { packCount: true },
  });

  revalidatePath("/packs");
  revalidatePath(`/packs/${product.id}`);

  return {
    purchaseId: purchase.id,
    productId: product.id,
    productName: product.name,
    createdProduct: created,
    packsBoughtForProduct: totals._sum.packCount ?? data.packCount,
  };
}

export type OpenPackResult = {
  openingId: string;
  /** Which pack of the box this was, and how many the box held. */
  packNumber: number;
  packCount: number;
  /** All-in cost of this one pack. */
  packCost: number;
};

export async function openPack(input: OpenPackInput): Promise<OpenPackResult> {
  const data = openPackSchema.parse(input);

  const purchase = await db.sealedPurchase.findUnique({
    where: { id: data.purchaseId },
    include: { _count: { select: { openings: true } }, product: true },
  });
  if (!purchase) throw new Error("Sealed purchase not found.");

  const alreadyOpened = purchase._count.openings;
  if (alreadyOpened >= purchase.packCount) {
    throw new Error(
      `All ${purchase.packCount} pack${purchase.packCount === 1 ? "" : "s"} from this buy are already opened.`
    );
  }

  const opening = await db.packOpening.create({
    data: {
      purchaseId: data.purchaseId,
      date: new Date(data.date),
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath("/packs");
  revalidatePath(`/packs/${purchase.productId}`);

  return {
    openingId: opening.id,
    packNumber: alreadyOpened + 1,
    packCount: purchase.packCount,
    packCost:
      (purchase.unitPrice * purchase.packCount + (purchase.fees ?? 0)) /
      purchase.packCount,
  };
}

export async function deletePackOpening(id: string) {
  const opening = await db.packOpening.delete({
    where: { id },
    include: { purchase: { select: { productId: true } } },
  });
  revalidatePath("/packs");
  revalidatePath(`/packs/${opening.purchase.productId}`);
  return opening;
}

export async function deleteSealedPurchase(id: string) {
  const purchase = await db.sealedPurchase.delete({ where: { id } });
  revalidatePath("/packs");
  revalidatePath(`/packs/${purchase.productId}`);
  return purchase;
}

/**
 * A parsed pull, priced but not yet saved.
 *
 * Priced at preview rather than on save so the $1 rule can be applied against
 * real numbers — you can see which lines are bulk and drop them before they
 * become rows.
 */
export type PullPreviewRow = {
  name: string;
  printing: string | null;
  finish: string | null;
  qty: number;
  /** An existing tracked card this matched, if one did. */
  cardId: string | null;
  /** Several tracked cards share this name — saving would guess wrong. */
  ambiguous: boolean;
  /** Market price per copy now; becomes `valueAtOpen` on save. */
  price: number | null;
  /** Why there's no price, when there isn't one. */
  priceNote: string | null;
};

export type PullPreviewResult = {
  rows: PullPreviewRow[];
  errors: string[];
  format: BulkAddFormat;
};

/**
 * Parse a pasted list into priced pulls, ready to review.
 *
 * Reuses the bulk-add parser, so a Moxfield/Archidekt line or an Export CSV
 * both work here for the same reason they work on the cards page. Prices come
 * from the same Scryfall call the re-fetch button uses, at the same pacing.
 */
export async function previewPulls(input: {
  text: string;
  game: string;
}): Promise<PullPreviewResult> {
  const parsed = parseBulkAddInput(input.text, { status: "OWNED" });
  const game = input.game.trim();
  const isMagic = game.toLowerCase() === "mtg";

  const candidates = await db.card.findMany();
  const rows: PullPreviewRow[] = [];

  for (const row of parsed.rows) {
    // The parser leaves these optional; everything downstream wants null.
    const printing = row.printing ?? null;
    const finish = row.finish ?? null;

    const match = matchCard(candidates, { name: row.name, game, printing, finish });

    let price: number | null = null;
    let priceNote: string | null = null;

    if (!isMagic) {
      priceNote = `Scryfall prices Magic only — enter ${game} values by hand`;
    } else {
      const fetched = await fetchTrackedPrice(row.name, printing, finish);
      if (fetched) {
        price = fetched.price;
        if (!fetched.exactMatch) priceNote = "matched by name, check the printing";
      } else {
        priceNote = "no price found";
      }
      // Scryfall asks for ~100ms between requests; the same pacing as the
      // bulk re-fetch and track_prices.py.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    rows.push({
      name: row.name,
      printing,
      finish,
      qty: row.qty ?? 1,
      cardId: match.card?.id ?? null,
      ambiguous: match.ambiguous,
      price,
      priceNote,
    });
  }

  return { rows, errors: parsed.errors, format: parsed.format };
}

export type AddPullsResult = {
  added: number;
  cardsCreated: number;
  /** Summed `valueAtOpen` of what was just saved. */
  valueAdded: number;
};

/**
 * Save reviewed pulls against an opening.
 *
 * A pull whose card isn't tracked yet creates one, OWNED, and seeds today's
 * price from the snapshot — without that entry the card has no price history
 * at all, and every freshly pulled card would read as worth nothing under
 * "now" until the next price run happened to catch it.
 */
export async function addPulls(input: AddPullsInput): Promise<AddPullsResult> {
  const data = addPullsSchema.parse(input);

  const opening = await db.packOpening.findUnique({
    where: { id: data.openingId },
    include: { purchase: { select: { productId: true } } },
  });
  if (!opening) throw new Error("Pack opening not found.");

  const today = new Date(new Date().toISOString().slice(0, 10));
  let cardsCreated = 0;
  let valueAdded = 0;

  for (const pull of data.pulls) {
    let cardId = pull.cardId ?? null;

    if (!cardId) {
      const card = await db.card.create({
        data: {
          name: pull.name.trim(),
          game: pull.game.trim(),
          printing: pull.printing?.trim() || null,
          finish: pull.finish?.trim() || null,
          status: "OWNED",
          qty: pull.qty,
        },
      });
      cardId = card.id;
      cardsCreated++;
    }

    if (pull.valueAtOpen != null) {
      // Same one-per-day rule as the re-fetch: today's entry is replaced, not
      // appended to, so opening two packs in a day doesn't double-log a price.
      await db.priceEntry.deleteMany({ where: { cardId, date: today } });
      await db.priceEntry.create({
        data: {
          cardId,
          price: pull.valueAtOpen,
          date: today,
          source: "Pack pull (via Scryfall)",
        },
      });
      valueAdded += pull.valueAtOpen * pull.qty;
    }

    await db.pull.create({
      data: {
        openingId: data.openingId,
        cardId,
        name: pull.name.trim(),
        printing: pull.printing?.trim() || null,
        finish: pull.finish?.trim() || null,
        qty: pull.qty,
        valueAtOpen: pull.valueAtOpen ?? null,
      },
    });

    // A pulled card is a card you own, so it counts toward qty like a buy
    // does. Runs after the Pull row exists so the sum includes it.
    await syncCardFromAcquisitions(cardId);
  }

  revalidatePath("/");
  revalidatePath("/packs");
  revalidatePath(`/packs/${opening.purchase.productId}`);

  return { added: data.pulls.length, cardsCreated, valueAdded };
}

export async function deletePull(id: string) {
  const pull = await db.pull.delete({
    where: { id },
    include: {
      opening: { include: { purchase: { select: { productId: true } } } },
    },
  });
  if (pull.cardId) await syncCardFromAcquisitions(pull.cardId);
  revalidatePath("/");
  revalidatePath("/packs");
  revalidatePath(`/packs/${pull.opening.purchase.productId}`);
  return pull;
}
