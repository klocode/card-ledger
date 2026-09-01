import { Layers, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MainNav } from "@/components/layout/main-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Layers className="size-5" />
              Card Ledger
            </Link>
            <MainNav />
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/cards/new">
                <Plus className="size-4" />
                Add card
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
