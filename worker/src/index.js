/* portfolio-push — Cloudflare Worker (free tier) behind the My Portfolio PWA:
   daily market-open/close lock-screen reports, intraday mover alerts (alerts.js),
   and the app's edge quote proxy (GET /q — quotes.js).

   KV keys:  token    — bearer token, trust-on-first-use (single user)
             sub      — the phone's push subscription
             snapshot — {holdings:[{sym,qty}], cash, prices:{sym:{price,prev}}, ts} synced by the app
             last     — {open:'YYYY-MM-DD', close:'YYYY-MM-DD'} so a report never sends twice
             moved    — {date, syms:[…]} so an intraday ±2% mover alerts once per day
   Secrets:  VAPID_PRIVATE_JWK · VAPID_SUB · ADMIN_TOKEN     Vars: VAPID_PUB

   Crons fire in UTC and US DST moves — so each report has TWO crons (EDT + EST slot)
   and the ET wall-clock window check below picks whichever is correct that day. */
import { sendWebPush } from './webpush.js';
import { handleQuoteProxy, fetchQuote } from './quotes.js';
import { checkAlerts } from './alerts.js';
import { etNow, tradingDay, money, signed, pctS, ORIGINS } from './shared.js';

async function buildReport(env, kind) {
  const snap = await env.KV.get('snapshot', 'json');
  if (!snap || !Array.isArray(snap.holdings) || !snap.holdings.length) return null;
  const quotes = {};
  await Promise.all(snap.holdings.map(async h => { quotes[h.sym] = await fetchQuote(h.sym); }));
  let total = +snap.cash || 0, prevTotal = +snap.cash || 0;
  const moves = [], missing = [];
  for (const h of snap.holdings) {
    const q = quotes[h.sym] || (snap.prices && snap.prices[h.sym]) || null; // app-synced price = stale-but-real fallback
    if (!q || !(q.price > 0)) { missing.push(h.sym.replace('-', '.')); continue; }
    const prev = q.prev > 0 ? q.prev : q.price;
    total += h.qty * q.price; prevTotal += h.qty * prev;
    moves.push({ sym: h.sym.replace('-', '.'), pct: prev > 0 ? (q.price / prev - 1) * 100 : 0 });
  }
  if (!moves.length) return null;
  const d = total - prevTotal, pct = prevTotal > 0 ? d / prevTotal * 100 : 0;
  moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const big = moves.filter(m => Math.abs(m.pct) >= 2);           // headline any ±2% mover…
  const show = (big.length ? big : moves.slice(0, 2)).slice(0, 3); // …else the two biggest
  const mtxt = show.map(m => `${m.sym} ${(m.pct >= 0 ? '+' : '')}${m.pct.toFixed(1)}%`).join(' · ');
  const na = missing.length ? ` · ${missing.join('/')} n/a` : '';
  return kind === 'open'
    ? { title: `Market open — ${money(total)}`, body: `${signed(d)} (${pctS(pct)}) at the bell · ${mtxt}${na}` }
    : { title: `Market closed — ${signed(d)} today`, body: `${money(total)} (${pctS(pct)}) · ${mtxt}${na}` };
}

async function sendReport(env, kind, force) {
  const et = etNow();
  if (!force) {
    if (!tradingDay(et)) return { skip: 'market closed today' };
    const w = kind === 'open' ? [566, 600] : [968, 1010];  // ET minutes: 9:26–10:00 / 16:08–16:50
    if (et.hm < w[0] || et.hm > w[1]) return { skip: `wrong-DST cron slot (${et.hm} min ET)` };
    const last = await env.KV.get('last', 'json') || {};
    if (last[kind] === et.date) return { skip: 'already sent today' };
  }
  const sub = await env.KV.get('sub', 'json');
  if (!sub || !sub.endpoint) return { skip: 'no device subscribed yet' };
  const rep = await buildReport(env, kind);
  if (!rep) return { skip: 'no snapshot or quotes' };
  const res = await sendWebPush(env, sub, JSON.stringify({ title: rep.title, body: rep.body, tag: 'daily-' + kind }), 'daily-' + kind);
  if (res.status === 404 || res.status === 410) { await env.KV.delete('sub'); return { error: 'subscription expired — re-enable in the app', status: res.status }; }
  if (!force) { const last = await env.KV.get('last', 'json') || {}; last[kind] = et.date; await env.KV.put('last', JSON.stringify(last)); }
  return { sent: kind, status: res.status, title: rep.title, body: rep.body };
}

/* auth: single-user trust-on-first-use bearer token (+ ADMIN_TOKEN for maintenance/tests) */
const tEq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
async function auth(env, req, register) {
  const h = req.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (tok.length < 24) return false;
  if (env.ADMIN_TOKEN && tEq(tok, env.ADMIN_TOKEN)) return true;
  const cur = await env.KV.get('token');
  if (!cur) { if (!register) return false; await env.KV.put('token', tok); return true; }
  return tEq(cur, tok);
}

const corsFor = req => {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type'
  };
};
const j = (obj, status, cors) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', ...cors } });

export default {
  async fetch(req, env) {
    const cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname;
    if (req.method === 'GET') {
      if (path === '/q') return handleQuoteProxy(req, cors);
      return new Response('portfolio-push ok', { headers: cors });
    }
    if (req.method !== 'POST') return j({ error: 'method not allowed' }, 405, cors);
    const isSub = path === '/subscribe';
    if (!await auth(env, req, isSub)) return j({ error: 'unauthorized' }, 403, cors);
    if (isSub) {
      let b; try { b = await req.json(); } catch (_) { return j({ error: 'bad json' }, 400, cors); }
      if (!b || !b.sub || !b.sub.endpoint || !b.sub.keys || !b.sub.keys.p256dh || !b.sub.keys.auth) return j({ error: 'bad subscription' }, 400, cors);
      await env.KV.put('sub', JSON.stringify(b.sub));
      if (b.snapshot) await env.KV.put('snapshot', JSON.stringify(b.snapshot));
      return j({ ok: true }, 200, cors);
    }
    if (path === '/snapshot') {
      let b; try { b = await req.json(); } catch (_) { return j({ error: 'bad json' }, 400, cors); }
      if (!b || !Array.isArray(b.holdings)) return j({ error: 'bad snapshot' }, 400, cors);
      await env.KV.put('snapshot', JSON.stringify(b));
      return j({ ok: true }, 200, cors);
    }
    if (path === '/unsubscribe') { await env.KV.delete('sub'); return j({ ok: true }, 200, cors); }
    if (path === '/test') {
      let b = null; try { b = await req.json(); } catch (_) { /* empty body = report test */ }
      if (b && b.kind === 'alerts') return j(await checkAlerts(env, true), 200, cors);
      return j(await sendReport(env, 'close', true), 200, cors);
    }
    return j({ error: 'not found' }, 404, cors);
  },
  async scheduled(ev, env, ctx) {
    if (ev.cron && ev.cron.startsWith('*/')) { // the every-20-min cron is the intraday alert check
      ctx.waitUntil(checkAlerts(env, false).then(r => console.log('alerts', JSON.stringify(r))));
      return;
    }
    const kind = etNow().hm < 720 ? 'open' : 'close'; // before/after noon ET decides which report this cron is
    ctx.waitUntil(sendReport(env, kind, false).then(r => console.log('cron', kind, JSON.stringify(r))));
  }
};
