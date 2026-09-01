import {
  computePosition,
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  type PurchaseLot,
} from "@/lib/cost-basis";

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

/**
 * What the position cost against what it's worth now.
 *
 * Renders nothing without lots — a card you're only watching has no basis to
 * report, and an empty panel of dashes would be noise on every such page.
 */
export function CostBasisPanel({
  lots,
  latestPrice,
  targetPrice,
}: {
  lots: PurchaseLot[];
  latestPrice: number | null;
  targetPrice: number | null;
}) {
  const position = computePosition(lots, latestPrice);
  if (!position) return null;

  const tone =
    position.unrealized == null || position.unrealized === 0
      ? "default"
      : position.unrealized > 0
        ? "gain"
        : "loss";

  return (
    <div className="border-border grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
      <Stat
        label="Cost basis"
        value={formatCurrency(position.totalCost)}
        hint={`${position.totalQty}× at ${formatCurrency(position.avgUnitCost)} all-in`}
      />
      <Stat
        label="Market value"
        value={
          position.marketValue == null
            ? "—"
            : formatCurrency(position.marketValue)
        }
        hint={
          latestPrice == null
            ? "no price logged yet"
            : `at ${formatCurrency(latestPrice)} each`
        }
      />
      <Stat
        label="Unrealized"
        value={
          position.unrealized == null
            ? "—"
            : formatSignedCurrency(position.unrealized)
        }
        tone={tone}
        hint={
          position.unrealizedPct == null
            ? undefined
            : formatPercent(position.unrealizedPct)
        }
      />
      <Stat
        label="Vs. target"
        // "under"/"over" rather than a signed number: a minus sign on a good
        // outcome reads as a loss, which is the opposite of what happened.
        value={
          targetPrice == null
            ? "—"
            : `${formatCurrency(Math.abs(position.avgUnitPrice - targetPrice))} ${
                position.avgUnitPrice <= targetPrice ? "under" : "over"
              }`
        }
        tone={
          targetPrice == null
            ? "default"
            : position.avgUnitPrice <= targetPrice
              ? "gain"
              : "loss"
        }
        hint={
          targetPrice == null
            ? "no target set"
            : `paid ${formatCurrency(position.avgUnitPrice)} vs ${formatCurrency(targetPrice)}`
        }
      />
    </div>
  );
}
