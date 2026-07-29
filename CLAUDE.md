# CLAUDE.md - Investing App Context & Assistant Sync

Welcome Claude! This document maintains project context and state so both **Claude** and **Antigravity (Gemini)** can collaborate seamlessly on this repository without losing track of progress.

## Project Summary
- **App Name**: Personal Investment Display App
- **Live URL**: https://vdrxppy99.github.io/Investing-app/
- **Tech Stack**: Pure Vanilla HTML5, CSS3, JavaScript (ES6+), Service Worker (PWA), Chart.js. No build step or transpilation.

## Core Architecture & File Structure
- `index.html` — Page markup shell (4 tabs: Portfolio, News, Explore, Insights + overlay sheets).
- `css/app.css` — Modern design system (Emerald-on-black, Dark/Light modes, micro-animations).
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
  9. `news.js` — News tab & RSS/headline feed per ticker.
  10. `app.js` — Global app initialization, event handlers, tab navigation.

## Critical Developer Instructions
1. **Service Worker Versioning**: Whenever editing JS or CSS files, **always bump `CACHE_NAME` in `sw.js`**. If adding new JS/CSS files, include them in `CORE` array in `sw.js`.
2. **Data Security**: User data in `localStorage` is AES-256-GCM encrypted. Never commit raw personal financial data to git.
3. **No Build Step**: Keep all JS compatible directly in modern browsers without Babel/Webpack/Vite unless requested.

## Current Project Status
- **Latest Version**: v9.1.0 (Institutional grade upgrade: Multi-language EN/DE/ES engine, multi-account classification, rebalance calculator with share counts, SMA 50/200 & Trend Signals, native iOS Haptic bridge).
- **Active Task / Goal**: Core institutional upgrades completed and verified on iOS Simulator.

## Dual Assistant Sync Log
- **2026-07-29**: Set up `.agents/AGENTS.md` and `CLAUDE.md` to establish a synchronized development workflow between Antigravity and Claude.
- **2026-07-29**: Upgraded to **v9.1.0**:
  - `index.html` & `js/i18n.js`: Set base language to English, added Spanish (ES) support, and bypassed MutationObserver for EN to achieve 0ms translation overhead.
  - `js/seed.js` & `js/portfolio.js`: Extended `ACCOUNTS` dictionary to support Taxable Brokerage, Roth IRA, Traditional IRA, 401(k), Crypto, and Cash. Rendered dynamic account filter chips.
  - `js/portfolio.js`: Upgraded rebalance calculator (`planDeposit`) to compute exact share quantities `@` current market price.
  - `js/sheets.js`: Enhanced `openStockSheet` to compute and display 50-day SMA, 200-day SMA, and trend signals.
  - `native/Portfolio/WebScreen.swift` & `js/tappable.js`: Integrated native iOS Swift Haptic Engine (`UIImpactFeedbackGenerator` & `UINotificationFeedbackGenerator`) via `window.BasisNative.haptic()`.

