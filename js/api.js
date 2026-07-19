'use strict';
/* ============ DATA FETCHING (browser-side, multiple fallbacks) ============ */
const PUSH_URL='https://portfolio-push.vdrxppy99.workers.dev'; // our own Cloudflare Worker (worker/ in this repo)
/* Yahoo requests go through OUR worker first (/q — origin-locked, edge-cached, no third
   party sees them); direct + public proxies stay as fallbacks. Non-Yahoo URLs (stooq CSV,
   frankfurter FX) return null here — the worker only whitelists Yahoo — so they skip it. */
const PROXIES = [ u=>/^https:\/\/query[12]\.finance\.yahoo\.com\//.test(u) ? PUSH_URL+'/q?u='+encodeURIComponent(u) : null,
                  u=>u,
                  u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u),
                  u=>'https://corsproxy.io/?url='+encodeURIComponent(u) ];
let goodProxy = 0; // remember which source worked last, try it first next time
async function tryFetch(url, asJson){
  const order = [goodProxy, ...PROXIES.map((_,i)=>i).filter(i=>i!==goodProxy)];
  for(const pi of order){
    try{
      const pu = PROXIES[pi](url); if(!pu) continue; // this source doesn't serve this URL
      const ctl = new AbortController(); const to = setTimeout(()=>ctl.abort(), 10000);
      const r = await fetch(pu, {cache:'no-store', signal:ctl.signal});
      clearTimeout(to);
      if(!r.ok) continue;
      const tx = await r.text();
      if(!tx || tx.length<5) continue;
      goodProxy = pi;
      return asJson ? JSON.parse(tx) : tx;
    }catch(e){ /* try next source */ }
  }
  throw new Error('unreachable');
}
function parseYahoo(j){
  const res = j && j.chart && j.chart.result && j.chart.result[0]; if(!res) throw new Error('bad data');
  const meta = res.meta||{};
  const ts = (res.timestamp||[]).map(t=>t*1000);
  const cl = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
  let price = meta.regularMarketPrice;
  const valid = cl.map((c,i)=>[ts[i],c]).filter(x=>x[1]!=null);
  if(price==null && valid.length) price = valid[valid.length-1][1];
  // previous close: chartPreviousClose is the close before the FIRST bar of the
  // requested range (a year ago for range=1y), so it's only a last resort
  let prev = meta.regularMarketPreviousClose;
  if(prev==null && valid.length>1) prev = valid[valid.length-2][1];
  if(prev==null) prev = meta.chartPreviousClose;
  return { price, prev, t:valid.map(x=>x[0]), c:valid.map(x=>x[1]) };
}
const pendingBig={}; // sym -> {price, ts}: first sighting of a >25% move, awaiting confirmation
function setQuote(sym, price, prev){ // single gate for every price write
  const old=state.quotes[sym];
  if(!(price>0)) return false;
  // reject implausible ticks (bad/garbled proxy responses) — unless our data is over a week old.
  // Real >25% gaps DO happen (watchlist earnings): accept when two fetches within 3 min agree.
  if(old && old.price>0 && old.ts && Date.now()-old.ts<7*86400e3 && Math.abs(price/old.price-1)>0.25){
    const pb=pendingBig[sym];
    if(!(pb && Date.now()-pb.ts<3*60000 && Math.abs(price/pb.price-1)<0.03)){
      pendingBig[sym]={price, ts:Date.now()};
      return false;
    }
    delete pendingBig[sym]; // confirmed twice — the move is real
  }
  const next={ price, prev:(prev>0?prev:(old&&old.prev)||price), ts:Date.now() };
  if(!old || old.price!==next.price || old.prev!==next.prev){ qDirty=true; quotesRev++; }
  state.quotes[sym]=next;
  return true;
}
async function fetchQuote(sym){
  try{
    const j = await tryFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d&_=${Date.now()}`, true);
    const d = parseYahoo(j);
    if(setQuote(sym, d.price, d.prev)) return true;
    throw new Error('bad quote');
  }catch(e){
    try{ // stooq fallback — ~15-min DELAYED, so only step in when our quote is older than that
      // (a 10-min guard let stooq overwrite an 11-min-old Yahoo price with OLDER data → visible backwards tick)
      const old=state.quotes[sym];
      if(old && old.ts && Date.now()-old.ts<25*60000) return false;
      const st = sym.toLowerCase().replace('.','-')+'.us';
      const tx = await tryFetch(`https://stooq.com/q/l/?s=${st}&f=sd2t2ohlcv&h&e=csv`, false);
      const cells = tx.trim().split('\n').pop().split(',');
      return setQuote(sym, parseFloat(cells[6]), null);
    }catch(e2){}
    return false;
  }
}
async function fetchHistory(sym){
  try{
    // NOTE: range=max silently downgrades to monthly bars — 10y is the longest range Yahoo serves daily
    const j = await tryFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`, true);
    const d = parseYahoo(j);
    if(d.t.length>5){ state.history[sym] = { t:d.t, c:d.c, ts:Date.now(), range:'10y' };
      setQuote(sym, d.price, d.prev); return true; }
  }catch(e){}
  return false;
}
const benchFetching=new Set(); // per-symbol, so cycling World→Nasdaq mid-download can't skip a fetch
async function ensureBenchHistory(sym){ // benchmark funds you don't own (e.g. VT) need their own history
  const h=state.history[sym];
  if(h && h.t && h.t.length>5 && h.ts && Date.now()-h.ts<12*3600e3) return true;
  if(benchFetching.has(sym)) return false;
  benchFetching.add(sym);
  const ok=await fetchHistory(sym);
  benchFetching.delete(sym);
  if(ok) lsSet('pt_history', state.history);
  return ok;
}
async function fetchIntraday(sym){
  try{
    const j = await tryFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m&_=${Date.now()}`, true);
    const d = parseYahoo(j);
    if(d.t.length>1){ state.intraday[sym] = { t:d.t, c:d.c, ts:Date.now() };
      setQuote(sym, d.price, d.prev); return true; }
  }catch(e){}
  return false;
}
let intraFetching=false;
async function ensureIntraday(){
  if(intraFetching) return;
  const TTL = marketOpen() ? 60000 : 30*60000;
  const stale = uniqSyms().filter(s=>{ const h=state.intraday[s]; return !h || !h.ts || Date.now()-h.ts>TTL; });
  if(!stale.length) return;
  intraFetching=true;
  const results = await Promise.allSettled(stale.map(fetchIntraday));
  intraFetching=false;
  lsSet('pt_intraday', state.intraday); lsSet('pt_quotes', state.quotes);
  if(results.some(r=>r.status==='fulfilled'&&r.value===true) && state.view.range==='1D'){ renderHeader(); renderList(); renderChart(); setStatus(); }
}
async function fetchFx(){
  try{
    const j = await tryFetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR', true);
    if(j && j.rates && j.rates.EUR){ state.fx = { rate:j.rates.EUR, ts:Date.now() }; }
  }catch(e){}
}
async function refreshAll(force){
  if(state.fetching) return;
  state.fetching=true; setStatus();
  $('refreshBtn').classList.add('spinning');
  const syms=uniqSyms();
  const HIST_TTL = 12*3600*1000;
  // PHASE 1 — quotes only (tiny payloads): fresh prices on screen in ~a second,
  // even after days away, instead of waiting behind 10-year history downloads
  const qres = await Promise.allSettled(syms.map(fetchQuote));
  const quotesOk = qres.some(r=>r.status==='fulfilled' && r.value===true);
  // phase 1 renders only the light surfaces — the heavy charts rebuild once, in phase 2
  if(quotesOk){ state.live=true; lsSet('pt_quotes', state.quotes); renderHeader(); renderList(); renderMover(); renderStale(); setStatus(); }
  // PHASE 2 — heavy history + FX refresh quietly behind the already-live screen
  const hjobs = syms.filter(s=>{
    const h=state.history[s];
    return force || !h || !h.ts || h.range!=='10y' || Date.now()-h.ts>HIST_TTL;
  }).map(fetchHistory);
  hjobs.push(fetchFx());
  const results = await Promise.allSettled(hjobs);
  state.live = quotesOk || results.some(r=>r.status==='fulfilled' && r.value===true);
  state.fetching=false;
  $('refreshBtn').classList.remove('spinning');
  lsSet('pt_history', state.history); // persist() no longer carries the heavy caches
  persist(); renderAll();
  if(typeof maybeShowRecap==='function') maybeShowRecap();
  pushSyncSoon(); // keep the push server's fallback prices warm (no-op unless reports are on)
}
/* --- live polling: every few seconds while the US market is open --- */
let failStreak=0, pollTimer=null;
const POLL_BASE=10000, POLL_MAX=60000, POLL_CLOSED=300000; // 10s: fast enough to feel live, slow enough that the free proxies don't start failing
function nextDelay(){
  if(!marketOpen()) return POLL_CLOSED;
  return failStreak ? Math.min(POLL_BASE*Math.pow(2,failStreak), POLL_MAX) : POLL_BASE;
}
function schedulePoll(){
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async ()=>{ await refreshQuotesOnly(); schedulePoll(); }, nextDelay());
}
async function refreshQuotesOnly(){
  if(state.fetching || document.hidden) return;
  state.fetching=true; setStatus();
  qDirty=false;
  const results = await Promise.allSettled(uniqSyms().map(fetchQuote));
  const ok = results.some(r=>r.status==='fulfilled'&&r.value===true);
  failStreak = ok ? 0 : failStreak+1;
  if(ok) state.live=true; else if(failStreak>3) state.live=false;
  state.fetching=false;
  // nothing moved (market closed, repeated closes) → skip the DOM/chart work entirely
  if(qDirty){
    lsSet('pt_quotes', state.quotes);
    renderHeader(); renderList(); renderMover(); updateChartLive();
  }
  setStatus();
  if(state.view.range==='1D') ensureIntraday(); // refresh the 5-min bars too (throttled inside)
}
/* update only the chart's last point on each tick (no full redraw).
   Known trade-off: the dashed benchmark's last point stays at its last full render
   within a session — recomputing it per tick isn't worth the churn. */
