# CLAUDE.md - Investing App Context & Assistant Sync

Welcome Claude! This document maintains project context and state so both **Claude** and **Antigravity (Gemini)** can collaborate seamlessly on this repository without losing track of progress.

## Project Summary
- **App Name**: Personal Investment Display App
- **Live URL**: https://vdrxppy99.github.io/Investing-app/
- **Tech Stack**: Pure Vanilla HTML5, CSS3, JavaScript (ES6+), Service Worker (PWA), Chart.js. No build step or transpilation.

## Core Architecture & File Structure
- `index.html` — Page markup shell (3 tabs: Portfolio, Explore, Insights + overlay sheets). The News tab was removed by the owner; do not reintroduce it.
- `css/` — Layered stylesheet, four files, `@layer` order is **tokens, base, components, layout** and must be preserved:
  1. `tokens.css` — The ONLY file permitted to contain a literal hex, px or ms value. Dark/Light ramps, type & space scales, structural dimensions.
  2. `base.css` — Reset, typography defaults, focus, motion policy, numeral hardening.
  3. `components.css` — Every component (cards, rows, sheets, tabbar, FAB, tables, heatmap).
  4. `layout.css` — Shell, wrap, responsive breakpoints, desktop rail.
- `sw.js` — Service worker for offline PWA functionality (Network-first HTML, cached core assets).
- `js/` modules (Global scope script loading order):
  1. `boot.js` — Theme bootstrap, Chart.js defaults.
  2. `seed.js` — Offline-first baseline dataset snapshot.
  3. `core.js` — State management, AES-256 encryption, formatting, math (XIRR, Dietz).
  4. `portfolio.js` — Portfolio tab UI & hero charts.
  5. `api.js` — Live stock quote fetching (Yahoo, Stooq, Frankfurter) + CORS proxies.
  6. `explore.js` — Explore tab, stock search, watchlist, market screeners.
  7. `insights.js` — Insights tab, health score, tax lots, risk analysis.
  8. `sheets.js` — Bottom sheets, holding detail, stock view modals.
  9. `i18n.js` — German translation layer (dictionary + pattern pass over rendered text).
  10. `app.js` — Global app initialization, event handlers, tab navigation.

## Critical Developer Instructions
1. **Service Worker Versioning**: Whenever editing JS or CSS files, **always bump `CACHE_NAME` in `sw.js`**. If adding new JS/CSS files, include them in `CORE` array in `sw.js`.
2. **Data Security**: User data in `localStorage` is AES-256-GCM encrypted. Never commit raw personal financial data to git.
3. **No Build Step**: Keep all JS compatible directly in modern browsers without Babel/Webpack/Vite unless requested.

## Current Project Status
- **Latest Version**: v9.2.0 (UI/UX refactor: canvas ramp retarget, bottom keep-out unification, holdings-row grid, monthly-returns heatmap, localization pattern pass, chart standardisation).
- **Languages**: **EN/DE only.** There is no Spanish dictionary in `js/i18n.js`; the earlier ES claim was wrong and is corrected here.
- **Scope decisions by the owner — do NOT "restore" these:**
  - **News tab: removed.** Unused and not worth keeping. `js/news.js` no longer exists.
  - **`ACCOUNTS` is two entries** (`Main Account`, `Brokerage`) in `js/seed.js`. The six types added in v9.1.0 (Roth IRA, 401(k), Crypto Vault, …) are US-specific and the owner holds neither, so they were reverted. This is deliberate, not a regression.
- **Active Task / Goal**: v9.2.0 refactor complete. Every pure financial function (XIRR, modified Dietz, volatility/beta/max drawdown, tax-lot short/long-term split, same-buys-in-VOO benchmark) is verified against independently-derived expected values in [test/phase1/math.spec.js](test/phase1/math.spec.js), cross-checked with the `backtesting` skill's Python oracle where applicable — see that file's header comment for the exact derivations. The one disagreement found (`riskStats()` annualizing with a hardcoded 252 regardless of actual sampling interval) is fixed in `js/insights.js`; see the comments there and above `xirr()` in `js/core.js` for the day-count/annualization/stdev conventions used throughout.

