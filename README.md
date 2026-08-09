# My Portfolio

A personal investment **display** app — no trading, no brokerage connection. It
reads a manually-entered purchase-lot history, pulls live prices, and computes
the same analytics a paid portfolio tracker would: money-weighted return,
risk stats, tax lots, and a Monte Carlo retirement projection. Deployed on
GitHub Pages: https://vdrxppy99.github.io/Investing-app/

Everything personal — holdings, lots, cash, goals — lives encrypted in the
browser's `localStorage`. Nothing is sent anywhere except live-price lookups
(by ticker only) and, optionally, an encrypted backup to the project's own
Cloudflare Worker.

## Tabs

| Tab | What it shows |
|---|---|
| **Home** | Greeting + market-open countdown, portfolio value with sparkline and allocation strip, Daily Movers bar chart, Coming Up (dividend ex-dates + confirmed earnings dates merged into one list), three portfolio-insight tiles (health grade, XIRR, vs. S&P 500), and the Goal card — a Monte Carlo projection ("N% chance of reaching $X by year Y" plus a p10/p50/p90 fan chart, assumptions stated inline) |
| **Markets** | Stock/ETF search with live prices, world indices, a gainers/losers/most-active screener, sector rows, diversification ideas |
| **Portfolio** | Total value with live day change, a Lightweight Charts hero (1D–Max, value/profit toggle, benchmark overlay, scrub to any date, buy markers, all-time-high line), sortable holdings with sparklines, allocation donut, dividend forecast, CSV/JSON export |
| **Insights** | Health score (A–F) breakdown, deposit-adjusted performance (modified Dietz + XIRR, benchmarked against the same purchases replayed into VOO), tax lots (short/long-term split), portfolio P/E, risk (volatility, beta, max drawdown), sector exposure, monthly-return heatmap |
| **Following** | Watchlist (star any stock from its detail sheet) with live prices, and the ETF look-through — "stocks you secretly own," aggregated from every fund you hold, the one feature commercial trackers generally don't offer at all |

The News tab that appeared in early versions was removed — it duplicated
Markets/Following and wasn't worth the maintenance. Do not reintroduce it.

## Architecture

Static site, **no build step, no framework, no bundler.** Plain `<script>`
tags loaded in a fixed order — every file shares one global scope, so a symbol
renamed in `core.js` breaks every file after it silently, and load order
matters. The app also sits behind a passcode/Face-ID lock screen, so most of
the app's own JS isn't loaded by `index.html` directly — `js/vault.js`
fetches it script-by-script, in order, only after the vault unlocks:

```
index.html            markup shell (5 tabs + tab bar + overlay sheets), CSP meta tag
css/tokens.css         the ONLY file allowed a literal hex/px/ms value — theme ramps, scales
css/base.css           reset, typography, focus, motion policy
css/components.css      every component (cards, rows, sheets, tabbar, charts, heatmap)
css/layout.css          shell, responsive breakpoints, desktop rail
js/i18n.js, icons.js,   loaded before the lock screen — it needs icons and the ui builders
  ui.js, vault.js
js/boot.js              theme bootstrap, Chart.js defaults      \
js/seed.js               offline-first baseline dataset          |
js/demo.js               "see an example portfolio" fixture       |
js/core.js               state, AES-256-GCM crypto, XIRR/Dietz     | loaded by
js/portfolio.js          Portfolio tab, Lightweight Charts hero     | vault.js,
js/api.js                live quote fetching + CORS-proxy fallback  | AFTER
js/explore.js            Markets + Following tabs                  | unlock
js/insights.js           Insights tab                              |
js/sheets.js              shared bottom sheets (holding detail,     |
                            stock view, explainers)                 |
js/monte-carlo.js        pure Monte Carlo engine (Worker + main)   |
js/app.js                tab switching, global wiring, init       /
js/tappable.js          delegated click handling for dynamic rows
js/monte-carlo-worker.js runs js/monte-carlo.js off the main thread (10k paths/run)
sw.js                   service worker: offline shell, network-first HTML
```

Two rules that are easy to violate silently — see `CLAUDE.md` and the
`sw-release` checklist:

1. **Bump `V` in `sw.js` on every css/js change.** If it doesn't change, the
   service worker keeps serving the old cached files to every installed
   client — no error, no console warning, just stale code that never updates.
