import { parseBulkAddCsv, type BulkAddDefaults, type ParseBulkAddResult } from "@/lib/csv";
import type { CreateCardInput } from "@/lib/validations/card";

export type BulkAddFormat = "csv" | "list";

/**
 * A pasted blob is treated as CSV only when its first line is a header row
 * naming a Name column — that's the Export CSV contract, and it keeps deck
 * lists out of the CSV path even though card names contain commas
 * ("1 Ragavan, Nimble Pilferer (MH2) 138"). Everything else is a plain text
 * list, which degrades gracefully to "one card name per line".
 */
export function detectBulkAddFormat(text: string): BulkAddFormat {
  const firstLine = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  if (!firstLine) return "list";

  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(",") ? "," : null;
  if (!delimiter) return "list";

  const headers = firstLine
    .split(delimiter)
    .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return headers.includes("name") ? "csv" : "list";
}

/** Section labels a deck list may carry on their own line; not cards. */
const SECTION_HEADERS = new Set([
  "deck",
  "main",
  "maindeck",
  "mainboard",
  "sideboard",
  "commander",
  "companion",
  "maybeboard",
  "considering",
  "wishlist",
  "tokens",
  "attractions",
  "stickers",
  "contraptions",
]);

/** "1 ", "4x ", "4xName" — capped at 3 digits so "1996 World Champion" stays a name. */
const QTY_PATTERNS = [/^(\d{1,3})\s*[xX]\s*(?=\S)/, /^(\d{1,3})\s+(?=\S)/];

/**
 * "(MH2) 138" / "(mh2) #138" — the collector number must start with a digit so
 * a trailing "#Category" tag isn't swallowed as one.
 */
const SET_PATTERN = /\(([A-Za-z0-9]{2,6})\)(?:\s*#?\s*(\d[A-Za-z0-9★-]*))?/;

const FOIL_PATTERN = /\*F\*/i;
const ETCHED_PATTERN = /\*E\*/i;

type ParsedLine = Pick<CreateCardInput, "name" | "printing" | "finish" | "tags"> & {
  qty: number | null;
};

function parseLine(line: string): ParsedLine | null {
  // MTGO-style sideboard prefix ("SB: 1 Lightning Bolt").
  let rest = line.replace(/^(?:SB|MB):\s*/i, "").trim();

  let qty: number | null = null;
  for (const pattern of QTY_PATTERNS) {
    const match = rest.match(pattern);
    if (match) {
      qty = Number(match[1]);
      rest = rest.slice(match[0].length);
      break;
    }
  }

  let printing: string | null = null;
  const setMatch = rest.match(SET_PATTERN);
  if (setMatch) {
    const [matched, setCode, collector] = setMatch;
    const at = setMatch.index ?? 0;
    printing = collector ? `${setCode.toUpperCase()} #${collector}` : setCode.toUpperCase();
    rest = `${rest.slice(0, at)} ${rest.slice(at + matched.length)}`;
  }

  let finish: string | null = null;
  if (ETCHED_PATTERN.test(rest)) finish = "etched";
  else if (FOIL_PATTERN.test(rest)) finish = "foil";
  rest = rest.replace(/\*[A-Za-z-]+\*/g, " ");

  // Moxfield categories ("#Ramp") and Archidekt categories ("[Ramp{noDeck}]").
  const tags: string[] = [];
  rest = rest.replace(/\[([^\]]+)\]/g, (_, inner: string) => {
    const tag = inner.replace(/\{[^}]*\}/g, "").trim();
    if (tag) tags.push(tag);
    return " ";
  });
  rest = rest.replace(/(?:^|\s)#([^\s#]+)/g, (_, tag: string) => {
    tags.push(tag);
    return " ";
  });

  const name = rest.replace(/\s+/g, " ").trim();
  if (!name) return null;
  return { name, printing, finish, tags, qty };
}

function isSkippableLine(line: string): boolean {
  if (!line) return true;
  if (line.startsWith("//")) return true;
  // A bare section label, with or without a count ("Sideboard (15)", "Deck:").
  const bare = line
    .replace(/\(\d+\)\s*$/, "")
    .replace(/[:#]/g, "")
    .trim()
    .toLowerCase();
  return SECTION_HEADERS.has(bare);
}

/**
 * Parses plain text card lists — Moxfield/Archidekt/MTGO text exports, or just
 * one name per line. Recognized per line:
 *
 *     [qty] Name [(SET) collector] [*F* | *E*] [#tag | [tag]]
 *
 * Section headers, `//` comments and blank lines are ignored. Repeated cards
 * (the same name/printing/finish across mainboard and sideboard, say) collapse
 * into one row with the quantities summed.
 */
export function parseDeckList(
  text: string,
  defaults: BulkAddDefaults = {}
): ParseBulkAddResult {
  const status = defaults.status ?? "WATCHING";
  const errors: string[] = [];
  const byKey = new Map<string, CreateCardInput>();

  text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (isSkippableLine(line)) return;

      const parsed = parseLine(line);
      if (!parsed) {
        errors.push(`Line ${index + 1}: could not read a card name from "${line}"`);
        return;
      }

      const key = [
        parsed.name.toLowerCase(),
        parsed.printing ?? "",
        parsed.finish ?? "",
      ].join("|");
      const existing = byKey.get(key);
      if (existing) {
        if (status === "OWNED" && (existing.qty != null || parsed.qty != null)) {
          existing.qty = (existing.qty ?? 0) + (parsed.qty ?? 0);
        }
        existing.tags = Array.from(new Set([...existing.tags, ...parsed.tags]));
        return;
      }

      byKey.set(key, {
        name: parsed.name,
        game: "MTG",
        printing: parsed.printing,
        finish: parsed.finish,
        type: null,
        status,
        qty: status === "OWNED" ? parsed.qty : null,
        targetPrice: null,
        group: null,
        tags: parsed.tags,
      });
    });

  return { rows: Array.from(byKey.values()), errors };
}

export type ParseBulkAddInputResult = ParseBulkAddResult & { format: BulkAddFormat };

/** Detects the pasted/uploaded format and routes it to the right parser. */
export function parseBulkAddInput(
  text: string,
  defaults: BulkAddDefaults = {}
): ParseBulkAddInputResult {
  const format = detectBulkAddFormat(text);
  const result = format === "csv" ? parseBulkAddCsv(text, defaults) : parseDeckList(text, defaults);
  return { ...result, format };
}
