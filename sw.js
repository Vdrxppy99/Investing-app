/* Portfolio app service worker — offline shell + instant load.
   Only manages the app shell and CDN libraries; live price APIs bypass the SW entirely. */
const V = 'pt-2.6.140'; // ⚠ bump on EVERY deploy — this is NOT semver, see below
// ── VERSION SCHEME — PROUD.NORMAL.SHAME (as of this line; do NOT "correct" it back
// to semver) ────────────────────────────────────────────────────────────────────
// First number: releases the owner is genuinely proud of. Second: normal feature
// releases. Third: bug fixes and small things he'd rather not admit to. None of the
// three numbers means MAJOR/MINOR/PATCH — a big third-number jump is not a crisis,
// it just means a lot of small embarrassing things got fixed. See CHANGELOG.md's
// entry for this version for the full rationale. All history below this line, back
// through v9.x/v8.x/etc., was written under the OLD semver-ish scheme and is left
// as-is — do not renumber past entries to fit the new one.
// v9.11.0 — UPGRADE_PLAN.md Phase 6 (final): the deterministic goal ETA (js/app.js
// renderGoal(), "compound today's money at your trailing return") is replaced by a
// parametric Monte Carlo projection — 10,000 paths, seeded deterministically
// (js/monte-carlo.js runMonteCarloProjection()), real return N(7%,12%)/yr and
// inflation N(2%,0.8%)/yr drawn independently per path per year, contributions
// derived from the portfolio's own non-dividend lot history (js/app.js
// deriveMonthlyContribution()) added in fixed nominal dollars and deflated back to
// today's dollars by that path's own realized inflation. state.goal gains a
// required `year` field (js/app.js renderGoalForm()) — existing goals with only
// `amt` render a "set a target year" prompt rather than guessing one. Runs in a new
// Worker (js/monte-carlo-worker.js) so 10k paths never touch the main thread — the
// v9.10.3 session measured worst interaction at 104-160ms against the 200ms INP
// target and this does not regress it (main-thread dispatch measured, not assumed;
// see CHANGELOG.md). Home's #goalCard now shows "N% chance by <year>" plus a
// p10/p50/p90 fan chart (Lightweight Charts, already loaded for the hero chart —
// Chart.js is not pulled back onto this path) and states its own assumptions
// (return/inflation means+SDs, the derived contribution rate or its absence,
// pre-tax) inline rather than showing a bare percentage. Edge cases each render
// their own message instead of throwing: no goal, goal already reached, target
// year in the past, and too little purchase history to derive a contribution rate
// (fewer than 2 distinct purchase months) — all covered in test/monte-carlo.spec.js
// (engine, pure Node, no browser) plus this session's manual browser verification.
// US-domiciled holdings: projection is explicitly pre-tax, no German investment tax
// modeled (Vorabpauschale/Teilfreistellung/Sparerpauschbetrag do not apply and are
// not implemented — see UPGRADE_PLAN.md Phase 6). No existing financial maths
// touched; golden master figures (test/golden) don't cover goal/projection state at
// all, verified unchanged.
// v9.4.0 — UPGRADE_PLAN.md Phase R1: Portfolio screen rebuilt on DESIGN-TARGET.md
// (indigo brand, hairline cards, allocation strip, holdings grouped by asset
// class), plus the real .sheet__head/.sheet__body scroll fix for #detailSheet
// and #editSheet. No financial maths touched.
// v9.5.0 — UPGRADE_PLAN.md Phase R2: Insights screen restructured from ~20
// stacked cards into a health card + 6-tile module grid + heatmap + sector
// strip, everything else demoted into lazily-rendered detail sheets (js/insights.js,
// index.html, js/app.js). openTaxSheet/openSectorSheet/openLocSheet (js/sheets.js)
// routed through the R1 .sheet__head/.sheet__body primitive. Categorical
// palette position 4 corrected (was byte-identical to --gain) in css/tokens.css
// and redesign/contrast-check.mjs. No financial maths touched.
// v9.6.0 — UPGRADE_PLAN.md Phase R3: Explore split into two tabs, Markets
// (search, indices, screeners, sectors, ideas) and Following (watchlist, plus
// the ETF look-through promoted to a headline section — index.html, js/explore.js,
// js/app.js, js/sheets.js, js/i18n.js). Sector rows are now a plain krow list
// instead of heat-tinted inline-styled tiles. TAB_ORDER (js/app.js) updated to
// the new four-tab order for correct view-transition slide direction. No
// financial maths touched.
// v9.7.0 — UPGRADE_PLAN.md Phase R4 (final): Home tab added as the new landing
// screen (index.html, js/app.js, js/portfolio.js, js/insights.js) — greeting +
// market-open countdown, portfolio card w/ sparkline + allocation strip +
// period-return pills (#homePr, owed from R1), Today's movers (w/ the "vs S&P
// 500 today" narrative, owed from R1), Coming up (dividend ex-dates), Goal
// (flat progress bar, replacing the old ring). TAB_ORDER now five tabs:
// home, markets, portfolio, insights, following. No financial maths touched;
// renderHomePr()/renderComingUp() read only pre-existing computed values.
// v9.7.1 — cleanup: Insights "Max drawdown" tile (js/insights.js renderModGrid)
// was appending a literal '%' after fmtPct(), which already appends one,
// rendering "−12.98%%"; the other five module tiles don't use fmtPct+'%' and
// were unaffected. js/portfolio.js drawHeroChart() sets attributionLogo:false
// (Apache-2.0 permits removing Lightweight Charts' built-in TradingView logo
// from the hero chart's bottom-left corner). No financial maths touched.
// v9.7.2 — fix: desktop rail nav (.rail-nav__item, >=1024px) had no click handler at
// all — only .tabbar__item was bound (js/app.js), so left-rail navigation was
// completely inert on wide viewports. Both now share one handler (haptics, view
// transitions, TAB_ORDER direction, heading focus). showPage() also now keeps
// aria-current="page" in sync on every nav button, not just .on — it was static
// markup stuck on "Home" forever, and since css/layout.css's
// `.rail-nav__item[aria-current="page"]` rule sits in a later @layer than
// components.css's `.on` rule, the rail would have shown Home permanently
// highlighted regardless of the real active tab. No financial maths touched.
// v9.7.3 — Phase 5 vault audit fixes (js/portfolio.js, js/vault.js): exportBackup()
// no longer includes pt_bk (was exporting the raw cloud-backup key + passcode
// verifier alongside plaintext holdings); importBackup() no longer accepts a
// bk field from a backup file at all. Passcode minimum raised 6→8 chars and
// all-numeric passcodes rejected, enforced once in js/vault.js (passcodeError)
// and applied to both first-time setup and vaultChangePass — PBKDF2 iteration
// count (310,000) untouched. No financial maths touched.
// v9.7.4 — Content-Security-Policy added (index.html <meta http-equiv>, the only
// delivery path on GitHub Pages — no response headers, so no frame-ancestors/
// report-uri). connect-src/img-src derived from js/api.js and js/seed.js's real
// fetch/image origins. Two footguns found and fixed empirically, not just
// removed for the policy: js/app.js haptic() used style.cssText (blocked under
// style-src without 'unsafe-inline'); js/core.js badgeHtml() built
// onload=/onerror= as literal HTML attributes on an innerHTML'd <img> (blocked
// under script-src with no 'unsafe-inline', even though the handlers are
// JS-authored, not markup-authored) — replaced with two capture-phase
// document listeners keyed off the .blogo class. style-src still needs
// 'unsafe-inline' (split as style-src-attr, so <style> tag injection stays
// blocked): ~82 sites across portfolio.js/insights.js/explore.js/sheets.js
// compute per-render inline style="" (bar widths, hash-derived badge
// gradients) that neither a nonce nor a CSP hash can cover, since the values
// differ every render. No financial maths touched.
// v9.7.5 — session close-out, three small fixes: (1) C-1 — js/vault.js's #unlockPass,
// #setPass1/#setPass2 and #restorePass now clear on the SUCCESS path too, not just on
// failure, so the plaintext passcode no longer sits in the live DOM for the rest of the
// tab's life after a real unlock (verified empirically, not by reading the code — see
// UPGRADE_PLAN.md Backlog C-1). (2) js/insights.js renderCoach() now esc()s x.title/
// x.detail before they reach innerHTML — local-only today, defence-in-depth. (3) added
// test/export-import.spec.js: the export/import round-trip had zero prior coverage and
// is the one path where a bug loses the whole portfolio; it also asserts the exported
// JSON carries no `bk` key, the TP-1 regression guard. No financial maths touched.
// v9.7.6 — three bug fixes (js/app.js, css/components.css), no new features. (1) Logo/
// monogram stacking: css/components.css's crossfade rule read `.blogo img.on` — a
// descendant-img selector that never matched, because badgeHtml() (js/core.js) has always
// put .blogo directly ON the <img> itself (bug present since the rule's very first commit,
// e6d8396 — not a CSP-refactor regression). opacity:0-until-.on never applied, so the logo
// sat at opacity:1 from insertion and showed through/over the monogram on any logo with
// transparent pixels. Fixed the selector to match the real markup (`.blogo`/`.blogo.on`);
// verified pre-load opacity is 0 and post-load is 1, and that a row with the logo host
// blocked still renders the monogram with no broken row. (2) Hero chart lines
// thicken-then-snap-back after a Portfolio tab switch: measured (Playwright, canvas.width/
// height vs their own getBoundingClientRect()) a genuine ~30-130ms window where Lightweight
// Charts' autoSize/ResizeObserver recovery from a 0×0 (display:none) container produces a
// non-uniform bitmap:CSS mismatch (e.g. bitmap height 720px for a 240px CSS box) — this
// lives inside the vendor bundle's minified autoSize implementation; every manual resize()/
// applyOptions() nudge attempted relocated the same transient rather than removing it, so
// showPage() now veils #mainChart (opacity, not display — the box stays measurable) for a
// verified-safe 220ms after Portfolio becomes visible, past every measured settle time.
// (3) Two range chips lit at once: js/app.js's #metricSeg/#rangeSeg click handlers synced
// only the .on class, never aria-selected, so index.html's hardcoded default (Profit/1M)
// stayed aria-selected="true" forever — and since components.css's `[aria-selected="true"]`
// rule paints the identical solid-fill highlight as `.on` by design, the default chip and
// whichever one was actually clicked both rendered lit. Same class of bug as the rail-nav
// fix in commit 1b374e9. Verified by reading aria-selected across every chip after
// clicking: exactly one lit, every time. No financial maths touched.
// v9.8.0 — Home v2 §1: Daily Movers bar chart (index.html, js/app.js, css/tokens.css,
// css/components.css) replaces the old text-row "Today's movers" list and moves to the
// top of Home, above the portfolio card. Divs and CSS, no chart library — up to five
// columns on a shared baseline (--mv-zone bottom-anchors the % label + bar per column,
// so every badge/ticker still lines up regardless of that column's own bar height), a
// working gainers/losers toggle (#moverToggle, wired with the same syncSel fix
// #metricSeg/#rangeSeg needed in v9.7.6 — built correct from the start, not a fourth
// instance), bar height proportional to the largest absolute move in the visible set,
// floored at --mv-bar-min so a near-zero move still shows a sliver. #moverTotal/
// #moverNarrative retired with the old section — Home v2's header ("Stay on top" / "Your
// Daily Movers") has no slot for them. Two smaller fixes alongside it: (1) badgeHtml()
// now renders in the asset-detail sheet head (js/sheets.js openStockSheet, js/portfolio.js
// openDetail) — both showed plain ticker text with no logo/monogram at all. (2) the 220ms
// chart-settling veil added in v9.7.6 is now --dur-chart-settle (css/tokens.css), read via
// parseFloat(cvar(...)) like --dur-data already was, instead of a literal in js/app.js.
// Added test/active-state.spec.js: a regression guard for the "hardcoded active state never
// cleared" bug class fixed three times now (rail-nav, commit 1b374e9; #metricSeg/#rangeSeg,
// v9.7.6; and this session's moverToggle, built correct from the start) — asserts exactly
// one element lit (.on class OR aria-current/aria-selected) across tabbar, rail-nav,
// #rangeSeg, #metricSeg and #moverToggle after every possible click. No financial maths
// touched.
// ⚠ adding a new js/css file to the app? It MUST be added here too (and V bumped),
//   or offline/first-load installs will silently miss it.
const CORE = ['./', './index.html', './manifest.webmanifest',
  // The stylesheet is now four layered files (app.css was deleted in the redesign).
  './css/tokens.css', './css/base.css', './css/components.css', './css/layout.css',
  './js/i18n.js', './js/icons.js', './js/ui.js', './js/tappable.js',
  './js/vault.js', './js/boot.js', './js/seed.js', './js/demo.js', './js/core.js', './js/portfolio.js', './js/api.js',
  './js/explore.js', './js/insights.js', './js/sheets.js', './js/monte-carlo.js', './js/monte-carlo-worker.js', './js/app.js',
  './apple-touch-icon.png', './icon-192.png', './icon-512.png',
  // Lightweight Charts — Portfolio hero chart only (js/portfolio.js), needed on first
  // paint, so it's still precached. Vendored not CDN'd, so the app can chart offline.
  './vendor/lightweight-charts.standalone.production.js'];
  // vendor/chart.umd.min.js is deliberately NOT in CORE (Phase 4): it's
  // lazy-loaded on first use (js/boot.js ensureChartJs()) rather than fetched on
  // every install whether or not it's ever needed. The fetch handler below still
  // caches it at runtime the first time it's actually requested — same offline
  // guarantee after first use, just not paid for on installs that never open a
  // chart-needing sheet.