function updateChartLive(){
  if(scrubbing) return;
  if(!mainChart){ renderChart(); return; }
  const ds = mainChart.data.datasets[0]; const data = ds.data;
  if(!data || data.length<1){ renderChart(); return; }
  const t = totals(state.view.acc);
  // profit MUST use the same lots-based formula as buildSeries, or the live point jumps off the line
  const cash = cashFor(state.view.acc);
  const pNow = hasLots(state.view.acc) ? t.value-cash-lotState(state.view.acc, dayStr(Date.now())).cost : t.profit;
  const v = state.view.metric==='profit' ? pNow : t.value;
  data[data.length-1] = v;
  const upNow = data[data.length-1] >= data[0];
  const isGreen = mainChart._up !== false;
  if(upNow !== isGreen){ renderChart(); return; } // trend flipped: redraw with new color
  mainChart.update('none');
  if(data.length>1){
    const d0=data[0], diff=v-d0;
    let pct='';
    if(state.view.metric==='value' && d0>0) pct=` (${fmtPct((v/d0-1)*100)})`;
    else if(state.view.metric==='profit' && chartBaseV>0) pct=` (${fmtPct(diff/chartBaseV*100)})`;
    $('chartDelta').innerHTML = `<span class="${cls(diff)}">${fmtSign(diff)}${pct}</span> <span class="rng">· ${state.view.metric} · ${state.view.range}</span>`;
  }
}

