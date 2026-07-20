'use strict';
/* ============ STORAGE ============ */
/* personal keys live ONLY inside the encrypted vault (see js/vault.js) —
   everything else (quote/history/news caches, view prefs) stays in plain localStorage */
/* ⚠ MUST stay identical to PRIVATE_KEYS in js/vault.js (vault loads alone, pre-unlock).
   Adding a key? Change BOTH lists + exportBackup(). */
const PRIVATE_KEYS = new Set(['pt_holdings','pt_lots','pt_cash','pt_deposits','pt_confirmed','pt_goal','pt_targets','pt_push','pt_bk','pt_alerts']);
const mem = {};
let quotesRev=0, qDirty=false; // bumped by setQuote only when a price actually changed
window.storageFull=false;
function lsGet(k){
  if(PRIVATE_KEYS.has(k)){ const v=window.VAULT_DATA?window.VAULT_DATA[k]:undefined; return v===undefined?null:v; }
  try{ const v=localStorage.getItem(k); return v?JSON.parse(v):mem[k]||null; }catch(e){ return mem[k]||null; }
}
function lsSet(k,v){
  if(PRIVATE_KEYS.has(k)){ if(window.VAULT_DATA){ window.VAULT_DATA[k]=v; if(window.vaultPersist) vaultPersist(); } return; }
  mem[k]=v;
  try{ localStorage.setItem(k,JSON.stringify(v)); window.storageFull=false; }
  catch(e){
    // quota hit — evict the biggest reconstructible caches and retry once, loudly if that fails too
    try{
      localStorage.removeItem('pt_intraday');
      if(typeof state!=='undefined' && state.history){
        const owned=new Set(state.holdings.map(h=>h.sym));
        for(const s of Object.keys(state.history)) if(!owned.has(s)) delete state.history[s];
        if(k!=='pt_history') localStorage.setItem('pt_history', JSON.stringify(state.history));
      }
      localStorage.setItem(k,JSON.stringify(v));
      window.storageFull=false;
    }catch(e2){ window.storageFull=true; }
  }
}

/* ============ STATE ============ */
const state = {
  holdings: lsGet('pt_holdings') || JSON.parse(JSON.stringify(SEED_HOLDINGS)),
  lots:     lsGet('pt_lots')     || JSON.parse(JSON.stringify(SEED_LOTS)),
  cash:     lsGet('pt_cash')     || {...SEED_CASH},
  deposits: lsGet('pt_deposits') ?? SEED_DEPOSITS,
  confirmed: lsGet('pt_confirmed') || SEED_CONFIRMED,
  quotes:   lsGet('pt_quotes')   || JSON.parse(JSON.stringify(SEED_QUOTES)),
  history:  lsGet('pt_history')  || JSON.parse(JSON.stringify(SEED_HISTORY)),   // sym -> {t:[ms], c:[close], ts:fetchedAt, range}
  intraday: lsGet('pt_intraday') || {},   // sym -> {t:[ms], c:[price], ts:fetchedAt} (5-min bars, today)
  divs:     lsGet('pt_divs')     || {},
  goal:     lsGet('pt_goal')     || null,   // savings target { amt }   // sym -> {list:[[ms,perShare]], ts} distribution history
  targets:  lsGet('pt_targets')  || null,   // target mix { sym: pct } — drives the drift view in Allocation
  watch:    lsGet('pt_watch')    || [],     // followed symbols [{sym,name}]
  fx:       lsGet('pt_fx')       || {rate:0.86, ts:0},
  // bench: 'off' | 'VOO' (S&P 500) | 'VT' (Total World) | 'QQQ' (Nasdaq 100) — migrates from the old boolean
  view: { acc:'all', metric: lsGet('pt_metric') || 'profit', range:'1M', ccy: lsGet('pt_ccy') || 'USD',
          bench: (function(){ const b=lsGet('pt_bench'); return (b==='VOO'||b==='VT'||b==='QQQ') ? b : (b===true ? 'VOO' : 'off'); })(),
          sort: lsGet('pt_sort') || 'value', priv: !!lsGet('pt_priv') },
  live:false, fetching:false
};

