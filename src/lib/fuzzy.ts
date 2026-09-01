/**
 * Small fzf-style fuzzy matcher for the cards search box. Deliberately not a
 * dependency: the whole collection is already in memory client-side, so this
 * only ever runs over a few hundred short strings per keystroke.
 */

const DIACRITICS = /\p{Diacritic}/gu;
const WORD_CHAR = /[a-z0-9]/;

/**
 * "Mjölnir, Hammer of Thor" -> "mjolnir hammer of thor" and "Sakura-Tribe" ->
 * "sakura tribe", so accents, hyphens and apostrophes never have to be typed
 * exactly. Apostrophes vanish rather than becoming gaps, keeping "avacyns" a
 * clean hit on "Avacyn's Pilgrim".
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Returns null when `query` isn't even a subsequence of `text`; otherwise a
 * score where higher is better. A contiguous substring hit always outranks a
 * scattered subsequence, and within each, matches at a word start and matches
 * nearer the front of the string rank higher — so typing "sto" puts
 * "Stoneforge Mystic" above "Wooded Foothills".
 */
export function fuzzyScore(text: string, query: string): number | null {
  const haystack = normalize(text);
  const needle = normalize(query);
  if (!needle) return 0;
  if (!haystack) return null;

  const direct = haystack.indexOf(needle);
  if (direct !== -1) {
    let score = 1000 - direct;
    if (direct === 0) score += 200;
    else if (!WORD_CHAR.test(haystack[direct - 1])) score += 100;
    if (haystack.length === needle.length) score += 200;
    return score;
  }

  let score = 0;
  let cursor = 0;
  let run = 0;
  for (const char of needle) {
    const at = haystack.indexOf(char, cursor);
    if (at === -1) return null;
    if (at === cursor && cursor > 0) {
      run += 1;
      score += 10 + run * 5;
    } else {
      run = 0;
      score += 5 - Math.min(at - cursor, 10);
    }
    if (at === 0 || !WORD_CHAR.test(haystack[at - 1])) score += 15;
    cursor = at + 1;
  }
  return score;
}

export type SearchableCard = {
  name: string;
  game: string;
  printing: string | null;
  finish: string | null;
  type: string | null;
  group: string | null;
  tags: { name: string }[];
};

/**
 * Weighted so a name hit beats an incidental hit on a tag or set code — "mh2"
 * should still find every Modern Horizons 2 card, but "ragavan" shouldn't be
 * outranked by a card merely tagged "ragavan-deck".
 */
function searchableFields(card: SearchableCard): [string, number][] {
  return [
    [card.name, 1],
    [card.printing ?? "", 0.6],
    [card.group ?? "", 0.5],
    [card.type ?? "", 0.4],
    [card.game, 0.4],
    [card.finish ?? "", 0.3],
    ...card.tags.map((tag): [string, number] => [tag.name, 0.6]),
  ];
}

/** Best weighted field score, or null if nothing in the card matches. */
export function scoreCard(card: SearchableCard, query: string): number | null {
  let best: number | null = null;
  for (const [text, weight] of searchableFields(card)) {
    if (!text) continue;
    const score = fuzzyScore(text, query);
    if (score == null) continue;
    const weighted = score * weight;
    if (best == null || weighted > best) best = weighted;
  }
  return best;
}

/**
 * Filters and re-ranks by match quality. An empty query is a no-op, which
 * keeps the server's own ordering (watching-by-distance, then owned) intact.
 */
export function searchCards<T extends SearchableCard>(cards: T[], query: string): T[] {
  if (!query.trim()) return cards;
  return cards
    .map((card) => ({ card, score: scoreCard(card, query) }))
    .filter((entry): entry is { card: T; score: number } => entry.score != null)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.card);
}