## Traps & Gotchas
- **Demo-mode figures from two different manual page loads are not comparable.**
  `refreshAll(false).then(schedulePoll)` ([js/app.js:1090](js/app.js:1090)) fires
  a live price fetch on every boot — it is not gated on `window.DEMO_MODE` — so a
  browser session with real network access can have that fetch land (or fail)
  differently at every reload, changing the portfolio total and everything
  derived from it. A figure read by manually driving the app in a browser is
  comparable ONLY to other figures captured in that SAME page load; never
  compute a ratio, a delta, or a "before vs. after" across two separate manual
  reloads. Capture both halves of any comparison in one session, or use the
  seeded test harness instead — it IS seeded/deterministic, confirmed by
  reading the code rather than assumed: [test/helpers.js:7](test/helpers.js:7)
  freezes the clock to a fixed instant (`FROZEN_TIME`, via
  `page.clock.setFixedTime`) and [test/helpers.js:21](test/helpers.js:21)
  (`blockExternalNetwork()`) blocks every live price host, so quotes always
  fall back to the same baked `SEED_QUOTES` snapshot regardless of when the
  suite runs. Found the hard way in the 2026-08-17 session: a printed table of
  projected medians was divided by a `v0` from a *different* reload than the
  one that produced the medians, producing a confident but false "decaying
  growth rate" finding — see CHANGELOG.md's v2.6.161 entry for the full
  reconstruction.
- **A green `test/i18n-coverage.spec.js` run is not evidence that JS-emitted
  strings are translated.** Its candidate list comes only from existing
  `window.i18nDE` dictionary keys and static `index.html` text
  ([test/i18n-coverage.spec.js:64](test/i18n-coverage.spec.js:64)) — it never
  parses `.js` source, so a hardcoded English string living only inside a JS
  template literal is invisible to it until it already has a dictionary entry.
  See UPGRADE_PLAN.md's Backlog for the full finding and the `renderGoal()`
  string that shipped several "0 leaks" sessions untranslated because of
  exactly this blind spot.

## Dual Assistant Sync Log
- **2026-07-29**: Set up `.agents/AGENTS.md` and `CLAUDE.md` to establish a synchronized development workflow between Antigravity and Claude.
- **2026-07-29**: Upgraded to **v9.1.0**:
  - `index.html` & `js/i18n.js`: Set base language to English, added Spanish (ES) support, and bypassed MutationObserver for EN to achieve 0ms translation overhead.
  - `js/seed.js` & `js/portfolio.js`: Extended `ACCOUNTS` dictionary to support Taxable Brokerage, Roth IRA, Traditional IRA, 401(k), Crypto, and Cash. Rendered dynamic account filter chips.
  - `js/portfolio.js`: Upgraded rebalance calculator (`planDeposit`) to compute exact share quantities `@` current market price.
  - `js/sheets.js`: Enhanced `openStockSheet` to compute and display 50-day SMA, 200-day SMA, and trend signals.
  - `native/Portfolio/WebScreen.swift` & `js/tappable.js`: Integrated native iOS Swift Haptic Engine (`UIImpactFeedbackGenerator` & `UINotificationFeedbackGenerator`) via `window.BasisNative.haptic()`.
- **2026-07-30**: Upgraded to **v9.2.0** — a four-phase UI/UX refactor. No logic changes: `js/core.js`, `js/vault.js`, `js/api.js`, `js/seed.js` and `js/app.js` are untouched.
  - **Phase 1 — foundation** (`css/tokens.css`, `css/base.css`, `index.html`): retargeted the dark canvas/surface ramp to `#0B0F17`/`#161B22` and re-derived `--surface-grad`; added `--fab-size`, `--fab-gap`, `--tabbar-h`, `--safe-bottom`, `--bottom-clear` and `--heat-cell-min`; re-asserted `tabular-nums lining` on every numeric surface so digits cannot reflow during the Inter font swap.
  - **Phase 2 — primitives** (`css/components.css`, `css/layout.css`): stopped table headers breaking mid-word ("DIVIDE-NDEN") by confining `overflow-wrap: anywhere` to `td`; converted `.hrow` from flex to an explicit grid and clipped `.hinfo`, ending the holdings-row overlap; unified every fixed bottom element and scroll container on `--bottom-clear` / `--safe-bottom`, closing the ~32px band the FAB was covering.
  - **Phase 3 — macro views** (`js/insights.js`, `js/i18n.js`, `css/components.css`): the compressed monthly-returns heatmap was a class-name collision — `<table class="hm">` inherited the holding-row meta-text rule — so it was renamed to `.heatmap` and given real CSS; replaced the i18n digit guard (which silently refused every sentence containing a number) with a numeric-only guard plus a capture-group pattern pass, so coach items no longer render English under German titles.
  - **Phase 4 — charting** (`js/portfolio.js`, `js/insights.js`): standardised curve tension (0.35 observed, 0.2 modelled) and added `cubicInterpolationMode: 'monotone'` so the bezier can no longer overshoot below a local minimum and draw a loss that never happened; extracted one shared `CHART_TOOLTIP` (colour keys are accessors, so the live theme toggle still repaints).
