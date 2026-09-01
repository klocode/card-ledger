import Papa from "papaparse";

import type { CreateCardInput } from "@/lib/validations/card";
import type { LogPriceRowInput } from "@/lib/validations/price";

export type ExportableCard = {
  name: string;
  game: string;
  group: string | null;
  tags: { name: string }[];
  printing: string | null;
  finish: string | null;
  type: string | null;
  status: "OWNED" | "WATCHING";
  qty: number | null;
  targetPrice: number | null;
  priceEntries: { price: number; date: Date; source: string }[];
};

const EXPORT_COLUMNS = [
  "Name",
  "Game",
  "Group",
  "Tags",
  "Printing",
  "Finish",
  "Type",
  "Status",
  "Qty",
  "Target",
  "Date",
  "Price",
  "Source",
] as const;

/**
 * Matches the "Export CSV" contract documented in track_prices.py: one row
 * per card, with Date/Price/Source carrying that card's most recent logged
 * price (blank if it's never been priced). Tags are joined with `;` since
 * the column itself is comma-delimited. Status/Qty were added after the
 * original script's docstring was written — safe, since it reads columns
 * by name and ignores anything it doesn't recognize. This makes Export CSV
 * a lossless card format, so it doubles as the Bulk Add input format.
 */
export function buildExportCsv(cards: ExportableCard[]): string {
  const rows = cards.map((card) => {
    const latest = card.priceEntries[0];
    return {
      Name: card.name,
      Game: card.game,
      Group: card.group ?? "",
      Tags: card.tags.map((t) => t.name).join(";"),
      Printing: card.printing ?? "",
      Finish: card.finish ?? "",
      Type: card.type ?? "",
      Status: card.status,
      Qty: card.qty ?? "",
      Target: card.targetPrice ?? "",
      Date: latest ? latest.date.toISOString().slice(0, 10) : "",
      Price: latest ? latest.price : "",
      Source: latest ? latest.source : "",
    };
  });
  // Papa.unparse returns "" for an empty data array even with `columns` set,
  // which would drop the header row entirely for a brand-new, cardless DB.
  if (rows.length === 0) return EXPORT_COLUMNS.join(",") + "\r\n";
  return Papa.unparse(rows, { columns: [...EXPORT_COLUMNS] });
}

export type ParsedImportRow = LogPriceRowInput;

export type ParseImportResult = {
  rows: ParsedImportRow[];
  errors: string[];
};

/**
 * Accepts either the script's narrow output (Name, Price, Date, Source) or
 * the full Export CSV format pasted back in — only the columns needed to
 * log a price are read, everything else is ignored. Header matching is
 * case-insensitive.
 */
export function parseImportCsv(text: string): ParseImportResult {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = result.errors.map(
    (e) => `Row ${e.row ?? "?"}: ${e.message}`
  );

  const rows: ParsedImportRow[] = [];
  result.data.forEach((raw, index) => {
    const name = raw.name?.trim();
    const priceRaw = raw.price?.trim();
    const date = raw.date?.trim();
    const source = raw.source?.trim();

    if (!name || !priceRaw || !date || !source) {
      errors.push(
        `Row ${index + 1}: missing required field (need Name, Price, Date, Source)`
      );
      return;
    }
    const price = Number(priceRaw);
    if (Number.isNaN(price)) {
      errors.push(`Row ${index + 1}: price "${priceRaw}" is not a number`);
      return;
    }

    rows.push({
      name,
      price,
      date,
      source,
      game: raw.game?.trim() || undefined,
      printing: raw.printing?.trim() || undefined,
      finish: raw.finish?.trim() || undefined,
    });
  });

  return { rows, errors };
}

export type ParseBulkAddResult = {
  rows: CreateCardInput[];
  errors: string[];
};

export type BulkAddDefaults = {
  /** Status for rows with no Status column; the column still wins per-row. */
  status?: "OWNED" | "WATCHING";
};

/**
 * Accepts the Export CSV format (or any subset of its columns) to create
 * many cards at once. Only Name is required — Game defaults to "MTG",
 * Status defaults to "Watching". Date/Price/Source are ignored; use
 * "Log prices" to log prices after cards are created.
 *
 * Papa auto-detects the delimiter, so tab- or semicolon-separated exports
 * pasted out of a spreadsheet parse the same way.
 */
export function parseBulkAddCsv(
  text: string,
  defaults: BulkAddDefaults = {}
): ParseBulkAddResult {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = result.errors.map(
    (e) => `Row ${e.row ?? "?"}: ${e.message}`
  );

  const rows: CreateCardInput[] = [];
  result.data.forEach((raw, index) => {
    const name = raw.name?.trim();
    if (!name) {
      errors.push(`Row ${index + 1}: missing Name`);
      return;
    }

    const statusRaw = raw.status?.trim().toUpperCase();
    const status =
      statusRaw === "OWNED"
        ? "OWNED"
        : statusRaw === "WATCHING"
          ? "WATCHING"
          : (defaults.status ?? "WATCHING");

    const qtyRaw = raw.qty?.trim();
    const qty = qtyRaw ? Number(qtyRaw) : null;
    if (qtyRaw && Number.isNaN(qty as number)) {
      errors.push(`Row ${index + 1}: qty "${qtyRaw}" is not a number`);
      return;
    }

    const targetRaw = raw.target?.trim();
    const targetPrice = targetRaw ? Number(targetRaw) : null;
    if (targetRaw && Number.isNaN(targetPrice as number)) {
      errors.push(`Row ${index + 1}: target "${targetRaw}" is not a number`);
      return;
    }

    rows.push({
      name,
      game: raw.game?.trim() || "MTG",
      printing: raw.printing?.trim() || null,
      finish: raw.finish?.trim() || null,
      type: raw.type?.trim() || null,
      status,
      qty: status === "OWNED" ? qty : null,
      targetPrice: status === "WATCHING" ? targetPrice : null,
      group: raw.group?.trim() || null,
      tags: raw.tags
        ? raw.tags
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    });
  });

  return { rows, errors };
}
