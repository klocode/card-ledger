import Link from "next/link";

import { PackSummaryPanel, netTone } from "@/components/packs/pack-summary";
import { RecordSealedPurchaseDialog } from "@/components/packs/record-sealed-purchase-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPacks } from "@/lib/actions/pack-actions";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from "@/lib/cost-basis";
import { db } from "@/lib/db";
import { NOTABLE_PULL_THRESHOLD, type PackSummary } from "@/lib/pack-value";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Packs · Card Ledger",
};

/** One set's cumulative line, sitting beside its heading. */
function SetTotal({ summary }: { summary: PackSummary }) {
  if (summary.packsOpened === 0) {
    return (
      <span className="text-muted-foreground text-sm tabular-nums">
        {summary.packsBought} pack{summary.packsBought === 1 ? "" : "s"} bought,
        none opened
      </span>
    );
  }
  const tone = netTone(summary.netNow);
  return (
    <span className="text-sm tabular-nums">
      <span className="text-muted-foreground">
        {summary.packsOpened}/{summary.packsBought} opened ·{" "}
        {formatCurrency(summary.spentOnOpened)} in →{" "}
        {formatCurrency(summary.now.total)} out{" "}
      </span>
      <span
        className={
          tone === "gain"
            ? "text-gain font-medium"
            : tone === "loss"
              ? "text-loss font-medium"
              : "font-medium"
        }
      >
        {formatSignedCurrency(summary.netNow)}
      </span>
      {summary.netNowPct != null && (
        <span className="text-muted-foreground text-xs">
          {" "}
          {formatPercent(summary.netNowPct)}
        </span>
      )}
    </span>
  );
}

export default async function PacksPage({ searchParams }: PageProps<"/packs">) {
  const params = await searchParams;
  const gameParam = params.game;
  const game = typeof gameParam === "string" ? gameParam : undefined;

  const [{ sets, totals }, allProducts] = await Promise.all([
    listPacks({ game }),
    db.sealedProduct.findMany({
      select: { name: true, game: true, setName: true },
    }),
  ]);

  const games = Array.from(new Set(allProducts.map((p) => p.game))).sort();
  const setNames = Array.from(
    new Set(allProducts.map((p) => p.setName).filter((s): s is string => !!s))
  ).sort();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Packs</h1>
          <p className="text-muted-foreground text-sm">
            What sealed product cost against what came out of it. Pull value
            counts cards over ${NOTABLE_PULL_THRESHOLD} — bulk isn&rsquo;t logged, so
            these totals are a floor, not a ceiling.
          </p>
        </div>
        <RecordSealedPurchaseDialog
          products={allProducts}
          games={games}
          sets={setNames}
        />
      </div>

      {games.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Game:</span>
          <Link
            href="/packs"
            className={
              game ? "text-muted-foreground hover:underline" : "font-medium"
            }
          >
            All
          </Link>
          {games.map((g) => (
            <Link
              key={g}
              href={`/packs?game=${encodeURIComponent(g)}`}
              className={
                game === g ? "font-medium" : "text-muted-foreground hover:underline"
              }
            >
              {g}
            </Link>
          ))}
        </div>
      )}

      {sets.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-8 text-center text-sm">
          No sealed product tracked yet. Record a buy and every pack you open
          from it gets measured against what it cost.
        </p>
      ) : (
        <>
          <PackSummaryPanel summary={totals} />

          {sets.map((set) => (
            <section key={set.key || "__unset__"} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-medium">
                  {set.setName ?? "No set recorded"}
                  {set.setCode && (
                    <Badge variant="outline" className="ml-2">
                      {set.setCode}
                    </Badge>
                  )}
                </h2>
                <SetTotal summary={set.summary} />
              </div>

              {!set.setName && (
                <p className="text-muted-foreground text-xs">
                  These products have no set on them yet, so they can&rsquo;t
                  roll up with the rest of their set. Adding one on the next buy
                  fills it in.
                </p>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product line</TableHead>
                    <TableHead className="text-right">Packs</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-right">Pulled now</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {set.products.map(({ id, name, game: productGame, summary }) => {
                    const opened = summary.packsOpened > 0;
                    const tone = netTone(summary.netNow);
                    return (
                      <TableRow key={id}>
                        <TableCell>
                          <Link href={`/packs/${id}`} className="hover:underline">
                            {name}
                          </Link>
                          {games.length > 1 && (
                            <Badge variant="outline" className="ml-2">
                              {productGame}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {summary.packsOpened}/{summary.packsBought}
                          <span className="text-muted-foreground"> opened</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(summary.spentOnOpened)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {opened ? formatCurrency(summary.now.total) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            !opened
                              ? ""
                              : tone === "gain"
                                ? "text-gain"
                                : tone === "loss"
                                  ? "text-loss"
                                  : ""
                          }`}
                        >
                          {opened ? formatSignedCurrency(summary.netNow) : "—"}
                          {opened && summary.netNowPct != null && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              {formatPercent(summary.netNowPct)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
