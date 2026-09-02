"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deletePackOpening,
  deletePull,
  deleteSealedProduct,
  deleteSealedPurchase,
} from "@/lib/actions/pack-actions";

type Target = "product" | "purchase" | "opening" | "pull";

const ACTIONS: Record<Target, (id: string) => Promise<unknown>> = {
  product: deleteSealedProduct,
  purchase: deleteSealedPurchase,
  opening: deletePackOpening,
  pull: deletePull,
};

/**
 * One button for every level of the pack ledger, because the four deletes
 * differ only in which action they call and what they warn about taking with
 * them — four near-identical components would drift.
 *
 * `confirmText` is required rather than generated: a delete that cascades
 * needs to say what else goes, and only the caller knows how much that is.
 */
export function DeletePackButton({
  target,
  id,
  confirmText,
  successText,
  redirectTo,
  label,
}: {
  target: Target;
  id: string;
  confirmText: string;
  successText: string;
  /** Where to go afterwards, when the deleted thing owns the current page. */
  redirectTo?: string;
  /**
   * Visible text. Omit or pass "" for an icon-only button, used where a worded
   * one would crowd; the accessible name falls back either way.
   */
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      try {
        await ACTIONS[target](id);
        toast.success(successText);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete that."
        );
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={handleDelete}
      // `||`, not `??`: an icon-only button passes label="" and an empty
      // string is not nullish, so `??` would leave it with no accessible name
      // at all — a delete control invisible to a screen reader.
      aria-label={label || `Delete ${target}`}
      className="text-muted-foreground hover:text-loss"
    >
      <Trash2 className="size-4" />
      {label}
    </Button>
  );
}
