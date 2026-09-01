"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  createPurchaseSchema,
  type CreatePurchaseInput,
} from "@/lib/validations/purchase";

/**
 * Re-derive the card's owned quantity from its lots.
 *
 * `Card.qty` predates purchases and is still hand-editable (bulk edit, the
 * edit dialog, CSV import all write it), so this keeps one narrow rule rather
 * than ripping the column out: *while a card has lots, they are the truth* —
 * qty is their sum and the card is OWNED. Deleting the last lot leaves qty and
 * status exactly as they were, since "I removed a receipt" is not the same
 * statement as "I no longer own this", and silently flipping a card back to
 * WATCHING would lose a quantity the user may have typed in by hand.
 */
async function syncCardFromLots(cardId: string) {
  const lots = await db.purchase.findMany({
    where: { cardId },
    select: { qty: true },
  });
  if (lots.length === 0) return;

  await db.card.update({
    where: { id: cardId },
    data: {
      qty: lots.reduce((sum, lot) => sum + lot.qty, 0),
      status: "OWNED",
    },
  });
}

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

  await syncCardFromLots(data.cardId);

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
  await syncCardFromLots(purchase.cardId);
  revalidatePath("/");
  revalidatePath(`/cards/${purchase.cardId}`);
  return purchase;
}
