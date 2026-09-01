import { BulkAddDialog } from "@/components/cards/bulk-add-dialog";
import { CardsView } from "@/components/cards/cards-view";
import { ExportCsvButton } from "@/components/cards/export-csv-button";
import { FetchAllPricesButton } from "@/components/cards/fetch-all-prices-button";
import { FilterBar } from "@/components/cards/filter-bar";
import { LogPricesDialog } from "@/components/cards/log-prices-dialog";
import {
  getFilterOptions,
  listCards,
  type CardFilters,
} from "@/lib/actions/card-actions";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const getParam = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  const status = getParam("status");
  const filters: CardFilters = {
    game: getParam("game"),
    status: status === "OWNED" || status === "WATCHING" ? status : undefined,
    group: getParam("group"),
    tag: getParam("tag"),
  };

  const [cards, filterOptions] = await Promise.all([
    listCards(filters),
    getFilterOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar {...filterOptions} />
        <div className="flex gap-2">
          <BulkAddDialog />
          <FetchAllPricesButton />
          <LogPricesDialog />
          <ExportCsvButton />
        </div>
      </div>
      <CardsView cards={cards} />
    </div>
  );
}
