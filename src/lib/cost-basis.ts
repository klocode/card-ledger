/**
 * Cost-basis math for a card's purchase lots.
 *
 * Pure functions over plain data so the same numbers can be computed on the
 * server (detail page) and the client (dialog preview) without a round trip.
 */

export type PurchaseLot = {
  qty: number;
  unitPrice: number;
  fees: number | null;
};

export type CostBasis = {
  /** Copies acquired across every lot. */
  totalQty: number;
  /** Everything paid, fees included. */
  totalCost: number;
  /**
   * All-in cost per copy — the number to judge profit against, since fees are
   * money spent just as much as the card price is.
   */
  avgUnitCost: number;
  /**
   * Cost per copy excluding fees. Compared against `targetPrice`, because a
   * target is set against a listing price, and shipping was never part of it.
   */
  avgUnitPrice: number;
};

export function computeCostBasis(lots: PurchaseLot[]): CostBasis | null {
  if (lots.length === 0) return null;

  const totalQty = lots.reduce((sum, lot) => sum + lot.qty, 0);
  const cardCost = lots.reduce((sum, lot) => sum + lot.unitPrice * lot.qty, 0);
  const feeCost = lots.reduce((sum, lot) => sum + (lot.fees ?? 0), 0);
  const totalCost = cardCost + feeCost;

  // A lot is constrained to qty >= 1, so this only trips if every lot was
  // somehow zeroed out — guard anyway rather than emit NaN into the UI.
  if (totalQty === 0) return null;

  return {
    totalQty,
    totalCost,
    avgUnitCost: totalCost / totalQty,
    avgUnitPrice: cardCost / totalQty,
  };
}

export type Position = CostBasis & {
  /** `null` when the card has never been priced. */
  marketValue: number | null;
  /** Market value minus what was paid. `null` without a price to mark against. */
  unrealized: number | null;
  /** Unrealized gain as a fraction of cost. `null` if cost was zero. */
  unrealizedPct: number | null;
};

/**
 * Marks a set of lots against the latest known market price.
 *
 * The whole position is valued at the latest price rather than each lot at
 * the price on its own buy date: what the position is worth today does not
 * depend on when its pieces were bought.
 */
export function computePosition(
  lots: PurchaseLot[],
  latestPrice: number | null
): Position | null {
  const basis = computeCostBasis(lots);
  if (!basis) return null;

  const marketValue = latestPrice == null ? null : latestPrice * basis.totalQty;
  const unrealized = marketValue == null ? null : marketValue - basis.totalCost;

  return {
    ...basis,
    marketValue,
    unrealized,
    unrealizedPct:
      unrealized == null || basis.totalCost === 0
        ? null
        : unrealized / basis.totalCost,
  };
}

/**
 * How a price paid compares to the target that was set for the card.
 * `null` when there's no target to judge against.
 */
export function compareToTarget(
  pricePaid: number,
  targetPrice: number | null
): { beat: boolean; difference: number } | null {
  if (targetPrice == null) return null;
  return { beat: pricePaid <= targetPrice, difference: pricePaid - targetPrice };
}

export function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/** Currency with an explicit `+` on gains, for deltas where direction is the point. */
export function formatSignedCurrency(value: number): string {
  return `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
}

export function formatPercent(fraction: number): string {
  return `${fraction > 0 ? "+" : ""}${(fraction * 100).toFixed(1)}%`;
}
