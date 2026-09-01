"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { BulkEditDialog } from "@/components/cards/bulk-edit-dialog";
import { Button } from "@/components/ui/button";
import { deleteCardsBulk } from "@/lib/actions/card-actions";

export function BulkActionsBar({
  ids,
  onClear,
}: {
  ids: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const count = ids.length;
  const label = `${count} card${count === 1 ? "" : "s"}`;

  function handleDelete() {
    if (!confirm(`Delete ${label}? This also deletes their price history.`)) return;
    startTransition(async () => {
      try {
        const { deleted } = await deleteCardsBulk(ids);
        toast.success(`Deleted ${deleted} card${deleted === 1 ? "" : "s"}`);
        onClear();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete cards");
      }
    });
  }

  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
      <span className="text-sm font-medium" aria-live="polite">
        {label} selected
      </span>
      <div className="ml-auto flex gap-2">
        <BulkEditDialog ids={ids} onDone={onClear} />
        <Button variant="outline" size="sm" disabled={isPending} onClick={handleDelete}>
          <Trash2 className="size-4" />
          {isPending ? "Deleting…" : "Delete"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
