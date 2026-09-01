"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteCard } from "@/lib/actions/card-actions";

export function DeleteCardButton({ cardId, cardName }: { cardId: string; cardName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${cardName}"? This also deletes its price history.`)) return;
    startTransition(async () => {
      await deleteCard(cardId);
      toast.success(`Deleted ${cardName}`);
      router.push("/");
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleDelete}>
      <Trash2 className="size-4" />
      Delete
    </Button>
  );
}
