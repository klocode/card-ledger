import { format } from "date-fns";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PriceRunReport } from "@/lib/actions/report-actions";
import { formatCurrency, formatPercent, formatSignedCurrency } from "@/lib/cost-basis";

/**
 * Run dates are stored anchored to UTC midnight, the same as price entries, so
 * they're read back as calendar parts and re-made locally. Formatting the
 * stored instant directly would slide the report to the previous day for
 * anyone west of UTC.
 */
function formatRunDate(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-").map(Number);
  return format(new Date(year, month - 1, day), "EEE d MMM yyyy");
}

function Stat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "gain" | "loss";
  hint?: string;
}) {
  const toneClass =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-lg font-medium tabular-nums ${toneClass}`}>
        {value}
      </span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

function MovesTable({ moves }: { moves: PriceRunReport["moves"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Card</TableHead>
          <TableHead className="text-right">Was</TableHead>
          <TableHead className="text-right">Now</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {moves.map((move) => {
          const up = move.delta > 0;
          const toneClass = up ? "text-gain" : "text-loss";
          const Icon = up ? ArrowUp : ArrowDown;
          return (
            <TableRow key={move.id}>
              <TableCell>
                {/* The link is dropped rather than broken once a card is
                    deleted — the move still happened. */}
                {move.cardId ? (
                  <Link href={`/cards/${move.cardId}`} className="hover:underline">
                    {move.name}
                  </Link>
                ) : (
                  move.name
                )}
                {(move.printing || move.finish) && (
                  <span className="text-muted-foreground block text-xs">
                    {[move.printing, move.finish].filter(Boolean).join(" · ")}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(move.previous)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(move.price)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${toneClass}`}>
                <span className="inline-flex items-center gap-1">
                  <Icon className="size-3" aria-hidden />
                  {formatSignedCurrency(move.delta)}
                </span>
              </TableCell>
              <TableCell className={`text-right tabular-nums ${toneClass}`}>
                {move.pct === 0 ? "—" : formatPercent(move.pct)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** One day's fetch-all, as a report: what it priced, and what actually moved. */
export function PriceRunReportCard({ run }: { run: PriceRunReport }) {
  const valueTone =
    run.ownedValueChange === 0
      ? "default"
      : run.ownedValueChange > 0
        ? "gain"
        : "loss";

  return (
    <section className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{formatRunDate(run.date)}</h2>
        <span className="text-muted-foreground text-xs">
          run at {format(run.ranAt, "h:mm a")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Priced"
          value={`${run.logged}/${run.checked}`}
          hint={run.skipped > 0 ? `${run.skipped} skipped` : "all cards priced"}
        />
        <Stat
          label="Owned value"
          value={formatSignedCurrency(run.ownedValueChange)}
          tone={valueTone}
          hint="change across owned copies"
        />
        <Stat
          label="Up"
          value={String(run.risers)}
          tone={run.risers > 0 ? "gain" : "default"}
          hint={run.firstTime > 0 ? `${run.firstTime} first-time` : undefined}
        />
        <Stat
          label="Down"
          value={String(run.fallers)}
          tone={run.fallers > 0 ? "loss" : "default"}
        />
      </div>

      {run.moves.length > 0 ? (
        <MovesTable moves={run.moves} />
      ) : (
        <p className="text-muted-foreground text-sm">
          No notable moves — everything held within a few cents.
        </p>
      )}

      {run.skippedDetail.length > 0 && (
        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer">
            {run.skippedDetail.length} card
            {run.skippedDetail.length === 1 ? "" : "s"} skipped
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {run.skippedDetail.map((entry) => (
              <li key={`${entry.name}-${entry.reason}`}>
                {entry.name} — {entry.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