/* ============ HELPERS ============ */
const $ = id => document.getElementById(id);
function uniqSyms(){ return [...new Set(state.holdings.map(h=>h.sym))]; }
function priceOf(s){ return state.quotes[s] ? state.quotes[s].price : 0; }
function prevOf(s){ const q=state.quotes[s]; return q && q.prev ? q.prev : priceOf(s); }
function cashFor(acc){ return acc==='all' ? Object.values(state.cash).reduce((a,b)=>a+(+b||0),0) : (+state.cash[acc]||0); }
function rows(acc){ // merged positions for a filter
  const list = state.holdings.filter(h=>acc==='all'||h.acc===acc);
  const map = {};
  for(const h of list){
    if(!map[h.sym]) map[h.sym]={sym:h.sym, qty:0, cost:0, accs:{}};
    map[h.sym].qty += h.qty; map[h.sym].cost += h.cost;
    if(!map[h.sym].accs[h.acc]) map[h.sym].accs[h.acc]={qty:0,cost:0};
    map[h.sym].accs[h.acc].qty += h.qty; map[h.sym].accs[h.acc].cost += h.cost;
  }
  return Object.values(map).sort((a,b)=> b.qty*priceOf(b.sym) - a.qty*priceOf(a.sym));
}
function totals(acc){
  const rs = rows(acc); const cash = cashFor(acc);
  // shares bought TODAY didn't exist at yesterday's close — their "today" gain is
  // measured from what was actually paid, not from prev close (else buy days over/understate)
  const today=dayStr(Date.now()); const bt={};
  for(const l of state.lots){
    if(l.date===today && (acc==='all'||l.acc===acc)){
      const b=bt[l.sym]||(bt[l.sym]={qty:0,cost:0}); b.qty+=l.qty; b.cost+=l.cost;
    }
  }
  let val=cash, cost=0, day=0;
  for(const r of rs){
    const p=priceOf(r.sym), pv=prevOf(r.sym);
    val += r.qty*p; cost += r.cost;
    const b=bt[r.sym], bq=b?Math.min(b.qty,r.qty):0;
    day += (r.qty-bq)*(p-pv);
    if(bq>0) day += bq*p - b.cost*(bq/b.qty);
  }
  return { value:val, invested:cost, profit:val-cash-cost, day };
}
function rate(){ return state.view.ccy==='EUR' ? state.fx.rate : 1; }
/* fmtPx = always-visible market prices (public info); fmt = YOUR money — masked in privacy mode */
function fmtPx(v){ return new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy}).format(v*rate()); }
function fmt(v){ return state.view.priv ? '••••••' : fmtPx(v); }
function fmtSign(v){ return (v>=0?'+':'−') + fmt(Math.abs(v)); }
function fmtPct(v){ return (v>=0?'+':'−') + Math.abs(v).toFixed(2) + '%'; }
function cfmt(v){ return state.view.priv?'••••':new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact',maximumFractionDigits:1}).format(v*rate()); }
function cls(v){ return v>=0?'pos':'neg'; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function skel(n){ // shimmer placeholder rows — premium apps never show spinners for lists
  let h='';
  for(let i=0;i<(n||4);i++) h+='<div class="skel-row"><div class="skel-badge"></div><div class="skel-lines"><i style="width:'+(55+((i*17)%35))+'%"></i><i style="width:'+(30+((i*23)%25))+'%"></i></div></div>';
  return h;
}
function badge(sym){ return esc(sym.split('-')[0].slice(0,4)); }
function badgeHtml(sym, small){ // colored letter tile; a real company logo crossfades over it once loaded
  const direct=(typeof TICKER_LOGOS!=='undefined')&&TICKER_LOGOS[sym];
  const d=!direct&&(typeof TICKER_DOMAINS!=='undefined')&&TICKER_DOMAINS[sym];
  const src=direct||(d?`https://www.google.com/s2/favicons?domain=${d}&sz=128`:null);
  const logo=src?`<img class="blogo" src="${src}" alt="" referrerpolicy="no-referrer" onload="this.classList.add('on')" onerror="this.remove()">`:'';
  return `<div class="badge${small?' sm':''}" style="${bstyle(colorOf(sym))}">${badge(sym)}${logo}</div>`;
}
function bstyle(c){ return `background:linear-gradient(140deg,${c},color-mix(in srgb,${c} 55%,#000))`; }
function colorOf(sym){ if(COLORS[sym]) return COLORS[sym]; let h=0; for(const ch of sym) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h},55%,52%)`; }
function dayStr(ms){ return new Date(ms).toISOString().slice(0,10); }
function hasLots(acc){ return state.lots.some(l=>acc==='all'||l.acc===acc); }
function lotState(acc, d){ // shares held + total invested on day d ('YYYY-MM-DD'), per the lot log
  const out = {qty:{}, cost:0};
  for(const l of state.lots){
    if(acc!=='all' && l.acc!==acc) continue;
    if(l.date<=d){ out.qty[l.sym]=(out.qty[l.sym]||0)+l.qty; out.cost+=l.cost; }
  }
  return out;
}
function xirr(flows){ // money-weighted annualized return; flows: [{t:ms, v}] negative = money in
  if(flows.length<2) return null;
  const t0=flows[0].t, YR=31557600000;
  const f=r=>flows.reduce((a,c)=>a+c.v*Math.pow(1+r,-(c.t-t0)/YR),0);
  let lo=-0.95, hi=9, flo=f(lo), fhi=f(hi);
  if(isNaN(flo)||isNaN(fhi)||flo*fhi>0) return null;
  for(let i=0;i<80;i++){ const m=(lo+hi)/2, fm=f(m); if(flo*fm<=0){hi=m;fhi=fm;} else {lo=m;flo=fm;} }
  return (lo+hi)/2;
}
function personalReturn(acc){ // dividend reinvestments are internal return, not contributions
  const flows = state.lots
    .filter(l=>(acc==='all'||l.acc===acc) && !l.div)
    .map(l=>({t:new Date(l.date+'T16:00:00Z').getTime(), v:-l.cost}))
    .sort((a,b)=>a.t-b.t);
  if(!flows.length) return null;
  flows.push({t:Date.now(), v:totals(acc).value});
  const x=xirr(flows);
  if(x!=null) return x;
  // xirr's bisection bracket failed (rate outside −95%…+900% or no sign change) —
  // fall back to a simple annualized ratio so the Return/yr chip never just vanishes
  const inv=-flows.slice(0,-1).reduce((a,f)=>a+f.v,0), end=flows[flows.length-1].v;
  const yrs=Math.max(0.2,(flows[flows.length-1].t-flows[0].t)/31557600000);
  return inv>0&&end>0 ? Math.pow(end/inv,1/yrs)-1 : null;
}
function spark(sym){ // 30-day mini price line for a holding row
  const h=state.history[sym]; if(!h||!h.t||h.t.length<3) return '';
  const cut=Date.now()-31*86400000, pts=[];
  for(let i=0;i<h.t.length;i++) if(h.c[i]!=null && h.t[i]>=cut) pts.push(h.c[i]);
  const q=state.quotes[sym]; if(q && q.price) pts.push(q.price);
  if(pts.length<3) return '';
  const min=Math.min(...pts), max=Math.max(...pts), rng=(max-min)||1, W=54, H=22;
  const d=pts.map((p,i)=>`${i?'L':'M'}${(i/(pts.length-1)*W).toFixed(1)} ${(H-2-(p-min)/rng*(H-4)).toFixed(1)}`).join('');
  const up=pts[pts.length-1]>=pts[0];
  return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="${up?'var(--green)':'var(--red)'}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/></svg>`;
}
function benchSym(){ return state.view.bench==='VT' ? 'VT' : state.view.bench==='QQQ' ? 'QQQ' : 'VOO'; }
function benchName(){ return state.view.bench==='VT' ? 'World (VT)' : state.view.bench==='QQQ' ? 'Nasdaq 100 (QQQ)' : 'S&P 500'; }
function benchSeries(labels, values){ // "what if the same money had gone into the benchmark instead"
  const voo=state.history[benchSym()]; if(!voo||!voo.t||voo.t.length<2||values.length<2) return null;
  const px={}; for(let i=0;i<voo.t.length;i++) if(voo.c[i]!=null) px[dayStr(voo.t[i])]=voo.c[i];
  let last=null;
  const prices=labels.map(d=>{ if(px[d]!=null) last=px[d]; return last; });
  if(prices[0]==null||prices[0]<=0) return null;
  // idle cash stays cash in BOTH worlds — only the invested part buys the benchmark
  // (keeps this overlay consistent with the Insights "same buys" replay, which is lots-only)
  const cash=cashFor(state.view.acc);
  let shares=Math.max(0, values[0]-cash)/prices[0];
  const byDay={};
  for(const l of state.lots){
    if(l.div) continue;
    if(state.view.acc!=='all' && l.acc!==state.view.acc) continue;
    if(l.date>labels[0] && l.date<=labels[labels.length-1]) byDay[l.date]=(byDay[l.date]||0)+l.cost;
  }
  const out=[];
  for(let i=0;i<labels.length;i++){
    if(byDay[labels[i]] && prices[i]>0) shares += byDay[labels[i]]/prices[i];
    out.push(prices[i]>0 ? cash + shares*prices[i] : null);
  }
  return out;
}
