import type { CreateCardInput } from "@/lib/validations/card";

export type CardFormValues = {
  name: string;
  game: string;
  printing: string;
  finish: string;
  type: string;
  qty: string;
  targetPrice: string;
  group: string;
  tagsInput: string;
};

export const CARD_FORM_DEFAULTS: CardFormValues = {
  name: "",
  game: "MTG",
  printing: "",
  finish: "",
  type: "",
  qty: "",
  targetPrice: "",
  group: "",
  tagsInput: "",
};

export function buildCardPayload(
  values: CardFormValues,
  status: "OWNED" | "WATCHING"
): CreateCardInput {
  return {
    name: values.name.trim(),
    game: values.game.trim(),
    printing: values.printing.trim() || null,
    finish: values.finish.trim() || null,
    type: values.type.trim() || null,
    status,
    qty: status === "OWNED" && values.qty.trim() ? Number(values.qty) : null,
    targetPrice:
      status === "WATCHING" && values.targetPrice.trim()
        ? Number(values.targetPrice)
        : null,
    group: values.group.trim() || null,
    tags: values.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}
