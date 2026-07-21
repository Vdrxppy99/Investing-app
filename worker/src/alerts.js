/* Intraday alerts for OWNED funds only — lock-screen pushes when something notable happens:
     · all-time high / all-time low (full price history, ratchets forward)
     · price breaking out of its usual trading band (mean ± 2σ of the last 60 daily closes —
       the "usually sits $95–$105, now at $108" signal)
     · big day move (±2% — the original mover alert)
   Runs on the 20-minute cron ("*&#47;20 13-21 * * 1-5" — see wrangler.jsonc), gated to
   10:00–15:55 ET so the daily open/close reports keep the morning/evening story.
   ONE push per run (top alert headlines, others tagged on), and per-symbol cooldowns in
   KV 'alerts' stop the same story repeating: ATH/ATL 3 trading days, band 5, mover 1.
   Wording rule (owner): plain finance speak with real dollar amounts — never stats jargon. */
import { fetchQuote } from './quotes.js';
import { sendWebPush } from './webpush.js';
import { etNow, tradingDay, money, signed } from './shared.js';

const MOVE_PCT = 2;                                    // single-holding day move that counts as "big"
const PORT_MOVE = 450;                                 // whole-portfolio day $ swing that earns a heads-up (~1.6% at $28k — a genuinely big day, not a normal ~$280 wiggle)
const SD_MULT = 2;                                     // band width = mean ± 2σ
const COOLDOWN = { ath: 3, atl: 3, hi: 5, lo: 5, mv: 1, dv: 1, 'm$': 1, mg: 1, tgt: 1, pbig: 1 }; // days before the same alert may repeat
const PRIORITY = { 'm$': 8, mg: 7, tgt: 7, pbig: 6, atl: 5, ath: 4, dv: 4, lo: 3, hi: 2, mv: 1 }; // milestones/targets top, then big portfolio day, lows, dividends/highs, bands, movers
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept': 'application/json' };
const money0 = v => '$' + Math.round(Math.abs(v)).toLocaleString('en-US');

