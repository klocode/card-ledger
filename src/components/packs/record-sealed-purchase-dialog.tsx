"use client";

import { PackagePlus } from "lucide-react";
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
import { recordSealedPurchase } from "@/lib/actions/pack-actions";
import { formatCurrency } from "@/lib/cost-basis";

/**
 * Record a sealed buy — a box, or a single pack as a box of one.
 *
 * The product is typed, not picked from a dropdown, with a datalist of what
 * already exists: the action matches case-insensitively, so re-typing a
 * product you've bought before joins it rather than forking a second ledger.
 */
export function RecordSealedPurchaseDialog({
  products,
  games,
  sets,
}: {
  products: { name: string; game: string; setName: string | null }[];
  games: string[];
  sets: string[];
}) {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [game, setGame] = useState(games[0] ?? "MTG");
  const [setName, setSetName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [packCount, setPackCount] = useState("12");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [isPending, startTransition] = useTransition();

  // The number that actually matters, shown while it can still be reconsidered.
  const parsedCount = Number(packCount);
  const parsedPrice = Number(unitPrice);
  const parsedFees = fees.trim() ? Number(fees) : 0;
  const perPack =
    parsedCount > 0 &&
    Number.isFinite(parsedCount) &&
    Number.isFinite(parsedPrice) &&
    unitPrice.trim() &&
    Number.isFinite(parsedFees)
      ? (parsedPrice * parsedCount + parsedFees) / parsedCount
      : null;

  const match = products.find(
    (p) =>
      p.name.toLowerCase() === productName.trim().toLowerCase() &&
      p.game.toLowerCase() === game.trim().toLowerCase()
  );

  function reset() {
    setProductName("");
    setSetName("");
    setSetCode("");
    setPackCount("12");
    setUnitPrice("");
    setFees("");
    setDate(new Date().toISOString().slice(0, 10));
    setSource("");
  }

  function handleSubmit() {
    if (!productName.trim()) {
      toast.error("Name the product — e.g. Marvel Collector Booster.");
      return;
    }
    if (!game.trim()) {
      toast.error("Which game is this?");
      return;
    }
    if (!Number.isInteger(parsedCount) || parsedCount < 1) {
      toast.error("Packs bought must be a whole number of at least 1.");
      return;
    }
    if (!unitPrice.trim() || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Enter what each pack cost.");
      return;
    }
    if (fees.trim() && (Number.isNaN(parsedFees) || parsedFees < 0)) {
      toast.error("Shipping must be a positive amount.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await recordSealedPurchase({
          productName: productName.trim(),
          game: game.trim(),
          setName: setName.trim() || null,
          setCode: setCode.trim().toUpperCase() || null,
          packCount: parsedCount,
          unitPrice: parsedPrice,
          fees: fees.trim() ? parsedFees : null,
          date,
          source: source.trim() || null,
        });

        toast.success(
          result.createdProduct
            ? `Started tracking ${result.productName} — ${parsedCount} pack${parsedCount === 1 ? "" : "s"} at ${formatCurrency(perPack ?? parsedPrice)} each`
            : `Added to ${result.productName} — ${result.packsBoughtForProduct} packs bought in total`
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
        <Button size="sm">
          <PackagePlus className="size-4" />
          Record a buy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a sealed buy</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pack-product">Product</Label>
            <Input
              id="pack-product"
              list="pack-product-options"
              placeholder="Marvel Collector Booster"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
            <datalist id="pack-product-options">
              {products.map((p) => (
                <option key={`${p.game}:${p.name}`} value={p.name} />
              ))}
            </datalist>
            <p className="text-muted-foreground text-xs">
              {match
                ? `Joins your existing ${match.name} ledger${match.setName ? ` under ${match.setName}` : ""}.`
                : productName.trim()
                  ? "New product — it gets its own ledger."
                  : "Repeat buys of the same product roll up together."}
            </p>
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pack-set">Set</Label>
              <Input
                id="pack-set"
                list="pack-set-options"
                placeholder="Edge of Eternities"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
              />
              <datalist id="pack-set-options">
                {sets.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pack-set-code">Set code</Label>
              <Input
                id="pack-set-code"
                placeholder="EOE"
                value={setCode}
                onChange={(e) => setSetCode(e.target.value)}
              />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            Optional, but it&rsquo;s what groups collector boosters, play
            boosters and boxes from one set under a shared total.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pack-game">Game</Label>
              <Input
                id="pack-game"
                list="pack-game-options"
                placeholder="MTG"
                value={game}
                onChange={(e) => setGame(e.target.value)}
              />
              <datalist id="pack-game-options">
                {games.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pack-count">Packs bought</Label>
              <Input
                id="pack-count"
                type="number"
                min={1}
                step="1"
                value={packCount}
                onChange={(e) => setPackCount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pack-unit-price">Price per pack</Label>
              <Input
                id="pack-unit-price"
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pack-fees">Shipping / tax</Label>
              <Input
                id="pack-fees"
                type="number"
                min={0}
                step="0.01"
                placeholder="optional"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pack-date">Date</Label>
              <Input
                id="pack-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {perPack != null && (
            <p className="-mt-2 text-xs">
              <span className="text-muted-foreground">All-in cost per pack:</span>{" "}
              <span className="font-medium tabular-nums">
                {formatCurrency(perPack)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                — this is what each pack has to beat.
              </span>
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="pack-source">Bought from</Label>
            <Input
              id="pack-source"
              placeholder="TCGplayer, local shop, preorder…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save buy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
