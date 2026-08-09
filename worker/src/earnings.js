/* Earnings-date proxy — GET /earnings?syms=AAPL,MSFT.
   Source: earningswhispers.com's own internal ajax endpoint (api/getstocksdata/{ticker}) — the
   one that populates their site's own earnings-date widget (found by reading their stocks.js).
   Unofficial/undocumented, same grey-area personal-use footing as the Yahoo endpoints in
   quotes.js (see DATA-SOURCES.md) — no key, no signup, not for republishing.

   Only rows with a non-null confirmDate are surfaced: confirmDate null means EarningsWhispers'
   own model estimate from historical cadence, not a company-announced date, and the app's design
   brief (DESIGN-TARGET.md §2) is explicit that a guessed date must never be shown — omitting the
   row is the correct behaviour, not a bug.

   ETFs (and anything else the source doesn't recognise) come back non-200/garbage HTML; that
   failure IS the correct "no earnings" signal for a fund, and is cached the same as a real miss
   so a portfolio that's mostly ETFs doesn't retry every symbol on every KV expiry. */
import { ORIGINS } from './shared.js';

const SYM_RE = /^[A-Z0-9.\-]{1,10}$/;
const TTL = 24 * 3600; // seconds — matches the app's own 24h client-side cache (ensureDivs/ensureEarnings)
const MAX_SYMS = 40;

async function fetchOne(sym) {
  try {
    const r = await fetch(`https://www.earningswhispers.com/api/getstocksdata/${encodeURIComponent(sym)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': `https://www.earningswhispers.com/stocks/${sym}`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    if (!r.ok) return null; // ETFs and unknown tickers 500 here — that's the "no earnings" case
    const j = await r.json();
    if (!j || !j.nextEPSDate || !j.confirmDate) return null; // unconfirmed = their own estimate, not a real date
    return { date: j.nextEPSDate.slice(0, 10), q: j.quarter, qy: new Date(j.quarterDate).getUTCFullYear() };
  } catch (_) { return null; }
}

export async function handleEarningsProxy(req, env, cors) {
  if (!ORIGINS.includes(req.headers.get('origin') || '')) return new Response('forbidden', { status: 403, headers: cors });
  const raw = (new URL(req.url).searchParams.get('syms') || '').toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
  const syms = [...new Set(raw)].filter(s => SYM_RE.test(s)).slice(0, MAX_SYMS);
  if (!syms.length) return new Response('{}', { status: 200, headers: { ...cors, 'content-type': 'application/json' } });
  const out = {};
  await Promise.all(syms.map(async sym => {
    const key = `earn:${sym}`;
    const cached = await env.KV.get(key, 'json'); // null only when the key has never been set — {d:...} once cached, hit or miss
    if (cached) { out[sym] = cached.d; return; }
    const data = await fetchOne(sym);
    out[sym] = data;
    await env.KV.put(key, JSON.stringify({ d: data }), { expirationTtl: TTL });
  }));
  return new Response(JSON.stringify(out), { status: 200, headers: { ...cors, 'content-type': 'application/json' } });
}