2. **Register every new css/js file in `sw.js`'s `CORE` array**, and in
   `js/vault.js`'s `APP_SCRIPTS` if it's part of the post-unlock app. A file
   that's referenced but missing from both loads fine online and silently
   breaks offline installs.

Version numbers are **`PROUD.NORMAL.SHAME`**, not semver — see `sw.js`'s
header comment and the matching `CHANGELOG.md` entry before assuming
otherwise.

## The Cloudflare Worker

`worker/` (deployed as `portfolio-push`, Cloudflare's free tier) does
everything that needs a server:

- `/q` — CORS proxy for live Yahoo Finance quotes (the browser can't call
  Yahoo directly)
- `/earnings` — confirmed-earnings-date lookup, KV-cached 24h per symbol
- `/backup` — optional encrypted cloud backup of the vault
- `/ask` — an in-app AI assistant via Workers AI's free daily allocation
- cron-triggered daily open/close portfolio reports and intraday mover
  alerts, delivered via Web Push (VAPID)

Deploy with `npx wrangler deploy --config worker/wrangler.jsonc` from the
repo root.

## Security

- The app opens to a **lock screen**: a passcode (set on first launch, 8+
  characters, not all-numeric) or **Face ID** (WebAuthn passkey with the PRF
  extension, iOS 18+).
- Personal data (holdings, lots, cash, deposits, goal) is **AES-256-GCM
  encrypted at rest**; the master key is wrapped separately by the passcode
  (PBKDF2, 310,000 iterations) and by the Face ID passkey. Without unlocking,
  `localStorage` holds only ciphertext, and `js/seed.js` contains no personal
  data.
- A Content-Security-Policy is enforced via `<meta http-equiv>` in
  `index.html` (GitHub Pages sends no response headers, so this is the only
  delivery path available — no `frame-ancestors`/`report-uri`).
- Forgotten passcode = unrecoverable by design. Restore from an exported
  backup. Manage everything under ⚙︎ → Security.

## Testing

37 Playwright tests (`npx playwright test`), covering:

- a **golden-master snapshot** (`test/golden`) of every computed financial
  figure — total value, XIRR, modified Dietz returns, risk stats, health
  score, holdings — against a frozen demo dataset. A regression here means a
  number the user sees changed; regenerate the snapshot only when a change to
  the math is deliberate, never to make a failing diff pass.
- independently-derived closed-form checks for the pure math (XIRR, modified
  Dietz, tax-lot splits, volatility/beta/drawdown, the Monte Carlo engine's
  zero-volatility case) in `test/phase1` and `test/monte-carlo.spec.js` — the
  Monte Carlo engine's tests run in plain Node, no browser, since the engine
  is a pure function that has to run identically on the main thread and
  inside a Web Worker
- WCAG 2.2 AA accessibility (`@axe-core/playwright`, zero violations across
  every tab, plus keyboard-operability checks) and a Core Web Vitals pass
  (Chart.js lazy-loaded, not on the critical path)
- export/import round-trip, dead-control and active-state regressions, and a
  general smoke test across all five tabs

## Data

- All personal data lives in the browser's `localStorage` — nothing leaves
  the device except ticker-only price lookups and an opt-in encrypted backup.
  Back up manually via ⚙︎ → Export backup.
- Prices: Yahoo Finance's free `v8/finance/chart` endpoint (direct, then via
  the Worker's `/q` CORS proxy as fallback), frankfurter.dev for USD→EUR.
  `js/api.js` still has a stooq fallback wired in for delayed quotes, but per
  `DATA-SOURCES.md` stooq now serves a JS proof-of-work challenge instead of
  CSV — a known-broken fallback, not yet removed.
- Holdings are US-domiciled Vanguard funds in a US account; all tax modeling
  (tax lots, the Monte Carlo projection) is US-rules, pre-tax where the rules
  aren't implemented — not German investment tax.
- Seed snapshot from the Vanguard "Unrealized Summary" PDF, 2026-07-01.

## Native shell

`native/` is a thin iOS wrapper (SwiftUI + `WKWebView`) that loads the live
GitHub Pages build — the web app and the native app are one app on two
platforms by construction, not two codebases kept in sync by hand.
`scripts/sync-version.sh` keeps the version number honest across both.

## Development

`CLAUDE.md` has the full architecture, scope decisions, and rules for AI
assistants working on this repo. `UPGRADE_PLAN.md` is the phased history of
how the app got here — run one phase per session, in order.
