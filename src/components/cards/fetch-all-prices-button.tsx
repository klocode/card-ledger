"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  listPriceableCardIds,
  refetchPricesBulk,
  type BulkRefetchRow,
} from "@/lib/actions/price-actions";
import { recordPriceRun } from "@/lib/actions/report-actions";
import { formatMove, rankMoves, toMoves } from "@/lib/price-moves";

// Small enough that each round trip stays a few seconds — progress keeps
// moving and no single request runs long enough to be cut off.
const BATCH_SIZE = 10;

// The toast is a glance; the rest of the movers are on the report page.
const TOAST_MOVERS = 3;

function summarise(rows: BulkRefetchRow[]) {
  const ok = rows.filter((r): r is Extract<BulkRefetchRow, { ok: true }> => r.ok);
  const failed = rows.filter((r): r is Extract<BulkRefetchRow, { ok: false }> => !r.ok);
  const movers = rankMoves(toMoves(ok)).slice(0, TOAST_MOVERS).map(formatMove);

  return { ok, failed, movers };
}

export function FetchAllPricesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  function handleFetchAll() {
    setRunning(true);
    const toastId = toast.loading("Fetching prices…");

    startTransition(async () => {
      const rows: BulkRefetchRow[] = [];
      let error: string | null = null;

      try {
        const ids = await listPriceableCardIds();
        if (ids.length === 0) throw new Error("No Magic cards to price.");

        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          rows.push(...(await refetchPricesBulk(ids.slice(i, i + BATCH_SIZE))));
          toast.loading(`Fetching prices… ${rows.length} of ${ids.length}`, {
            id: toastId,
          });
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "Failed to fetch prices";
      }

      // Recorded before anything is reported, and from a partial run too: the
      // prices those batches wrote are already in the ledger, so the day's
      // report should account for them either way. A failure to file the
      // report must not bury the fetch result, hence the swallowed catch.
      const report =
        rows.length > 0 ? await recordPriceRun(rows).catch(() => null) : null;

      if (error) {
        toast.error(error, { id: toastId });
      } else {
        const { ok, failed, movers } = summarise(rows);
        const description = [
          movers.length > 0 ? `Biggest moves: ${movers.join(", ")}.` : null,
          failed.length > 0
            ? `Skipped: ${failed.map((f) => `${f.name} (${f.reason})`).join("; ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        const message = `Logged ${ok.length} price${ok.length === 1 ? "" : "s"}${
          failed.length > 0 ? `, ${failed.length} skipped` : ""
        }`;

        const options = {
          id: toastId,
          description,
          action: report
            ? {
                label:
                  report.notable > 0
                    ? `${report.notable} notable`
                    : "Daily report",
                onClick: () => router.push("/reports"),
              }
            : undefined,
        };

        if (failed.length > 0) toast.warning(message, options);
        else toast.success(message, options);
      }

      setRunning(false);
      if (rows.length > 0) router.refresh();
    });
  }

  const busy = running || isPending;

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={handleFetchAll}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Fetching…" : "Fetch all prices"}
    </Button>
  );
}
