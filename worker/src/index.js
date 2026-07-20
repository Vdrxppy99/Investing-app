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
    ? { title: `Market open — ${money(total)}`, body: `${signed(d)} (${pctS(pct)}) at the bell · ${mtxt}${na}`, total }
    : { title: `Market closed — ${signed(d)} today`, body: `${money(total)} (${pctS(pct)}) · ${mtxt}${na}`, total };
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
  if (!force) {
    const last = await env.KV.get('last', 'json') || {}; last[kind] = et.date; await env.KV.put('last', JSON.stringify(last));
    if (kind === 'close' && rep.total > 0) { // daily value log — feeds the month-in-review push
      const mh = await env.KV.get('mhist', 'json') || {};
      mh[et.date] = Math.round(rep.total * 100) / 100;
      for (const k of Object.keys(mh)) if (Date.parse(et.date) - Date.parse(k) > 400 * 864e5) delete mh[k];
      await env.KV.put('mhist', JSON.stringify(mh));
    }
  }
  return { sent: kind, status: res.status, title: rep.title, body: rep.body };
}

/* first close cron of a new month → "Your June in review" topline push (the app shows the
   rich deposit-adjusted version on next open). Needs two month-ends in the value log. */
async function sendMonthly(env) {
  const et = etNow(), ym = et.date.slice(0, 7);
  const last = await env.KV.get('last', 'json') || {};
  if (last.month === ym) return { skip: 'already sent this month' };
  last.month = ym; await env.KV.put('last', JSON.stringify(last)); // mark first — never double-push
  const mh = await env.KV.get('mhist', 'json') || {};
  const d0 = new Date(et.date + 'T12:00:00Z'); d0.setUTCDate(0);   // last day of previous month
  const pm = d0.toISOString().slice(0, 7);
  const ends = m => Object.keys(mh).filter(k => k.startsWith(m)).sort().pop();
  const ePrev = ends(pm);
  d0.setUTCDate(0);                                                // last day of the month before that
  const ePrev2 = ends(d0.toISOString().slice(0, 7));
  if (!ePrev || !ePrev2) return { skip: 'not enough value history yet' };
  const sub = await env.KV.get('sub', 'json');
  if (!sub || !sub.endpoint) return { skip: 'no device subscribed yet' };
  const a = mh[ePrev2], b = mh[ePrev], diff = b - a, pct = a > 0 ? diff / a * 100 : 0;
  const mName = new Date(pm + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long' });
  const res = await sendWebPush(env, sub, JSON.stringify({
    title: `Your ${mName} in review`,
    body: `${signed(diff)} (${pctS(pct)}) for the month — you ended ${mName} at ${money(b)}. Open the app for the full story.`,
    tag: 'monthly' }), 'monthly');
  return { sent: 'monthly', status: res.status };
}

/* /restore brute-force brake — per-isolate, resets hourly (fine for a single-user API) */
let rlN = 0, rlT = 0;
const rlOk = () => { const n = Date.now(); if (n - rlT > 3600e3) { rlT = n; rlN = 0; } return ++rlN <= 20; };

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
    if (path === '/restore') { // new phone, no bearer yet — the passcode-derived tag IS the auth
      if (!rlOk()) return j({ error: 'too many tries — wait an hour' }, 429, cors);
      let b; try { b = await req.json(); } catch (_) { return j({ error: 'bad json' }, 400, cors); }
      const bk = await env.KV.get('backup', 'json');
      if (!bk || !b || !tEq(bk.tag, String(b.tag || ''))) return j({ error: 'no backup for that passcode' }, 403, cors);
      return j({ salt: bk.salt, iv: bk.iv, ct: bk.ct, ts: bk.ts }, 200, cors);
    }
    const isSub = path === '/subscribe';
    if (!await auth(env, req, isSub || path === '/backup' || path === '/ask')) return j({ error: 'unauthorized' }, 403, cors);
    if (path === '/backup') { // encrypted on the phone before upload — the server only stores bytes
      let b; try { b = await req.json(); } catch (_) { return j({ error: 'bad json' }, 400, cors); }
      if (b && b.off) { await env.KV.delete('backup'); return j({ ok: true }, 200, cors); }
      if (!b || typeof b.tag !== 'string' || b.tag.length < 32 || typeof b.ct !== 'string' || !b.salt || !b.iv) return j({ error: 'bad backup' }, 400, cors);
      if (b.ct.length > 400000) return j({ error: 'too big' }, 400, cors);
      await env.KV.put('backup', JSON.stringify({ tag: b.tag, salt: b.salt, iv: b.iv, ct: b.ct, ts: b.ts || Date.now() }));
      return j({ ok: true }, 200, cors);
    }
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
    if (path === '/ask') { // in-app AI assistant via Workers AI (free daily allocation), capped so it stays $0
      if (!env.AI) return j({ error: 'ai not enabled' }, 503, cors);
      let b; try { b = await req.json(); } catch (_) { return j({ error: 'bad json' }, 400, cors); }
      const qn = (b && typeof b.question === 'string') ? b.question.trim().slice(0, 500) : '';
      if (!qn) return j({ error: 'no question' }, 400, cors);
      const today = etNow().date, u = await env.KV.get('ai', 'json') || {};
      const n = u.date === today ? (u.n || 0) : 0, CAP = 25;
      if (n >= CAP) return j({ error: 'limit', left: 0 }, 429, cors);
      const ctx = (b.context && typeof b.context === 'string') ? b.context.slice(0, 2000) : '';
      const sys = 'You are a concise, friendly assistant inside a personal investing app. Answer ONLY from the portfolio snapshot given. The owner is a long-term index-fund investor who never sells and does not want to be told to buy or sell. Plain language, at most 4 sentences, include the relevant figures from the snapshot, and never invent numbers that are not in it. No tax or legal advice.';
      let answer = '';
      try {
        const out = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', { max_tokens: 300, messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Portfolio snapshot: ${ctx}\n\nQuestion: ${qn}` }
        ] });
        answer = ((out && (out.response || out.result)) || '').toString().trim();
      } catch (_) { return j({ error: 'ai failed' }, 502, cors); }
      if (!answer) return j({ error: 'ai empty' }, 502, cors);
      await env.KV.put('ai', JSON.stringify({ date: today, n: n + 1 }));
      return j({ answer, left: CAP - n - 1 }, 200, cors);
    }
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
    ctx.waitUntil(sendReport(env, kind, false).then(r => console.log('cron', kind, JSON.stringify(r)))
      .then(() => kind === 'close' ? sendMonthly(env).then(r => console.log('monthly', JSON.stringify(r))) : null));
  }
};
