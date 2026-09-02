import { db } from "@/lib/db";

/**
 * Re-derive the card's owned quantity from everything that acquired it.
 *
 * `Card.qty` predates purchases and is still hand-editable (bulk edit, the
 * edit dialog, CSV import all write it), so this keeps one narrow rule rather
 * than ripping the column out: *while a card has lots or pulls, they are the
 * truth* — qty is their sum and the card is OWNED. Removing the last one
 * leaves qty and status exactly as they were, since "I removed a receipt" is
 * not the same statement as "I no longer own this", and silently flipping a
 * card back to WATCHING would lose a quantity the user may have typed by hand.
 *
 * Pulls count alongside purchases because a card out of a pack is a card you
 * own; leaving them out would make the collection quietly understate itself.
 * They carry no cost basis, though — see `computeCostBasis`, which is
 * deliberately blind to them.
 *
 * Lives outside the action files so both can call it: an export from a
 * "use server" module becomes a client-callable endpoint, and this is
 * internal bookkeeping, not an action.
 */
export async function syncCardFromAcquisitions(cardId: string) {
  const [lots, pulls] = await Promise.all([
    db.purchase.findMany({ where: { cardId }, select: { qty: true } }),
    db.pull.findMany({ where: { cardId }, select: { qty: true } }),
  ]);
  if (lots.length === 0 && pulls.length === 0) return;

  const qty = [...lots, ...pulls].reduce((sum, row) => sum + row.qty, 0);
  await db.card.update({
    where: { id: cardId },
    data: { qty, status: "OWNED" },
  });
}
