/* Portfolio app service worker — offline shell + instant load.
   Only manages the app shell and CDN libraries; live price APIs bypass the SW entirely. */
const V = 'pt-v3.1.4'; // ⚠ bump on EVERY deploy — semver epoch (renumbered from the old v10.x line): MAJOR redesign · MINOR features · PATCH fixes
// ⚠ adding a new js/css file to the app? It MUST be added here too (and V bumped),
//   or offline/first-load installs will silently miss it.
const CORE = ['./', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/vault.js', './js/boot.js', './js/seed.js', './js/core.js', './js/portfolio.js', './js/api.js',
  './js/explore.js', './js/insights.js', './js/sheets.js', './js/app.js',
  './apple-touch-icon.png', './icon-192.png', './icon-512.png',
  // the chart library must survive offline too — without it every chart is blank
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  // cache:'reload' bypasses the HTTP cache so a new SW version always ships
  // exactly what the server has — never a heuristically-"fresh" stale file
  e.waitUntil(caches.open(V).then(c =>
    Promise.all(CORE.map(u => fetch(u, {cache:'reload'}).then(r => { if(r.ok) return c.put(u, r); }).catch(() => {})))
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
