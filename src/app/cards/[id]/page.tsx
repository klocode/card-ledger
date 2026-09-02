import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AddManualPriceDialog } from "@/components/cards/add-manual-price-dialog";
import { CardImage, CardImageSkeleton } from "@/components/cards/card-image";
import { CostBasisPanel } from "@/components/cards/cost-basis-panel";
import { DeleteCardButton } from "@/components/cards/delete-card-button";
import { EditCardDialog } from "@/components/cards/edit-card-dialog";
import { MarkAsBoughtDialog } from "@/components/cards/mark-as-bought-dialog";
import { OtherPrintings } from "@/components/cards/other-printings";
import { PriceHistoryChart } from "@/components/cards/price-history-chart";
import { PriceLogTable } from "@/components/cards/price-log-table";
import { PurchaseLogTable } from "@/components/cards/purchase-log-table";
import { RefetchPriceButton } from "@/components/cards/refetch-price-button";
import { Badge } from "@/components/ui/badge";
import { getCard } from "@/lib/actions/card-actions";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({
  params,
}: PageProps<"/cards/[id]">) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();

  // Scryfall covers Magic only, so the art and printings panels are MTG-only.
  const isMagic = card.game.trim().toLowerCase() === "mtg";

  const chartPoints = card.priceEntries.map((entry) => ({
    date: entry.date.toISOString().slice(0, 10),
    price: entry.price,
  }));

  // priceEntries come back date-ascending, so the last one is the current mark.
  const latestPrice = card.priceEntries.at(-1)?.price ?? null;

  const pulledQty = card.pulls.reduce((sum, pull) => sum + pull.qty, 0);

  const buyPoints = card.purchases.map((purchase) => ({
    date: purchase.date.toISOString().slice(0, 10),
    qty: purchase.qty,
    unitPrice: purchase.unitPrice,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-start gap-5">
          {isMagic && (
            <Suspense fallback={<CardImageSkeleton />}>
              <CardImage name={card.name} printing={card.printing} />
            </Suspense>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{card.name}</h1>
            <p className="text-muted-foreground text-sm">
              {card.game}
              {card.printing ? ` · ${card.printing}` : ""}
              {card.finish ? ` · ${card.finish}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant={card.status === "OWNED" ? "secondary" : "outline"}
              >
                {card.status === "OWNED"
                  ? `Owned${card.qty ? ` ×${card.qty}` : ""}`
                  : "Watching"}
              </Badge>
              {card.group && <Badge variant="outline">{card.group}</Badge>}
              {card.tags.map((t) => (
                <Badge key={t.id} variant="outline">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <MarkAsBoughtDialog
            cardId={card.id}
            cardName={card.name}
            status={card.status}
            targetPrice={card.targetPrice}
            latestPrice={latestPrice}
          />
          <EditCardDialog card={card} />
          <DeleteCardButton cardId={card.id} cardName={card.name} />
        </div>
      </div>

      <CostBasisPanel
        lots={card.purchases}
        latestPrice={latestPrice}
        targetPrice={card.targetPrice}
        pulledQty={pulledQty}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Price history</h2>
        <PriceHistoryChart
          points={chartPoints}
          targetPrice={card.targetPrice}
          buys={buyPoints}
        />
      </section>

      {isMagic && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Other printings</h2>
          <Suspense
            fallback={
              <p className="text-muted-foreground text-sm">
                Loading printings…
              </p>
            }
          >
            <OtherPrintings
              cardId={card.id}
              name={card.name}
              printing={card.printing}
              finish={card.finish}
            />
          </Suspense>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Price log</h2>
          <div className="flex gap-2">
            {isMagic && <RefetchPriceButton cardId={card.id} />}
            <AddManualPriceDialog cardId={card.id} />
          </div>
        </div>
        <PriceLogTable entries={card.priceEntries} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Purchases</h2>
          <MarkAsBoughtDialog
            cardId={card.id}
            cardName={card.name}
            status={card.status}
            targetPrice={card.targetPrice}
            latestPrice={latestPrice}
          />
        </div>
        <PurchaseLogTable purchases={card.purchases} />
      </section>
    </div>
  );
}
