/**
 * Live lookups against Scryfall's free API (no key required:
 * https://scryfall.com/docs/api). This is read-only reference data shown next
 * to a card — it is never written to the price log, which stays the record of
 * what `scripts/track_prices.py` actually captured over time.
 *
 * Scryfall covers Magic only, so callers must gate on game === "MTG".
 */

const SCRYFALL_BASE = "https://api.scryfall.com";

const HEADERS = {
  "User-Agent": "card-price-ledger/1.0 (personal use)",
  Accept: "application/json",
};

// Scryfall's usd fields are TCGplayer's *daily* numbers, so anything under a
// day is already fresher than the source; an hour keeps repeat visits off the
// network without going stale. fetch is uncached by default in Next 16, so
// this has to be asked for explicitly.
const REVALIDATE_SECONDS = 3600;

export type Finish = "nonfoil" | "foil" | "etched";

/** Scryfall prices each finish in its own field. */
const PRICE_FIELD: Record<Finish, "usd" | "usd_foil" | "usd_etched"> = {
  nonfoil: "usd",
  foil: "usd_foil",
  etched: "usd_etched",
};

const FINISH_ORDER: Finish[] = ["nonfoil", "foil", "etched"];

export type PrintingRow = {
  /** Stable key, and what a click writes back as the card's printing. */
  printing: string;
  set: string;
  setName: string;
  collectorNumber: string;
  finish: Finish;
  price: number | null;
  releasedAt: string;
  scryfallUri: string;
};

export type PrintingsResult = {
  rows: PrintingRow[];
  /** False when we fell back to a fuzzy name lookup to find the card. */
  exactMatch: boolean;
  /** Printings found, as opposed to rows — one printing yields several rows. */
  printingCount: number;
};

/**
 * "LTR #237" -> ["ltr", "237"]. Mirrors parse_printing() in track_prices.py:
 * the set code and collector number must be separated by '#' and/or
 * whitespace, or a bare code like "PLST" backtracks into ("pls", "t") and
 * 404s. Hyphens stay in the number for The List ("MM3-119").
 */
export function parsePrinting(printing: string | null): [string, string] | null {
  if (!printing) return null;
  const match = /^\s*([A-Za-z0-9]+)(?:\s+|\s*#\s*)([A-Za-z0-9-]+)\s*$/.exec(printing.trim());
  return match ? [match[1].toLowerCase(), match[2]] : null;
}

/**
 * Free-text finish -> the finish actually priced. Same rules as
 * price_for_finish() in track_prices.py, including that a blank finish is
 * priced as nonfoil, so the row highlighted here is the row the script logs.
 */
export function normalizeFinish(finish: string | null): Finish {
  const value = (finish ?? "").trim().toLowerCase();
  if (value.includes("etch")) return "etched";
  if (value.includes("foil") && !value.replace(/[-\s]/g, "").includes("nonfoil")) {
    return "foil";
  }
  return "nonfoil";
}

type ScryfallFace = {
  name?: string;
  image_uris?: Record<string, string>;
};

type ScryfallCard = {
  name?: string;
  layout?: string;
  image_uris?: Record<string, string>;
  card_faces?: ScryfallFace[];
  set?: string;
  set_name?: string;
  collector_number?: string;
  released_at?: string;
  scryfall_uri?: string;
  finishes?: string[];
  prices?: Record<string, string | null>;
  prints_search_uri?: string;
};

/**
 * `fresh` bypasses the cache for reads whose whole point is being current —
 * a price about to be written to the log. Display reads (the printings panel,
 * card art) stay cached. The two options are mutually exclusive: passing both
 * makes Next ignore each of them.
 */
async function getJson<T>(url: string, fresh = false): Promise<T | null> {
  const response = await fetch(url, {
    headers: HEADERS,
    ...(fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: REVALIDATE_SECONDS } }),
  });
  return response.ok ? ((await response.json()) as T) : null;
}

/** The tracker's own printing format, e.g. "SOA #35". */
function printingOf(card: ScryfallCard): string {
  const set = (card.set ?? "").toUpperCase();
  return set && card.collector_number ? `${set} #${card.collector_number}` : "";
}

function toRows(card: ScryfallCard): PrintingRow[] {
  const finishes = (card.finishes ?? []).filter((f): f is Finish =>
    FINISH_ORDER.includes(f as Finish)
  );
  const printing = printingOf(card);
  if (!printing) return [];

  return FINISH_ORDER.filter((finish) => finishes.includes(finish)).map((finish) => {
    const raw = card.prices?.[PRICE_FIELD[finish]];
    return {
      printing,
      set: (card.set ?? "").toUpperCase(),
      setName: card.set_name ?? "",
      collectorNumber: card.collector_number ?? "",
      finish,
      // A printing can exist with no current listing; it stays selectable, it
      // just has no number to show.
      price: raw != null ? Number(raw) : null,
      releasedAt: card.released_at ?? "",
      scryfallUri: card.scryfall_uri ?? "",
    };
  });
}

