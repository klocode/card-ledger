import { z } from "zod";

export const CARD_STATUSES = ["OWNED", "WATCHING"] as const;

export const createCardSchema = z.object({
  name: z.string().min(1, "Name is required"),
  game: z.string().min(1, "Game is required"),
  printing: z.string().nullable().optional(),
  finish: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  status: z.enum(CARD_STATUSES).default("WATCHING"),
  qty: z.number().int().positive().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  group: z.string().nullable().optional(),
  tags: z.array(z.string().min(1)).default([]),
});

export const updateCardSchema = createCardSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const TAG_EDIT_MODES = ["add", "remove", "replace"] as const;

// Every field is optional: a bulk edit only touches the fields the user
// explicitly turned on, so `undefined` means "leave as-is" while `null` clears.
export const bulkEditCardsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one card"),
  game: z.string().min(1, "Game is required").optional(),
  status: z.enum(CARD_STATUSES).optional(),
  qty: z.number().int().positive().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  finish: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
  tags: z
    .object({
      mode: z.enum(TAG_EDIT_MODES),
      values: z.array(z.string().min(1)),
    })
    .optional(),
});

export type BulkEditCardsInput = z.infer<typeof bulkEditCardsSchema>;
