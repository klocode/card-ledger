"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { AddPullsDialog } from "@/components/packs/add-pulls-dialog";
import { DeletePackButton } from "@/components/packs/delete-pack-button";
import { netTone } from "@/components/packs/pack-summary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from "@/lib/cost-basis";

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export type PackPull = {
  id: string;
  cardId: string | null;
  name: string;
  printing: string | null;
  finish: string | null;
  qty: number;
  valueAtOpen: number | null;
  latestPrice: number | null;
};

export type PackRow = {
  openingId: string;
  /** Position within its own buy — "pack 3 of 12" of *that* box. */
  packNumber: number;
  packCount: number;
  date: Date;
  /** Which buy it came out of, so same-numbered packs stay distinguishable. */
  buyDate: Date;
  /** All-in cost of this pack, from the buy it came out of. */
  cost: number;
  valueNow: number;
  valueAtOpen: number;
  pulls: PackPull[];
};

/**
 * Every opened pack in one list, best verdict first, each expandable to what
 * was in it.
 *
 * The per-buy view answers "how is this box doing"; this answers "which packs
 * actually paid, and what made the difference". Packs from different buys sit
 * side by side even though they cost different amounts — the cost column is
 * what makes them comparable, rather than something to normalise away.
 */
export function PackBreakdown({
  packs,
  game,
}: {
  packs: PackRow[];
  game: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (packs.length === 0) return null;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const nets = packs.map((p) => p.valueNow - p.cost);
  const bestNet = Math.max(...nets);
  const worstNet = Math.min(...nets);
  const winners = nets.filter((n) => n > 0).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">Pack by pack</h2>
        <span className="text-muted-foreground text-sm">
          {winners} of {packs.length} beat their cost ·{" "}
          {expanded.size === packs.length ? (
            <button
              type="button"
              className="underline"
              onClick={() => setExpanded(new Set())}
            >
              collapse all
            </button>
          ) : (
            <button
              type="button"
              className="underline"
              onClick={() => setExpanded(new Set(packs.map((p) => p.openingId)))}
            >
              expand all
            </button>
          )}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pack</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Pulled now</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="text-right">At open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packs.map((pack) => {
            const net = pack.valueNow - pack.cost;
            const tone = netTone(net);
            const pct = pack.cost === 0 ? null : net / pack.cost;
            const isOpen = expanded.has(pack.openingId);

            return (
              <Fragment key={pack.openingId}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => toggle(pack.openingId)}
                >
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {isOpen ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}
                      <span>
                        Pack {pack.packNumber} of {pack.packCount}
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          · opened {DATE.format(pack.date)} · from the{" "}
                          {DATE.format(pack.buyDate)} buy · {pack.pulls.length}{" "}
                          pull{pack.pulls.length === 1 ? "" : "s"}
                          {net === bestNet && net > 0 && " · best"}
                          {net === worstNet && worstNet !== bestNet && " · worst"}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(pack.cost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(pack.valueNow)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      tone === "gain"
                        ? "text-gain"
                        : tone === "loss"
                          ? "text-loss"
                          : ""
                    }`}
                  >
                    {formatSignedCurrency(net)}
                    {pct != null && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        {formatPercent(pct)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatSignedCurrency(pack.valueAtOpen - pack.cost)}
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="bg-muted/30">
                      <PackContents
                        pulls={pack.pulls}
                        openingId={pack.openingId}
                        game={game}
                        packCost={pack.cost}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PackContents({
  pulls,
  openingId,
  game,
  packCost,
}: {
  pulls: PackPull[];
  openingId: string;
  game: string;
  packCost: number;
}) {
  return (
    <div className="flex flex-col gap-3 py-1">
      {pulls.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No pulls logged for this pack yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {pulls.map((pull) => (
            <div
              key={pull.id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {pull.qty > 1 && (
                  <span className="text-muted-foreground">{pull.qty}× </span>
                )}
                {pull.cardId ? (
                  <Link href={`/cards/${pull.cardId}`} className="hover:underline">
                    {pull.name}
                  </Link>
                ) : (
                  pull.name
                )}
                {(pull.printing || pull.finish) && (
                  <span className="text-muted-foreground text-xs">
                    {" "}
                    {[pull.printing, pull.finish].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1 tabular-nums">
                <span className="text-muted-foreground text-xs">
                  {pull.valueAtOpen == null
                    ? "—"
                    : formatCurrency(pull.valueAtOpen * pull.qty)}{" "}
                  at open →{" "}
                </span>
                {pull.latestPrice == null
                  ? "—"
                  : formatCurrency(pull.latestPrice * pull.qty)}
                <DeletePackButton
                  target="pull"
                  id={pull.id}
                  confirmText={`Remove ${pull.name} from this pack? The card itself stays tracked; only the record of pulling it goes.`}
                  successText={`Removed ${pull.name} from the pack`}
                  label=""
                />
              </span>
            </div>
          ))}
        </div>
      )}

      {/*
        Not redundant, and not safe to remove: the row above owns an onClick
        that toggles this panel shut. Radix renders the dialog through a
        portal, but React synthetic events bubble along the React tree rather
        than the DOM one — so without this, every click *inside* the open
        dialog would travel back up to the row and collapse the panel out from
        under the form.
      */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <AddPullsDialog
          openingId={openingId}
          game={game}
          packCost={packCost}
        />
        <DeletePackButton
          target="opening"
          id={openingId}
          label="Delete pack"
          confirmText={
            pulls.length
              ? `Delete this pack opening? Its ${pulls.length} pull${pulls.length === 1 ? "" : "s"} go with it, and the pack returns to sealed.`
              : "Delete this pack opening? The pack returns to sealed."
          }
          successText="Pack opening deleted — the pack is sealed again"
        />
      </div>
    </div>
  );
}
