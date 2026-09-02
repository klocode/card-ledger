"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  addPulls,
  previewPulls,
  type PullPreviewRow,
} from "@/lib/actions/pack-actions";
import { formatCurrency, formatSignedCurrency } from "@/lib/cost-basis";
import { NOTABLE_PULL_THRESHOLD } from "@/lib/pack-value";

type Row = PullPreviewRow & {
  /** Unticked rows aren't saved. */
  include: boolean;
  /** Editable so a missing or wrong price can be corrected before saving. */
  priceText: string;
};

/**
 * Turn a pasted pack into priced pulls.
 *
 * Prices are fetched at preview so the $1 rule lands on real numbers: anything
 * under the threshold arrives unticked, which applies the convention by
 * default while leaving it a decision rather than a filter you can't see past.
 */
export function AddPullsDialog({
  openingId,
  game,
  packCost,
}: {
  openingId: string;
  game: string;
  packCost: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPricing, startPricing] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const chosen = rows?.filter((r) => r.include) ?? [];
  const chosenValue = chosen.reduce((sum, r) => {
    const price = Number(r.priceText);
    return sum + (r.priceText.trim() && !Number.isNaN(price) ? price * r.qty : 0);
  }, 0);

  function reset() {
    setText("");
    setRows(null);
    setErrors([]);
  }

  function handlePreview() {
    if (!text.trim()) {
      toast.error("Paste the cards you pulled first.");
      return;
    }
    startPricing(async () => {
      try {
        const result = await previewPulls({ text, game });
        if (result.rows.length === 0) {
          toast.error("Couldn't read any cards out of that.");
          setErrors(result.errors);
          return;
        }
        setRows(
          result.rows.map((row) => ({
            ...row,
            include: row.price == null || row.price >= NOTABLE_PULL_THRESHOLD,
            priceText: row.price != null ? row.price.toFixed(2) : "",
          }))
        );
        setErrors(result.errors);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not price those pulls."
        );
      }
    });
  }

  function handleSave() {
    if (chosen.length === 0) {
      toast.error("Tick at least one pull to save.");
      return;
    }
    startSaving(async () => {
      try {
        const result = await addPulls({
          openingId,
          pulls: chosen.map((row) => {
            const price = Number(row.priceText);
            return {
              cardId: row.cardId,
              name: row.name,
              game,
              printing: row.printing,
              finish: row.finish,
              qty: row.qty,
              valueAtOpen:
                row.priceText.trim() && !Number.isNaN(price) && price >= 0
                  ? price
                  : null,
            };
          }),
        });

        const net = result.valueAdded - packCost;
        toast.success(
          `${result.added} pull${result.added === 1 ? "" : "s"} added${
            result.cardsCreated
              ? `, ${result.cardsCreated} new card${result.cardsCreated === 1 ? "" : "s"} tracked`
              : ""
          } — ${formatCurrency(result.valueAdded)} against a ${formatCurrency(packCost)} pack (${formatSignedCurrency(net)})`
        );
        reset();
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save those pulls."
        );
      }
    });
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev
        ? prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
        : prev
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="size-4" />
          Add pulls
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add pulls</DialogTitle>
        </DialogHeader>

        {rows === null ? (
          <div className="grid gap-3">
            <Label htmlFor="pull-text">What came out of the pack?</Label>
            <Textarea
              id="pull-text"
              rows={8}
              placeholder={"1 Ragavan, Nimble Pilferer (MH2) 138 *F*\n1 Sol Ring (LTC) 273\nUrza's Saga"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              One card per line — a deck-list line, an export row, or just a
              name.{" "}
              {game.toLowerCase() === "mtg"
                ? `Each gets priced from Scryfall, and anything under ${formatCurrency(NOTABLE_PULL_THRESHOLD)} arrives unticked.`
                : `Scryfall only prices Magic, so you'll enter ${game} values by hand on the next step.`}
            </p>
          </div>
        ) : (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto">
            {rows.map((row, index) => (
              <div
                key={`${row.name}-${index}`}
                className="flex items-center gap-3 text-sm"
              >
                <Checkbox
                  checked={row.include}
                  onCheckedChange={(checked) =>
                    update(index, { include: checked === true })
                  }
                  aria-label={`Include ${row.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    {row.qty > 1 && (
                      <span className="text-muted-foreground">{row.qty}× </span>
                    )}
                    {row.name}
                    {row.cardId && (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        · already tracked
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {[row.printing, row.finish].filter(Boolean).join(" · ") ||
                      "no printing"}
                    {row.ambiguous && " · several cards share this name"}
                    {row.priceNote && ` · ${row.priceNote}`}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-24"
                  placeholder="price"
                  value={row.priceText}
                  onChange={(e) => update(index, { priceText: e.target.value })}
                  aria-label={`Value of ${row.name} at open`}
                />
              </div>
            ))}

            {errors.length > 0 && (
              <div className="text-muted-foreground text-xs">
                {errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <p className="text-sm">
              <span className="text-muted-foreground">
                {chosen.length} of {rows.length} ticked —{" "}
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrency(chosenValue)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                against a {formatCurrency(packCost)} pack:{" "}
              </span>
              <span
                className={`font-medium tabular-nums ${
                  chosenValue - packCost >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {formatSignedCurrency(chosenValue - packCost)}
              </span>
            </p>
          </div>
        )}

        <DialogFooter>
          {rows === null ? (
            <Button onClick={handlePreview} disabled={isPricing}>
              {isPricing ? "Pricing…" : "Price them"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setRows(null)}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : `Save ${chosen.length} pull${chosen.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
