"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { listCards } from "@/lib/actions/card-actions";
import { cycleSort, type SortKey, type SortState } from "@/lib/card-sort";
import { cn } from "@/lib/utils";

type CardRow = Awaited<ReturnType<typeof listCards>>[number];

function formatPrice(n: number | null) {
  return n == null ? "—" : `$${n.toFixed(2)}`;
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSortChange,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSortChange: (next: SortState) => void;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <TableHead
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSortChange(cycleSort(sort, sortKey))}
        className="hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors"
      >
        {label}
        <Icon
          className={cn(
            "size-3.5 transition-opacity",
            active ? "opacity-100" : "opacity-40",
          )}
        />
      </button>
    </TableHead>
  );
}

export function CardsTable({
  cards,
  sort,
  onSortChange,
  selected,
  onSelectedChange,
}: {
  cards: CardRow[];
  sort: SortState;
  onSortChange: (next: SortState) => void;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}) {
  // Shift-click extends from the last row you ticked, so the range has to
  // survive between clicks — and the shift key itself only reaches us through
  // the click event, not Radix's onCheckedChange.
  const anchorRef = useRef<number | null>(null);
  const shiftRef = useRef(false);

  const allSelected =
    cards.length > 0 && cards.every((c) => selected.has(c.id));
  const someSelected = !allSelected && cards.some((c) => selected.has(c.id));

  function toggleAll(checked: boolean) {
    const next = new Set(selected);
    for (const card of cards) {
      if (checked) next.add(card.id);
      else next.delete(card.id);
    }
    anchorRef.current = null;
    onSelectedChange(next);
  }

  function toggleRow(index: number, checked: boolean) {
    const anchor =
      shiftRef.current && anchorRef.current != null ? anchorRef.current : index;
    const [from, to] = anchor <= index ? [anchor, index] : [index, anchor];
    const next = new Set(selected);
    for (let i = from; i <= to; i++) {
      if (checked) next.add(cards[i].id);
      else next.delete(cards[i].id);
    }
    anchorRef.current = index;
    onSelectedChange(next);
  }

  if (cards.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No cards yet. Add one to get started.
      </p>
    );
  }

  return (
    // Capped so a long list scrolls inside the table instead of running the
    // whole page off the bottom; the header rides along at the top.
    <Table
      containerClassName="max-h-[70dvh] rounded-md border"
      className="text-base"
    >
      <TableHeader className="bg-background sticky top-0 z-10">
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
              onCheckedChange={(v) => toggleAll(v === true)}
              aria-label={
                allSelected ? "Deselect all cards" : "Select all cards"
              }
            />
          </TableHead>
          <SortableHead
            label="Name"
            sortKey="name"
            sort={sort}
            onSortChange={onSortChange}
          />
          <TableHead>Game</TableHead>
          <TableHead>Status</TableHead>
          <SortableHead
            label="Latest price"
            sortKey="latestPrice"
            sort={sort}
            onSortChange={onSortChange}
          />
          <TableHead>Target / distance</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cards.map((card, index) => (
          <TableRow
            key={card.id}
            data-state={selected.has(card.id) ? "selected" : undefined}
          >
            <TableCell>
              <Checkbox
                checked={selected.has(card.id)}
                onClick={(e) => {
                  shiftRef.current = e.shiftKey;
                }}
                onCheckedChange={(v) => toggleRow(index, v === true)}
                aria-label={`Select ${card.name}`}
              />
            </TableCell>
            <TableCell>
              <Link
                href={`/cards/${card.id}`}
                className="font-medium hover:underline"
              >
                {card.name}
              </Link>
              {card.printing && (
                <div className="text-muted-foreground text-sm">
                  {card.printing}
                  {card.finish ? ` · ${card.finish}` : ""}
                </div>
              )}
            </TableCell>
            <TableCell>{card.game}</TableCell>
            <TableCell>
              <Badge
                variant={card.status === "OWNED" ? "secondary" : "outline"}
              >
                {card.status === "OWNED"
                  ? `Owned${card.qty ? ` ×${card.qty}` : ""}`
                  : "Watching"}
              </Badge>
            </TableCell>
            <TableCell>{formatPrice(card.latestPrice)}</TableCell>
            <TableCell>
              {card.status === "WATCHING" && card.targetPrice != null ? (
                <span
                  className={
                    card.distanceToTarget != null && card.distanceToTarget <= 0
                      ? "font-medium text-green-600 dark:text-green-400"
                      : ""
                  }
                >
                  {formatPrice(card.targetPrice)}
                  {card.distanceToTarget != null &&
                    ` (${
                      card.distanceToTarget <= 0
                        ? "at/below target"
                        : `+${formatPrice(card.distanceToTarget)}`
                    })`}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>{card.group ?? "—"}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {card.tags.map((t) => (
                  <Badge key={t.id} variant="outline">
                    {t.name}
                  </Badge>
                ))}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
