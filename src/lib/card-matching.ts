import type { Card } from "@/generated/prisma/client";

export type PriceRowForMatch = {
  name: string;
  game?: string | null;
  printing?: string | null;
  finish?: string | null;
};

/**
 * SQLite string filters don't support Prisma's `mode: "insensitive"`, so
 * candidates are loaded once by the caller and matched here in JS instead.
 */
export function matchCard(
  cards: Card[],
  row: PriceRowForMatch
): { card: Card | null; ambiguous: boolean } {
  const nameLower = row.name.trim().toLowerCase();
  const byName = (c: Card) => c.name.trim().toLowerCase() === nameLower;

  if (row.game && row.printing) {
    const gameLower = row.game.toLowerCase();
    const exact = cards.filter(
      (c) =>
        byName(c) &&
        c.game.toLowerCase() === gameLower &&
        c.printing === row.printing &&
        (!row.finish || (c.finish ?? "") === row.finish)
    );
    if (exact.length === 1) return { card: exact[0], ambiguous: false };
    if (exact.length > 1) return { card: null, ambiguous: true };
  }

  const byNameOnly = cards.filter(byName);
  if (byNameOnly.length === 1) return { card: byNameOnly[0], ambiguous: false };
  if (byNameOnly.length > 1) return { card: null, ambiguous: true };
  return { card: null, ambiguous: false };
}
