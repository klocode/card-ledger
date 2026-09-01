"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CardFormFields } from "@/components/cards/card-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateCard } from "@/lib/actions/card-actions";
import { buildCardPayload, type CardFormValues } from "@/lib/card-form";

export type EditableCard = {
  id: string;
  name: string;
  game: string;
  printing: string | null;
  finish: string | null;
  type: string | null;
  status: "OWNED" | "WATCHING";
  qty: number | null;
  targetPrice: number | null;
  group: string | null;
  tags: { name: string }[];
};

export function EditCardDialog({ card }: { card: EditableCard }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"OWNED" | "WATCHING">(card.status);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm<CardFormValues>({
    defaultValues: {
      name: card.name,
      game: card.game,
      printing: card.printing ?? "",
      finish: card.finish ?? "",
      type: card.type ?? "",
      qty: card.qty != null ? String(card.qty) : "",
      targetPrice: card.targetPrice != null ? String(card.targetPrice) : "",
      group: card.group ?? "",
      tagsInput: card.tags.map((t) => t.name).join(", "),
    },
  });

  function onSubmit(values: CardFormValues) {
    if (!values.name.trim() || !values.game.trim()) {
      toast.error("Name and Game are required.");
      return;
    }
    startTransition(async () => {
      try {
        await updateCard({ id: card.id, ...buildCardPayload(values, status) });
        toast.success("Card updated");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update card");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardFormFields register={register} status={status} onStatusChange={setStatus} />
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
