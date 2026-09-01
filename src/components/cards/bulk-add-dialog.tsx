"use client";

import { FileUp, ListPlus } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCardsBulk } from "@/lib/actions/card-actions";
import { parseBulkAddInput } from "@/lib/bulk-add";

const PLACEHOLDER =
  "Name,Game,Printing,Finish,Status,Target\n" +
  "Wrenn and Six,MTG,MH1 #212,nonfoil,Watching,15\n" +
  "\n— or a text list —\n\n" +
  "1 Wrenn and Six (MH1) 212\n" +
  "2 Ragavan, Nimble Pilferer (MH2) 138 *F*\n" +
  "Lightning Bolt";

export function BulkAddDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"OWNED" | "WATCHING">("WATCHING");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(
    () => (text.trim() ? parseBulkAddInput(text, { status }) : null),
    [text, status]
  );

  async function loadFile(file: File) {
    try {
      setText(await file.text());
    } catch {
      toast.error(`Could not read ${file.name}.`);
    }
  }

  function handleImport() {
    const parsed = parseBulkAddInput(text, { status });
    const { rows, errors } = parsed;
    if (rows.length === 0) {
      toast.error(errors[0] ?? "No cards found in the pasted text.");
      return;
    }

    startTransition(async () => {
      const result = await createCardsBulk(rows);
      const summary = [`Added ${result.created} card${result.created === 1 ? "" : "s"}.`];
      if (result.errors.length > 0) summary.push(`${result.errors.length} failed.`);
      if (errors.length > 0) summary.push(`${errors.length} line(s) had parse errors.`);

      if (result.errors.length > 0 || errors.length > 0) {
        toast.warning(summary.join(" "), {
          description: [
            ...errors,
            ...result.errors.map((e) => `${e.name}: ${e.reason}`),
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
          <ListPlus className="size-4" />
          Bulk add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk add cards</DialogTitle>
          <DialogDescription>
            Paste, drop or upload a CSV (an Export CSV works, or just a Name column) —
            or a plain text list like a Moxfield export (
            <code className="font-mono">1 Wrenn and Six (MH1) 212 *F*</code>). The
            format is detected for you; only a name is required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end justify-between gap-4">
          <div className="grid gap-1.5">
            <Label>Status for new cards</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "OWNED" | "WATCHING")}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WATCHING">Watching</SelectItem>
                <SelectItem value="OWNED">Owned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="size-4" />
            Upload file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.dec,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadFile(file);
              // Reset so picking the same file twice still fires onChange.
              e.target.value = "";
            }}
          />
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const file = e.dataTransfer.files?.[0];
            if (file) {
              e.preventDefault();
              void loadFile(file);
            }
          }}
          placeholder={PLACEHOLDER}
          rows={10}
          // The textarea is field-sizing-content, so a long list would grow it
          // (and the dialog) past the viewport; cap it and let it scroll itself.
          className="max-h-[40dvh] overflow-y-auto font-mono text-xs"
        />

        {preview && (
          <p className="text-muted-foreground text-xs">
            {preview.format === "csv" ? "CSV" : "Text list"} detected —{" "}
            {preview.rows.length} card{preview.rows.length === 1 ? "" : "s"} ready
            {preview.errors.length > 0
              ? `, ${preview.errors.length} line${preview.errors.length === 1 ? "" : "s"} skipped`
              : ""}
            .
            {status === "WATCHING" && preview.format === "list"
              ? " Quantities are ignored for watched cards."
              : ""}
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={handleImport}
            disabled={isPending || !preview || preview.rows.length === 0}
          >
            {isPending ? "Adding…" : "Add cards"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
