import { z } from "zod";

export const recordSealedPurchaseSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  game: z.string().min(1, "Game is required"),
  setCode: z.string().nullable().optional(),
  setName: z.string().nullable().optional(),
  packCount: z.number().int().positive("Packs bought must be at least 1"),
  unitPrice: z.number().nonnegative("Price per pack can't be negative"),
  fees: z.number().nonnegative().nullable().optional(),
  date: z.string().min(1),
  source: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type RecordSealedPurchaseInput = z.infer<
  typeof recordSealedPurchaseSchema
>;

export const openPackSchema = z.object({
  purchaseId: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export type OpenPackInput = z.infer<typeof openPackSchema>;

/**
 * One pulled card. `cardId` links an existing tracked card; without it the
 * name/game pair creates one, so a pull is never recorded as a bare string
 * that can't be priced later.
 */
export const addPullSchema = z.object({
  openingId: z.string().min(1),
  cardId: z.string().nullable().optional(),
  name: z.string().min(1, "Card name is required"),
  game: z.string().min(1),
  printing: z.string().nullable().optional(),
  finish: z.string().nullable().optional(),
  qty: z.number().int().positive("Quantity must be at least 1"),
  valueAtOpen: z.number().nonnegative().nullable().optional(),
});

export type AddPullInput = z.infer<typeof addPullSchema>;

export const addPullsSchema = z.object({
  openingId: z.string().min(1),
  pulls: z.array(addPullSchema.omit({ openingId: true })).min(1),
});

export type AddPullsInput = z.infer<typeof addPullsSchema>;
