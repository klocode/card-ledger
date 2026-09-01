"""
track_prices.py

Reads a watchlist of Magic: The Gathering cards (name, set code, collector
number, finish) and looks up current market prices via the free Scryfall
API (no key required: https://scryfall.com/docs/api). Writes results to a
CSV formatted for direct paste into the Card Ledger's "Log prices"
bulk import, and — if the Card Ledger app is running locally — also
posts each price straight into it as it's fetched, no paste required.

USAGE
    python track_prices.py                       # easiest: app running
    python track_prices.py watchlist.csv
    python track_prices.py watchlist.csv prices_out.csv

    With no arguments, the watchlist is pulled straight from the running
    app (localhost:3000) and saved to ../exports/watchlist.csv — no need to
    click "Export CSV" or go digging in ~/Downloads. Output defaults to
    ../exports/prices-YYYY-MM-DD.csv. Paths given as arguments are used
    as-is, relative to wherever you're running the command.

INPUT
    watchlist.csv is exactly what the tracker's own "Export CSV" button
    gives you. Its columns are:
        Name, Game, Group, Tags, Printing, Finish, Type, Target, Date, Price, Source
    Only Name, Game, Printing, and Finish are read here; the rest are
    ignored, so you can export straight from the tracker with no editing.

    Only rows where Game is "MTG" (case-insensitive) get looked up —
    Scryfall only covers Magic. Other games (Pokemon, sports, etc.) need a
    different data source; see the note at the bottom of this file.

    "Printing" should be in the tracker's own format: "SET #NUMBER",
    e.g. "LTR #237". If Printing is blank, this falls back to a fuzzy
    name-only lookup, which may not match the exact printing you meant —
    the script tells you when that fallback path was used.

OUTPUT
    Both files live in ../exports/ by default, which is gitignored — it's
    a scratch drawer for CSVs on their way in or out of the app, not
    version-controlled data.

    prices_out.csv: a header row followed by one row per successfully
    priced card, as Name, Price, Date, Source. Source records which market
    the number came from rather than just "Scryfall" — Scryfall's USD prices
    are TCGplayer's daily numbers, so a row reads e.g. "TCGplayer foil (via
    Scryfall)", with "— fuzzy match" appended when the printing wasn't an
    exact hit. Paste this file's contents into the tracker's "Log prices"
    bulk import — or skip that step entirely: if the app is reachable at
    localhost:3000, each price is posted there automatically as it's
    fetched. The CSV is still written every run either way, as a log/backup.

    Exactly one price is logged per card. Where the run had to guess, the
    console says so without logging anything extra: a card with no Finish
    set reports what the other finishes go for, and a fuzzy name match
    reports the printing it actually priced, so you can pin either down by
    filling in that card's Finish / Printing field and re-running.

    A single card failing (network hiccup, no listing found, etc.) is
    logged and skipped — it doesn't abort the rest of the run.

SETUP
    pip install requests
"""

import csv
import sys
import time
import re
from datetime import date
from pathlib import Path

import requests

SCRYFALL_BASE = "https://api.scryfall.com"
IMPORT_URL = "http://localhost:3000/api/prices/import"
EXPORT_URL = "http://localhost:3000/api/cards/export"
EXPORTS_DIR = Path(__file__).resolve().parent.parent / "exports"
PRICE_FIELD_NAMES = {"usd": "nonfoil", "usd_foil": "foil", "usd_etched": "etched"}
HEADERS = {
    "User-Agent": "card-price-ledger-tracker/1.0 (personal use script)",
    "Accept": "application/json",
}


def parse_printing(printing):
    """
    'LTR #237' -> ('ltr', '237'). Returns (None, None) if unparseable, which
    sends the caller down the fuzzy name path.

    Set code and collector number must be separated by '#' and/or whitespace.
    Without that requirement a bare set code like 'PLST' backtracks into
    ('pls', 't') and 404s — the number has to be absent, not invented. Hyphens
    are kept in the number for The List, whose collector numbers look like
    'MM3-119'.
    """
    if not printing:
        return None, None
    m = re.match(
        r"\s*([A-Za-z0-9]+)(?:\s+|\s*#\s*)([A-Za-z0-9\-]+)\s*$", printing.strip()
    )
    if not m:
        return None, None
    return m.group(1).lower(), m.group(2)


