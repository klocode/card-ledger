"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateCard } from "@/lib/actions/card-actions";
import type { Finish, PrintingRow } from "@/lib/scryfall";

const FINISH_LABEL: Record<Finish, string> = {
  nonfoil: "nonfoil",
  foil: "foil",
  etched: "etched",
};

export function OtherPrintingsTable({
  cardId,
  rows,
  trackedPrinting,
  trackedFinish,
}: {
  cardId: string;
  rows: PrintingRow[];
  trackedPrinting: string | null;
  trackedFinish: Finish;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function isTracked(row: PrintingRow) {
    return row.printing === trackedPrinting && row.finish === trackedFinish;
  }

  function handleTrack(row: PrintingRow) {
    startTransition(async () => {
      try {
        await updateCard({
          id: cardId,
          printing: row.printing,
          finish: row.finish,
        });
        toast.success(
          `Now tracking ${row.printing} ${FINISH_LABEL[row.finish]}`,
          {
            description: "The next price run will log this version.",
          },
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to switch printing",
        );
      }
    });
  }

  return (
    // Heavily reprinted cards run to a few hundred rows, so the list scrolls
    // itself rather than pushing the price log off the page.
    <Table containerClassName="max-h-96 rounded-md border">
      <TableHeader className="bg-background sticky top-0 z-10">
        <TableRow>
          <TableHead>Set</TableHead>
          <TableHead>Printing</TableHead>
          <TableHead>Finish</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const tracked = isTracked(row);
          return (
            <TableRow
              key={`${row.printing}-${row.finish}`}
              data-state={tracked ? "selected" : undefined}
            >
              <TableCell>
                <span className="font-mono text-xs">{row.set}</span>
                <div className="text-muted-foreground max-w-48 truncate text-xs">
                  {row.setName}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.printing}
              </TableCell>
              <TableCell>
                <Badge
                  variant={row.finish === "nonfoil" ? "outline" : "secondary"}
                >
                  {FINISH_LABEL[row.finish]}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.price == null ? "—" : `$${row.price.toFixed(2)}`}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {tracked ? (
                    <Badge>Tracked</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleTrack(row)}
                    >
                      Track
                    </Button>
                  )}
                  {row.scryfallUri && (
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a
                        href={row.scryfallUri}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${row.printing} on Scryfall`}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
