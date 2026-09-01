export type PricePoint = { date: string; price: number };
export type BuyPoint = { date: string; qty: number; unitPrice: number };

export type ChartRow = {
  date: string;
  price: number | null;
  buy: number | null;
  buyQty: number | null;
};

/**
 * Fold buys into the price series on a shared date axis.
 *
 * The chart's x-axis is categorical, so a marker can only be drawn on a date
 * that already exists as a category — a buy made on a day with no logged
 * price would otherwise silently vanish. Building the axis from the union of
 * both date sets keeps every buy visible; days that exist only because of a
 * buy carry `price: null`, which `connectNulls` bridges so the price line
 * stays continuous rather than breaking into segments.
 *
 * Several buys on one day collapse into a single marker at their
 * quantity-weighted average price, which is what that day actually cost per
 * copy.
 */
export function buildChartRows(
  points: PricePoint[],
  buys: BuyPoint[]
): ChartRow[] {
  const priceByDate = new Map(points.map((p) => [p.date, p.price]));

  const buyByDate = new Map<string, { qty: number; cost: number }>();
  for (const buy of buys) {
    const existing = buyByDate.get(buy.date) ?? { qty: 0, cost: 0 };
    buyByDate.set(buy.date, {
      qty: existing.qty + buy.qty,
      cost: existing.cost + buy.unitPrice * buy.qty,
    });
  }

  // ISO dates sort lexicographically, so this is chronological order.
  const dates = Array.from(
    new Set([...priceByDate.keys(), ...buyByDate.keys()])
  ).sort();

  return dates.map((date) => {
    const buy = buyByDate.get(date);
    return {
      date,
      price: priceByDate.get(date) ?? null,
      buy: buy && buy.qty > 0 ? buy.cost / buy.qty : null,
      buyQty: buy?.qty ?? null,
    };
  });
}
