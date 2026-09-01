"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  bulkEditCardsSchema,
  createCardSchema,
  updateCardSchema,
  type BulkEditCardsInput,
  type CreateCardInput,
  type UpdateCardInput,
} from "@/lib/validations/card";

function tagsConnectOrCreate(tags: string[]) {
  return tags.map((name) => ({ where: { name }, create: { name } }));
}

function toCreateData(data: CreateCardInput) {
  return {
    name: data.name,
    game: data.game,
    printing: data.printing ?? null,
    finish: data.finish ?? null,
    type: data.type ?? null,
    status: data.status,
    qty: data.qty ?? null,
    targetPrice: data.targetPrice ?? null,
    group: data.group ?? null,
    tags: data.tags.length
      ? { connectOrCreate: tagsConnectOrCreate(data.tags) }
      : undefined,
  };
}

export type CardFilters = {
  game?: string;
  status?: "OWNED" | "WATCHING";
  group?: string;
  tag?: string;
};

export async function listCards(filters: CardFilters = {}) {
  const cards = await db.card.findMany({
    where: {
      ...(filters.game ? { game: filters.game } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.group ? { group: filters.group } : {}),
      ...(filters.tag ? { tags: { some: { name: filters.tag } } } : {}),
    },
    include: {
      tags: true,
      priceEntries: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  const withLatest = cards.map((card) => {
    const latestPrice = card.priceEntries[0]?.price ?? null;
    const distanceToTarget =
      card.status === "WATCHING" && latestPrice != null && card.targetPrice != null
        ? latestPrice - card.targetPrice
        : null;
    return { ...card, latestPrice, distanceToTarget };
  });

  withLatest.sort((a, b) => {
    if (a.status !== b.status) return a.status === "WATCHING" ? -1 : 1;
    if (a.status === "WATCHING") {
      if (a.distanceToTarget == null && b.distanceToTarget == null) {
        return a.name.localeCompare(b.name);
      }
      if (a.distanceToTarget == null) return 1;
      if (b.distanceToTarget == null) return -1;
      return a.distanceToTarget - b.distanceToTarget;
    }
    return a.name.localeCompare(b.name);
  });

  return withLatest;
}

export async function getCard(id: string) {
  return db.card.findUnique({
    where: { id },
    include: {
      tags: true,
      priceEntries: { orderBy: { date: "asc" } },
      purchases: { orderBy: { date: "asc" } },
    },
  });
}

export async function createCard(input: CreateCardInput) {
  const data = createCardSchema.parse(input);
  const card = await db.card.create({ data: toCreateData(data) });
  revalidatePath("/");
  return card;
}

export type CreateCardsBulkResult = {
  created: number;
  errors: { name: string; reason: string }[];
};

export async function createCardsBulk(
  inputs: CreateCardInput[]
): Promise<CreateCardsBulkResult> {
  let created = 0;
  const errors: { name: string; reason: string }[] = [];

  for (const input of inputs) {
    try {
      const data = createCardSchema.parse(input);
      await db.card.create({ data: toCreateData(data) });
      created++;
    } catch (err) {
      errors.push({
        name: input.name || "(unnamed)",
        reason: err instanceof Error ? err.message : "failed to create",
      });
    }
  }

  revalidatePath("/");
  return { created, errors };
}

export async function updateCard(input: UpdateCardInput) {
  const { id, tags, ...rest } = updateCardSchema.parse(input);
  const card = await db.card.update({
    where: { id },
    data: {
      ...rest,
      ...(tags !== undefined
        ? { tags: { set: [], connectOrCreate: tagsConnectOrCreate(tags) } }
        : {}),
    },
  });
  revalidatePath("/");
  revalidatePath(`/cards/${id}`);
  return card;
}

export type BulkEditResult = {
  updated: number;
  errors: { name: string; reason: string }[];
};

export async function updateCardsBulk(
  input: BulkEditCardsInput
): Promise<BulkEditResult> {
  const { ids, tags, ...fields } = bulkEditCardsSchema.parse(input);

  // Only the fields the user turned on are present; `null` clears a field, so
  // it has to survive the filter that drops "leave unchanged".
  const data = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(data).length === 0 && !tags) return { updated: 0, errors: [] };

  const errors: { name: string; reason: string }[] = [];
  let updated = 0;

  if (!tags) {
    const result = await db.card.updateMany({ where: { id: { in: ids } }, data });
    updated = result.count;
  } else {
    const tagData =
      tags.mode === "remove"
        ? { disconnect: tags.values.map((name) => ({ name })) }
        : {
            ...(tags.mode === "replace" ? { set: [] } : {}),
            ...(tags.values.length
              ? { connectOrCreate: tagsConnectOrCreate(tags.values) }
              : {}),
          };

    // Tag edits are per-card relation writes, so they can't ride along on a
    // single updateMany the way the scalar fields do.
    const targets = await db.card.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });

    for (const target of targets) {
      try {
        await db.card.update({
          where: { id: target.id },
          data: { ...data, tags: tagData },
        });
        updated++;
      } catch (err) {
        errors.push({
          name: target.name,
          reason: err instanceof Error ? err.message : "failed to update",
        });
      }
    }
  }

  revalidatePath("/");
  for (const id of ids) revalidatePath(`/cards/${id}`);
  return { updated, errors };
}

export async function deleteCardsBulk(ids: string[]) {
  if (ids.length === 0) return { deleted: 0 };
  const result = await db.card.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/");
  return { deleted: result.count };
}

export async function deleteCard(id: string) {
  await db.card.delete({ where: { id } });
  revalidatePath("/");
}

export async function getFilterOptions() {
  const cards = await db.card.findMany({
    select: { game: true, group: true, tags: { select: { name: true } } },
  });
  const games = Array.from(new Set(cards.map((c) => c.game))).sort();
  const groups = Array.from(
    new Set(cards.map((c) => c.group).filter((g): g is string => !!g))
  ).sort();
  const tags = Array.from(
    new Set(cards.flatMap((c) => c.tags.map((t) => t.name)))
  ).sort();
  return { games, groups, tags };
}
