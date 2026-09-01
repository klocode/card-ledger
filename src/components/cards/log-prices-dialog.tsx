"use client";

import { Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { logPrices } from "@/lib/actions/price-actions";
import { parseImportCsv } from "@/lib/csv";

export function LogPricesDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleImport() {
    const { rows, errors } = parseImportCsv(text);
    if (rows.length === 0) {
      toast.error(errors[0] ?? "No valid rows found in pasted CSV.");
      return;
    }

    startTransition(async () => {
      const result = await logPrices(rows);
      const summary = [`Logged ${result.imported} price${result.imported === 1 ? "" : "s"}.`];
      if (result.skipped.length > 0) summary.push(`${result.skipped.length} skipped.`);
      if (errors.length > 0) summary.push(`${errors.length} row(s) had parse errors.`);

      if (result.skipped.length > 0 || errors.length > 0) {
        toast.warning(summary.join(" "), {
          description: [
            ...errors,
            ...result.skipped.map((s) => `${s.name}: ${s.reason}`),
          ].join("\n"),
        });
      } else {
        toast.success(summary.join(" "));
      }
      setText("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" />
          Log prices
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log prices</DialogTitle>
          <DialogDescription>
            Paste CSV from track_prices.py (Name, Price, Date, Source) — or a full
            Export CSV — to log prices in bulk.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Name,Price,Date,Source\nWrenn and Six,18.50,2026-08-23,Scryfall"}
          rows={10}
          className="max-h-[40dvh] overflow-y-auto font-mono text-xs"
        />
        <DialogFooter>
          <Button onClick={handleImport} disabled={isPending || !text.trim()}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
