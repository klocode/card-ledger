"use server";

import { revalidatePath } from "next/cache";

import type { BulkRefetchRow } from "@/lib/actions/price-actions";
import { db } from "@/lib/db";
import { isNotableMove, rankMoves, toMoves } from "@/lib/price-moves";

export type SkippedCard = { name: string; reason: string };

export type RecordedRun = { id: string; notable: number; ownedValueChange: number };

/**
 * Write the day's report from the rows a "fetch all" produced.
 *
 * One report per day, replacing any earlier one: the run itself overwrites the
 * day's prices rather than appending to them, so a second run is a corrected
 * view of the same day and two reports for it would just disagree. Moves are
 * cascaded away with the old run, then rewritten from the newer numbers.
 *
 * Partial runs are recorded too — whatever prices landed are already in the
 * ledger, and a report that omits them would be the inaccurate one.
 */
export async function recordPriceRun(
  rows: BulkRefetchRow[]
): Promise<RecordedRun | null> {
  if (rows.length === 0) return null;

  const ok = rows.filter((row): row is Extract<BulkRefetchRow, { ok: true }> => row.ok);
  const failed = rows.filter(
    (row): row is Extract<BulkRefetchRow, { ok: false }> => !row.ok
  );

  const moves = toMoves(ok);
  const notable = rankMoves(moves.filter(isNotableMove));

  // Printing/finish are denormalised onto the move, and qty/status decide what
  // the day did to the value of what's actually owned.
  const cards = await db.card.findMany({
    where: { id: { in: ok.map((row) => row.id) } },
    select: { id: true, printing: true, finish: true, qty: true, status: true },
  });
  const cardById = new Map(cards.map((card) => [card.id, card]));

  const ownedValueChange = moves.reduce((total, move) => {
    const card = cardById.get(move.cardId);
    if (!card || card.status !== "OWNED") return total;
    return total + move.delta * (card.qty ?? 1);
  }, 0);

  const today = new Date(new Date().toISOString().slice(0, 10));
  const skippedDetail: SkippedCard[] = failed.map((row) => ({
    name: row.name,
    reason: row.reason,
  }));

  await db.priceRun.deleteMany({ where: { date: today } });
  const run = await db.priceRun.create({
    data: {
      date: today,
      checked: rows.length,
      logged: ok.length,
      skipped: failed.length,
      firstTime: ok.filter((row) => row.previous == null).length,
      risers: moves.filter((move) => move.delta > 0).length,
      fallers: moves.filter((move) => move.delta < 0).length,
      ownedValueChange,
      skippedDetail,
      moves: {
        create: notable.map((move) => {
          const card = cardById.get(move.cardId);
          return {
            cardId: move.cardId,
            name: move.name,
            printing: card?.printing ?? null,
            finish: card?.finish ?? null,
            price: move.price,
            previous: move.previous,
            delta: move.delta,
            pct: move.pct,
          };
        }),
      },
    },
    select: { id: true },
  });

  revalidatePath("/reports");
  return { id: run.id, notable: notable.length, ownedValueChange };
}

export type PriceRunReport = Awaited<ReturnType<typeof listPriceRuns>>[number];

/**
 * Reports newest first, each with its moves already ordered biggest-swing
 * first so the page can render them straight through.
 */
export async function listPriceRuns(limit = 60) {
  const runs = await db.priceRun.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { moves: true },
  });

  return runs.map((run) => ({
    ...run,
    moves: rankMoves(run.moves),
    skippedDetail: parseSkipped(run.skippedDetail),
  }));
}

/** The column is free-form JSON to SQLite, so it's checked rather than trusted. */
function parseSkipped(value: unknown): SkippedCard[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is SkippedCard =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as SkippedCard).name === "string" &&
      typeof (entry as SkippedCard).reason === "string"
  );
}
