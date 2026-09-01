"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { refetchPrice } from "@/lib/actions/price-actions";

export function RefetchPriceButton({ cardId }: { cardId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefetch() {
    startTransition(async () => {
      try {
        const result = await refetchPrice(cardId);
        if (!result.ok) {
          toast.error(result.reason);
          return;
        }
        toast.success(`Logged $${result.price.toFixed(2)} (${result.finish})`, {
          description:
            result.replaced > 0
              ? `Replaced today's existing entry — priced ${result.printing}.`
              : `Priced ${result.printing}.`,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch price");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleRefetch}>
      <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
      {isPending ? "Fetching…" : "Re-fetch price"}
    </Button>
  );
}
