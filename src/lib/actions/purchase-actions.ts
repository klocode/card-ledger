"use server";

import { revalidatePath } from "next/cache";

import { syncCardFromAcquisitions } from "@/lib/card-ownership";
import { db } from "@/lib/db";
import {
  createPurchaseSchema,
  type CreatePurchaseInput,
} from "@/lib/validations/purchase";

export type AddPurchaseResult = {
  purchase: { id: string; qty: number; unitPrice: number };
  /** Set when this buy flipped the card out of WATCHING, so the UI can say so. */
  becameOwned: boolean;
  /** Cost-vs-target verdict, or null when the card had no target set. */
  target: { beat: boolean; difference: number } | null;
};

export async function addPurchase(
  input: CreatePurchaseInput
): Promise<AddPurchaseResult> {
  const data = createPurchaseSchema.parse(input);

  const card = await db.card.findUnique({
    where: { id: data.cardId },
    select: { status: true, targetPrice: true },
  });
  if (!card) throw new Error("Card not found.");

  const purchase = await db.purchase.create({
    data: {
      cardId: data.cardId,
      qty: data.qty,
      unitPrice: data.unitPrice,
      date: new Date(data.date),
      source: data.source?.trim() || null,
      fees: data.fees ?? null,
      notes: data.notes?.trim() || null,
    },
  });

  await syncCardFromAcquisitions(data.cardId);

  revalidatePath("/");
  revalidatePath(`/cards/${data.cardId}`);

  return {
    purchase: {
      id: purchase.id,
      qty: purchase.qty,
      unitPrice: purchase.unitPrice,
    },
    becameOwned: card.status === "WATCHING",
    target:
      card.targetPrice == null
        ? null
        : {
            beat: data.unitPrice <= card.targetPrice,
            difference: data.unitPrice - card.targetPrice,
          },
  };
}

export async function deletePurchase(id: string) {
  const purchase = await db.purchase.delete({ where: { id } });
  await syncCardFromAcquisitions(purchase.cardId);
  revalidatePath("/");
  revalidatePath(`/cards/${purchase.cardId}`);
  return purchase;
}