async function fetchChartResult(sym, qs) {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?${qs}`, { headers: UA });
      if (!r.ok) continue;
      const res = (await r.json())?.chart?.result?.[0];
      if (res) return res;
    } catch (_) { /* try next host */ }
  }
  return null;
}
const fetchSeries = async (sym, qs) => (await fetchChartResult(sym, qs))?.indicators?.quote?.[0] || null;

/* Per-day stats per owned symbol: usual band (mean ± 2σ of last 60 closes) + all-time
   high/low (monthly bars over the fund's full life — true intra-period extremes).
   Built once per ET day, cached in KV 'bands' + warm-isolate memory (KV write budget). */
let bandsMem = null;
async function ensureBands(env, syms, etDate) {
  if (bandsMem && bandsMem.date === etDate) return bandsMem;
  const stored = await env.KV.get('bands', 'json');
  if (stored && stored.date === etDate) return (bandsMem = stored);
  const data = stored && stored.data ? { ...stored.data } : {};
  let built = 0;
  for (const sym of syms) {
    const recent = await fetchSeries(sym, 'range=3mo&interval=1d');
    const life = await fetchSeries(sym, 'range=max&interval=1mo');
    const closes = (recent?.close || []).filter(v => v > 0).slice(-60);
    const highs = (life?.high || []).filter(v => v > 0);
    const lows = (life?.low || []).filter(v => v > 0);
    if (closes.length < 30 || !highs.length) continue; // too young / fetch failed — skip today
    const mean = closes.reduce((a, v) => a + v, 0) / closes.length;
    const sd = Math.sqrt(closes.reduce((a, v) => a + (v - mean) * (v - mean), 0) / closes.length);
    data[sym] = { lo: mean - SD_MULT * sd, hi: mean + SD_MULT * sd, ath: Math.max(...highs), atl: Math.min(...lows) };
    built++;
  }
  if (!built && !stored) return null;               // nothing usable yet — retry next run
  bandsMem = { date: etDate, data };
  await env.KV.put('bands', JSON.stringify(bandsMem)); // one write per day
  return bandsMem;
}

const daysApart = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);

export async function checkAlerts(env, force) {
  const et = etNow();
  if (!force) {
    if (!tradingDay(et)) return { skip: 'not a trading day' };
    if (et.hm < 600 || et.hm > 955) return { skip: `outside alert window (${et.hm} min ET)` };
  }
  const sub = await env.KV.get('sub', 'json');
  if (!sub || !sub.endpoint) return { skip: 'no device subscribed yet' };
  const snap = await env.KV.get('snapshot', 'json');
  if (!snap || !Array.isArray(snap.holdings) || !snap.holdings.length) return { skip: 'no snapshot' };
  const syms = snap.holdings.map(h => h.sym);
  const bands = await ensureBands(env, syms, et.date);
  const sent = await env.KV.get('alerts', 'json') || {};   // {"VOO:ath":"2026-07-20", ...}
  const ok = key => force || !sent[key] || daysApart(et.date, sent[key]) >= COOLDOWN[key.split(':')[1]];

  const found = [], evaluated = [], contribs = [];
  let total = +snap.cash || 0, priced = 0, portDay = 0;
  for (const h of snap.holdings) {
    const q = await fetchQuote(h.sym);
    if (!q || !(q.price > 0) || !(q.prev > 0)) continue;
    total += h.qty * q.price; priced++; portDay += h.qty * (q.price - q.prev);
    const name = h.sym.replace('-', '.');
    const dayUsd = h.qty * (q.price - q.prev);
    const stake = h.qty * q.price;
    const pct = (q.price / q.prev - 1) * 100;
    contribs.push({ name, usd: dayUsd, pct }); // for the "led by …" attribution on a big portfolio day
    const b = bands && bands.data[h.sym];
    evaluated.push({ sym: name, price: q.price, band: b ? [+b.lo.toFixed(2), +b.hi.toFixed(2)] : null, ath: b && b.ath, atl: b && b.atl });
    const add = (type, title, body) => { if (ok(`${h.sym}:${type}`)) found.push({ sym: h.sym, name, type, title, body, p: PRIORITY[type], impact: Math.abs(dayUsd) }); };
    if (b && q.price > b.ath)
      add('ath', `${name} just set an all-time high`, `${money(q.price)} — its highest price ever. Your stake: ${money(stake)} (${signed(dayUsd)} today)`);
    else if (b && q.price < b.atl)
      add('atl', `${name} fell to an all-time low`, `${money(q.price)} — its lowest price on record. Your stake: ${money(stake)} (${signed(dayUsd)} today)`);
    else if (b && q.price > b.hi)
      add('hi', `${name} is breaking out above its usual range`, `${money(q.price)}, above its typical ${money0(b.lo)}–${money0(b.hi)} band — strong momentum. ${signed(dayUsd)} on your shares today`);
    else if (b && q.price < b.lo)
      add('lo', `${name} slipped below its usual range`, `${money(q.price)}, below its typical ${money0(b.lo)}–${money0(b.hi)} band — unusual weakness. ${signed(dayUsd)} on your shares today`);
    if (Math.abs(pct) >= MOVE_PCT)
      add('mv', `${name} ${(pct >= 0 ? '+' : '')}${pct.toFixed(1)}% today`, `${signed(dayUsd)} on your shares`);
    /* user-set price targets from the app ("push me at $700") — one-shot per target */
    for (const tg of (snap.alerts || [])) {
      if (tg.sym !== h.sym || !(tg.at > 0)) continue;
      if (!((tg.dir === 'up' && q.price >= tg.at) || (tg.dir !== 'up' && q.price <= tg.at))) continue;
      const key = `${h.sym}:tgt:${tg.at}`;
      if (!force && sent[key]) continue; // fired already — stays quiet until the app changes the target
      found.push({ sym: h.sym, name, type: 'tgt', p: PRIORITY.tgt, impact: stake, key,
        title: `${name} just hit your ${money(tg.at)} alert`,
        body: `Trading at ${money(q.price)} — the level you asked to hear about. Your stake: ${money(stake)} (${signed(dayUsd)} today).` });
    }
    if (b && q.price > b.ath) { b.ath = q.price; bands.dirty = true; }  // ratchet so tomorrow compares against today
  }

  /* ---- big portfolio day: whole-portfolio swings ±$PORT_MOVE → one heads-up, attributed to
     the funds that actually moved the needle (biggest $ contribution, like the Top Movers view) ---- */
  if (priced === snap.holdings.length && Math.abs(portDay) >= PORT_MOVE && ok('PORT:pbig')) {
    const prev = total - portDay, pct = prev > 0 ? portDay / prev * 100 : 0, up = portDay >= 0;
    const s0 = v => (v >= 0 ? '+' : '−') + money0(v);
    const drivers = contribs.filter(c => up ? c.usd > 0 : c.usd < 0).sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd)).slice(0, 2);
    const led = drivers.length ? ` — led by ${drivers.map(c => `${c.name} ${s0(c.usd)} (${(c.pct >= 0 ? '+' : '') + c.pct.toFixed(1)}%)`).join(' and ')}` : '';
    found.push({ sym: 'PORT', name: 'PORT', type: 'pbig', p: PRIORITY.pbig, impact: Math.abs(portDay),
      title: `Your portfolio is ${up ? 'up' : 'down'} ${money0(Math.abs(portDay))} today`,
      body: `Now at ${money(total)} (${(pct >= 0 ? '+' : '') + pct.toFixed(1)}%)${led}.` });
  }

  /* ---- milestones: first time the portfolio crosses a $5k line, or a goal-progress line.
     High-water marks in KV 'mstone' — an alert can never repeat. First run seeds silently. */
  if (priced === snap.holdings.length && total > 0) {
    const ms = await env.KV.get('mstone', 'json') || {};
    const STEP = 5000, GOALS = [25, 50, 75, 90, 100];
    if (ms.top$ === undefined) { ms.top$ = Math.floor(total / STEP) * STEP; ms.dirty = 1; }
    else if (total >= ms.top$ + STEP) {
      const line = Math.floor(total / STEP) * STEP;
      const growth = snap.dep > 0 && total > snap.dep ? ` — ${money(total - snap.dep)} of that is growth your money made on its own` : '';
      found.push({ sym: 'PORT', name: 'PORT', type: 'm$', p: PRIORITY['m$'], impact: total,
        title: `You just crossed ${money0(line)}`, body: `Your portfolio reached ${money(total)} today${growth}.` });
      ms.top$ = line; ms.dirty = 1;
    }
    const goal = +snap.goal || 0;
    if (goal > 0) {
      const hit = GOALS.filter(g => total / goal * 100 >= g).pop() || 0;
      if (ms.topG === undefined) { ms.topG = hit; ms.dirty = 1; }
      else if (hit > ms.topG) {
        found.push({ sym: 'PORT', name: 'PORT', type: 'mg', p: PRIORITY.mg, impact: total,
          title: hit >= 100 ? 'You reached your goal 🎉' : `You're ${hit}% of the way to your goal`,
          body: hit >= 100 ? `${money(total)} — past your ${money0(goal)} target. Time to dream bigger.`
                           : `${money(total)} of your ${money0(goal)} target — steady progress.` });
        ms.topG = hit; ms.dirty = 1;
      }
    }
    if (ms.dirty) { delete ms.dirty; await env.KV.put('mstone', JSON.stringify(ms)); }
  }

  /* ---- dividend declarations: once a day, look for a NEW payout event on each fund.
     First sighting of a fund just records its latest event (no back-alerts). */
  const dvs = await env.KV.get('divs', 'json') || { seen: {} };
  if (dvs.date !== et.date) {
    for (const h of snap.holdings) {
      const evs = (await fetchChartResult(h.sym, 'range=3mo&interval=1d&events=div'))?.events?.dividends;
      if (!evs) continue;
      const latest = Object.values(evs).reduce((a, e) => (e && e.date > (a ? a.date : 0) ? e : a), null);
      if (!latest || !(latest.amount > 0)) continue;
      if (dvs.seen[h.sym] && latest.date > dvs.seen[h.sym] && ok(`${h.sym}:dv`)) {
        const cut = h.qty * latest.amount, name = h.sym.replace('-', '.');
        found.push({ sym: h.sym, name, type: 'dv', p: PRIORITY.dv, impact: cut,
          title: `${name} is paying you a dividend`,
          body: `~${money(cut)} for your ${h.qty % 1 ? h.qty.toFixed(2) : h.qty} shares (${money(latest.amount)}/share) — cash lands in your account within days.` });
      }
      dvs.seen[h.sym] = latest.date;
    }
    dvs.date = et.date;
    await env.KV.put('divs', JSON.stringify(dvs)); // one write per day
  }

  if (!found.length) return { skip: 'nothing notable', evaluated };
  found.sort((a, z) => z.p - a.p || z.impact - a.impact);
  const top = found[0];
  const extras = found.slice(1, 3).map(a => ['mv', 'm$', 'mg', 'tgt', 'pbig'].includes(a.type) ? a.title.replace(' today', '') : `${a.name} ${({ ath: 'at an all-time high', atl: 'at an all-time low', hi: 'above its usual range', lo: 'below its usual range', dv: 'paying a dividend' })[a.type]}`);
  const body = top.body + (extras.length ? ` · Also: ${extras.join(', ')}` : '');
  const res = await sendWebPush(env, sub, JSON.stringify({ title: top.title, body, tag: 'alert' }), 'alert');
  if (res.status === 404 || res.status === 410) { await env.KV.delete('sub'); return { error: 'subscription expired — re-enable in the app', status: res.status }; }
  for (const a of found) sent[a.key || `${a.sym}:${a.type}`] = et.date;
  for (const k of Object.keys(sent)) { // keep the map small; fired targets vanish once the app drops them
    if (k.includes(':tgt:')) { if (!(snap.alerts || []).some(t => `${t.sym}:tgt:${t.at}` === k)) delete sent[k]; }
    else if (daysApart(et.date, sent[k]) > 30) delete sent[k];
  }
  await env.KV.put('alerts', JSON.stringify(sent));
  if (bands && bands.dirty) { delete bands.dirty; await env.KV.put('bands', JSON.stringify(bands)); }
  return { sent: top.type, status: res.status, title: top.title, body, evaluated };
}
