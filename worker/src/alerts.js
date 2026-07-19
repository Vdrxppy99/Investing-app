/* Intraday mover alerts — a lock-screen push the moment a holding swings ±2% on the day.
   Runs on the 20-minute cron ("*&#47;20 13-21 * * 1-5" — see wrangler.jsonc); each symbol
   alerts at most ONCE per trading day (KV 'moved'), and the daily open/close reports
   stay the morning/evening story — movers only fire between 10:00 and 15:55 ET. */
import { fetchQuote } from './quotes.js';
import { sendWebPush } from './webpush.js';
import { etNow, tradingDay, signed } from './shared.js';

const THRESHOLD = 2; // ±% on the day that counts as a "big move" (owner's chosen bar)

export async function checkMovers(env) {
  const et = etNow();
  if (!tradingDay(et)) return { skip: 'not a trading day' };
  if (et.hm < 600 || et.hm > 955) return { skip: `outside alert window (${et.hm} min ET)` };
  const sub = await env.KV.get('sub', 'json');
  if (!sub || !sub.endpoint) return { skip: 'no device subscribed yet' };
  const snap = await env.KV.get('snapshot', 'json');
  if (!snap || !Array.isArray(snap.holdings) || !snap.holdings.length) return { skip: 'no snapshot' };
  const moved = await env.KV.get('moved', 'json') || {};
  const done = moved.date === et.date ? (moved.syms || []) : [];
  const alerts = [];
  for (const h of snap.holdings) {
    if (done.includes(h.sym)) continue; // already alerted today — one push per symbol per day
    const q = await fetchQuote(h.sym);
    if (!q || !(q.price > 0) || !(q.prev > 0)) continue;
    const pct = (q.price / q.prev - 1) * 100;
    if (Math.abs(pct) < THRESHOLD) continue;
    alerts.push({ sym: h.sym.replace('-', '.'), raw: h.sym, pct, usd: h.qty * (q.price - q.prev) });
  }
  if (!alerts.length) return { skip: 'no new movers' };
  alerts.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const top = alerts[0];
  const fp = p => (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
  const extra = alerts.slice(1).map(a => `${a.sym} ${fp(a.pct)}`).join(' · ');
  const title = `${top.sym} ${fp(top.pct)} today`;
  const body = `${signed(top.usd)} on your shares${extra ? ` · also ${extra}` : ''}`; // full dollars — owner pref
  const res = await sendWebPush(env, sub, JSON.stringify({ title, body, tag: 'mover' }), 'mover');
  if (res.status === 404 || res.status === 410) { await env.KV.delete('sub'); return { error: 'subscription expired — re-enable in the app', status: res.status }; }
  await env.KV.put('moved', JSON.stringify({ date: et.date, syms: [...done, ...alerts.map(a => a.raw)] }));
  return { sent: 'mover', status: res.status, title, body };
}