/* ============ PUSH REPORTS — daily open/close lock-screen notifications ============
   Server: worker/ in this repo, deployed to the owner's own free Cloudflare account.
   The server stores only tickers + share counts + cash (enough to compute the dollar
   text); every notification payload is end-to-end encrypted (RFC 8291), so Apple's
   relay moves bytes it can't read. pt_push {token,on} lives in the encrypted vault. */
const PUSH_VAPID='BOMmoU1mLZ74CNAjtn1gm2Sna5vu0ZtValfGhBkhdDmvv8Q-vhdZcVoxUWwcxZwvnL-eZ9JqdCfdAe3xPwPGP9E'; // PUSH_URL is defined at the top of this file (shared with the quote proxy)
function pushSnapshot(){
  const hs={};
  for(const h of state.holdings){ if(h.sym && h.qty>0) hs[h.sym]=(hs[h.sym]||0)+h.qty; }
  const prices={};
  for(const s of Object.keys(hs)){ const q=state.quotes[s]; if(q && q.price>0) prices[s]={price:q.price, prev:q.prev||0}; }
  return { holdings:Object.entries(hs).map(([sym,qty])=>({sym,qty})),
           cash:(+state.cash.main||0)+(+state.cash.brok||0), prices, ts:Date.now() };
}
function pushCall(path, body){
  const p=lsGet('pt_push');
  if(!p || !p.token) return Promise.reject(new Error('no token'));
  return fetch(PUSH_URL+path,{method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+p.token},
    body: body?JSON.stringify(body):'{}'});
}
let pushSyncT=null, pushSyncLast=0;
function pushSyncSoon(){
  const p=lsGet('pt_push'); if(!p || !p.on) return;
  if(Date.now()-pushSyncLast<10*60000) return; // at most every 10 min — the server only needs day-fresh numbers
  clearTimeout(pushSyncT);
  pushSyncT=setTimeout(()=>{ pushSyncLast=Date.now(); pushCall('/snapshot', pushSnapshot()).catch(()=>{}); }, 8000);
}
async function pushEnable(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)){
    toast('This browser can’t do push — use the installed app.', true); return false;
  }
  // iOS only grants web push to Home-Screen apps — a Safari tab would fail with a confusing error
  const standalone = navigator.standalone===true || matchMedia('(display-mode: standalone)').matches;
  if(!standalone && /iPhone|iPad/.test(navigator.userAgent)){
    toast('Open the app from your Home Screen icon to turn on reports.', true); return false;
  }
  const perm = await Notification.requestPermission(); // first await — must stay inside the tap gesture
  if(perm!=='granted'){ toast('Notifications are blocked — allow them in iOS Settings → Notifications → My Portfolio.', true); return false; }
  try{
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true,
      applicationServerKey:Uint8Array.from(atob(PUSH_VAPID.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0))});
    const p = lsGet('pt_push') || {};
    if(!p.token){ const a=new Uint8Array(24); crypto.getRandomValues(a); p.token=Array.from(a,x=>x.toString(16).padStart(2,'0')).join(''); }
    lsSet('pt_push', p); // token first — pushCall reads it
    const r = await pushCall('/subscribe', {sub:sub.toJSON(), snapshot:pushSnapshot()});
    if(!r.ok) throw new Error('server '+r.status);
    p.on=true; lsSet('pt_push', p); pushSyncLast=Date.now();
    toast('Daily reports on — market open & close, right on your lock screen.');
    return true;
  }catch(e){ toast('Couldn’t reach the report server — check your connection and try again.', true); return false; }
}
async function pushDisable(){
  try{ const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription(); if(sub) await sub.unsubscribe(); }catch(e){}
  try{ await pushCall('/unsubscribe'); }catch(e){}
  const p=lsGet('pt_push')||{}; p.on=false; lsSet('pt_push', p);
  toast('Daily reports off.');
}
function pushTest(){
  return pushCall('/test').then(r=>r.json()).then(d=>{
    if(d && d.sent) toast('Test report sent — check your lock screen in a few seconds.');
    else toast('Server replied: '+(d && (d.skip||d.error) || 'unknown'), true);
  }).catch(()=>toast('Couldn’t reach the report server.', true));
}
