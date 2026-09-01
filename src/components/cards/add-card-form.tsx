"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CardFormFields } from "@/components/cards/card-form-fields";
import { Button } from "@/components/ui/button";
import { createCard } from "@/lib/actions/card-actions";
import {
  buildCardPayload,
  CARD_FORM_DEFAULTS,
  type CardFormValues,
} from "@/lib/card-form";

export function AddCardForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"OWNED" | "WATCHING">("WATCHING");
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm<CardFormValues>({
    defaultValues: CARD_FORM_DEFAULTS,
  });

  function onSubmit(values: CardFormValues) {
    if (!values.name.trim() || !values.game.trim()) {
      toast.error("Name and Game are required.");
      return;
    }
    startTransition(async () => {
      try {
        const card = await createCard(buildCardPayload(values, status));
        toast.success(`Added ${card.name}`);
        router.push(`/cards/${card.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add card");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <CardFormFields register={register} status={status} onStatusChange={setStatus} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add card"}
        </Button>
      </div>
    </form>
  );
}
