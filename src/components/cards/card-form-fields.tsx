"use client";

import type { UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CardFormValues } from "@/lib/card-form";

const GAME_SUGGESTIONS = ["MTG", "Pokemon", "Sports"];

export function CardFormFields({
  register,
  status,
  onStatusChange,
}: {
  register: UseFormRegister<CardFormValues>;
  status: "OWNED" | "WATCHING";
  onStatusChange: (status: "OWNED" | "WATCHING") => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Wrenn and Six" {...register("name")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="game">Game</Label>
          <Input id="game" list="game-suggestions" {...register("game")} />
          <datalist id="game-suggestions">
            {GAME_SUGGESTIONS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="printing">Printing</Label>
          <Input id="printing" placeholder="LTR #237" {...register("printing")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="finish">Finish</Label>
          <Input id="finish" placeholder="nonfoil" {...register("finish")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="type">Type</Label>
          <Input id="type" {...register("type")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => onStatusChange(v as "OWNED" | "WATCHING")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WATCHING">Watching</SelectItem>
              <SelectItem value="OWNED">Owned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {status === "OWNED" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="qty">Quantity</Label>
            <Input id="qty" type="number" min={1} step={1} {...register("qty")} />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="targetPrice">Target buy price</Label>
            <Input
              id="targetPrice"
              type="number"
              min={0}
              step="0.01"
              {...register("targetPrice")}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="group">Group</Label>
          <Input id="group" placeholder="Commander deck" {...register("group")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tagsInput">Tags</Label>
          <Input id="tagsInput" placeholder="chase, reprint-risk" {...register("tagsInput")} />
        </div>
      </div>
    </div>
  );
}
