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
import { deletePurchase } from "@/lib/actions/purchase-actions";
import { formatCurrency } from "@/lib/cost-basis";

export type PurchaseRow = {
  id: string;
  date: Date;
  qty: number;
  unitPrice: number;
  fees: number | null;
  source: string | null;
};

export function PurchaseLogTable({ purchases }: { purchases: PurchaseRow[] }) {
  const [isPending, startTransition] = useTransition();

  if (purchases.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No purchases recorded. Use “Mark as bought” when you buy this card to
        start tracking what it cost you.
      </p>
    );
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePurchase(id);
      toast.success("Purchase deleted");
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Each</TableHead>
          <TableHead>Fees</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>From</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...purchases]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell>{purchase.date.toISOString().slice(0, 10)}</TableCell>
              <TableCell>{purchase.qty}</TableCell>
              <TableCell>{formatCurrency(purchase.unitPrice)}</TableCell>
              <TableCell className="text-muted-foreground">
                {purchase.fees ? formatCurrency(purchase.fees) : "—"}
              </TableCell>
              <TableCell>
                {formatCurrency(
                  purchase.unitPrice * purchase.qty + (purchase.fees ?? 0)
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {purchase.source ?? "—"}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleDelete(purchase.id)}
                  aria-label="Delete purchase"
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
