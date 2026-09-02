/**
 * Pack-ledger math: what sealed product cost against what came out of it.
 *
 * Pure functions over plain data, same contract as `cost-basis.ts`, so the
 * page and the entry dialogs compute identical numbers without a round trip.
 * Currency and percent formatting lives in `cost-basis.ts` — import from there
 * rather than growing a second set here.
 */

/**
 * The line between a pull worth logging and bulk. Not enforced — you decide
 * what goes in — but the UI reads its copy from this constant so the totals
 * say which convention produced them.
 */
export const NOTABLE_PULL_THRESHOLD = 1;

export type ProductIdentity = { game: string; name: string };

/**
 * Find the product a buy belongs to among the ones already tracked.
 *
 * Case- and whitespace-insensitive on both fields, because the database can't
 * be: SQLite compares strings binary, so the `@@unique([game, name])` index
 * would happily let "Marvel Collector Booster" and "marvel collector booster"
 * become two products with two separate P&Ls — the exact split the product
 * model exists to prevent. Same workaround, and the same reason, as
 * `matchCard`; the index stays as the backstop against exact duplicates.
 */
export function findProductMatch<T extends ProductIdentity>(
  products: T[],
  wanted: ProductIdentity
): T | null {
  const key = (p: ProductIdentity) =>
    // NUL separator, not a space: it cannot occur in a typed name, so
    // { game: "a", name: "b c" } and { game: "a b", name: "c" } stay
    // distinct keys instead of colliding on "a b c". Written as an escape
    // rather than an embedded byte so the file stays text to git.
    `${p.game.trim().toLowerCase()}\u0000${p.name.trim().toLowerCase()}`;
  const target = key(wanted);
  return products.find((p) => key(p) === target) ?? null;
}

export type PullValue = {
  qty: number;
  /** Per-copy market price on the day it was pulled, when one was known. */
  valueAtOpen: number | null;
  /** Per-copy latest price from the linked card; null if unlinked or unpriced. */
  latestPrice: number | null;
};

export type SealedPurchaseLot = {
  packCount: number;
  unitPrice: number;
  fees: number | null;
  openings: { pulls: PullValue[] }[];
};

/**
 * All-in cost of a single pack from this buy.
 *
 * Fees spread across the whole lot because shipping bought the whole box, and
 * per-purchase rather than per-product because a box on sale and a box at
 * retail genuinely cost different amounts per pack — averaging them across a
 * product would erase the thing that made the cheap one a good buy.
 */
export function perPackCost(
  purchase: Pick<SealedPurchaseLot, "packCount" | "unitPrice" | "fees">
): number {
  if (purchase.packCount <= 0) return 0;
  return (
    (purchase.unitPrice * purchase.packCount + (purchase.fees ?? 0)) /
    purchase.packCount
  );
}

export type ValueMode = "atOpen" | "now";

export type PullTotal = {
  total: number;
  /** Pulls that contributed a number. */
  valued: number;
  /**
   * Pulls with no price in this mode — the total understates by exactly
   * these. Reported rather than papered over: a pull whose card was deleted
   * has no current price, and substituting its open-day price would present a
   * stale number as a live one.
   */
  unvalued: number;
};

export function pullValue(pulls: PullValue[], mode: ValueMode): PullTotal {
  let total = 0;
  let valued = 0;
  let unvalued = 0;

  for (const pull of pulls) {
    const unit = mode === "atOpen" ? pull.valueAtOpen : pull.latestPrice;
    if (unit == null) {
      unvalued++;
      continue;
    }
    total += unit * pull.qty;
    valued++;
  }

  return { total, valued, unvalued };
}

export type PackSummary = {
  packsBought: number;
  packsOpened: number;
  packsUnopened: number;
  /**
   * Cost of the packs actually opened. The denominator for net, because
   * charging every pack bought against the pulls so far would read as a
   * permanent loss that shrinks each time another pack is opened.
   */
  spentOnOpened: number;
  /** What the unopened packs cost — inventory, not a loss. */
  sealedAtCost: number;
  atOpen: PullTotal;
  now: PullTotal;
  /** Pull value minus cost of opened packs, on the day each was opened. */
  netAtOpen: number;
  /** The same, marked at today's prices. */
  netNow: number;
  /** Net as a fraction of what the opened packs cost. `null` if nothing opened. */
  netAtOpenPct: number | null;
  netNowPct: number | null;
};

/**
 * Roll a set of sealed buys into one report.
 *
 * One function for both the per-product rows and the all-in header — the
 * header is the same call over every purchase — so the two can't drift into
 * disagreeing about what "net" means.
 */
export function summarizePacks(purchases: SealedPurchaseLot[]): PackSummary {
  let packsBought = 0;
  let packsOpened = 0;
  let spentOnOpened = 0;
  let sealedAtCost = 0;
  const allPulls: PullValue[] = [];

  for (const purchase of purchases) {
    const cost = perPackCost(purchase);
    const opened = purchase.openings.length;
    // Guard rather than trust: a stray extra opening shouldn't turn the
    // sealed-inventory figure negative and quietly discount the total.
    const unopened = Math.max(0, purchase.packCount - opened);

    packsBought += purchase.packCount;
    packsOpened += opened;
    spentOnOpened += cost * opened;
    sealedAtCost += cost * unopened;

    for (const opening of purchase.openings) allPulls.push(...opening.pulls);
  }

  const atOpen = pullValue(allPulls, "atOpen");
  const now = pullValue(allPulls, "now");
  const netAtOpen = atOpen.total - spentOnOpened;
  const netNow = now.total - spentOnOpened;

  return {
    packsBought,
    packsOpened,
    packsUnopened: Math.max(0, packsBought - packsOpened),
    spentOnOpened,
    sealedAtCost,
    atOpen,
    now,
    netAtOpen,
    netNow,
    netAtOpenPct: spentOnOpened === 0 ? null : netAtOpen / spentOnOpened,
    netNowPct: spentOnOpened === 0 ? null : netNow / spentOnOpened,
  };
}
