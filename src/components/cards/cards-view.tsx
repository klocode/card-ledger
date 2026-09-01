"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BulkActionsBar } from "@/components/cards/bulk-actions-bar";
import { CardsTable } from "@/components/cards/cards-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sortCards, type SortState } from "@/lib/card-sort";
import { searchCards } from "@/lib/fuzzy";
import type { listCards } from "@/lib/actions/card-actions";

type CardRow = Awaited<ReturnType<typeof listCards>>[number];

export function CardsView({ cards }: { cards: CardRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Search first, then sort: with no column sort chosen, a query leaves rows in
  // best-match order, and choosing a sort takes over from there.
  const results = useMemo(
    () => sortCards(searchCards(cards, query), sort),
    [cards, query, sort]
  );

  // Bulk actions only ever touch rows you can see, so a search (or a card
  // deleted out from under the selection) narrows what's about to change.
  const selectedIds = useMemo(
    () => results.filter((card) => selected.has(card.id)).map((card) => card.id),
    [results, selected]
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // "/" jumps to the search box the way it does in most list UIs, but not
  // while you're already typing somewhere else.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Search cards — name, set, tag, group…"
          aria-label="Search cards"
          className="pr-9 pl-8"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <BulkActionsBar ids={selectedIds} onClear={clearSelection} />
      )}

      {query.trim() && (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {results.length} of {cards.length} card{cards.length === 1 ? "" : "s"} match
          {results.length === 1 ? "es" : ""} “{query.trim()}”
        </p>
      )}

      {query.trim() && results.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No cards match “{query.trim()}”.
        </p>
      ) : (
        <CardsTable
          cards={results}
          sort={sort}
          onSortChange={setSort}
          selected={selected}
          onSelectedChange={setSelected}
        />
      )}
    </div>
  );
}
