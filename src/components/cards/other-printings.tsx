import { OtherPrintingsTable } from "@/components/cards/other-printings-table";
import { fetchPrintings, normalizeFinish } from "@/lib/scryfall";

/**
 * Live "what do the other versions cost" panel. Fetched at request time, so
 * the detail page wraps it in <Suspense> — an unreachable Scryfall must not
 * hold up the price history, which is the page's actual job.
 */
export async function OtherPrintings({
  cardId,
  name,
  printing,
  finish,
}: {
  cardId: string;
  name: string;
  printing: string | null;
  finish: string | null;
}) {
  const result = await fetchPrintings(name, printing);

  if (!result) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn&apos;t reach Scryfall for other printings right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">
        {result.printingCount} printing{result.printingCount === 1 ? "" : "s"} ·
        live TCGplayer prices via Scryfall, not logged to this card&apos;s history.
        {!result.exactMatch &&
          " Matched by name — set this card's printing to pin the exact version."}
      </p>
      <OtherPrintingsTable
        cardId={cardId}
        rows={result.rows}
        trackedPrinting={printing}
        trackedFinish={normalizeFinish(finish)}
      />
    </div>
  );
}
