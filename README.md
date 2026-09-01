# Card Ledger

A personal, local-only tracker for TCG card prices — log prices over time for
cards you own (collection value) and cards you're watching (target buy
price), and see the trend before deciding whether it's a good time to buy.
Once you do buy, record what you paid and it tracks the position: cost basis,
unrealized gain, and whether you beat your own target.

## Tech Stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **TypeScript**
- **SQLite** with **Prisma 7** ORM (no external database needed)
- **Tailwind CSS v4** + **shadcn/ui**
- **Recharts** for the price history chart
- **Zod** for validation
- **Papa Parse** for CSV import/export

## Features

- **Cards list** — every card you're tracking, filterable by game/status/group/tag.
  Watching cards default-sort by distance to their target price; owned cards sort by name.
- **Card detail** — price history line chart with a target-price reference line, plus the full price log.
- **Add / edit cards** — name, game, printing (`SET #NUMBER`), finish, type, status (Owned/Watching), quantity, target buy price, group, tags.
- **Bulk edit** — tick rows in the cards list (shift-click for a range, or select-all in the header), then change Game, Status, Quantity, Target, Finish, Group or Tags across every selected card at once, or delete them together. Only the fields you tick are written; a ticked field left blank clears it. Tags can be added, removed or replaced wholesale.
- **Bulk add** — paste, drop or upload a CSV (an Export CSV, or just a Name column) *or* a plain text list like a Moxfield/Archidekt/MTGO export (`1 Wrenn and Six (MH1) 212 *F*`). The format is detected for you; set codes become printings, `*F*`/`*E*` become finishes, and `#tags`/`[categories]` become tags.
- **Mark as bought** — on a card's page, record an actual purchase: quantity,
  price paid per copy, date, shipping/tax and where it came from. Prefilled
  with today and the latest logged price, so a buy at roughly the watched
  price is one click. It flips a Watching card to Owned, and tells you there
  and then how the price paid compared to your target.
- **Cost basis & unrealized P&L** — a card with purchases shows what the
  position cost (fees included), what it's worth at the latest logged price,
  the unrealized gain in dollars and percent, and how the average price paid
  compares to the target you'd set. Cards without purchases don't show the
  panel at all.
- **Buy markers on the chart** — every purchase is plotted on the price
  history at the price you actually paid, so you can see whether you bought
  the dip or the top. A buy on a day with no logged price still gets its own
  point on the axis; several buys on one day merge into a single marker at
  their quantity-weighted average.
- **Purchases log** — every lot for a card, with its all-in total, and a
  delete for anything entered wrong.
- **Log prices** — paste a CSV (from `track_prices.py`'s output, or a full Export CSV) to log many prices at once. Matches cards by name, or by game+printing+finish when those columns are present, and reports anything ambiguous or unmatched instead of guessing.
- **Card art** — an MTG card's page shows the art for the printing it actually tracks, pulled from Scryfall on view. Double-faced cards (transform, modal DFC) show both faces.
- **Other printings** — on an MTG card's page, every printing of that name with its live nonfoil/foil/etched price, pulled from Scryfall on view. Shows what the versions you *aren't* tracking currently cost, and "Track" on any row repoints the card at that printing and finish so the next price run follows it. These prices are reference only — they're never written to the card's price history.
- **Fetch all prices** — one button on the cards list re-prices every MTG card from Scryfall, in batches of 10 with a live progress toast, then reports how many were logged, anything skipped and why, and the three biggest moves since the last price, with a shortcut through to that day's report. Same one-per-day rule as the single-card re-fetch, so running it twice in a day corrects the day rather than doubling it. Does what `track_prices.py` does, without leaving the app.
- **Daily reports** — every "Fetch all prices" run files a dated report on the **Reports** page: how many cards were priced, what the day did to the value of what you own, how many rose and fell, and a table of the moves worth a second look (was → now, in dollars and percent, each linking back to the card). Anything Scryfall couldn't price is listed with its reason, so a misconfigured printing surfaces instead of quietly staying stale. One report per day — re-running rewrites it, matching how a re-fetch corrects the day's price rather than adding to it.
- **Re-fetch price** — on an MTG card's page, pull that card's current price from Scryfall for exactly the printing and finish it tracks, without running the whole script. It replaces any entry already dated today rather than adding a second one (one price per card per day is what the chart and the "latest price" column assume), and reports what it replaced. Pair it with **Track** on the printings panel to correct a card that was pointed at the wrong version.
- **Export CSV** — one row per card (`Name, Game, Group, Tags, Printing, Finish, Type, Target, Date, Price, Source`), with each card's most recently logged price. Feed this straight back into `track_prices.py` as its watchlist input.
- **`scripts/track_prices.py`** — fetches current MTG prices from Scryfall for your watchlist. Run with no arguments and it pulls the watchlist from the running app, prices it, and POSTs each price straight back in (`localhost:3000/api/prices/import`); either way it also writes a CSV to `exports/` you can paste into "Log prices" by hand.

### What counts as a notable move

The report keeps the moves worth reading, not every move — a list where each
day's real news sits between forty half-cent drifts is one nobody opens. A move
makes the table when it clears **either** bar:

- **$1.00 or more**, whatever the percentage — $2 off a $60 dual is 3% and still
  real money.
- **5% or more**, as long as it's also **at least 25 cents** — 20% off a $1
  common is a genuine signal; the floor keeps penny noise out.

Two bars rather than one because the collection spans three orders of magnitude,
and a single threshold would either drown in the cheap cards or miss the
expensive ones. The rule lives in `src/lib/price-moves.ts` and is shared with the
run's toast, so the two never disagree about what moved. The *counts* (up, down,
owned value) are of every move, notable or not.

