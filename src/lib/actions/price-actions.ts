"use server";

import { revalidatePath } from "next/cache";

import { matchCard } from "@/lib/card-matching";
import { db } from "@/lib/db";
import { fetchTrackedPrice } from "@/lib/scryfall";
import {
  logPriceRowSchema,
  manualPriceSchema,
  type LogPriceRowInput,
  type ManualPriceInput,
} from "@/lib/validations/price";

export type LogPricesResult = {
  imported: number;
  skipped: { name: string; reason: string }[];
};

export async function logPrices(rows: LogPriceRowInput[]): Promise<LogPricesResult> {
  const parsedRows = rows.map((row) => logPriceRowSchema.parse(row));
  const cards = await db.card.findMany();

  let imported = 0;
  const skipped: { name: string; reason: string }[] = [];

  for (const row of parsedRows) {
    const { card, ambiguous } = matchCard(cards, row);
    if (!card) {
      skipped.push({
        name: row.name,
        reason: ambiguous
          ? `ambiguous — multiple cards named "${row.name}"; include game/printing/finish to disambiguate`
          : "no matching card found",
      });
      continue;
    }
    await db.priceEntry.create({
      data: {
        cardId: card.id,
        price: row.price,
        date: new Date(row.date),
        source: row.source,
      },
    });
    imported++;
  }

  revalidatePath("/");
  return { imported, skipped };
}

export async function addManualPrice(input: ManualPriceInput) {
  const data = manualPriceSchema.parse(input);
  const entry = await db.priceEntry.create({
    data: {
      cardId: data.cardId,
      price: data.price,
      date: new Date(data.date),
      source: data.source,
    },
  });
  revalidatePath(`/cards/${data.cardId}`);
  revalidatePath("/");
  return entry;
}

export type RefetchPriceResult =
  | { ok: true; price: number; finish: string; printing: string; replaced: number }
  | { ok: false; reason: string };

/**
 * Re-price one card from Scryfall, right now.
 *
 * A re-fetch corrects today's number rather than adding a second observation
 * for the same day, so any existing entry for this card dated today is
 * replaced — one price per card per day is what the chart and the "latest
 * price" column both assume. The count of what it replaced is reported back
 * so an overwritten manual entry is never silent.
 */
export async function refetchPrice(cardId: string): Promise<RefetchPriceResult> {
  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card) return { ok: false, reason: "Card not found." };
  if (card.game.trim().toLowerCase() !== "mtg") {
    return { ok: false, reason: "Scryfall only covers Magic cards." };
  }

  const result = await fetchTrackedPrice(card.name, card.printing, card.finish);
  if (!result) {
    return {
      ok: false,
      reason: `No ${card.finish?.trim() || "nonfoil"} price listed for ${
        card.printing ?? card.name
      }.`,
    };
  }

  // Same day boundary the manual dialog and the script both use.
  const today = new Date(new Date().toISOString().slice(0, 10));
  const { count } = await db.priceEntry.deleteMany({
    where: { cardId, date: today },
  });

  await db.priceEntry.create({
    data: { cardId, price: result.price, date: today, source: result.source },
  });

  revalidatePath("/");
  revalidatePath(`/cards/${cardId}`);
  return {
    ok: true,
    price: result.price,
    finish: result.finish,
    printing: result.printing,
    replaced: count,
  };
}

export type BulkRefetchRow =
  | { ok: true; id: string; name: string; price: number; previous: number | null }
  | { ok: false; id: string; name: string; reason: string };

/** Ids of every card Scryfall can price, in the list's own order. */
export async function listPriceableCardIds(): Promise<string[]> {
  // SQLite has no case-insensitive filter in Prisma, so the game check
  // happens here — same reason card-matching.ts matches in JS.
  const cards = await db.card.findMany({
    orderBy: { name: "asc" },
    select: { id: true, game: true },
  });
  return cards
    .filter((card) => card.game.trim().toLowerCase() === "mtg")
    .map((card) => card.id);
}

/**
 * Re-price a batch of cards. The caller walks the full list in chunks so no
 * single request runs long — that keeps progress visible and survives hosts
 * that cap function duration, where one 40-second call would be killed.
 *
 * Same one-per-day rule as the single-card re-fetch: today's entry is
 * replaced, not appended to.
 */
export async function refetchPricesBulk(cardIds: string[]): Promise<BulkRefetchRow[]> {
  const cards = await db.card.findMany({ where: { id: { in: cardIds } } });
  const today = new Date(new Date().toISOString().slice(0, 10));
  const rows: BulkRefetchRow[] = [];

  for (const card of cards) {
    if (card.game.trim().toLowerCase() !== "mtg") {
      rows.push({ ok: false, id: card.id, name: card.name, reason: "not a Magic card" });
      continue;
    }

    const result = await fetchTrackedPrice(card.name, card.printing, card.finish);
    if (!result) {
      rows.push({
        ok: false,
        id: card.id,
        name: card.name,
        reason: `no ${card.finish?.trim() || "nonfoil"} price for ${card.printing ?? card.name}`,
      });
    } else {
      // Read the last price from before today so the caller can report movers.
      const prior = await db.priceEntry.findFirst({
        where: { cardId: card.id, date: { lt: today } },
        orderBy: { date: "desc" },
        select: { price: true },
      });

      await db.priceEntry.deleteMany({ where: { cardId: card.id, date: today } });
      await db.priceEntry.create({
        data: { cardId: card.id, price: result.price, date: today, source: result.source },
      });

      rows.push({
        ok: true,
        id: card.id,
        name: card.name,
        price: result.price,
        previous: prior?.price ?? null,
      });
    }

    // Scryfall asks for ~100ms between requests; the script honours the same.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  revalidatePath("/");
  return rows;
}

export async function deletePriceEntry(id: string) {
  const entry = await db.priceEntry.delete({ where: { id } });
  revalidatePath(`/cards/${entry.cardId}`);
  revalidatePath("/");
  return entry;
}