/**
 * Find the one Scryfall card a tracked card refers to.
 *
 * Exact set+number first, since that pins the right card among reprints; a
 * fuzzy name lookup is the fallback and is reported, because it may land on a
 * different printing than meant. Both callers below go through here with
 * identical URLs and options, so Next memoizes it to a single request per
 * render pass however many panels ask for it.
 */
async function resolveCard(
  name: string,
  printing: string | null,
  fresh = false
): Promise<{ card: ScryfallCard; exactMatch: boolean } | null> {
  const parsed = parsePrinting(printing);

  if (parsed) {
    const exact = await getJson<ScryfallCard>(
      `${SCRYFALL_BASE}/cards/${parsed[0]}/${parsed[1]}`,
      fresh
    );
    if (exact) return { card: exact, exactMatch: true };
  }

  const fuzzy = await getJson<ScryfallCard>(
    `${SCRYFALL_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`,
    fresh
  );
  return fuzzy ? { card: fuzzy, exactMatch: false } : null;
}

export type CardFaceImage = {
  name: string;
  /** Scryfall's "normal" size — 488x680, the intrinsic ratio to render at. */
  url: string;
};

/**
 * Card art for the printing this card actually tracks.
 *
 * Double-faced layouts (transform, modal_dfc, …) carry no top-level image and
 * put one under each face instead, so those return two images — a real case
 * here, not a hypothetical. Foil and nonfoil share artwork, so finish doesn't
 * enter into it.
 */
export async function fetchCardImages(
  name: string,
  printing: string | null
): Promise<CardFaceImage[]> {
  try {
    const resolved = await resolveCard(name, printing);
    if (!resolved) return [];
    const { card } = resolved;

    const front = card.image_uris?.normal;
    if (front) return [{ name: card.name ?? name, url: front }];

    return (card.card_faces ?? [])
      .map((face) => ({ name: face.name ?? name, url: face.image_uris?.normal ?? "" }))
      .filter((face) => face.url);
  } catch {
    return [];
  }
}

export type TrackedPrice = {
  price: number;
  finish: Finish;
  /**
   * Matches the label source_label() writes in track_prices.py, so a re-fetch
   * and a scripted run leave the same fingerprint instead of splitting the
   * history into two dialects of the same source.
   */
  source: string;
  /** The printing actually priced — differs from the card's on a fuzzy match. */
  printing: string;
  exactMatch: boolean;
};

/**
 * The current price for exactly the printing and finish a card tracks.
 *
 * Returns null when that finish has no listing — the caller reports it rather
 * than logging a hole, same as the script does.
 */
export async function fetchTrackedPrice(
  name: string,
  printing: string | null,
  finish: string | null,
  { fresh = true }: { fresh?: boolean } = {}
): Promise<TrackedPrice | null> {
  try {
    const resolved = await resolveCard(name, printing, fresh);
    if (!resolved) return null;

    const { card, exactMatch } = resolved;
    const wanted = normalizeFinish(finish);
    const raw = card.prices?.[PRICE_FIELD[wanted]];
    if (raw == null) return null;

    const price = Number(raw);
    if (!Number.isFinite(price) || price <= 0) return null;

    const label = `TCGplayer ${wanted} (via Scryfall)`;
    return {
      price,
      finish: wanted,
      source: exactMatch ? label : `${label} — fuzzy match`,
      printing: printingOf(card),
      exactMatch,
    };
  } catch {
    return null;
  }
}

/**
 * Every printing of `name`, one row per printing/finish pair, newest first.
 *
 * Resolves the exact printing first when `printing` parses, since that pins
 * the right card among reprints; a fuzzy name lookup is the fallback and is
 * flagged in the result, because it may land on a different card than meant.
 * Returns null when Scryfall can't be reached or doesn't know the card —
 * callers render without the panel rather than failing the page.
 */
export async function fetchPrintings(
  name: string,
  printing: string | null
): Promise<PrintingsResult | null> {
  try {
    const resolved = await resolveCard(name, printing);
    if (!resolved?.card.prints_search_uri) return null;
    const { card, exactMatch } = resolved;

    const rows: PrintingRow[] = [];
    let printingCount = 0;
    let next: string | undefined = card.prints_search_uri;

    // Scryfall pages at 175, which covers even the most-reprinted cards
    // (Sol Ring is ~137) in one request; the loop is a cap, not a paginator.
    for (let page = 0; next && page < 3; page++) {
      const result: { data?: ScryfallCard[]; has_more?: boolean; next_page?: string } | null =
        await getJson(next);
      if (!result?.data) break;
      printingCount += result.data.length;
      for (const print of result.data) rows.push(...toRows(print));
      next = result.has_more ? result.next_page : undefined;
    }

    return rows.length > 0 ? { rows, exactMatch, printingCount } : null;
  } catch {
    // Offline, DNS failure, Scryfall down — the panel is a nicety, not the page.
    return null;
  }
}