def fetch_card(set_code, collector_number, name_fallback):
    """Look up an exact printing if we have set+number; otherwise fuzzy by name."""
    if set_code and collector_number:
        resp = requests.get(
            f"{SCRYFALL_BASE}/cards/{set_code}/{collector_number}",
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json(), True
    resp = requests.get(
        f"{SCRYFALL_BASE}/cards/named",
        params={"fuzzy": name_fallback},
        headers=HEADERS,
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json(), False
    return None, False


def price_for_finish(card, finish):
    """
    Returns (price, price_field). Scryfall tracks nonfoil / foil / etched as
    separate price fields, but does NOT distinguish special foil treatments
    (Surge Foil, Neon Ink, etc.) from plain foil — they share the usd_foil
    field. If you're tracking a premium finish specifically, treat this as an
    approximation and sanity-check it.
    """
    prices = card.get("prices", {})
    finish = (finish or "").strip().lower()
    if "etch" in finish:
        field = "usd_etched"
    # "nonfoil" contains "foil", so it has to be ruled out before the foil test.
    elif "foil" in finish and "nonfoil" not in finish.replace("-", "").replace(" ", ""):
        field = "usd_foil"
    else:
        field = "usd"
    return prices.get(field), field


def other_finish_prices(card, used_field):
    """
    Every finish's price rides along in the same Scryfall response, so showing
    the ones we didn't use is free. They're reported rather than logged: all
    finishes of a name match the same card row on import, so logging them all
    would stack several same-day points onto one card's history. To actually
    track a second finish, add it as its own card with that Finish set.
    """
    prices = card.get("prices", {})
    return ", ".join(
        f"{label} ${prices[field]}"
        for field, label in PRICE_FIELD_NAMES.items()
        if field != used_field and prices.get(field)
    )


def printing_of(card):
    """'MH2 #138' — the printing Scryfall actually landed on."""
    set_code = (card.get("set") or "").upper()
    number = card.get("collector_number") or ""
    return f"{set_code} #{number}" if set_code and number else "(unknown printing)"


def source_label(price_field, exact_match):
    """
    What actually stands behind the number, recorded per price entry.

    Scryfall aggregates rather than sets prices: its usd/usd_foil/usd_etched
    fields are TCGplayer's daily numbers (eur is Cardmarket, tix is
    Cardhoarder — neither is used here), so crediting "Scryfall" alone would
    name the pipe and not the market. A fuzzy-matched row is flagged too: the
    price is real, but it may be for a different printing than you meant.
    """
    label = f"TCGplayer {PRICE_FIELD_NAMES[price_field]} (via Scryfall)"
    return label if exact_match else f"{label} — fuzzy match"


def post_price(row, app_reachable):
    """
    Best-effort POST of a single priced row to the running app. Returns the
    (possibly updated) app_reachable flag — once a connection attempt fails,
    later cards in the same run skip straight to CSV-only instead of
    re-attempting a server that isn't there.
    """
    if not app_reachable:
        return app_reachable
    try:
        resp = requests.post(
            IMPORT_URL, json={"rows": [row]}, headers=HEADERS, timeout=2
        )
        if resp.status_code == 200:
            result = resp.json()
            if result.get("imported"):
                print("       -> logged to app")
            else:
                skipped = result.get("skipped") or []
                reason = skipped[0]["reason"] if skipped else "not imported"
                print(f"       -> app skipped it: {reason}")
        else:
            print(f"       -> app returned {resp.status_code}, see prices_out.csv instead")
    except requests.exceptions.ConnectionError:
        print("  (app not running at localhost:3000 — writing CSV only from here on)")
        return False
    except requests.exceptions.RequestException as e:
        print(f"       -> app POST failed ({e}), see prices_out.csv instead")
    return app_reachable


def fetch_watchlist(dest):
    """
    Pull the watchlist from the running app's Export CSV endpoint and save it
    to `dest`, so the no-argument run needs nothing from the browser. Exits
    with instructions if the app isn't up — there's no watchlist without it.
    """
    try:
        resp = requests.get(EXPORT_URL, headers={"Accept": "text/csv"}, timeout=10)
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Couldn't fetch the watchlist from {EXPORT_URL}: {e}\n")
        print("Start the app with `npm run dev`, or pass a CSV yourself:")
        print("    python track_prices.py path/to/watchlist.csv")
        sys.exit(1)

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(resp.text, encoding="utf-8")
    print(f"Fetched watchlist from the app -> {dest}")
    return dest


def resolve_paths(argv, today):
    """
    argv[1:] is (), (in_path,) or (in_path, out_path). Anything missing falls
    back to the exports/ drawer; an explicit path is used exactly as given.
    """
    if len(argv) > 3:
        print("Usage: python track_prices.py [watchlist.csv [prices_out.csv]]")
        sys.exit(1)

    in_path = Path(argv[1]) if len(argv) > 1 else fetch_watchlist(EXPORTS_DIR / "watchlist.csv")
    out_path = Path(argv[2]) if len(argv) > 2 else EXPORTS_DIR / f"prices-{today}.csv"

    if not in_path.exists():
        print(f"Watchlist not found: {in_path}")
        sys.exit(1)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    return in_path, out_path


def main():
    today = date.today().isoformat()
    in_path, out_path = resolve_paths(sys.argv, today)
    results = []
    app_reachable = True

    with open(in_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Game", "").strip().lower() != "mtg":
                continue

            name = row.get("Name", "").strip()
            if not name:
                continue

            try:
                set_code, number = parse_printing(row.get("Printing", ""))
                card, exact_match = fetch_card(set_code, number, name)

                if not card:
                    print(f"  X  not found: {name}")
                    continue

                finish = row.get("Finish", "")
                price, price_field = price_for_finish(card, finish)
                if price is None:
                    elsewhere = other_finish_prices(card, price_field)
                    hint = f" — but has {elsewhere}" if elsewhere else ""
                    print(f"  !  no price listed: {name} ({finish or 'nonfoil'}){hint}")
                    continue

                source = source_label(price_field, exact_match)
                print(f"  OK {name}: ${price} [{PRICE_FIELD_NAMES[price_field]}]")
                results.append([name, price, today, source])

                # Everything below is reporting only — it never changes what's
                # logged, just makes the guesses this run had to make visible.
                if not finish.strip():
                    elsewhere = other_finish_prices(card, price_field)
                    if elsewhere:
                        print(f"       also sells as {elsewhere} — set this card's"
                              " Finish to track one of those instead")
                if not exact_match:
                    print(f"       fuzzy name match — priced {printing_of(card)};"
                          f" set Printing to \"{printing_of(card)}\" to pin it")

                app_reachable = post_price(
                    {
                        "name": name,
                        "price": price,
                        "date": today,
                        "source": source,
                        "game": "MTG",
                        "printing": row.get("Printing", "") or None,
                        "finish": finish or None,
                    },
                    app_reachable,
                )
            except Exception as e:
                print(f"  X  error on {name or '(unknown card)'}: {e}")
                continue

            time.sleep(0.1)  # be polite to Scryfall's rate limit

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Name", "Price", "Date", "Source"])
        writer.writerows(results)

    print(f"\nWrote {len(results)} prices to {out_path}")
    print("Paste its contents into the tracker's 'Log prices' bulk import")
    print("(or skip that if they were already auto-imported above).")


if __name__ == "__main__":
    main()

# ---------------------------------------------------------------------------
# Extending beyond MTG:
#   Scryfall only covers Magic. For Pokemon, sports cards, or sealed product
#   pricing, you'd add a second lookup function hitting a different API
#   (e.g. TCG API / tcgapi.dev, or PriceCharting's API for sealed & graded),
#   each requiring your own free-tier API key, then route rows to the right
#   function based on the Game column.
#
# Going from manual to scheduled:
#   Once this works the way you want run by hand, a GitHub Action on a cron
#   schedule (in a repo you already have this file in) can run it
#   automatically and commit the output CSV back to the repo — genuinely
#   free, no server or hosting bill required. A scheduled run has no
#   localhost app to POST to, so it'll always fall back to CSV-only; that's
#   fine, just paste the committed CSV into "Log prices" next time you're
#   at the app. Happy to set that up once you've validated the manual
#   version does what you want.
# ---------------------------------------------------------------------------
