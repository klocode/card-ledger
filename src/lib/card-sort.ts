export type SortKey = "name" | "latestPrice";
export type SortDirection = "asc" | "desc";
export type SortState = { key: SortKey; direction: SortDirection } | null;

export type SortableCard = { name: string; latestPrice: number | null };

/** First click sorts the way you'd want by default: A→Z, but priciest first. */
const INITIAL_DIRECTION: Record<SortKey, SortDirection> = {
  name: "asc",
  latestPrice: "desc",
};

/**
 * Click cycles through initial direction → reversed → off. The third state
 * matters: the unsorted order is the server's own (watching cards by distance
 * to target, then owned by name), which no column sort can reproduce.
 */
export function cycleSort(current: SortState, key: SortKey): SortState {
  const initial = INITIAL_DIRECTION[key];
  if (current?.key !== key) return { key, direction: initial };
  if (current.direction === initial) {
    return { key, direction: initial === "asc" ? "desc" : "asc" };
  }
  return null;
}

export function sortCards<T extends SortableCard>(cards: T[], sort: SortState): T[] {
  if (!sort) return cards;
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...cards].sort((a, b) => {
    if (sort.key === "name") {
      return factor * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    // A card with no logged price is unknown, not cheap — it sinks to the
    // bottom in both directions rather than claiming "$0".
    if (a.latestPrice == null || b.latestPrice == null) {
      if (a.latestPrice == null && b.latestPrice == null) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      return a.latestPrice == null ? 1 : -1;
    }
    return factor * (a.latestPrice - b.latestPrice);
  });
}
