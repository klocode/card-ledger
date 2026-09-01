import Link from "next/link";

import { PriceRunReportCard } from "@/components/reports/price-run-report";
import { listPriceRuns } from "@/lib/actions/report-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daily reports · Card Ledger",
};

export default async function ReportsPage() {
  const runs = await listPriceRuns();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Daily reports</h1>
        <p className="text-muted-foreground text-sm">
          Every &ldquo;Fetch all prices&rdquo; run files a report for that day,
          listing the moves worth a second look. Run it twice in a day and the
          second report replaces the first.
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-8 text-center text-sm">
          No runs recorded yet. Hit{" "}
          <Link href="/" className="underline">
            Fetch all prices
          </Link>{" "}
          and the day&rsquo;s report will land here.
        </p>
      ) : (
        runs.map((run) => <PriceRunReportCard key={run.id} run={run} />)
      )}
    </div>
  );
}
