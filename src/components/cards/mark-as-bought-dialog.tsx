"use client";

import { ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addPurchase } from "@/lib/actions/purchase-actions";
import { compareToTarget, formatCurrency } from "@/lib/cost-basis";

/**
 * Capture what a card actually cost, at the moment it's bought.
 *
 * Prefilled with today and the latest logged market price, because the common
 * case is buying at roughly the price you were just watching — the point is
 * that recording a buy costs one click, not that every field gets retyped.
 */
export function MarkAsBoughtDialog({
  cardId,
  cardName,
  status,
  targetPrice,
  latestPrice,
}: {
  cardId: string;
  cardName: string;
  status: "OWNED" | "WATCHING";
  targetPrice: number | null;
  latestPrice: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState(
    latestPrice != null ? latestPrice.toFixed(2) : ""
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [fees, setFees] = useState("");
  const [isPending, startTransition] = useTransition();

  // Live verdict against the target, so the comparison lands while the number
  // can still be reconsidered rather than only in the toast afterwards.
  const parsedUnitPrice = Number(unitPrice);
  const verdict =
    unitPrice.trim() && !Number.isNaN(parsedUnitPrice)
      ? compareToTarget(parsedUnitPrice, targetPrice)
      : null;

  function reset() {
    setQty("1");
    setUnitPrice(latestPrice != null ? latestPrice.toFixed(2) : "");
    setDate(new Date().toISOString().slice(0, 10));
    setSource("");
    setFees("");
  }

  function handleSubmit() {
    const parsedQty = Number(qty);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      toast.error("Quantity must be a whole number of at least 1.");
      return;
    }
    if (!unitPrice.trim() || Number.isNaN(parsedUnitPrice) || parsedUnitPrice < 0) {
      toast.error("Enter what you paid per copy.");
      return;
    }
    const parsedFees = fees.trim() ? Number(fees) : null;
    if (parsedFees != null && (Number.isNaN(parsedFees) || parsedFees < 0)) {
      toast.error("Fees must be a positive amount.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await addPurchase({
          cardId,
          qty: parsedQty,
          unitPrice: parsedUnitPrice,
          date,
          source: source.trim() || null,
          fees: parsedFees,
        });

        const detail = result.target
          ? result.target.beat
            ? ` — ${formatCurrency(Math.abs(result.target.difference))} under target`
            : ` — ${formatCurrency(result.target.difference)} over target`
          : "";
        toast.success(
          `${result.becameOwned ? "Marked as bought" : "Purchase added"}: ${parsedQty}× ${cardName} at ${formatCurrency(parsedUnitPrice)}${detail}`
        );

        reset();
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not record the purchase."
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={status === "WATCHING" ? "default" : "outline"} size="sm">
          <ShoppingCart className="size-4" />
          {status === "WATCHING" ? "Mark as bought" : "Add purchase"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {status === "WATCHING" ? "Mark as bought" : "Add a purchase"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="buy-qty">Quantity</Label>
              <Input
                id="buy-qty"
                type="number"
                min={1}
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="buy-unit-price">Price paid each</Label>
              <Input
                id="buy-unit-price"
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>

          {verdict && targetPrice != null && (
            <p
              className={`-mt-2 text-xs ${verdict.beat ? "text-gain" : "text-loss"}`}
            >
              {verdict.beat
                ? `${formatCurrency(Math.abs(verdict.difference))} under your ${formatCurrency(targetPrice)} target`
                : `${formatCurrency(verdict.difference)} over your ${formatCurrency(targetPrice)} target`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="buy-date">Date</Label>
              <Input
                id="buy-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="buy-fees">Shipping / tax</Label>
              <Input
                id="buy-fees"
                type="number"
                min={0}
                step="0.01"
                placeholder="optional"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="buy-source">Bought from</Label>
            <Input
              id="buy-source"
              placeholder="TCGplayer, local shop, trade…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          {status === "WATCHING" && (
            <p className="text-muted-foreground text-xs">
              This will move {cardName} from Watching to Owned.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
