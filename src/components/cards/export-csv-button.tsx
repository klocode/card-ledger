import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportCsvButton() {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href="/api/cards/export" download="card-price-ledger-export.csv">
        <Download className="size-4" />
        Export CSV
      </a>
    </Button>
  );
}
