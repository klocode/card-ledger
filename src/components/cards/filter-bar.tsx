"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FilterBar({
  games,
  groups,
  tags,
}: {
  games: string[];
  groups: string[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all" || !value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.push(next.size > 0 ? `${pathname}?${next.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="WATCHING">Watching</SelectItem>
          <SelectItem value="OWNED">Owned</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("game") ?? "all"}
        onValueChange={(v) => setParam("game", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Game" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All games</SelectItem>
          {games.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {groups.length > 0 && (
        <Select
          value={searchParams.get("group") ?? "all"}
          onValueChange={(v) => setParam("group", v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {tags.length > 0 && (
        <Select
          value={searchParams.get("tag") ?? "all"}
          onValueChange={(v) => setParam("tag", v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
