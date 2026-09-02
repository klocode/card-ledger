"use client";

import { PackageOpen } from "lucide-react";
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
import { openPack } from "@/lib/actions/pack-actions";
import { formatCurrency } from "@/lib/cost-basis";

/**
 * Log a pack out of a buy. Recording the opening and recording the pulls are
 * separate steps on purpose — you crack the pack, then work out what's in it,
 * and an opening with nothing in it yet is a real state worth persisting
 * rather than a form to abandon halfway.
 */
export function OpenPackDialog({
  purchaseId,
  packCost,
  remaining,
}: {
  purchaseId: string;
  packCost: number;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      try {
        const result = await openPack({
          purchaseId,
          date,
          notes: notes.trim() || null,
        });
        toast.success(
          `Opened pack ${result.packNumber} of ${result.packCount} — ${formatCurrency(result.packCost)} to beat.`
        );
        setNotes("");
        setDate(new Date().toISOString().slice(0, 10));
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not record the opening."
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={remaining <= 0}>
          <PackageOpen className="size-4" />
          {remaining > 0 ? "Open a pack" : "All opened"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a pack</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <p className="text-muted-foreground text-sm">
            {remaining} pack{remaining === 1 ? "" : "s"} left from this buy, at{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatCurrency(packCost)}
            </span>{" "}
            each. Add the pulls once it&rsquo;s open.
          </p>

          <div className="grid gap-1.5">
            <Label htmlFor="open-date">Opened on</Label>
            <Input
              id="open-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="open-notes">Notes</Label>
            <Input
              id="open-notes"
              placeholder="optional — stream opening, birthday pack…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Opening…" : "Open pack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
