import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from "@/lib/cost-basis";
import type { PackSummary } from "@/lib/pack-value";

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

export function netTone(net: number): "default" | "gain" | "loss" {
  return net === 0 ? "default" : net > 0 ? "gain" : "loss";
}

/**
 * The pack verdict: what the opened packs cost against what came out of them.
 *
 * Both marks are shown rather than one. Value at open is what the pack was
 * worth the day it was cracked and can never be recomputed; value now is what
 * the pulls are actually worth. A pack can be a win on one and a loss on the
 * other, and that gap is the whole reason to keep the ledger.
 */
export function PackSummaryPanel({
  summary,
  unpricedNote = true,
}: {
  summary: PackSummary;
  unpricedNote?: boolean;
}) {
  const opened = summary.packsOpened > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="border-border grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-5">
        <Stat
          label="Packs bought"
          value={String(summary.packsBought)}
          hint={
            summary.packsUnopened > 0
              ? `${summary.packsUnopened} still sealed`
              : "all opened"
          }
        />
        <Stat
          label="Spent on opened"
          value={formatCurrency(summary.spentOnOpened)}
          hint={
            opened
              ? `${summary.packsOpened} pack${summary.packsOpened === 1 ? "" : "s"} at ${formatCurrency(summary.spentOnOpened / summary.packsOpened)}`
              : "nothing opened yet"
          }
        />
        <Stat
          label="Pulled (at open)"
          value={formatCurrency(summary.atOpen.total)}
          hint="value the day each pack was opened"
        />
        <Stat
          label="Pulled (now)"
          value={formatCurrency(summary.now.total)}
          hint="same cards at today's prices"
        />
        <Stat
          label="Net"
          value={opened ? formatSignedCurrency(summary.netNow) : "—"}
          tone={opened ? netTone(summary.netNow) : "default"}
          hint={
            !opened
              ? "open a pack to get a verdict"
              : summary.netNowPct == null
                ? undefined
                : `${formatPercent(summary.netNowPct)} · ${formatSignedCurrency(summary.netAtOpen)} at open`
          }
        />
      </div>

      {summary.sealedAtCost > 0 && (
        <p className="text-muted-foreground text-xs">
          {formatCurrency(summary.sealedAtCost)} still sitting in sealed packs —
          inventory, not part of the net above.
        </p>
      )}

      {unpricedNote && summary.now.unvalued > 0 && (
        <p className="text-muted-foreground text-xs">
          {summary.now.unvalued} pull
          {summary.now.unvalued === 1 ? " has" : "s have"} no current price
          (card removed or never priced), so &ldquo;now&rdquo; understates by
          that much.
        </p>
      )}
    </div>
  );
}
