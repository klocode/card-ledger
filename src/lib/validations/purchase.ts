import { z } from "zod";

export const createPurchaseSchema = z.object({
  cardId: z.string().min(1),
  qty: z.number().int().positive("Quantity must be at least 1"),
  unitPrice: z.number().nonnegative("Price paid can't be negative"),
  date: z.string().min(1),
  source: z.string().nullable().optional(),
  fees: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
