/* Edge quote proxy — GET /q?u=<yahoo url>.
   Why: the app's free public CORS proxies (allorigins, corsproxy.io) are third parties
   that see every request and flake under load. This serves the same bytes from OUR
   worker with a short in-memory cache — one fast, private, reliable source, with the
   public proxies demoted to fallbacks in the app's PROXIES list. */
import { ORIGINS } from './shared.js';

/* Only Yahoo's public read-only market-data GETs — anything looser would make this an
   open proxy on the free 100k req/day budget. Covers every tryFetch() Yahoo call in the
   app: quotes/history/intraday/dividends (v8 chart), news + search (v1 search),
   Explore screeners (v1 screener). stooq/frankfurter stay on the app's direct path. */
const ALLOWED_URL = /^https:\/\/query[12]\.finance\.yahoo\.com\/(v8\/finance\/chart\/[A-Za-z0-9^.=\-%]+\?|v1\/finance\/search\?|v1\/finance\/screener\/predefined\/saved\?)/;

const cache = new Map(); // key -> {ts, ttl, status, body, ct} — per-isolate; the Cache API is a no-op on *.workers.dev
const CACHE_MAX = 400;

/* live 1d charts power the in-app tickers — keep them near-real-time; everything else
   (10y history, dividends, search, screeners) barely changes intraday */
const ttlFor = u => /v8\/finance\/chart\/.+range=1d/.test(u) ? 25e3 : 10 * 60e3;

export async function handleQuoteProxy(req, cors) {
  if (!ORIGINS.includes(req.headers.get('origin') || '')) return new Response('forbidden', { status: 403, headers: cors });
  let target;
  try { target = new URL(new URL(req.url).searchParams.get('u') || ''); } catch (_) { return new Response('bad url', { status: 400, headers: cors }); }
  target.searchParams.delete('_'); // the app's cache-buster — Yahoo ignores it, but it would zero the hit rate here
  const key = target.toString();
  if (!ALLOWED_URL.test(key)) return new Response('url not allowed', { status: 403, headers: cors });
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < hit.ttl) {
    return new Response(hit.body, { status: hit.status, headers: { ...cors, 'content-type': hit.ct, 'x-cache': 'hit' } });
  }
  let r;
  try {
    r = await fetch(key, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept': 'application/json' } });
  } catch (_) { return new Response('upstream unreachable', { status: 502, headers: cors }); }
  const body = await r.text();
  const ct = r.headers.get('content-type') || 'application/json';
  if (r.ok && body.length > 5) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // evict the oldest entry
    cache.set(key, { ts: Date.now(), ttl: ttlFor(key), status: r.status, body, ct });
  }
  return new Response(body, { status: r.status, headers: { ...cors, 'content-type': ct, 'x-cache': 'miss' } });
}

/* single quote for the report/alert crons — moved here from index.js so alerts.js can
   share it without an import cycle */
export async function fetchQuote(sym) {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept': 'application/json' } });
      if (!r.ok) continue;
      const m = (await r.json())?.chart?.result?.[0]?.meta;
      if (m && m.regularMarketPrice > 0) return { price: m.regularMarketPrice, prev: m.chartPreviousClose > 0 ? m.chartPreviousClose : (m.previousClose > 0 ? m.previousClose : 0) };
    } catch (_) { /* try next host */ }
  }
  return null;
}
