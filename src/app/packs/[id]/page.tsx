import Link from "next/link";
import { notFound } from "next/navigation";

import { DeletePackButton } from "@/components/packs/delete-pack-button";
import { OpenPackDialog } from "@/components/packs/open-pack-dialog";
import { PackBreakdown, type PackRow } from "@/components/packs/pack-breakdown";
import { PackSummaryPanel } from "@/components/packs/pack-summary";
import { Badge } from "@/components/ui/badge";
import { getPackProduct } from "@/lib/actions/pack-actions";
import { formatCurrency } from "@/lib/cost-basis";
import { perPackCost, pullValue, type PullValue } from "@/lib/pack-value";

export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** A loaded pull, reduced to the two numbers the math marks it against. */
function toPullValue(pull: {
  qty: number;
  valueAtOpen: number | null;
  card: { priceEntries: { price: number }[] } | null;
}): PullValue {
  return {
    qty: pull.qty,
    valueAtOpen: pull.valueAtOpen,
    latestPrice: pull.card?.priceEntries[0]?.price ?? null,
  };
}

export default async function PackProductPage({
  params,
}: PageProps<"/packs/[id]">) {
  const { id } = await params;
  const product = await getPackProduct(id);
  if (!product) notFound();

  // Flattened across buys so packs can be compared directly. Each keeps the
  // cost of the buy it came from — that column is what makes a $19 pack and a
  // $25 pack legible side by side instead of misleading.
  const packRows: PackRow[] = product.purchases
    .flatMap((purchase) => {
      const cost = perPackCost(purchase);
      return purchase.openings.map((opening, index) => {
        const values = opening.pulls.map(toPullValue);
        return {
          openingId: opening.id,
          packNumber: index + 1,
          packCount: purchase.packCount,
          date: opening.date,
          buyDate: purchase.date,
          cost,
          valueNow: pullValue(values, "now").total,
          valueAtOpen: pullValue(values, "atOpen").total,
          pulls: opening.pulls.map((pull) => ({
            id: pull.id,
            cardId: pull.cardId,
            name: pull.name,
            printing: pull.printing,
            finish: pull.finish,
            qty: pull.qty,
            valueAtOpen: pull.valueAtOpen,
            latestPrice: pull.card?.priceEntries[0]?.price ?? null,
          })),
        };
      });
    })
    .sort((a, b) => b.valueNow - b.cost - (a.valueNow - a.cost));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/packs"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Packs
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{product.game}</Badge>
            {product.setName && <Badge variant="outline">{product.setName}</Badge>}
            {product.setCode && <Badge variant="outline">{product.setCode}</Badge>}
          </div>
        </div>

        <DeletePackButton
          target="product"
          id={product.id}
          label="Delete product"
          redirectTo="/packs"
          confirmText={
            product.summary.packsBought > 0
              ? `Delete ${product.name} entirely? All ${product.purchases.length} buy${product.purchases.length === 1 ? "" : "s"}, ${product.summary.packsOpened} opened pack${product.summary.packsOpened === 1 ? "" : "s"} and every pull recorded from them go with it. Cards you pulled stay in your collection.`
              : `Delete ${product.name}?`
          }
          successText={`Deleted ${product.name}`}
        />
      </div>

      <PackSummaryPanel summary={product.summary} />

      <PackBreakdown packs={packRows} game={product.game} />

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-medium">Buys</h2>

        {product.purchases.map((purchase) => {
          const cost = perPackCost(purchase);
          const opened = purchase.openings.length;
          const remaining = Math.max(0, purchase.packCount - opened);

          return (
            <div
              key={purchase.id}
              className="border-border flex flex-col gap-4 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {purchase.packCount} pack
                    {purchase.packCount === 1 ? "" : "s"} at{" "}
                    {formatCurrency(purchase.unitPrice)}
                    {purchase.fees ? ` + ${formatCurrency(purchase.fees)} fees` : ""}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {DATE.format(purchase.date)}
                    {purchase.source ? ` · ${purchase.source}` : ""} ·{" "}
                    <span className="tabular-nums">{formatCurrency(cost)}</span>{" "}
                    all-in per pack · {opened} opened, {remaining} sealed
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <OpenPackDialog
                    purchaseId={purchase.id}
                    packCost={cost}
                    remaining={remaining}
                  />
                  <DeletePackButton
                    target="purchase"
                    id={purchase.id}
                    confirmText={
                      opened > 0
                        ? `Delete this buy of ${purchase.packCount} pack${purchase.packCount === 1 ? "" : "s"}? Its ${opened} opened pack${opened === 1 ? "" : "s"} and every pull recorded from them go too.`
                        : `Delete this buy of ${purchase.packCount} pack${purchase.packCount === 1 ? "" : "s"}? Nothing has been opened from it.`
                    }
                    successText="Buy deleted"
                    label=""
                  />
                </div>
              </div>

              {opened === 0 && (
                <p className="text-muted-foreground text-sm">
                  Nothing opened from this buy yet.
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