- **2026-08-02**: Portfolio hero chart (`#mainChart` only) rebuilt on **Lightweight Charts v5.2.0** (`vendor/lightweight-charts.standalone.production.js`, registered in `sw.js` CORE), replacing Chart.js for that one surface — every other chart (holding detail, drawdown, worth, contributions, dividend calendar, allocation donut) is untouched and still Chart.js. `js/portfolio.js`: `drawHeroChart()`/`attachHeroScrub()` replace the old `hero`-branch of `drawChart()`/`attachScrub()`; `heroFx` (the up/down glow-shadow canvas plugin) is deleted — gain/loss now reads from the sign/pill next to the chart, not line colour, so the series is one accent colour (`--brand`) regardless of direction, with `--mut` for the benchmark overlay (UPGRADE_PLAN.md Phase 2 design constraint: colour-only gain/loss encoding is invisible to ~8% of men). `js/api.js`: `updateChartLive()` now calls the series' own `update()` instead of mutating a Chart.js dataset in place; the old "trend flipped → full redraw" branch is gone with the up/down colouring it existed for. Foot-gun hit and fixed: `chart.timeScale().fitContent()` pads sparse ranges (a 22-point month, a 2-point weekly-baked range) with empty space on the left instead of stretching the line edge-to-edge; `setVisibleLogicalRange({from:0, to:n-1})` is used instead. **Correction (2026-08-02, Phase 3):** that fix was incomplete — `setVisibleLogicalRange` alone still padded genuinely sparse ranges (verified by isolated reproduction); `fixLeftEdge`/`fixRightEdge`/`rightOffset:0` at `createChart()` time were also required. See the Phase 3 entry below. Bundle size: `vendor/lightweight-charts.standalone.production.js` adds 196,203 bytes raw / 61,589 gzipped (~28.8% over the pre-existing `chart.umd.min.js` + app total of 680,888 raw / 213,770 gzipped) — additive, not a swap, since Chart.js is still load-bearing for every other chart.
- **2026-08-02**: Phase 3 ("Feel") — critique first (six weakest points logged against visual hierarchy/spacing/alignment/type scale/state coverage/touch targets), fixed the worst three, then a motion pass. Fixed: (1) `.hsym` holdings-row markup (`js/portfolio.js`) + CSS (`components.css`) — the fund name and ticker were one truncating block, so the ellipsis could eat the ticker (the one reliable per-row identifier) before the descriptive name; now only `.hname` shrinks, `.htick` never does. (2) Two bare inline text links (`#tgtEditLnk`, `#goalEdit`) and the `.cq` info-badge were 13-14px tall — under WCAG 2.2 AA's 24px minimum (2.5.8) — given invisible hit-area expansion (padding+negative-margin for the links, an absolutely-positioned `::before` for the badge) via the new `--tap-sm: 24px` token; no visual change. (3) The Phase 2 chart-squish bug (see correction above) — `fixLeftEdge`/`fixRightEdge`/`rightOffset:0` added to `drawHeroChart()`'s `timeScale` options. Motion: tab switches (`js/app.js`) now use the View Transitions API with a directional slide matching the tabbar order, feature-detected (`document.startViewTransition`) and focus-routed to the new tab's heading (`pfTitle`/`exploreTitle`/`insightsTitle`, all now `tabindex="-1"`); `#tvNum` gets a roll-up tween (`rollUpTvNum()` in `js/app.js`) on every value change after the first render, using `--dur-data` — not a new token, the one already named for this. `css/base.css`'s existing `prefers-reduced-motion` block is extended (not duplicated) to also neutralize `::view-transition-*`, which the pre-existing `*::before/*::after` rule doesn't reach; `animateTotal()`'s pre-existing gap (no reduced-motion check at all) is also closed. No math/state files touched; Phase 0 suite green throughout, golden master unchanged (verified, not assumed).
