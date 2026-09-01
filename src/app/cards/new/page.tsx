import { AddCardForm } from "@/components/cards/add-card-form";

export default function NewCardPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-semibold">Add card</h1>
      <AddCardForm />
    </div>
  );
}
