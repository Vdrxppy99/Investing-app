/* Portfolio app service worker — offline shell + instant load.
   Only manages the app shell and CDN libraries; live price APIs bypass the SW entirely. */
const V = 'pt-v9.7.2'; // ⚠ bump on EVERY deploy — semver epoch (renumbered from the old v10.x line): MAJOR redesign · MINOR features · PATCH fixes
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
// ⚠ adding a new js/css file to the app? It MUST be added here too (and V bumped),
//   or offline/first-load installs will silently miss it.
const CORE = ['./', './index.html', './manifest.webmanifest',
  // The stylesheet is now four layered files (app.css was deleted in the redesign).
  './css/tokens.css', './css/base.css', './css/components.css', './css/layout.css',
  './js/i18n.js', './js/icons.js', './js/ui.js', './js/tappable.js',
  './js/vault.js', './js/boot.js', './js/seed.js', './js/demo.js', './js/core.js', './js/portfolio.js', './js/api.js',
  './js/explore.js', './js/insights.js', './js/sheets.js', './js/app.js',
  './apple-touch-icon.png', './icon-192.png', './icon-512.png',
  // Chart.js is vendored now rather than fetched from a CDN. Loading it remotely
  // meant the app could not chart at all offline, however well the SW behaved.
  './vendor/chart.umd.min.js',
  // Lightweight Charts — Portfolio hero chart only (js/portfolio.js), same offline reasoning.
  './vendor/lightweight-charts.standalone.production.js'];

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