### Purchases, Qty and Status

`Qty` and `Status` predate purchases and are still editable by hand (the edit
dialog, bulk edit and CSV import all write them), so purchases claim them under
one narrow rule: **while a card has purchase lots, the lots are the truth** —
`Qty` is their sum and the card is `OWNED`. Recording a buy therefore moves a
Watching card to Owned and sets its quantity for you.

Deleting the *last* lot leaves `Qty` and `Status` exactly as they were. Removing
a receipt isn't the same statement as "I no longer own this", and silently
flipping the card back to Watching would throw away a quantity you may have
typed in yourself. Cards with no lots behave exactly as they did before.

Cost basis is reported two ways, because the two questions want different
numbers: profit is judged against the **all-in** cost per copy (fees included,
since shipping is money spent), while the **vs. target** comparison excludes
fees, because a target is set against a listing price and shipping was never
part of it.

## Getting Started

### Prerequisites

- **Node.js 20.19+ or 22.12+** (Prisma 7 requires this). If you're on an older Node via `nvm`, this repo has a `.nvmrc` — run `nvm use`.
- Python 3 + `pip install requests` if you want to run `track_prices.py`.

### Setup

```bash
npm install
cp .env.example .env   # sets DATABASE_URL for the local SQLite file
npm run db:generate   # generate the Prisma client
npm run db:push        # create dev.db and apply the schema
npm run dev
```

Visit `http://localhost:3000`.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run lint` | Lint |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:push` | Push the schema to `dev.db` |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

### Using `track_prices.py`

With the app running (`npm run dev`), that's the whole thing:

```bash
pip install requests          # once
python scripts/track_prices.py
```

It pulls your watchlist from the app's own export endpoint, looks up each MTG
card on Scryfall, and POSTs the prices straight back into the app — nothing to
click, nothing to paste. Both CSVs land in `exports/`:

- `exports/watchlist.csv` — the snapshot it priced against (overwritten each run)
- `exports/prices-YYYY-MM-DD.csv` — the prices it found, as a backup/log

If the app *isn't* running, export a CSV from the UI and pass it in yourself;
then paste the output into **Log prices** afterward:

```bash
python scripts/track_prices.py ~/Downloads/card-price-ledger-export.csv
python scripts/track_prices.py watchlist.csv prices_out.csv   # both paths explicit
```

#### Where the prices come from

Scryfall aggregates rather than sets prices. Its `usd` / `usd_foil` /
`usd_etched` fields are **TCGplayer's** daily numbers (its `eur` fields are
Cardmarket and `tix` is Cardhoarder — neither is used here), so each entry
records the market rather than the pipe:

| Source recorded | Meaning |
|---|---|
| `TCGplayer nonfoil (via Scryfall)` | Scryfall's `usd` for the exact printing |
| `TCGplayer foil (via Scryfall)` | `usd_foil` — note Scryfall does **not** separate premium treatments (Surge, Neon Ink) from plain foil |
| `TCGplayer etched (via Scryfall)` | `usd_etched` |
| `… — fuzzy match` | Printing wasn't an exact hit, so the price may be for a different printing than you meant — fix by putting `SET #NUMBER` in the card's Printing field |

Exactly one price is logged per card. Where a run has to guess, it says so in
the console instead of logging extra rows — a card with no Finish set reports
what the other finishes go for (`also sells as foil $57.26`), and a fuzzy name
match reports the printing it actually priced (`priced MSC #211`). Fill in that
card's Finish / Printing and re-run to pin either down. To track a card's foil
*and* nonfoil over time, add it twice with different Finish values.

Each run appends a new price entry per card, so run it about once a day —
running it twice in one day just puts two same-dated points on the chart.

### The `exports/` folder

A scratch drawer for CSVs moving in or out of the app. Its contents are
gitignored (only the README is tracked), so nothing in it ends up in git.

## Known Findings

- `npm audit` reports a high-severity advisory in `deepmerge-ts` (via `@prisma/config`'s config-merging). It's a stack-exhaustion DoS triggered by merging deeply recursive objects — not exploitable here, since the only thing being merged is this project's own trusted local Prisma config. Fixing it would mean downgrading Prisma to 6.12.0, which isn't worth it for a local single-user dev tool. Revisit next time Prisma deps are bumped.

## Roadmap

Not built yet, in rough priority order:

- **Multi-game price fetching** — Pokemon/sports via a TCG API (e.g. tcgapi.dev), sealed/graded via PriceCharting. The data model already supports any `game` value; only the Scryfall/MTG fetch path is wired up.
- **Portfolio rollup** — cost basis, market value and unrealized P&L across every
  Owned card, on the cards list. The per-card math is already in `src/lib/cost-basis.ts`;
  this is summing it.
- **Collection value over time** — total value (qty × latest price) of Owned cards,
  plotted over time, with total cost basis as a second line so the gap between them
  is the gain.
- **Realized P&L** — a `Sale` model (or signed-qty lots) for cards you flip.
- **Biggest movers** — cards with the largest % price change over a recent window.
- **Target-hit alerts** — surface (or notify on) Watching cards that just crossed their target price.
