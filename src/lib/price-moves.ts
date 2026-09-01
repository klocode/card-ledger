/**
 * What counts as a price *move* worth reading about.
 *
 * Shared by the "fetch all prices" toast and the daily report so the two never
 * disagree about which cards moved — the toast is just the top of the same
 * list the report keeps.
 */

export type PriceMove = {
  cardId: string;
  name: string;
  price: number;
  previous: number;
  /** Signed change since the last logged price. */
  delta: number;
  /** Fractional change (0.12 = +12%); 0 when the previous price was 0. */
  pct: number;
};

/** A dollar move this big is notable on its own, however small the percentage. */
const NOTABLE_DOLLARS = 1;
/** …and a percentage move this big is notable however few dollars it is — */
const NOTABLE_PCT = 0.05;
/** …as long as it clears this, so penny cards don't fill the report. */
const NOISE_FLOOR = 0.25;

/**
 * Two thresholds rather than one because the collection spans three orders of
 * magnitude: $2 off a $60 dual is real money at 3%, and 20% off a $1 common is
 * a real signal at 20 cents — one rule would either drown in the cheap cards
 * or miss the expensive ones.
 */
export function isNotableMove(move: PriceMove): boolean {
  const dollars = Math.abs(move.delta);
  if (dollars >= NOTABLE_DOLLARS) return true;
  return Math.abs(move.pct) >= NOTABLE_PCT && dollars >= NOISE_FLOOR;
}

/** Biggest dollar swings first — the order both the toast and report use. */
export function rankMoves<T extends { delta: number }>(moves: T[]): T[] {
  return [...moves].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * Build moves from priced rows. Cards with no earlier price have nothing to
 * move from and are left out — they're counted separately as first-time prices.
 */
export function toMoves(
  rows: { id: string; name: string; price: number; previous: number | null }[]
): PriceMove[] {
  return rows
    .filter((row): row is typeof row & { previous: number } => row.previous != null)
    .map((row) => ({
      cardId: row.id,
      name: row.name,
      price: row.price,
      previous: row.previous,
      delta: row.price - row.previous,
      pct: row.previous > 0 ? (row.price - row.previous) / row.previous : 0,
    }))
    .filter((move) => move.delta !== 0);
}

/** `Ancient Tomb +$2.30` — the compact form the toast lists. */
export function formatMove(move: { name: string; delta: number }): string {
  return `${move.name} ${move.delta >= 0 ? "+" : "−"}$${Math.abs(move.delta).toFixed(2)}`;
}
