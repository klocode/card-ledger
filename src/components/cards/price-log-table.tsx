"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deletePriceEntry } from "@/lib/actions/price-actions";

export type PriceLogRow = {
  id: string;
  date: Date;
  price: number;
  source: string;
};

export function PriceLogTable({ entries }: { entries: PriceLogRow[] }) {
  const [isPending, startTransition] = useTransition();

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No prices logged yet.
      </p>
    );
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePriceEntry(id);
      toast.success("Price entry deleted");
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...entries]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{entry.date.toISOString().slice(0, 10)}</TableCell>
              <TableCell>${entry.price.toFixed(2)}</TableCell>
              <TableCell>{entry.source}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleDelete(entry.id)}
                  aria-label="Delete price entry"
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
