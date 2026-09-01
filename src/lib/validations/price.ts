import { z } from "zod";

export const logPriceRowSchema = z.object({
  name: z.string().min(1),
  price: z.coerce.number().positive(),
  date: z.string().min(1),
  source: z.string().min(1),
  game: z.string().nullable().optional(),
  printing: z.string().nullable().optional(),
  finish: z.string().nullable().optional(),
});

export const manualPriceSchema = z.object({
  cardId: z.string().min(1),
  price: z.number().positive(),
  date: z.string().min(1),
  source: z.string().min(1).default("manual"),
});

export type LogPriceRowInput = z.infer<typeof logPriceRowSchema>;
export type ManualPriceInput = z.infer<typeof manualPriceSchema>;
