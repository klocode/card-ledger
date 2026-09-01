"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCardsBulk } from "@/lib/actions/card-actions";
import type { BulkEditCardsInput } from "@/lib/validations/card";

type FieldKey = "game" | "status" | "qty" | "targetPrice" | "finish" | "group" | "tags";

const NO_FIELDS: Record<FieldKey, boolean> = {
  game: false,
  status: false,
  qty: false,
  targetPrice: false,
  finish: false,
  group: false,
  tags: false,
};

const EMPTY_VALUES = {
  game: "",
  status: "WATCHING" as "OWNED" | "WATCHING",
  qty: "",
  targetPrice: "",
  finish: "",
  group: "",
  tagsMode: "add" as "add" | "remove" | "replace",
  tagsInput: "",
};

/** A row that stays disabled — and so untouched by the save — until ticked. */
function FieldRow({
  id,
  label,
  enabled,
  onEnabledChange,
  hint,
  children,
}: {
  id: string;
  label: string;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_9rem_1fr] items-center gap-3">
      <Checkbox
        id={`enable-${id}`}
        checked={enabled}
        onCheckedChange={(v) => onEnabledChange(v === true)}
        aria-label={`Change ${label}`}
      />
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <div className={enabled ? "" : "pointer-events-none opacity-40"}>
        {children}
        {enabled && hint && (
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        )}
      </div>
    </div>
  );
}

export function BulkEditDialog({
  ids,
  onDone,
}: {
  ids: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(NO_FIELDS);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [isPending, startTransition] = useTransition();

  const count = ids.length;
  const anyField = Object.values(fields).some(Boolean);

  function setField(key: FieldKey, next: boolean) {
    setFields((prev) => ({ ...prev, [key]: next }));
  }

  function setValue<K extends keyof typeof EMPTY_VALUES>(
    key: K,
    next: (typeof EMPTY_VALUES)[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Each pass starts from "change nothing" so a stale tick can't sneak
    // through on the next edit.
    if (!next) {
      setFields(NO_FIELDS);
      setValues(EMPTY_VALUES);
    }
  }

  function buildInput(): BulkEditCardsInput | string {
    const input: BulkEditCardsInput = { ids };

    if (fields.game) {
      if (!values.game.trim()) return "Game can't be empty.";
      input.game = values.game.trim();
    }
    if (fields.status) input.status = values.status;
    if (fields.qty) {
      const raw = values.qty.trim();
      if (!raw) input.qty = null;
      else {
        const qty = Number(raw);
        if (!Number.isInteger(qty) || qty < 1) return "Quantity must be a whole number of 1 or more.";
        input.qty = qty;
      }
    }
    if (fields.targetPrice) {
      const raw = values.targetPrice.trim();
      if (!raw) input.targetPrice = null;
      else {
        const price = Number(raw);
        if (!Number.isFinite(price) || price <= 0) return "Target price must be greater than 0.";
        input.targetPrice = price;
      }
    }
    if (fields.finish) input.finish = values.finish.trim() || null;
    if (fields.group) input.group = values.group.trim() || null;
    if (fields.tags) {
      const tagValues = values.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagValues.length === 0 && values.tagsMode !== "replace") {
        return "Enter at least one tag, or use Replace with to clear tags.";
      }
      input.tags = { mode: values.tagsMode, values: tagValues };
    }

    return input;
  }

  function handleSave() {
    const input = buildInput();
    if (typeof input === "string") {
      toast.error(input);
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateCardsBulk(input);
        if (result.errors.length > 0) {
          toast.warning(
            `Updated ${result.updated} card${result.updated === 1 ? "" : "s"}, ${result.errors.length} failed.`,
            { description: result.errors.map((e) => `${e.name}: ${e.reason}`).join("\n") }
          );
        } else {
          toast.success(
            `Updated ${result.updated} card${result.updated === 1 ? "" : "s"}`
          );
        }
        handleOpenChange(false);
        onDone();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update cards");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Edit {count} card{count === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Tick a field to change it on every selected card. Unticked fields are
            left alone; a ticked field left blank clears it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FieldRow
            id="bulk-game"
            label="Game"
            enabled={fields.game}
            onEnabledChange={(v) => setField("game", v)}
          >
            <Input
              id="bulk-game"
              value={values.game}
              onChange={(e) => setValue("game", e.target.value)}
              placeholder="MTG"
              disabled={!fields.game}
            />
          </FieldRow>

          <FieldRow
            id="bulk-status"
            label="Status"
            enabled={fields.status}
            onEnabledChange={(v) => setField("status", v)}
          >
            <Select
              value={values.status}
              onValueChange={(v) => setValue("status", v as "OWNED" | "WATCHING")}
              disabled={!fields.status}
            >
              <SelectTrigger id="bulk-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WATCHING">Watching</SelectItem>
                <SelectItem value="OWNED">Owned</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow
            id="bulk-qty"
            label="Quantity"
            enabled={fields.qty}
            onEnabledChange={(v) => setField("qty", v)}
            hint="Only shown for owned cards. Blank clears it."
          >
            <Input
              id="bulk-qty"
              type="number"
              min={1}
              step={1}
              value={values.qty}
              onChange={(e) => setValue("qty", e.target.value)}
              disabled={!fields.qty}
            />
          </FieldRow>

          <FieldRow
            id="bulk-target"
            label="Target buy price"
            enabled={fields.targetPrice}
            onEnabledChange={(v) => setField("targetPrice", v)}
            hint="Only used for watched cards. Blank clears it."
          >
            <Input
              id="bulk-target"
              type="number"
              min={0}
              step="0.01"
              value={values.targetPrice}
              onChange={(e) => setValue("targetPrice", e.target.value)}
              disabled={!fields.targetPrice}
            />
          </FieldRow>

          <FieldRow
            id="bulk-finish"
            label="Finish"
            enabled={fields.finish}
            onEnabledChange={(v) => setField("finish", v)}
          >
            <Input
              id="bulk-finish"
              value={values.finish}
              onChange={(e) => setValue("finish", e.target.value)}
              placeholder="nonfoil"
              disabled={!fields.finish}
            />
          </FieldRow>

          <FieldRow
            id="bulk-group"
            label="Group"
            enabled={fields.group}
            onEnabledChange={(v) => setField("group", v)}
          >
            <Input
              id="bulk-group"
              value={values.group}
              onChange={(e) => setValue("group", e.target.value)}
              placeholder="Commander deck"
              disabled={!fields.group}
            />
          </FieldRow>

          <FieldRow
            id="bulk-tags"
            label="Tags"
            enabled={fields.tags}
            onEnabledChange={(v) => setField("tags", v)}
            hint={
              values.tagsMode === "replace"
                ? "Existing tags are dropped; blank removes all tags."
                : undefined
            }
          >
            <div className="flex gap-2">
              <Select
                value={values.tagsMode}
                onValueChange={(v) =>
                  setValue("tagsMode", v as "add" | "remove" | "replace")
                }
                disabled={!fields.tags}
              >
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="remove">Remove</SelectItem>
                  <SelectItem value="replace">Replace with</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="bulk-tags"
                value={values.tagsInput}
                onChange={(e) => setValue("tagsInput", e.target.value)}
                placeholder="chase, reprint-risk"
                disabled={!fields.tags}
              />
            </div>
          </FieldRow>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending || !anyField}>
            {isPending
              ? "Saving…"
              : `Apply to ${count} card${count === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
