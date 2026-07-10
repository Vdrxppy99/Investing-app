# My Portfolio

A personal investment **display** app (no trading) — live prices, real purchase-lot history, and premium-app analytics for a Vanguard portfolio. Deployed on GitHub Pages: https://vdrxppy99.github.io/Investing-app/

## Tabs

| Tab | What it shows |
|---|---|
| **Portfolio** | Total value with live day change, hero chart (1D–Max, value/profit, benchmark overlay cycling S&P 500 → Total World, scrub to any date, buy markers, all-time-high line), today's drivers (day-change attribution), sortable holdings with sparklines, allocation donut, dividend forecast + 12-month payout calendar, goal tracker; CSV + JSON export |
| **News** | Headlines matched to each fund you own plus the broad market, filterable per symbol (Yahoo Finance feed, 20-min cache) |
| **Explore** | Stock/ETF search, watchlist (☆ any stock), world indices, diversification ideas, "stocks you secretly own" (ETF look-through), most active / gainers / losers |
| **Insights** | Health score (A–F), deposit-adjusted performance (modified Dietz + XIRR + same-buys-in-VOO benchmark), gains reporting, tax lots, portfolio P/E, risk (volatility/beta/drawdown), sectors, monthly-return heatmap, asset worth, contributions |

## Architecture

Static site, no build step — plain JS files loaded in order (they share one global scope, so load order matters):

```
index.html          markup shell (4 pages + tab bar + overlay sheets)
css/app.css         design system (dark default + light theme via CSS variables)
js/boot.js          strict mode, palette, theme bootstrap, Chart.js defaults
js/seed.js          holdings/lots/quotes/history snapshot baked in (offline-first)
js/core.js          state + localStorage, formatting, portfolio math (XIRR, lots)
js/portfolio.js     Portfolio tab: header, chart series, holdings, edit sheet
js/api.js           Yahoo/stooq/frankfurter fetching with CORS-proxy fallbacks
js/explore.js       Explore tab: search, watchlist, indices, ideas, screeners
js/insights.js      Insights tab: health, performance, tax, risk, heatmaps
js/sheets.js        shared bottom sheets (holding detail, stock view, explainers)
js/news.js          News tab: per-holding headlines, filter chips
js/app.js           tab switching, global wiring, pull-to-refresh, init
sw.js               service worker: offline shell, network-first HTML
```

## Deploying

Push to `main` — GitHub Pages serves the repo root.
**Always bump `V` in `sw.js`** when changing any css/js file, or installed clients keep the old cached version.

## Security

- The app opens to a **lock screen**: a passcode (set on first launch) or **Face ID** (optional, WebAuthn passkey with the PRF extension, iOS 18+).
- Personal data (holdings, lots, cash, deposits, goal) is **AES-256-GCM encrypted at rest**; the master key is wrapped separately by the passcode (PBKDF2, 310k iterations) and by the Face ID passkey. Without unlocking, localStorage holds only ciphertext and `js/seed.js` contains no personal data.
- Forgotten passcode = unrecoverable by design — restore from an exported backup. Manage everything under ⚙︎ → Security.

## Data

- All personal data lives in the browser's localStorage (nothing leaves the device). Back up via ⚙︎ → Export backup.
- Prices: Yahoo Finance free endpoints (direct, then via CORS proxies), stooq as delayed fallback, frankfurter.dev for USD→EUR.
- Seed snapshot from the Vanguard "Unrealized Summary" PDF, 2026-07-01.