self.addEventListener('install', e => {
  self.skipWaiting();
  // cache:'reload' bypasses the HTTP cache so a new SW version always ships exactly what the
  // server has. Each fetch has an 8s abort so a slow/blocked CDN can NEVER stall activation —
  // a hung install used to leave the worker stuck "installing" forever, breaking push.
  e.waitUntil(caches.open(V).then(c =>
    Promise.all(CORE.map(u => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      return fetch(u, {cache:'reload', signal:ctl.signal})
        .then(r => { clearTimeout(t); if(r.ok) return c.put(u, r); })
        .catch(() => { clearTimeout(t); }); // best-effort: a missed file just isn't pre-cached
    }))
  ));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
/* ---- daily report notifications (see worker/ — the payload arrives as ready-to-show
   JSON text, already decrypted by the browser from its end-to-end encryption) ---- */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { body: (e.data && e.data.text()) || '' }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'My Portfolio', {
      body: d.body || '',
      tag: d.tag || 'portfolio',   // same-tag replaces: never a pile of stale reports
      data: { url: './' }
    });
    // iOS 16.4+: red badge on the app icon = number of unread cards on the lock screen
    try { if (navigator.setAppBadge) await navigator.setAppBadge((await self.registration.getNotifications()).length); } catch (_) {}
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  try { if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (_) {}
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if ('focus' in w) return w.focus(); }
    return clients.openWindow('./');
  }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isLib = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  // Never touch live data APIs (Yahoo, proxies, FX) — let the browser handle them normally.
  if (!sameOrigin && !isLib) return;
  // Network-first for the app document so new versions always land when online.
  if (req.mode === 'navigate' ||
      (sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')))) {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }
  // Cache-first for shell assets + libraries.
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => m))
  );
});
