import Link from "next/link";

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
 *
 * A card acquired only from packs has no basis either, since nothing was paid
 * for the copies individually. It still gets the provenance line, though:
 * without it the page shows an OWNED card with a quantity and no account of
 * where it came from, which reads as missing data rather than as the true
 * answer that its economics live on the pack ledger.
 */
export function CostBasisPanel({
  lots,
  latestPrice,
  targetPrice,
  pulledQty = 0,
}: {
  lots: PurchaseLot[];
  latestPrice: number | null;
  targetPrice: number | null;
  /** Copies that came out of packs. They have no cost basis by design. */
  pulledQty?: number;
}) {
  const position = computePosition(lots, latestPrice);
  if (!position) return pulledQty > 0 ? <PulledNote qty={pulledQty} /> : null;

  const tone =
    position.unrealized == null || position.unrealized === 0
      ? "default"
      : position.unrealized > 0
        ? "gain"
        : "loss";

  return (
    <div className="flex flex-col gap-2">
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

      {pulledQty > 0 && <PulledNote qty={pulledQty} withBasis />}
    </div>
  );
}

/**
 * Where pulled copies stand. `withBasis` distinguishes "these are extra to the
 * numbers above" from "these are all there is" — the same fact, but the first
 * has to explain an apparent mismatch and the second has to explain an absence.
 */
function PulledNote({ qty, withBasis }: { qty: number; withBasis?: boolean }) {
  const copies = `${qty} cop${qty === 1 ? "y" : "ies"}`;
  return (
    <p className="text-muted-foreground text-xs">
      {withBasis
        ? `Plus ${copies} pulled from packs, not counted above — pulls carry no cost basis of their own, so`
        : `${copies} pulled from packs. Nothing was paid for ${qty === 1 ? "it" : "them"} individually, so there's no cost basis to show —`}{" "}
      what they were worth against what the pack cost lives on the{" "}
      <Link href="/packs" className="underline">
        pack ledger
      </Link>
      .
    </p>
  );
}
