'use strict';
/* ============ INSIGHTS TAB ============ */
const centerTxt = { id:'centerTxt', afterDraw(c){
  const o=c.config.options.plugins && c.config.options.plugins.centerTxt; if(!o) return;
  const {ctx, chartArea:{left,top,width,height}}=c; const cx=left+width/2, cy=top+height/2;
  ctx.save(); ctx.textAlign='center';
  ctx.font="700 15px Inter,-apple-system,sans-serif"; ctx.fillStyle=cvar('--tx'); ctx.fillText(o.l1, cx, cy-3);
  ctx.font="600 10px Inter,-apple-system,sans-serif"; ctx.fillStyle=cvar('--mut'); ctx.fillText(o.l2, cx, cy+13);
  ctx.restore();
}};
// registered by ensureChartJs() (js/boot.js) once Chart.js actually loads — it's lazy now.
function renderGainsTable(){
  const rs=rows('all');
  // dividends actually received per fund (recorded reinvestment lots) — replaces the old
  // always-$0 "Realized" column: nothing has ever been sold, but dividends ARE realized cash
  const divBy={}; let divTot=0;
  for(const l of state.lots){ if(l.div){ divBy[l.sym]=(divBy[l.sym]||0)+l.cost; divTot+=l.cost; } }
  let unrl=0;
  const trs=rs.map(r=>{
    const u=r.qty*priceOf(r.sym)-r.cost; unrl+=u;
    const dv=divBy[r.sym]||0;
    return `<tr data-sym="${esc(r.sym)}"><td>${esc(r.sym.replace('-','.'))} <span style="color:var(--mut)">›</span></td><td>${r.qty.toFixed(2)}</td><td class="${dv>0?'pos':''}">${fmt(dv)}</td><td class="${cls(u)}">${fmtSign(u)}</td></tr>`;
  }).join('');
  $('gainsTable').innerHTML = `<tr><th>Asset</th><th>Owned</th><th>Dividends</th><th>Unrealized</th></tr>${trs}
    <tr><td>Total</td><td></td><td class="${divTot>0?'pos':''}">${fmt(divTot)}</td><td class="${cls(unrl)}"><b>${fmtSign(unrl)}</b></td></tr>`;
  $('gainsTable').querySelectorAll('tr[data-sym]').forEach(tr=> tr.onclick=()=>openDetail(tr.dataset.sym));
}
/* VXUS regional mix — published fund page, estimate */
const VXUS_REGIONS = { 'Europe':.40, 'Asia-Pacific':.27, 'Emerging markets':.26, 'Canada & other':.07 };
function locItems(){
  const rs=rows('all');
  const us=rs.filter(r=>r.sym!=='VXUS').reduce((a,r)=>a+r.qty*priceOf(r.sym),0);
  const intl=rs.filter(r=>r.sym==='VXUS').reduce((a,r)=>a+r.qty*priceOf(r.sym),0);
  const cash=cashFor('all');
  return [
    {label:'United States', v:us,                          color:CAT[0]},
    {label:'Europe',        v:intl*VXUS_REGIONS['Europe'], color:CAT[1]},
    {label:'Asia-Pacific',  v:intl*VXUS_REGIONS['Asia-Pacific'], color:CAT[3]},
    {label:'Emerging markets', v:intl*VXUS_REGIONS['Emerging markets'], color:CAT[4]},
    {label:'Canada & other', v:intl*VXUS_REGIONS['Canada & other'], color:CAT[5]},
    {label:'Cash',          v:cash,                        color:CAT[2]}
  ].filter(i=>i.v>0);
}
function renderLook(){
  if(!$('lookList')) return;
  const sub=$('lookSub');
  if(sub){
    const syms=new Set(rows('all').map(r=>r.sym));
    let n=0;
    if(syms.has('VTI')) n+=3600; else { if(syms.has('VOO')) n+=500; if(syms.has('VXF')) n+=3400; }
    if(syms.has('VXUS')) n+=8300;
    sub.textContent = n>1000 ? `Your funds hold ~${n.toLocaleString(appLocale())} companies across ~50 countries — these are your biggest slices.` : '';
  }
  const look=lookExposure().slice(0,10);
  $('lookList').innerHTML = look.map(l=>{
    const q=state.quotes[l.sym];
    const pct=q&&q.prev>0?(q.price/q.prev-1)*100:null;
    return mRow(l.sym, (LOOK_NAMES[l.sym]||'')+' · via '+l.via.map(v=>v.replace('-','.')).join(' + '), fmt(l.usd), pct);
  }).join('') || '<div class="mload">No fund holdings yet.</div>';
}
let lookFetching=false;
async function ensureLookQuotes(){
  if(lookFetching) return;
  const TTL=5*60000;
  const stale=lookExposure().slice(0,10).filter(l=>{const q=state.quotes[l.sym]; return !q||!q.ts||Date.now()-q.ts>TTL;});
  if(!stale.length) return;
  lookFetching=true;
  await Promise.allSettled(stale.map(l=>fetchQuote(l.sym)));
  lookFetching=false;
  lsSet('pt_quotes',state.quotes);
  renderLook();
}
function renderDrawdown(){
  const el=$('ddChart'); if(!el||!window.Chart) return;
  const o=Chart.getChart(el); if(o) o.destroy();
  const s=buildSeries('all');
  if(!s||s.labels.length<10){ $('ddStat').textContent='Needs price history — connect once.'; return; }
  const cut=rangeCutoff('1Y');
  let i=s.labels.findIndex(d=>d>=cut); if(i<0) i=0;
  let peak=Math.max(...s.value.slice(0,i+1)); // true peak going into the window
  const labels=[], dd=[];
  for(let k=i;k<s.labels.length;k++){
    const v=s.value[k]; if(v>peak) peak=v;
    labels.push(s.labels[k]); dd.push((v/peak-1)*100);
  }
  const cur=dd[dd.length-1], worst=Math.min(...dd);
  const ddBase=`Worst this year <b class="neg">${worst.toFixed(1)}%</b> · now <b class="${cur<-0.05?'neg':'pos'}">${cur<-0.05?cur.toFixed(1)+'%':'at the peak'}</b>`;
  $('ddStat').innerHTML=ddBase;
  el.setAttribute('role','img');
  el.setAttribute('aria-label', `Drawdown chart, past year. Worst: ${worst.toFixed(1)}%. Now: ${cur<-0.05?cur.toFixed(1)+'% below peak':'at the peak'}.`);
  const ddChart=new Chart(el,{type:'line',data:{labels,datasets:[{data:dd,borderColor:cvar('--red'),
      backgroundColor:`rgba(${cvar('--red-rgb')},.11)`,fill:true,pointRadius:0,borderWidth:1.8,tension:0.35,cubicInterpolationMode:'monotone'}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{...CHART_TOOLTIP,
        callbacks:{label:c=>c.parsed.y<-0.05?c.parsed.y.toFixed(1)+'% below peak':'At the peak'}}},
      scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,maxRotation:0,font:{size:10},callback:function(v){return this.getLabelForValue(v).slice(5);}}},
              y:{max:0,grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:4,font:{size:10},callback:v=>v+'%'}}}}});
  attachScrubAny(ddChart, i=>{
    $('ddStat').innerHTML = i==null ? ddBase :
      `${niceLbl(labels[i])} · <b class="${dd[i]<-0.05?'neg':'pos'}">${dd[i]<-0.05?dd[i].toFixed(1)+'% below peak':'at the peak'}</b>`;
  });
}
// Share-weighted portfolio P/E — shared by renderModGrid()'s tile and openPESheet()'s detail.
function portfolioPE(){
  const rs=rows('all'); let wsum=0, earn=0;
  for(const r of rs){ const m=FUND_META[r.sym]; if(!m||!m.pe) continue; const v=r.qty*priceOf(r.sym); wsum+=v; earn+=v/m.pe; }
  return earn>0?wsum/earn:null;
}
function riskStats(){
  const rs=rows('all'); const t=totals('all');
  const investedVal=Math.max(1,t.value-cashFor('all'));
  const w={}; for(const r of rs) w[r.sym]=r.qty*priceOf(r.sym)/investedVal;
  const H={};
  for(const r of rs){ const h=state.history[r.sym]; if(!h) continue; const m={}; for(let i=0;i<h.t.length;i++) if(h.c[i]!=null) m[dayStr(h.t[i])]=h.c[i]; H[r.sym]=m; }
  const days=[...new Set([].concat(...Object.values(H).map(m=>Object.keys(m))))].sort().slice(-253);
  const rets=[], voo=[], retDays=[];
  // per-symbol daily returns, index-aligned with voo — same series the portfolio-weighted
  // blend above pools together; kept per-symbol here too so holding-level beta (below) is
  // the identical cov/var formula, just unpooled, not a second calculation.
  const symRets={}; for(const s of Object.keys(H)) symRets[s]=[];
  for(let i=1;i<days.length;i++){
    let rp=0;
    for(const s of Object.keys(H)){ const a=H[s][days[i-1]], b=H[s][days[i]]; const rs=(a&&b)?(b/a-1):null; if(rs!=null) rp+=(w[s]||0)*rs; symRets[s].push(rs); }
    rets.push(rp); retDays.push(days[i]);
    const va=H.VOO&&H.VOO[days[i-1]], vb=H.VOO&&H.VOO[days[i]];
    voo.push(va&&vb?vb/va-1:null);
  }
  if(rets.length<30) return null;
  // Annualization factor: derive periods/year from the ACTUAL observed spacing of `days`,
  // rather than hardcoding a 252-trading-day count. state.history is daily for live-fetched
  // symbols but only WEEKLY for the offline/demo baked SEED_HISTORY (js/seed.js) — a hardcoded
  // 252 silently overstated weekly-sampled volatility by ~sqrt(252/52)≈2.2x and annualized
  // return by ~252/52≈4.8x (Phase 0 finding: demo Insights showed vol≈29%, annRet≈87%).
  // Day-count basis: Actual/365.25 (mean Gregorian year), matching xirr()'s YR constant in
  // js/core.js and the modified-Dietz windows in periodReturns()/monthlyDietzReturns() below —
  // one convention for "how many periods in a year" across the whole app.
  const spanDays=(new Date(days[days.length-1]).getTime()-new Date(days[0]).getTime())/86400000;
  const periodsPerYear = spanDays>0 ? 365.25/(spanDays/(days.length-1)) : 252;
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const mu=mean(rets);
  // Population standard deviation (divide by n, not n-1/Bessel-corrected "sample" stdev):
  // every return in the lookback window is used directly, not a sample estimating a larger
  // unseen population, so no correction is applied.
  const vol=Math.sqrt(mean(rets.map(r=>(r-mu)**2)))*Math.sqrt(periodsPerYear)*100;
  const pairs=rets.map((r,i)=>[r,voo[i]]).filter(p=>p[1]!=null);
  const mx=mean(pairs.map(p=>p[1])), my=mean(pairs.map(p=>p[0]));
  const cov=mean(pairs.map(p=>(p[0]-my)*(p[1]-mx))), vx=mean(pairs.map(p=>(p[1]-mx)**2));
  // Beta = cov/var of simple (arithmetic, not log) period returns. It is a RATIO, so it is
  // unaffected both by population-vs-sample normalization (the n or n-1 divisor is identical
  // top and bottom and cancels) and by the periods-per-year annualization above (neither cov
  // nor var is annualized here) — verified against an independent Python beta() (test/phase1).
  const beta=vx>0?cov/vx:1;
  // Per-holding beta — the exact same cov/var-vs-VOO formula above, applied to each symbol's
  // own return series instead of the portfolio-weighted blend. Powers the Risk module's axis
  // (design/target/insights-v2.html): every holding plotted by its own real beta, not a guess.
  const holdingBeta={};
  for(const s of Object.keys(H)){
    const pairs2=symRets[s].map((r,i)=>[r,voo[i]]).filter(p=>p[0]!=null&&p[1]!=null);
    if(pairs2.length<30) continue;
    const mx2=mean(pairs2.map(p=>p[1])), my2=mean(pairs2.map(p=>p[0]));
    const cov2=mean(pairs2.map(p=>(p[0]-my2)*(p[1]-mx2))), vx2=mean(pairs2.map(p=>(p[1]-mx2)**2));
    if(vx2>0) holdingBeta[s]=cov2/vx2;
  }
  // Max drawdown reads directly off the cumulative portfolio-value series (buildSeries): a
  // peak-to-trough ratio with no time dimension, so it is also unaffected by sampling frequency.
  let peak=0, mdd=0; const s=buildSeries('all');
  if(s) for(const v of s.value){ if(v>peak) peak=v; if(peak>0){ const dd=(v-peak)/peak; if(dd<mdd) mdd=dd; } }
  // your actual daily extremes over the last year — the swing size to expect on big news days
  let bi=0, wi=0;
  for(let i=1;i<rets.length;i++){ if(rets[i]>rets[bi]) bi=i; if(rets[i]<rets[wi]) wi=i; }
  // Sharpe = reward per unit of risk: (annualized return − 4% cash rate) ÷ annualized volatility
  const annRet=mu*periodsPerYear*100, RF=4;
  const sharpe=vol>0?(annRet-RF)/vol:0;
  return {vol, beta, mdd:mdd*100, best:{d:retDays[bi], p:rets[bi]*100}, worst:{d:retDays[wi], p:rets[wi]*100}, sharpe, annRet, holdingBeta, weights:w};
}
/* Deepest drop: the real drawdown curve (peak → trough → recovery), dated, plus which
   holding fell hardest and which held up best over that exact window. The peak-tracking
   scan is the same one riskStats() already runs to produce its single mdd figure above —
   this just keeps the path instead of collapsing it, and extends it to find WHEN. */
function drawdownStats(){
  const s=buildSeries('all'); if(!s||s.labels.length<10) return null;
  let peak=s.value[0], peakI=0, troughI=0, troughDd=0, troughPeakI=0;
  for(let i=0;i<s.value.length;i++){
    const v=s.value[i];
    if(v>peak){ peak=v; peakI=i; }
    const dd=peak>0?(v/peak-1):0;
    if(dd<troughDd){ troughDd=dd; troughI=i; troughPeakI=peakI; }
  }
  if(troughI===troughPeakI) return null; // never actually dropped
  const peakVal=s.value[troughPeakI], troughVal=s.value[troughI];
  const dropDollars=peakVal-troughVal;
  let recI=-1;
  for(let i=troughI+1;i<s.value.length;i++){ if(s.value[i]>=peakVal){ recI=i; break; } }
  const peakDate=s.labels[troughPeakI], troughDate=s.labels[troughI], recDate=recI>=0?s.labels[recI]:null;
  const recoveryMonths=recDate?(new Date(recDate+'T12:00:00')-new Date(troughDate+'T12:00:00'))/2629800000:null; // 30.4375-day month
  const endI=recI>=0?recI:s.value.length-1;
  const curveLabels=s.labels.slice(troughPeakI,endI+1);
  const curve=s.value.slice(troughPeakI,endI+1).map(v=>(v/peakVal-1)*100);
  // per-holding price move, peak date -> trough date — same binary-search-over-daily-closes
  // technique pathValue() already uses above, just reading a window instead of a lump sum.
  const moves=[];
  for(const r of rows('all')){
    const h=state.history[r.sym]; if(!h) continue;
    const px={}; for(let i=0;i<h.t.length;i++) if(h.c[i]!=null) px[dayStr(h.t[i])]=h.c[i];
    const dys=Object.keys(px).sort();
    const at=d=>{ let lo=0,hi=dys.length-1,ans=null; while(lo<=hi){ const m=(lo+hi)>>1; if(dys[m]<=d){ans=dys[m];lo=m+1;} else hi=m-1; } return ans?px[ans]:null; };
    const p0=at(peakDate), p1=at(troughDate);
    if(p0>0 && p1!=null) moves.push({sym:r.sym, pct:(p1/p0-1)*100});
  }
  moves.sort((a,b)=>a.pct-b.pct);
  const boughtThrough=state.lots.some(l=>!l.div && l.date>=peakDate && l.date<=troughDate);
  return {peakVal, troughVal, dropDollars, peakDate, troughDate, recDate, recoveryMonths, curveLabels, curve,
    hardest:moves[0]||null, heldUp:moves.length?moves[moves.length-1]:null, boughtThrough, mddPct:troughDd*100};
}
// "Same buys in VOO" as an annualized rate — identical xirr() cashflows and no-root fallback
// as personalReturn() (js/core.js), terminal value swapped for the VOO benchmark replay
// (pathValue, above) instead of your real portfolio total. Needed because the Return-vs-
// benchmark module's paired bars must compare two numbers of the same kind (both annualized
// %), not personalReturn()'s XIRR against the point-in-time dollar delta renderModGrid's
// "vs VOO" tile uses.
function benchmarkXirr(acc, sym){
  const sp=pathValue(sym); if(!sp) return null;
  const flows=state.lots.filter(l=>(acc==='all'||l.acc===acc)&&!l.div)
    .map(l=>({t:new Date(l.date+'T16:00:00Z').getTime(), v:-l.cost})).sort((a,b)=>a.t-b.t);
  if(!flows.length) return null;
  flows.push({t:Date.now(), v:sp.value});
  const x=xirr(flows);
  if(x!=null) return x;
  const inv=-flows.slice(0,-1).reduce((a,f)=>a+f.v,0), end=flows[flows.length-1].v;
  const yrs=Math.max(0.2,(flows[flows.length-1].t-flows[0].t)/31557600000);
  return inv>0&&end>0 ? Math.pow(end/inv,1/yrs)-1 : null;
}
// Goal-date projection shared by the three modules' goal lines below. Same log-compound ETA
// renderFI()/openFISheet() already use for the 4%-rule freedom number ("At your ~7%/yr pace,
// work could be optional in about N years") — retargeted at state.goal.amt (the owner's own
// target + year, set via the Home goal card) instead of the FI number. Not a new model: same
// formula, same growthRate(), a different target value.
function monthsToReach(amount, from){
  if(!(amount>0) || !(from>0) || from>=amount) return 0;
  return Math.log(amount/from)/Math.log(1+growthRate())*12;
}
function projectedGoalDate(fromValue){
  const goal=state.goal; if(!goal || !(goal.amt>0)) return null;
  if(fromValue>=goal.amt) return new Date();
  const months=monthsToReach(goal.amt, fromValue);
  if(!(months>0) || !isFinite(months)) return null;
  const d=new Date(); d.setMonth(d.getMonth()+Math.round(months));
  return d;
}
function monthYear(d){ return d.toLocaleDateString(appLocale(),{month:'short',year:'numeric'}); }
// Contribution-aware goal ETA for the Contributions module's goal line. monthsToReach()
// above deliberately has no contribution term — it mirrors renderFI()/renderProjection()'s
// established "today's money alone, no future deposits" convention. A contribution RATE
// needs a model that actually adds money over time, and the only one this app has is
// js/monte-carlo.js's runMonteCarloProjection() (used by Home's goal card). Reused here at
// its already-tested zero-volatility, one-path special case (test/monte-carlo.spec.js:
// "zero volatility with contributions matches a hand-computed annuity-with-inflation-decay
// sum") — same engine, same formula, just deterministic inputs instead of stochastic ones,
// so this is a numeric read of an existing model, not a new one. Linear interpolation
// between the two bracketing yearly points turns its year-granularity fan into a month
// figure — standard curve interpolation, not a second financial model.
function monthsToReachWithContribution(amount, from, monthlyPmt){
  if(!(amount>0) || !(from>0) || from>=amount || typeof runMonteCarloProjection!=='function') return null;
  const YEARS_CAP=60;
  const {fan}=runMonteCarloProjection({v0:from, years:YEARS_CAP, monthlyContribution:Math.max(0,monthlyPmt),
    goal:amount, meanReal:growthRate(), sdReal:0, meanInfl:0, sdInfl:0, paths:1, seed:1});
  const yr=fan.p50.findIndex(v=>v>=amount);
  if(yr<0) return null; // doesn't reach within the cap
  if(yr===0) return 0;
  const v0=fan.p50[yr-1], v1=fan.p50[yr];
  const frac=v1>v0 ? (amount-v0)/(v1-v0) : 0;
  return (yr-1+frac)*12;
}
function projectedGoalDateWithContribution(fromValue, monthlyPmt){
  const goal=state.goal; if(!goal || !(goal.amt>0)) return null;
  if(fromValue>=goal.amt) return new Date();
  const months=monthsToReachWithContribution(goal.amt, fromValue, monthlyPmt);
  if(months==null || !isFinite(months)) return null;
  const d=new Date(); d.setMonth(d.getMonth()+Math.round(months));
  return d;
}
function renderWorthChart(){
  const el=$('worthChart'); if(!window.Chart) return;
  const o=Chart.getChart(el); if(o) o.destroy();
  const cut=rangeCutoff('1Y');
  const rs=rows('all'); const maps={}; const daySet=new Set();
  for(const r of rs){ const h=state.history[r.sym]; if(!h) continue; maps[r.sym]={};
    for(let i=0;i<h.t.length;i++){ if(h.c[i]!=null){ const d=dayStr(h.t[i]); if(d>=cut){ daySet.add(d); maps[r.sym][d]=h.c[i]; } } } }
  const days=[...daySet].sort(); if(days.length<2) return;
  const colors={'US stocks':CAT[0],'International':CAT[1],'Dividend':CAT[2],'Berkshire':CAT[4]};
  const ds=Object.keys(ASSET_CLASSES).map(k=>({label:k, data:[], borderColor:colors[k], borderWidth:1.8, pointRadius:0, pointHoverRadius:3, tension:0.35, cubicInterpolationMode:'monotone', fill:false}));
  const last={};
  for(const d of days){
    const ls=lotState('all',d);
    for(const dsi of ds){
      let v=0;
      for(const s of ASSET_CLASSES[dsi.label]){ if(maps[s]&&maps[s][d]!=null) last[s]=maps[s][d]; const q=ls.qty[s]||0; if(q>0&&last[s]!=null) v+=q*last[s]; }
      dsi.data.push(v);
    }
  }
  const shown=ds.filter(d=>d.data.some(v=>v>0));
  el.setAttribute('role','img');
  el.setAttribute('aria-label', `Asset worth over the past year by category. Current: ${shown.map(d=>`${d.label} ${cfmt(d.data[d.data.length-1])}`).join(', ')}.`);
  const worthChart=new Chart(el,{type:'line',data:{labels:days,datasets:shown},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{...CHART_TOOLTIP,callbacks:{label:c=>c.dataset.label+': '+fmt(c.parsed.y)}}},
      scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,maxRotation:0,font:{size:10},callback:function(v){return this.getLabelForValue(v).slice(5);}}},
              y:{grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,font:{size:10},callback:v=>state.view.priv?'':new Intl.NumberFormat(appLocale(),{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate())}}}}});
  $('worthLegend').innerHTML=shown.map(d=>`<div class="alg"><span class="dot" style="background:${d.borderColor}"></span>${d.label}</div>`).join('');
  attachScrubAny(worthChart, i=>{ const ro=$('worthRO'); if(!ro) return;
    ro.textContent = i==null ? '' : `${niceLbl(days[i])} · `+shown.map(d=>`${d.label} ${cfmt(d.data[i])}`).join(' · '); });
}
/* ASSET WORTH — surfaced from #moreList (DESIGN-TARGET.md session 3). Delta's version
   line-charts its "top four holdings" because it must generalise to portfolios it can't
   fully show; this one holds six and can always name all of them (DESIGN-TARGET.md's own
   differentiator), so every held symbol gets its own row — a self-scaled 1Y sparkline (each
   row normalizes to its OWN min/max, so VOO's $83k and VXF's $5k both draw a full-height
   line; the point is shape, not a shared dollar axis) plus its current value and 1Y change.
   Same per-day qty×price walk renderWorthChart() above already does, just grouped by symbol
   instead of rolled up into ASSET_CLASSES. No goal line: see the HTML comment for why. */
function renderWorthMod(){
  const card=$('worthModCard'), body=$('worthRows'); if(!card||!body) return;
  const rs=rows('all'); if(!rs.length){ card.hidden=true; return; }
  const cut=rangeCutoff('1Y');
  const series=rs.map(r=>{
    const h=state.history[r.sym]; const map={}; const days=[];
    if(h) for(let i=0;i<h.t.length;i++){ if(h.c[i]!=null){ const d=dayStr(h.t[i]); if(d>=cut){ if(!(d in map)) days.push(d); map[d]=h.c[i]; } } }
    days.sort();
    const vals=[]; let last=null;
    for(const d of days){ const ls=lotState('all',d); const q=ls.qty[r.sym]||0; if(map[d]!=null) last=map[d]; if(q>0&&last!=null) vals.push(q*last); }
    return {sym:r.sym, vals, cur:r.qty*priceOf(r.sym)};
  }).filter(s=>s.vals.length>=2);
  if(!series.length){ card.hidden=true; return; }
  card.hidden=false;
  const head=$('worthModHead'); if(head) head.innerHTML=`<div class="stat__label">${t`Asset worth`}</div><span class="mod__sub">${t`by holding`} · 1Y</span>`;
  const w=110,h=22;
  body.innerHTML = series.slice().sort((a,b)=>b.cur-a.cur).map(s=>{
    const step=Math.max(1,Math.floor(s.vals.length/40));
    const pts=s.vals.filter((_,i)=>i%step===0 || i===s.vals.length-1);
    const lo=Math.min(...pts), hi=Math.max(...pts), span=(hi-lo)||1;
    const X=i=>i*w/(pts.length-1), Y=v=>h-2-((v-lo)/span)*(h-4);
    const d=pts.map((v,i)=>`${i===0?'M':'L'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    const chg=pts.length>1 ? (pts[pts.length-1]/pts[0]-1)*100 : 0;
    const col=colorOf(s.sym);
    return `<div class="modname"><i>${esc(s.sym.replace('-','.'))}</i>`+
      `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(s.sym)} 1Y trend, ${chg>=0?'up':'down'} ${Math.abs(chg).toFixed(1)}%"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`+
      `<span class="sparkval"><b>${esc(fmt(s.cur))}</b><em class="${chg>=0?'pos':'neg'}">${fmtPct(chg)}</em></span></div>`;
  }).join('');
  card.onclick=openWorthSheet;
}
function openPESheet(){
  const rs=rows('all');
  const body = `<p>Portfolio P/E is the price you pay for every $1 of your holdings' annual earnings — a rough valuation gauge. Lower is "cheaper," higher means more growth is priced in. It\'s a share-weighted blend across your funds.</p>`
    + rs.filter(r=>FUND_META[r.sym]).map(r=>`<div class="krow"><span class="k">${esc(r.sym.replace('-','.'))}</span><span>${FUND_META[r.sym].pe}× P/E</span></div>`).join('');
  openInfoSheet('Portfolio P/E', body);
}
function openRiskSheet(){
  const r=riskStats();
  if(!r){ openInfoSheet('Risk','<p>Needs a year of price history — connect once and check back.</p>'); return; }
  const dstr=d=>new Date(d+'T12:00:00').toLocaleDateString(appLocale(),{month:'short',day:'numeric'});
  const body = `<p>How much your portfolio swings, measured from your real price history.</p>
    <div class="krow"><span class="k">Volatility (1Y)</span><span>${r.vol.toFixed(1)}%</span></div>
    <div class="krow"><span class="k">Beta vs S&P 500</span><span>${r.beta.toFixed(2)}</span></div>
    <div class="krow"><span class="k">Max drawdown</span><span class="neg">${r.mdd.toFixed(1)}%</span></div>
    <div class="krow"><span class="k">Best day</span><span class="pos">${fmtPct(r.best.p)} · ${dstr(r.best.d)}</span></div>
    <div class="krow"><span class="k">Worst day</span><span class="neg">${fmtPct(r.worst.p)} · ${dstr(r.worst.d)}</span></div>
    <p style="margin-top:12px"><b>Volatility</b> is the size of your typical swing — under 15% is calm for stocks. <b>Beta</b> of ${r.beta.toFixed(2)} means you move ${r.beta<1?'less':'more'} than the S&P 500 (1.0 = in lockstep). <b>Max drawdown</b> is the worst peak-to-trough drop you\'ve lived through. <b>Best / worst day</b> are your real single-day extremes this past year — the swing size to expect when big news hits.</p>`;
  openInfoSheet('Risk', body);
}
function openHealthSheet(){
  const {score,metrics}=healthScore();
  if(score==null){ openInfoSheet('Portfolio Health', '<p>Add a holding to see your portfolio\'s health check — there\'s nothing to measure yet.</p>'); return; }
  const barCol=v=>v>=75?cvar('--green'):v>=50?cvar('--warn'):cvar('--red');
  const body = `<p>A single grade for your portfolio\'s shape, averaged from four checks. Tap any bar\'s topic below to see where you stand and how to improve.</p>`
    + metrics.map(m=>`<div class="hmet"><div class="t"><span>${m.k}</span><span class="s">${m.detail} · ${Math.round(m.v)}/100</span></div><div class="bar"><i style="width:${m.v.toFixed(0)}%;background:${barCol(m.v)}"></i></div>${m.tip?`<div class="htip" style="margin-top:7px"><span class="ti">→</span><span>${m.tip}</span></div>`:'<div class="htip" style="margin-top:7px;color:var(--mut)"><span class="ti">✓</span><span>Looking good here.</span></div>'}</div>`).join('')
    + `<p style="margin-top:6px;color:var(--faint);font-size:11px">Score = average of the four checks. Guidance, not financial advice.</p>`;
  openInfoSheet(t`Portfolio Health · ${score}/100`, body);
}
// Modified Dietz: R = (V1 − V0 − D) / (V0 + D·w), a deposit-adjusted (money-weighted-ish but
// non-iterative) return over one window. This app's D is pre-aggregated to one total per
// window (monthly here, per named window in periodReturns() below), so the exact date of each
// flow within the window isn't tracked — the textbook per-flow time-weight (days remaining /
// total days) collapses to a single flat w=0.5 (mid-window) for the whole deposit total. This
// is a deliberate simplification of true Modified Dietz given the monthly-bucketed data model,
// not a bug: exact for a single flow landing exactly mid-window, an approximation otherwise.
// Geometric vs arithmetic: Dietz returns for different windows are NOT chain-linked/compounded
// here — each window's % is independent, consistent with periodReturns() below re-deriving
// every window from V0/D directly rather than compounding monthly figures.
function monthlyDietzReturns(){ // 'YYYY-MM' -> deposit-adjusted % return — shared by heatmap + Monte Carlo
  const s=buildSeries('all'); if(!s||s.labels.length<3) return null;
  const eom={}; for(let i=0;i<s.labels.length;i++) eom[s.labels[i].slice(0,7)]=s.value[i];
  const dep={}; for(const l of state.lots){ if(!l.div) dep[l.date.slice(0,7)]=(dep[l.date.slice(0,7)]||0)+l.cost; }
  const months=Object.keys(eom).sort(); const ret={};
  for(let i=1;i<months.length;i++){ const m=months[i], v0=eom[months[i-1]], d=dep[m]||0;
    if(v0>0) ret[m]=(eom[m]-v0-d)/(v0+d/2)*100; }
  return {months, ret};
}
function periodReturns(){ // deposit-adjusted returns — ONE modified-Dietz formula for every window
  // (the old month-chaining for 6M/YTD/1Y/All silently dropped the first partial month of history)
  // Same flat mid-window weight (D/2) as monthlyDietzReturns() above, same reason.
  const s=buildSeries('all'); if(!s||s.labels.length<3) return [];
  const n=s.labels.length, out=[];
  for(const [k,cut] of [['1W',rangeCutoff('1W')],['1M',rangeCutoff('1M')],['6M',rangeCutoff('6M')],['YTD',rangeCutoff('YTD')],['1Y',rangeCutoff('1Y')],['All','0000-00-00']]){
    let i=s.labels.findIndex(d=>d>=cut); if(i<0) i=0;
    if(i>=n-1){ out.push({k,p:null}); continue; }
    const V0=s.value[i], D=state.lots.filter(l=>!l.div&&l.date>s.labels[i]).reduce((a,l)=>a+l.cost,0);
    out.push({k, p:(V0+D/2>0) ? (s.value[n-1]-V0-D)/(V0+D/2)*100 : null});
  }
  return out;
}
function prPills(arr){
  return arr.filter(x=>x.p!=null).map(x=>`<button class="prpill ${x.p>=0?'up':'down'}" data-r="${x.k==='All'?'MAX':x.k}">${x.k}<b>${fmtPct(x.p)}</b></button>`).join('');
}
function wirePrPills(el){
  el.querySelectorAll('.prpill').forEach(b=>b.onclick=()=>{
    showPage('portfolio');
    const t=document.querySelector(`#rangeSeg button[data-r="${b.dataset.r}"]`); if(t) t.click();
  });
}
function renderHomePr(){ const el=$('homePr'); if(!el) return; el.innerHTML=prPills(periodReturns()); wirePrPills(el); }
// "Same buys in VOO" benchmark: replays every real lot's cost as if it had bought `sym` at that
// symbol's closing price on-or-before the lot's purchase date (binary search over sorted daily
// closes), share-accumulating — a true buy-and-hold replay, not a single lump-sum comparison.
// Price-only: VOO/benchmark dividends are not reinvested here (documented to the user in
// renderPerf()'s footnote — "excluding its dividends"), so this understates the benchmark
// slightly versus a total-return index; deliberate, since the app doesn't track VOO's own
// distribution history the way it does the user's actual dividends.
function pathValue(sym){ // what your exact purchases would be worth if every dollar had bought `sym` instead
  const voo=state.history[sym]; if(!voo||!voo.t||voo.t.length<10) return null;
  const px={}; for(let i=0;i<voo.t.length;i++) if(voo.c[i]!=null) px[dayStr(voo.t[i])]=voo.c[i];
  const days=Object.keys(px).sort();
  const at=d=>{ let lo=0,hi=days.length-1,ans=null;
    while(lo<=hi){ const m=(lo+hi)>>1; if(days[m]<=d){ans=days[m];lo=m+1;} else hi=m-1; }
    return ans?px[ans]:null; };
  let sh=0, invested=0;
  for(const l of state.lots){ if(l.div) continue; const p=at(l.date); if(p>0){ sh+=l.cost/p; invested+=l.cost; } }
  if(!(sh>0)) return null;
  return { value: sh*(priceOf(sym)||px[days[days.length-1]]), invested };
}
function spPathValue(){ return pathValue('VOO'); }
function vooReturnSince(cut){ // VOO price return from `cut` (YYYY-MM-DD) to now
  const voo=state.history['VOO']; if(!voo||!voo.t||voo.t.length<2) return null;
  let p0=null, pLast=null;
  for(let i=0;i<voo.t.length;i++){
    if(voo.c[i]==null) continue;
    pLast=voo.c[i];
    if(p0==null && dayStr(voo.t[i])>=cut) p0=voo.c[i];
  }
  if(p0==null) p0=pLast; // window starts after last data point — no meaningful return
  const last=priceOf('VOO')||pLast;
  return p0>0 ? (last/p0-1)*100 : null;
}
function renderPerf(){
  const t=totals('all'), cash=cashFor('all'), mine=t.value-cash;
  const sp=spPathValue(), rr=personalReturn('all');
  // period-by-period scoreboard: you vs the market
  const s=buildSeries('all');
  const pr=periodReturns();
  const trs=pr.filter(x=>x.p!=null).map(x=>{
    const cut = x.k==='All' ? (s&&s.labels.length?s.labels[0]:'0000-00-00') : rangeCutoff(x.k);
    const b=vooReturnSince(cut);
    const d=b==null?null:x.p-b;
    return `<tr data-r="${x.k==='All'?'MAX':x.k}"><td>${x.k}</td><td class="${cls(x.p)}">${fmtPct(x.p)}</td><td style="color:var(--mut)">${b==null?'—':fmtPct(b)}</td><td class="${d==null?'':cls(d)}">${d==null?'—':fmtPct(d)}</td></tr>`;
  }).join('');
  let html = `<table class="gtable" style="margin-top:6px"><tr><th>Period</th><th>You</th><th>S&amp;P 500</th><th>±</th></tr>${trs}</table>`;
  if(sp){
    const d=mine-sp.value, dp=sp.value>0?d/sp.value*100:0;
    html += `<div class="krow" style="margin-top:14px"><span class="k">Your holdings today</span><span>${fmt(mine)}</span></div>
      <div class="krow"><span class="k">Same buys, all S&P 500</span><span>${fmt(sp.value)} <span class="${cls(d)}" style="font-size:11px">(${fmtSign(d)})</span></span></div>`;
    const wp=pathValue('VT');
    if(wp){ const wd=mine-wp.value;
      html += `<div class="krow"><span class="k">Same buys, all world (VT)</span><span>${fmt(wp.value)} <span class="${cls(wd)}" style="font-size:11px">(${fmtSign(wd)})</span></span></div>`;
    } else ensureBenchHistory('VT').then(ok=>{ if(ok && !$('page-insights').classList.contains('hidden')) renderPerf(); });
    if(rr!=null) html += `<div class="krow"><span class="k">Money-weighted return</span><span class="${cls(rr)}">${fmtPct(rr*100)} / yr</span></div>`;
    const real=realReturn();
    if(real) html += `<div class="krow"><span class="k">After inflation (real)</span><span class="${cls(real.realTot)}">${fmtPct(real.realTot)} <span style="color:var(--faint);font-size:11px">vs ${fmtPct(real.nomTot)} on paper</span></span></div>`;
  }
  html += `<div class="inc-note">Your returns are deposit-adjusted (new money doesn't inflate them); S&P 500 = VOO price change over the same window, excluding its dividends. "Same buys" replays each of your ${state.lots.filter(l=>!l.div).length} purchases into VOO on the same dates — the honest benchmark for your timing. Tap a period to see it on the chart.</div>`;
  $('perfBody').innerHTML=html;
  $('perfBody').querySelectorAll('tr[data-r]').forEach(tr=> tr.onclick=()=>{
    // R2: this table now lives inside the Performance sheet (openPerfSheet), not
    // inline on the page — close it before navigating tabs, or Portfolio would
    // render underneath a still-open scrim.
    closeDetail();
    showPage('portfolio');
    const t=document.querySelector(`#rangeSeg button[data-r="${tr.dataset.r}"]`); if(t) t.click();
  });
}
function ensureChartsSized(){ // charts created mid page-transition can get stamped width:0 — heal them
  ['ddChart','projChart','worthChart','contribChart'].forEach(id=>{
    const el=$(id); if(!el||!window.Chart) return;
    const c=Chart.getChart(el);
    if(c && el.width===0 && el.parentNode && el.parentNode.clientWidth>0){ try{ c.resize(); }catch(e){} }
  });
}
/* ============ R2 restructure: health card + module grid + heatmap + sector
   exposure are the only things rendered unconditionally (DESIGN-TARGET.md /
   five-tabs.html frame 4). Everything else — performance detail, drawdown,
   gains, tax lots, contributions, projection, financial independence, coach,
   crash test, geography, look-through, asset worth — is unchanged maths,
   just rendered lazily the moment its sheet opens (open*Sheet functions
   below), instead of unconditionally into cards that no longer exist. */
function renderInsights(){
  renderHealth();
  renderRiskMod();
  renderDrawdownMod();
  renderCrashMod();
  renderXirrMod();
  renderContribMod();
  renderTaxMod();
  renderSectorMod();
  renderGeoMod();
  renderWorthMod();
  renderPEMod();
  renderModGrid();
  renderHeatmap();
  renderMoreList();
}
/* One single-stat tile: Volatility. XIRR, vs VOO, Beta, Max drawdown, Contributions,
   Sector and Portfolio P/E all moved out to their own picture-plus-names cards
   (DESIGN-TARGET.md's Insights v2) — a number with a caption is a stat tile, not
   an Insights module. Volatility stays a flat tile because the approved rendered
   spec (design/target/insights-v2.html) keeps it as one too, paired with Sharpe. */
function renderModGrid(){
  const grid=$('modGrid'); if(!grid) return;
  const r=riskStats();
  const tile=(mod,label,value,tone,sub)=>
    `<button type="button" class="stat press" data-mod="${mod}">`+
    `<div class="stat__label">${esc(label)}</div>`+
    `<div class="stat__value${tone?` ${tone}`:''}">${esc(value)}</div>`+
    `<div class="stat__delta">${esc(sub)}</div></button>`;
  grid.innerHTML =
    tile('risk', 'Volatility', r?r.vol.toFixed(2)+'%':'—', '', r?'Sharpe '+r.sharpe.toFixed(2):'Needs price history');
  grid.querySelectorAll('[data-mod]').forEach(el=> el.onclick=()=>{
    if(el.dataset.mod==='risk') openRiskSheet();
  });
}
/* ============ Insights v2 modules — a mark + names, not a number in a box ============
   design/target/insights-v2.html is the approved rendered spec (DESIGN-TARGET.md's
   "Insights v2" section). Session 1: Risk, Deepest drop, Return-vs-benchmark. Session 2
   (this pass): Contributions, Sector (categorical allocstrip → sequential ramp — a form
   fix, not a restyle) and Portfolio P/E, further down this file. Each ends on the indigo
   goal-line rule where the state to write one honestly exists. Volatility stays a flat
   modGrid tile — the spec's own choice too. Heatmap/health/"More" untouched this session.
   Anti-pattern checks: see the commit note this lands with. */
function renderRiskMod(){
  const card=$('riskModCard'), svgEl=$('riskAxis'); if(!card||!svgEl) return;
  const r=riskStats();
  const hold=r?Object.entries(r.holdingBeta).map(([sym,beta])=>({sym,beta})).sort((a,b)=>a.beta-b.beta):[];
  if(!r || !hold.length){ card.hidden=true; return; }
  card.hidden=false;
  const head=$('riskModHead'); if(head) head.innerHTML=`<div class="stat__label">${t`Risk`}</div><span class="mod__sub">${t`beta vs S&P 500`}</span>`;
  const vals=[1, r.beta, ...hold.map(h=>h.beta)];
  const lo=Math.min(...vals)-0.12, hi=Math.max(...vals)+0.12;
  const w=342,h=96,pl=8,pr=8,y=52;
  const X=v=>pl+(v-lo)/(hi-lo)*(w-pl-pr);
  const MUT=cvar('--mut'), GRID=cvar('--grid'), BRAND=cvar('--brand'), CANVAS=cvar('--canvas');
  let s=`<line x1="${pl}" y1="${y}" x2="${w-pr}" y2="${y}" stroke="${GRID}" stroke-width="1.5"/>`;
  s+=`<line x1="${X(1).toFixed(1)}" y1="${y-13}" x2="${X(1).toFixed(1)}" y2="${y+13}" stroke="${MUT}" stroke-width="1.5" stroke-dasharray="2 3"/>`;
  // Two collision problems, not one. Session 1 only ever decluttered label TEXT (below),
  // never the MARKER circles themselves — this session's bug report caught VOO/VTI circles
  // overlapping outright on real clustered betas (a 0.78-1.18 band). Separately, the S&P
  // benchmark's label used to be drawn at a fixed position outside the declutter system
  // entirely, so a holding near beta=1.00 collided with it directly. Fixed by folding the
  // benchmark label into the SAME items array (r:0 — it never gets its own circle, the
  // dashed tick line above stays at the true X(1), unmoved) and running a two-pass
  // (forward then backward) minimum-gap resolution on marker x BEFORE the per-row label
  // declutter, so labels now start from already-separated markers instead of raw values.
  const px=+X(r.beta).toFixed(1);
  const items=[
    {x:px, sym:'YOU', isYou:true, r:7.5},
    ...hold.map(hd=>({x:+X(hd.beta).toFixed(1), sym:hd.sym.replace('-','.'), isYou:false, r:4})),
    {x:+X(1).toFixed(1), sym:'S&P 1.00', isBench:true, r:0},
  ];
  items.sort((a,b)=>a.x-b.x);
  for(let i=1;i<items.length;i++){
    const need=items[i-1].r+items[i].r+3;
    if(items[i].x-items[i-1].x<need) items[i].x=items[i-1].x+need;
  }
  for(let i=items.length-2;i>=0;i--){
    const need=items[i].r+items[i+1].r+3;
    if(items[i+1].x-items[i].x<need) items[i].x=items[i+1].x-need;
  }
  for(const it of items) it.x=Math.min(w-pr-4,Math.max(pl+4,it.x));
  // Label rows: real betas cluster far tighter than the mockup's illustrative spread-out
  // demo values, so simple alternation isn't enough — strict alternation only guarantees
  // the two IMMEDIATE x-neighbors differ in row; a 4-item cluster still puts every other
  // one in the SAME row, close enough to collide. Alternate for the common case, then
  // declutter each row independently — walk it in x-order and push any label still too
  // close to the previous one in that row rightward.
  items.forEach((it,i)=>{ it.row=(i%2===0)?'up':'down'; it.tx=it.x; });
  const MIN_GAP=24;
  for(const row of ['up','down']){
    const rowItems=items.filter(it=>it.row===row);
    for(let i=1;i<rowItems.length;i++){
      const prev=rowItems[i-1], cur=rowItems[i];
      if(cur.tx-prev.tx<MIN_GAP) cur.tx=prev.tx+MIN_GAP;
    }
    for(const it of rowItems) it.tx=Math.min(w-pr-4,Math.max(pl+4,it.tx));
  }
  for(const it of items){
    if(it.isYou || it.isBench) continue;
    s+=`<circle cx="${it.x.toFixed(1)}" cy="${y}" r="4" fill="${CANVAS}" stroke="${MUT}" stroke-width="1.6"/>`;
    s+=`<text x="${it.tx.toFixed(1)}" y="${it.row==='up'?y-18:y+40}" fill="${MUT}" stroke="none" font-size="9" font-weight="650" text-anchor="middle">${esc(it.sym)}</text>`;
  }
  const youIt=items.find(it=>it.isYou), benchIt=items.find(it=>it.isBench);
  s+=`<circle cx="${youIt.x.toFixed(1)}" cy="${y}" r="7.5" fill="${BRAND}" stroke="${CANVAS}" stroke-width="2.5"/>`;
  s+=`<text x="${youIt.tx.toFixed(1)}" y="${youIt.row==='up'?y-18:y+40}" fill="${BRAND}" stroke="none" font-size="10" font-weight="700" text-anchor="middle">YOU</text>`;
  s+=`<text x="${benchIt.tx.toFixed(1)}" y="${benchIt.row==='up'?y-18:y+40}" fill="${MUT}" stroke="none" font-size="9.5" font-weight="600" text-anchor="middle">S&amp;P 1.00</text>`;
  s+=`<text x="${pl}" y="${y+27}" fill="${MUT}" stroke="none" font-size="9" font-weight="600">${t`calmer`}</text>`;
  s+=`<text x="${w-pr}" y="${y+27}" fill="${MUT}" stroke="none" font-size="9" font-weight="600" text-anchor="end">${t`wilder`}</text>`;
  svgEl.innerHTML=s;
  svgEl.setAttribute('role','img');
  svgEl.setAttribute('aria-label', `Beta vs S&P 500, on one axis. You: ${r.beta.toFixed(2)}. `+hold.map(hd=>`${hd.sym.replace('-','.')} ${hd.beta.toFixed(2)}`).join(', ')+'.');
  const big=$('riskModBig'); if(big) big.textContent=r.beta.toFixed(2);
  // Goal line: dollar cost of a 20% market drop (same formula as openCrashSheet's crash-test
  // scenarios — index drawdown × your measured beta), translated into how far it pushes the
  // owner's own goal date (projectedGoalDate — real state.goal.amt/year, never a guess).
  const gl=$('riskGoalLine'); if(gl){
    const t2=totals('all'), dropCost=t2.value*0.20*Math.max(0,r.beta);
    const baseDate=projectedGoalDate(t2.value), shockDate=dropCost>0?projectedGoalDate(t2.value-dropCost):null;
    if(dropCost>0 && baseDate && shockDate && shockDate>baseDate){
      const costB=`<b>${fmt(dropCost)}</b>`, fromB=`<b>${monthYear(baseDate)}</b>`, toB=`<b>${monthYear(shockDate)}</b>`;
      gl.innerHTML=`<span>${t`A 20% market drop costs you ${costB} — and pushes your goal from ${fromB} to ${toB}.`}</span>`;
      gl.hidden=false;
    } else gl.hidden=true;
  }
  card.onclick=openRiskSheet;
}
function renderDrawdownMod(){
  const card=$('ddModCard'), svgEl=$('ddCurve'); if(!card||!svgEl) return;
  const d=drawdownStats();
  if(!d){ card.hidden=true; return; }
  card.hidden=false;
  const head=$('ddModHead'); if(head) head.innerHTML=`<div class="stat__label">${t`Deepest drop`}</div><span class="mod__sub">${t`peak to trough`}</span>`;
  const big=$('ddModBig'); if(big) big.textContent=fmtPct(d.mddPct);
  const w=342,h=80,pt=10,pb=14;
  const lo=Math.min(...d.curve,0)||-0.01;
  const X=i=>i*w/Math.max(1,d.curve.length-1), Y=v=>pt+(v/lo)*(h-pt-pb);
  let path=`M0 ${Y(d.curve[0]).toFixed(1)}`;
  for(let i=1;i<d.curve.length;i++){
    const a=X(i-1),b=Y(d.curve[i-1]),c=X(i),e=Y(d.curve[i]),m=(a+c)/2;
    path+=` C${m.toFixed(1)} ${b.toFixed(1)},${m.toFixed(1)} ${e.toFixed(1)},${c.toFixed(1)} ${e.toFixed(1)}`;
  }
  const troughRelI=d.curveLabels.indexOf(d.troughDate);
  const LOSS=cvar('--loss'), GRID=cvar('--grid'), CANVAS=cvar('--canvas'), zeroY=Y(0).toFixed(1);
  let s=`<defs><linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LOSS}" stop-opacity=".02"/><stop offset="1" stop-color="${LOSS}" stop-opacity=".22"/></linearGradient></defs>`+
    `<line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="${GRID}" stroke-width="1"/>`+
    `<path d="${path} L${w} ${zeroY} L0 ${zeroY} Z" fill="url(#ddg)" stroke="none"/>`+
    `<path d="${path}" fill="none" stroke="${LOSS}" stroke-width="2" stroke-linecap="round"/>`;
  if(troughRelI>=0){
    const cx=X(troughRelI).toFixed(1), cy=Y(d.curve[troughRelI]).toFixed(1);
    s+=`<circle cx="${cx}" cy="${cy}" r="3.6" fill="${LOSS}" stroke="${CANVAS}" stroke-width="2"/>`+
      `<text x="${cx}" y="${(+cy+15).toFixed(1)}" fill="${LOSS}" stroke="none" font-size="9.5" font-weight="650" text-anchor="middle">${esc(monthYear(new Date(d.troughDate+'T12:00:00')))}</text>`;
  }
  svgEl.innerHTML=s;
  svgEl.setAttribute('role','img');
  svgEl.setAttribute('aria-label', `Drawdown curve. Peak to trough: ${fmtPct(d.mddPct)}, trough on ${monthYear(new Date(d.troughDate+'T12:00:00'))}.`);
  const names=$('ddModNames');
  if(names) names.innerHTML=[
    d.hardest?`<div class="modname"><i>${esc(d.hardest.sym.replace('-','.'))}</i><s>${t`fell hardest`}</s><b class="neg">${fmtPct(d.hardest.pct)}</b></div>`:'',
    (d.heldUp && d.heldUp!==d.hardest)?`<div class="modname"><i>${esc(d.heldUp.sym.replace('-','.'))}</i><s>${t`held up best`}</s><b class="${d.heldUp.pct<0?'neg':'pos'}">${fmtPct(d.heldUp.pct)}</b></div>`:'',
  ].join('');
  const gl=$('ddGoalLine');
  if(gl){
    if(d.dropDollars>0){
      const rec=(d.recDate&&d.recoveryMonths!=null)?Math.max(1,Math.round(d.recoveryMonths)):null;
      const costB=`<b>${fmt(d.dropDollars)}</b>`;
      if(rec!=null){
        const monthsB=`<b>${rec} ${rec===1?t`month`:t`months`}</b>`;
        gl.innerHTML = d.boughtThrough
          ? `<span>${t`Cost ${costB} at the low. You were back to even in ${monthsB} — you kept buying through it.`}</span>`
          : `<span>${t`Cost ${costB} at the low. You were back to even in ${monthsB}.`}</span>`;
      } else {
        gl.innerHTML = `<span>${t`Cost ${costB} at the low.`}</span>`;
      }
      gl.hidden=false;
    } else gl.hidden=true;
  }
  card.onclick=openRiskSheet;
}
/* CRASH TEST — surfaced from #moreList (DESIGN-TARGET.md session 3): what past
   crashes would do to TODAY's portfolio, as a bar per scenario instead of the
   plain-text rows openCrashSheet's full sheet still uses (reachable by tap,
   unchanged). Same CRASH_SCENARIOS + beta-scaled dropCost math openCrashSheet
   already computes (defined further down this file — safe to reference here,
   this only runs once renderInsights() is called, by which point the whole
   script has executed). Pairs with the Risk card above: same dropCost/
   projectedGoalDate formula as renderRiskMod's goal line, just with each
   scenario's own drawdown fraction instead of a flat 20%. */
function renderCrashMod(){
  const card=$('crashModCard'), svgEl=$('crashBars'); if(!card||!svgEl) return;
  const t2=totals('all'); const rk=riskStats();
  if(!(t2.value>0) || !rk){ card.hidden=true; return; }
  const beta=Math.min(Math.max(0,rk.beta),1.3);
  const CRASH_LABELS={'2008 financial crisis':t`2008 financial crisis`,'2020 COVID crash':t`2020 COVID crash`,'2022 rate shock':t`2022 rate shock`};
  const scenarios=CRASH_SCENARIOS.map(c=>({...c, hit:t2.value*c.d*beta}));
  card.hidden=false;
  const head=$('crashModHead'); if(head) head.innerHTML=`<div class="stat__label">${t`Crash test`}</div><span class="mod__sub">${t`past crashes, scaled to you`}</span>`;
  // Label sits ABOVE its bar, not beside it: the real scenario names ("2008 financial
  // crisis") run 20+ characters, too wide for a left-side gutter at this card's 342px
  // width (session 1/2's "check against real clustered data" lesson, hit again — the
  // first version of this put the label in a 132px-wide left gutter and it collided
  // with the bar). The value sits INSIDE the bar's own right edge instead of past it,
  // because the largest scenario's bar already runs ~95% of the track width, leaving no
  // outside gutter free either.
  const w=342,h=102, max=Math.max(...scenarios.map(s=>s.hit))*1.05;
  const rowH=34, barH=14;
  let s='';
  scenarios.forEach((sc,i)=>{
    const y=i*rowH, ww=Math.max(56,(sc.hit/max)*w);
    s+=`<text x="0" y="${y+9}" fill="${cvar('--mut')}" stroke="none" font-size="10" font-weight="600">${esc(CRASH_LABELS[sc.n]||sc.n)}</text>`;
    s+=`<rect x="0" y="${y+13}" width="${w}" height="${barH}" rx="5" fill="${cvar('--surface-2')}" stroke="none"/>`;
    s+=`<rect x="0" y="${y+13}" width="${ww.toFixed(1)}" height="${barH}" rx="5" fill="${cvar('--loss')}" stroke="none"/>`;
    s+=`<text x="${(ww-6).toFixed(1)}" y="${y+13+10}" fill="${cvar('--on-primary')}" stroke="none" font-size="10" font-weight="650" text-anchor="end">−${esc(fmt(sc.hit))}</text>`;
  });
  svgEl.innerHTML=s;
  svgEl.setAttribute('role','img');
  svgEl.setAttribute('aria-label', `Crash test. `+scenarios.map(sc=>`${CRASH_LABELS[sc.n]||sc.n}: −${fmt(sc.hit)}`).join(', ')+'.');
  const names=$('crashModNames');
  const hold=Object.entries(rk.holdingBeta).sort((a,b)=>b[1]-a[1]);
  if(names) names.innerHTML = hold.length
    ? `<div class="modname"><i>${esc(hold[0][0].replace('-','.'))}</i><s>${t`would fall hardest`}</s><b>${hold[0][1].toFixed(2)}β</b></div>`
    : '';
  const gl=$('crashGoalLine');
  if(gl){
    const worst=scenarios.reduce((a,b)=>b.hit>a.hit?b:a, scenarios[0]);
    const baseDate=projectedGoalDate(t2.value), shockDate=worst.hit>0?projectedGoalDate(t2.value-worst.hit):null;
    if(worst.hit>0 && baseDate && shockDate && shockDate>baseDate){
      const costB=`<b>${fmt(worst.hit)}</b>`, fromB=`<b>${monthYear(baseDate)}</b>`, toB=`<b>${monthYear(shockDate)}</b>`;
      gl.innerHTML=`<span>${t`A repeat of the ${esc(CRASH_LABELS[worst.n]||worst.n)} costs you ${costB} — and pushes your goal from ${fromB} to ${toB}.`}</span>`;
      gl.hidden=false;
    } else gl.hidden=true;
  }
  card.onclick=openCrashSheet;
}
function renderXirrMod(){
  const card=$('xirrModCard'), svgEl=$('xirrBars'); if(!card||!svgEl) return;
  const you=personalReturn('all'), bench=benchmarkXirr('all','VOO');
  if(you==null || bench==null){ card.hidden=true; return; }
  card.hidden=false;
  const head=$('xirrModHead'); if(head) head.textContent=t`Your return vs buying VOO instead`;
  const w=342,h=92, barRows=[[t`You`, you*100, cvar('--brand')], [t`Same buys in VOO`, bench*100, cvar('--mut')]];
  const max=Math.max(20, Math.abs(you*100), Math.abs(bench*100))*1.05;
  const bx=112, bw=w-bx-58;
  let s='';
  barRows.forEach(([lab,v,col],i)=>{
    const y=14+i*38, ww=Math.max(4,(Math.max(0,v)/max)*bw);
    s+=`<text x="0" y="${y+13}" fill="${cvar('--mut')}" stroke="none" font-size="11" font-weight="600">${esc(lab)}</text>`;
    s+=`<rect x="${bx}" y="${y}" width="${bw}" height="20" rx="4" fill="${cvar('--surface-2')}" stroke="none"/>`;
    s+=`<rect x="${bx}" y="${y}" width="${ww.toFixed(1)}" height="20" rx="4" fill="${col}" stroke="none"/>`;
    s+=`<text x="${w}" y="${y+14}" fill="${cvar('--text')}" stroke="none" font-size="11.5" font-weight="650" text-anchor="end">${fmtPct(v)}</text>`;
  });
  svgEl.innerHTML=s;
  svgEl.setAttribute('role','img');
  svgEl.setAttribute('aria-label', `Your annualized return ${fmtPct(you*100)} versus the same buys in VOO, ${fmtPct(bench*100)}.`);
  const gl=$('xirrGoalLine');
  if(gl){
    const t2=totals('all'), sp=spPathValue(), mine=t2.value-cashFor('all'), added=sp?mine-sp.value:null;
    if(added){
      const baseDate=projectedGoalDate(t2.value-added), aheadDate=projectedGoalDate(t2.value);
      if(baseDate && aheadDate && baseDate.getTime()!==aheadDate.getTime()){
        const months=Math.max(1,Math.round(Math.abs(baseDate-aheadDate)/2629800000));
        const monthsB=`<b>${months} ${months===1?t`month`:t`months`}</b>`;
        gl.innerHTML=added>0
          ?`<span>${t`Your timing added ${'<b>'+fmt(added)+'</b>'} — about ${monthsB} off the goal date.`}</span>`
          :`<span>${t`Your timing cost you ${'<b>'+fmt(-added)+'</b>'} — about ${monthsB} later on the goal date.`}</span>`;
        gl.hidden=false;
      } else gl.hidden=true;
    } else gl.hidden=true;
  }
  card.onclick=openPerfSheet;
}
/* WHAT YOU ADDED — bars over the last 12 real contribution months, replacing the
   old contribCard's Chart.js line+bar combo on the Insights tab itself (openContribSheet's
   full renderContribChart(), still Chart.js, is unchanged and still reachable by tap). Same
   monthly aggregation as renderContribChart() below, just the last 12 months rather than 24,
   and drawn as small hand-rolled SVG bars matching design/target/insights-v2.html exactly. */
function renderContribMod(){
  const card=$('contribModCard'), svgEl=$('contribBars'); if(!card||!svgEl) return;
  const per={};
  for(const l of state.lots){ if(!l.div) per[l.date.slice(0,7)]=(per[l.date.slice(0,7)]||0)+l.cost; }
  const keys=Object.keys(per).sort();
  if(!keys.length){ card.hidden=true; return; }
  const labels=[], data=[];
  let cur=keys[0]; const end=dayStr(Date.now()).slice(0,7);
  while(cur<=end){ labels.push(cur); data.push(per[cur]||0);
    let [y,m]=cur.split('-').map(Number); m++; if(m>12){m=1;y++;} cur=y+'-'+String(m).padStart(2,'0'); }
  const V=data.slice(-12), L=labels.slice(-12);
  card.hidden=false;
  const head=$('contribModHead'); if(head) head.innerHTML=`<div class="stat__label">${t`What you added`}</div><span class="mod__sub">${V.length} ${V.length===1?t`month`:t`months`}</span>`;
  const total=V.reduce((a,v)=>a+v,0);
  const big=$('contribModBig'); if(big) big.textContent=fmt(total);
  const w=342,h=70,g=4,bw=(w-g*(V.length-1))/V.length,max=Math.max(...V,1);
  const mLbl=k=>new Date(k+'-02T12:00:00').toLocaleDateString(appLocale(),{month:'short'});
  let s='';
  V.forEach((v,i)=>{
    const bh=Math.max(1,(v/max)*(h-14)), x=i*(bw+g), y=h-14-bh;
    s+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${cvar('--brand')}" stroke="none" opacity="${(0.45+0.55*v/max).toFixed(2)}"/>`;
  });
  s+=`<text x="0" y="${h-1}" fill="${cvar('--mut')}" stroke="none" font-size="8.5" font-weight="600">${esc(mLbl(L[0]))}</text>`;
  s+=`<text x="${w}" y="${h-1}" fill="${cvar('--mut')}" stroke="none" font-size="8.5" font-weight="600" text-anchor="end">${esc(mLbl(L[L.length-1]))}</text>`;
  svgEl.innerHTML=s;
  svgEl.setAttribute('role','img');
  svgEl.setAttribute('aria-label', `What you added, last ${V.length} months. Total ${fmt(total)}. `+L.map((k,i)=>`${mLbl(k)} ${fmt(V[i])}`).join(', ')+'.');
  // Goal line: the pace shown IS the average of the 12 months on screen (not contribPace()'s
  // separate all-time average) — same number the chart already displays, nothing recomputed
  // differently. Arrival dates: the no-contribution baseline reuses session 1's
  // projectedGoalDate(); the contribution-aware dates reuse monthsToReachWithContribution()
  // above (the existing Monte Carlo engine's own deterministic special case).
  const gl=$('contribGoalLine');
  if(gl){
    const pmt=total/V.length, t2=totals('all');
    const baseDate=pmt>0?projectedGoalDate(t2.value):null;
    const paceDate=pmt>0?projectedGoalDateWithContribution(t2.value,pmt):null;
    if(baseDate && paceDate && baseDate>paceDate){
      const earlyMonths=Math.max(1,Math.round((baseDate-paceDate)/2629800000));
      const pmtB=`<b>${fmt(pmt)}</b>`, earlyB=`<b>${earlyMonths} ${earlyMonths===1?t`month`:t`months`} early</b>`;
      const moreDate=projectedGoalDateWithContribution(t2.value,pmt+100);
      const moreMonths=(moreDate && moreDate<paceDate) ? Math.max(1,Math.round((baseDate-moreDate)/2629800000)) : null;
      gl.innerHTML = moreMonths!=null
        ? `<span>${t`At ${pmtB}/month you arrive ${earlyB}. Adding $100 more makes it ${'<b>'+moreMonths+'</b>'}.`}</span>`
        : `<span>${t`At ${pmtB}/month you arrive ${earlyB}.`}</span>`;
      gl.hidden=false;
    } else gl.hidden=true;
  }
  card.onclick=openContribSheet;
}
/* TAX LOTS — surfaced from #moreList (DESIGN-TARGET.md session 3): short-term vs long-term
   as ONE split bar, not two magnitude bars. Real demo data is 98%/2% (verified against the
   live demo dataset, not the mockup's illustrative even split) — a magnitude bar would
   render the short-term side as a near-invisible sliver, so the form is a single proportional
   bar instead (session 1/2's "check against real clustered data" lesson, applied again). Same
   per-lot age/gain loop openTaxSheet (js/sheets.js) and renderMoreList's ltPct meta already
   use — no new maths, just re-formed and, new here, grouped per holding so the names list can
   say which holding still carries a short-term lot and when it clears — "what not to sell yet". */
function renderTaxMod(){
  const card=$('taxModCard'), svgEl=$('taxBar'); if(!card||!svgEl) return;
  const lots=state.lots.filter(l=>!l.div);
  if(!lots.length){ card.hidden=true; return; }
  const YR=31557600000, now=Date.now();
  let st=0, lt=0; const bySym={};
  for(const l of lots){
    const bornMs=new Date(l.date+'T12:00:00').getTime(), isLt=now-bornMs>=YR;
    const g=l.qty*priceOf(l.sym)-l.cost;
    if(isLt) lt+=g; else st+=g;
    if(!isLt){
      const ltDate=new Date(bornMs+YR);
      if(!bySym[l.sym] || ltDate<bySym[l.sym]) bySym[l.sym]=ltDate;
    }
  }
  card.hidden=false;
  const totG=st+lt, ltPct=totG>0?lt/totG*100:0, stPct=100-ltPct;
  const head=$('taxModHead'); if(head) head.innerHTML=`<div class="stat__label">${t`Tax lots`}</div><span class="mod__sub">${t`short-term vs long-term`}</span>`;
  const big=$('taxModBig'); if(big) big.textContent=ltPct.toFixed(0)+'%';
  const w=342,h=46, bx=0, bw=w, by=16, bh=14;
  const stW=Math.max(0,(stPct/100)*bw), ltW=bw-stW;
  let s=`<text x="0" y="9" fill="${cvar('--mut')}" stroke="none" font-size="9.5" font-weight="600">${t`Short-term gains`}</text>`;
  s+=`<text x="${w}" y="9" fill="${cvar('--mut')}" stroke="none" font-size="9.5" font-weight="600" text-anchor="end">${t`Long-term gains`}</text>`;
  s+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="7" fill="${cvar('--surface-2')}" stroke="none"/>`;
  if(stW>0) s+=`<rect x="${bx}" y="${by}" width="${stW.toFixed(1)}" height="${bh}" rx="7" fill="${cvar('--text-faint')}" stroke="none"/>`;
  if(ltW>0) s+=`<rect x="${(bx+stW).toFixed(1)}" y="${by}" width="${ltW.toFixed(1)}" height="${bh}" rx="7" fill="${cvar('--brand')}" stroke="none"/>`;
  s+=`<text x="0" y="${by+bh+11}" fill="${cvar('--text')}" stroke="none" font-size="10" font-weight="650">${stPct.toFixed(0)}% · ${esc(fmt(st))}</text>`;
  s+=`<text x="${w}" y="${by+bh+11}" fill="${cvar('--text')}" stroke="none" font-size="10" font-weight="650" text-anchor="end">${ltPct.toFixed(0)}% · ${esc(fmt(lt))}</text>`;
  svgEl.innerHTML=s;
  svgEl.setAttribute('role','img');
  svgEl.setAttribute('aria-label', `Tax lots. Short-term ${stPct.toFixed(0)}% (${fmt(st)}), long-term ${ltPct.toFixed(0)}% (${fmt(lt)}).`);
  const pending=Object.entries(bySym).sort((a,b)=>a[1]-b[1]);
  const names=$('taxModNames');
  if(names) names.innerHTML = pending.map(([sym,d])=>
    `<div class="modname"><i>${esc(sym.replace('-','.'))}</i><s>${t`goes long-term`}</s><b>${esc(monthYear(d))}</b></div>`).join('');
  const gl=$('taxGoalLine');
  if(gl){
    if(pending.length){
      const [soonSym,soonDate]=pending[0];
      const soonGain=lots.filter(l=>l.sym===soonSym && now-new Date(l.date+'T12:00:00').getTime()<YR).reduce((a,l)=>a+(l.qty*priceOf(l.sym)-l.cost),0);
      const symB=`<b>${esc(soonSym.replace('-','.'))}</b>`, gainB=`<b>${fmt(soonGain)}</b>`, dateB=`<b>${monthYear(soonDate)}</b>`;
      gl.innerHTML=`<span>${t`${symB} has ${gainB} in short-term gains — it turns long-term on ${dateB}.`}</span>`;
      gl.hidden=false;
    } else {
      gl.innerHTML=`<span>${t`Every lot you own already qualifies for the long-term rate.`}</span>`;
      gl.hidden=false;
    }
  }
  card.onclick=openTaxSheet;
}
/* WHERE THE MONEY ACTUALLY IS — sector exposure as a sequential single-hue ramp, ordered by
   magnitude, replacing the categorical allocstrip. Ordered magnitude is a sequential job
   (choosing-a-form.md): the reader's task is "which sector is biggest, by how much," not
   "instantly tell sector X's hue from sector Y's" — six categorical hues were spending the
   identity channel re-encoding what row order + label already show. Same SECTOR_WEIGHTS
   aggregation renderSectorStrip() (removed) and sheets.js's openSectorSheet() already use —
   no maths changed, only the form. */
function sectorExposure(){
  const per={};
  for(const r of rows('all')){
    const w=SECTOR_WEIGHTS[r.sym]; if(!w) continue;
    const v=r.qty*priceOf(r.sym);
    for(const [s,pc] of Object.entries(w)) per[s]=(per[s]||0)+v*pc/100;
  }
  let other=per['Other']||0; delete per['Other'];
  const items=Object.entries(per).sort((a,b)=>b[1]-a[1]);
  const top=items.slice(0,6); other+=items.slice(6).reduce((a,x)=>a+x[1],0);
  if(other>0) top.push([t`Everything else`, other]);
  return top;
}
function renderSectorMod(){
  const card=$('sectorCard'), body=$('sectorRows'); if(!card||!body) return;
  const top=sectorExposure();
  if(!top.length){ card.hidden=true; return; }
  card.hidden=false;
  const tot=top.reduce((a,x)=>a+x[1],0)||1;
  // Opacity-as-sequential-ramp dropped this session: 0.25+0.75*(v/max) compresses every
  // non-largest row toward the low end whenever one category dominates (this app's own
  // real data is exactly that — one ~25-83% row plus several much smaller ones), and the
  // resulting deltas (measured live: 0.53/0.53/0.52/0.45 across four sector rows) are too
  // close to read as different indigo shades in a 9px-tall bar. Length already encodes the
  // same magnitude precisely and comparably — the opacity channel was doubling up on a job
  // length was already doing, not doing a second job. One flat fill; length is the encoding.
  body.innerHTML=top.map(([label,v])=>{
    const pct=v/tot*100;
    return `<div class="seqrow"><s>${esc(label)}</s>`+
      `<span class="seqtrack"><i style="width:${pct.toFixed(1)}%"></i></span>`+
      `<b>${pct.toFixed(0)}%</b></div>`;
  }).join('');
  // Goal line: a look-through fact, not an assumption — find the top sector's two largest
  // dollar-contributing holdings (SECTOR_WEIGHTS, same source as the bars above), then check
  // lookExposure() (js/explore.js — already computes each underlying mega-cap's $ exposure
  // and which of your funds it comes "via") for whether those two holdings actually share
  // underlying companies, rather than assuming a sector-label match means real overlap.
  const gl=$('sectorGoalLine');
  if(gl){
    const [topLabel, topVal]=top[0];
    const contrib=rows('all').map(r=>{
      const w=SECTOR_WEIGHTS[r.sym]; const pc=w&&w[topLabel]; if(!pc) return null;
      return {sym:r.sym, v:r.qty*priceOf(r.sym)*pc/100};
    }).filter(Boolean).sort((a,b)=>b.v-a.v);
    if(contrib.length>=2){
      const [a,b]=contrib;
      const look=lookExposure();
      const shared=look.filter(l=>l.via.includes(a.sym)&&l.via.includes(b.sym)).length;
      const pctB=`<b>${(topVal/tot*100).toFixed(0)}%</b>`, aB=`<b>${esc(a.sym.replace('-','.'))}</b>`, bB=`<b>${esc(b.sym.replace('-','.'))}</b>`;
      if(shared>0){
        gl.innerHTML=`<span>${t`${esc(topLabel)} is ${pctB} of you — via ${aB} and ${bB}, not by choice. Your two biggest holdings there own the same companies.`}</span>`;
        gl.hidden=false;
      } else {
        gl.innerHTML=`<span>${t`${esc(topLabel)} is ${pctB} of you, mostly through ${aB} and ${bB}.`}</span>`;
        gl.hidden=false;
      }
    } else gl.hidden=true;
  }
  card.onclick=openSectorSheet;
}
/* WHERE YOUR MONEY LIVES — geographic mix, surfaced from #moreList (DESIGN-TARGET.md
   session 3), same sequential single-hue-ramp form as sector above: it's the same job
   (part-to-whole, ordered by magnitude), so it gets the same picture. locItems() (top of
   this file) is the same regional aggregation openLocSheet already lists — no maths
   changed, only the form. Real demo data: United States alone is ~83% of the portfolio,
   so the ramp's top row sits near-solid brand and the rest are thin slivers — expected
   for a US-heavy portfolio, not a rendering bug (checked against the live demo dataset). */
function renderGeoMod(){
  const card=$('geoModCard'), body=$('geoRows'); if(!card||!body) return;
  const items=locItems();
  if(!items.length){ card.hidden=true; return; }
  card.hidden=false;
  const head=$('geoModHead'); if(head) head.textContent=t`Where your money lives`;
  const tot=items.reduce((a,x)=>a+x.v,0)||1;
  // Opacity ramp dropped, same reasoning/evidence as renderSectorMod above: with one row
  // this dominant (US ~83%), 0.25+0.75*(v/max) crowds five of six rows into a 0.05-wide
  // opacity band (measured live: 0.31/0.29/0.29/0.26/0.26) — not perceptibly different
  // shades. Length alone is the encoding; the 3px seqtrack-i min-width floor (session 3,
  // css/components.css) still keeps this portfolio's real 1% buckets visible as a sliver.
  body.innerHTML=items.slice().sort((a,b)=>b.v-a.v).map(({label,v})=>{
    const pct=v/tot*100;
    return `<div class="seqrow"><s>${esc(label)}</s>`+
      `<span class="seqtrack"><i style="width:${pct.toFixed(1)}%"></i></span>`+
      `<b>${pct.toFixed(0)}%</b></div>`;
  }).join('');
  const gl=$('geoGoalLine');
  if(gl){
    const top=items.slice().sort((a,b)=>b.v-a.v)[0];
    const contrib = top.label==='United States'
      ? rows('all').filter(r=>r.sym!=='VXUS').map(r=>({sym:r.sym, v:r.qty*priceOf(r.sym)})).sort((a,b)=>b.v-a.v)
      : (top.label==='Cash' ? [] : [{sym:'VXUS', v:top.v}]);
    if(contrib.length){
      const pctB=`<b>${(top.v/tot*100).toFixed(0)}%</b>`;
      if(contrib.length>=2){
        const [a,b]=contrib;
        gl.innerHTML=`<span>${t`${esc(top.label)} is ${pctB} of you — mostly through ${'<b>'+esc(a.sym.replace('-','.'))+'</b>'} and ${'<b>'+esc(b.sym.replace('-','.'))+'</b>'}.`}</span>`;
      } else {
        gl.innerHTML=`<span>${t`${esc(top.label)} is ${pctB} of you, entirely through ${'<b>'+esc(contrib[0].sym.replace('-','.'))+'</b>'}.`}</span>`;
      }
      gl.hidden=false;
    } else gl.hidden=true;
  }
  card.onclick=openLocSheet;
}
/* PORTFOLIO P/E — a bar against VOO (this app's standing S&P 500 proxy everywhere else:
   riskStats()'s beta, benchmarkXirr(), pathValue() all benchmark against VOO), holdings
   ranked beneath by their own published P/E (FUND_META — the same figures openPESheet()
   already lists per fund, just ranked here instead of listed in filing order). */
function renderPEMod(){
  const card=$('peModCard'), svgEl=$('peBars'); if(!card||!svgEl) return;
  const pe=portfolioPE(), spy=FUND_META.VOO&&FUND_META.VOO.pe;
  if(pe==null || !spy){ card.hidden=true; return; }
  card.hidden=false;
  const w=342,h=92, barRows=[[t`You`, pe, cvar('--brand')], ['VOO ('+t`S&P 500`+')', spy, cvar('--mut')]];
  const max=Math.max(pe,spy)*1.15;
  const bx=112, bw=w-bx-58;
  let s='';
  barRows.forEach(([lab,v,col],i)=>{
    const y=14+i*38, ww=Math.max(4,(v/max)*bw);
    s+=`<text x="0" y="${y+13}" fill="${cvar('--mut')}" stroke="none" font-size="11" font-weight="600">${esc(lab)}</text>`;
    s+=`<rect x="${bx}" y="${y}" width="${bw}" height="20" rx="4" fill="${cvar('--surface-2')}" stroke="none"/>`;
    s+=`<rect x="${bx}" y="${y}" width="${ww.toFixed(1)}" height="20" rx="4" fill="${col}" stroke="none"/>`;
    s+=`<text x="${w}" y="${y+14}" fill="${cvar('--text')}" stroke="none" font-size="11.5" font-weight="650" text-anchor="end">${v.toFixed(1)}×</text>`;
  });
  svgEl.innerHTML=s;
  svgEl.setAttribute('role','img');
  svgEl.setAttribute('aria-label', `Portfolio P/E ${pe.toFixed(1)} versus VOO/S&P 500 at ${spy.toFixed(1)}.`);
  const names=$('peModNames');
  if(names){
    const ranked=rows('all').map(r=>({sym:r.sym, pe:FUND_META[r.sym]&&FUND_META[r.sym].pe})).filter(x=>x.pe).sort((a,b)=>b.pe-a.pe);
    names.innerHTML=ranked.map(x=>`<div class="modname"><i>${esc(x.sym.replace('-','.'))}</i><s></s><b>${x.pe.toFixed(0)}×</b></div>`).join('');
  }
  card.onclick=openPESheet;
}
/* The "More" list — every remaining Insights feature, demoted to a compact
   disclose row (js/ui.js's own comment: "how a demoted module is reached on
   mobile" — built in R1 for exactly this). Meta text reuses the same formulas
   the old cards used; tapping opens the same sheets/render functions,
   invoked fresh so they never depend on a card that no longer exists. */
function renderMoreList(){
  const list=$('moreList'); if(!list) return;
  const t=totals('all');
  const m12=new Set(state.lots.filter(l=>!l.div && l.date>dayStr(Date.now()-370*86400e3)).map(l=>l.date.slice(0,7))).size;
  // Tax lots, Crash test, Where your money lives and Asset worth moved out of this list to
  // their own mod cards on the tab (DESIGN-TARGET.md session 3 — see index.html's Insights
  // section comment). Next moves moved to Home instead (session 4 — see renderHomeCoach()
  // above and index.html's Home section comment): advice, not an insight, and Home is
  // where the owner actually lands. Contributions and Stocks-you-indirectly-own stay
  // listed here even though both also have a front door elsewhere (mod card / Following
  // tab respectively) — pre-existing, out of scope (already-settled in session 3's brief).
  const rowsDef=[
    {title:'Contributions', meta:`${m12} of last 12 months`, fn:openContribSheet},
    {title:'Where this is headed', meta:`${projYears}y projection`, fn:openProjSheet},
    {title:'Financial independence', meta:`${fmt(t.value*0.04/12)}/mo safe income`, fn:openFISheet},
    {title:'Stocks you indirectly own', meta:'Your ETF look-through', fn:openLookSheet}
  ];
  list.innerHTML = rowsDef.map((r,i)=>
    `<button class="disclose" data-i="${i}"><span class="disclose__title">${esc(r.title)}</span>`+
    `<span class="disclose__meta">${esc(r.meta)}</span><svg aria-hidden="true"><use href="#i-chevron-right"/></svg></button>`).join('');
  list.querySelectorAll('[data-i]').forEach((el,i)=> el.onclick=rowsDef[+el.dataset.i].fn);
}
/* ---- sheets for content that used to render inline — same render functions,
   invoked once their target elements exist inside the open sheet. ---- */
function openPerfSheet(){
  $('detailSheetHead').innerHTML = `<h2 class="hsym sheet__title">Performance</h2><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `
    <div id="perfBody"></div>
    <div class="card">
      <div class="stat__label">Drawdown · 1Y</div>
      <div id="ddStat"></div>
      <div class="chart chart--short"><canvas id="ddChart"></canvas></div>
    </div>
    <div class="tablewrap"><table class="table" id="gainsTable"></table></div>`;
  showOverlay('detail'); $('detailX').onclick=closeDetail; $('detailX').focus({preventScroll:true});
  renderPerf(); ensureChartJs().catch(()=>{}).then(renderDrawdown); renderGainsTable();
  setTimeout(ensureChartsSized,150);
}
function openContribSheet(){
  $('detailSheetHead').innerHTML = `<h2 class="hsym sheet__title">Contributions</h2><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `
    <div class="t-caption muted" id="contribSub"></div>
    <div class="scrubro" id="contribRO"></div>
    <div class="chart chart--short"><canvas id="contribChart"></canvas></div>`;
  showOverlay('detail'); $('detailX').onclick=closeDetail; $('detailX').focus({preventScroll:true});
  ensureChartJs().catch(()=>{}).then(renderContribChart);
  setTimeout(ensureChartsSized,150);
}
function openProjSheet(){
  $('detailSheetHead').innerHTML = `<h2 class="hsym sheet__title">Where this is headed</h2><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `
    <div class="seg" id="projSeg" role="tablist" aria-label="Projection years">
      <button class="seg__item" data-y="5" role="tab" aria-selected="${projYears===5}">5y</button>
      <button class="seg__item" data-y="10" role="tab" aria-selected="${projYears===10}">10y</button>
      <button class="seg__item" data-y="20" role="tab" aria-selected="${projYears===20}">20y</button>
    </div>
    <div class="scrubro" id="projRO"></div>
    <div class="chart"><canvas id="projChart"></canvas></div>
    <p class="t-caption faint" id="projNote"></p>
    <p class="t-caption faint" id="projMC"></p>`;
  showOverlay('detail'); $('detailX').onclick=closeDetail; $('detailX').focus({preventScroll:true});
  $('projSeg').querySelectorAll('button').forEach(b=> b.classList.toggle('on', +b.dataset.y===projYears));
  $('projSeg').querySelectorAll('button').forEach(b=> b.onclick=()=>{
    projYears=+b.dataset.y;
    $('projSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
    renderProjection();
  });
  ensureChartJs().catch(()=>{}).then(renderProjection);
  setTimeout(ensureChartsSized,150);
}
function openCoachSheet(){
  $('detailSheetHead').innerHTML = `<h2 class="hsym sheet__title">Next moves</h2><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `<div class="grid-2" id="coachGrid"></div>`;
  showOverlay('detail'); $('detailX').onclick=closeDetail; $('detailX').focus({preventScroll:true});
  renderCoach();
}
function openLookSheet(){
  $('detailSheetHead').innerHTML = `<h2 class="hsym sheet__title">Stocks you indirectly own</h2><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `<div class="t-caption muted" id="lookSub"></div><div id="lookList"></div>`;
  showOverlay('detail'); $('detailX').onclick=closeDetail; $('detailX').focus({preventScroll:true});
  renderLook(); ensureLookQuotes();
}
function openWorthSheet(){
  $('detailSheetHead').innerHTML = `<h2 class="hsym sheet__title">Asset worth · 1Y</h2><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `<div class="scrubro" id="worthRO"></div>
    <div class="chart chart--short"><canvas id="worthChart"></canvas></div><div class="dlegend" id="worthLegend"></div>`;
  showOverlay('detail'); $('detailX').onclick=closeDetail; $('detailX').focus({preventScroll:true});
  ensureChartJs().catch(()=>{}).then(renderWorthChart);
  setTimeout(ensureChartsSized,150);
}

/* ---- Crash Test: what past crashes would do to TODAY's portfolio (and that they all healed) ---- */
const CRASH_SCENARIOS=[
  {n:'2008 financial crisis', d:.55, rec:'~4 years'},
  {n:'2020 COVID crash',      d:.34, rec:'~5 months'},
  {n:'2022 rate shock',       d:.25, rec:'~2 years'}
];
function openCrashSheet(){
  const t=totals('all'); if(!(t.value>0)) return;
  const rk=riskStats(); const beta=(rk&&rk.beta>0)?Math.min(rk.beta,1.3):1;
  const rows=CRASH_SCENARIOS.map(c=>{ const hit=t.value*c.d*beta;
    return `<div class="krow"><span class="k">${c.n}</span><span><b class="neg">−${fmt(hit).replace('-','')}</b> → <b>${fmt(t.value-hit)}</b></span></div>`; }).join('');
  openInfoSheet('Crash test', `
    <p>If history's worst markets replayed <b>tomorrow</b>, here's roughly where today's ${fmt(t.value)} would land (scaled to your funds' actual sensitivity):</p>
    ${rows}
    <p style="margin-top:12px">The other half of the story: <b>every one of these fully recovered</b> — in ${CRASH_SCENARIOS.map(c=>c.rec.replace('~','about ')).join(', ')}. Money you won't need for years can afford to ride it out; panic-selling at the bottom is the only move that makes the loss permanent.</p>
    <div class="inc-note" style="margin-top:10px">Estimates: index drawdown × your portfolio's measured sensitivity (beta ${beta.toFixed(2)}). Not financial advice.</div>`);
}

/* ---- inflation-adjusted "real" return: what your all-time gain is worth in today's money ---- */
const INFLATION = 0.025; // ~ECB/Fed long-run target; the erosion your paper return hides
function realReturn(){
  const pr=periodReturns(); const all=pr.find(x=>x.k==='All');
  if(!all || all.p==null) return null;
  const lots=state.lots.filter(l=>!l.div).map(l=>l.date).filter(Boolean).sort();
  if(!lots.length) return null;
  const years=Math.max(0.5,(Date.now()-new Date(lots[0]+'T12:00:00').getTime())/31557600000);
  const realTot=((1+all.p/100)/Math.pow(1+INFLATION,years)-1)*100;
  return {nomTot:all.p, realTot, years};
}

/* ---- Financial Independence: the 4%-rule read on today's money ---- */
function growthRate(){ let g=personalReturn('all'); return (g!=null && g>0 && g<0.15) ? g : 0.07; }
function renderFI(){
  const el=$('fiBody'); if(!el) return;
  const t=totals('all');
  if(!(t.value>0)){ el.innerHTML='<div class="sub-n">Add holdings to see this.</div>'; return; }
  const monthly=t.value*0.04/12;
  const need=+((state.goal||{}).fimo)||0;
  let h=`<div class="big-n">${fmt(monthly)}<span style="font-size:14px;font-weight:500;color:var(--mut)"> /mo</span></div>
    <div class="sub-n">What your portfolio could safely pay you today — for life, without adding a cent.</div>`;
  if(need>0){
    const fiNum=need*12/0.04, pct=Math.min(100,t.value/fiNum*100);
    h+=`<div class="krow" style="margin-top:10px"><span class="k">Your freedom number</span><span><b>${fmt(fiNum)}</b></span></div>
      <div class="krow"><span class="k">You're here</span><span><b class="pos">${pct.toFixed(0)}%</b></span></div>
      <div class="fi-track"><i style="width:${pct.toFixed(1)}%"></i></div>`;
    if(t.value<fiNum){ const yrs=Math.log(fiNum/t.value)/Math.log(1+growthRate());
      h+=`<div class="sub-n" style="margin-top:8px">At your ~${(growthRate()*100).toFixed(0)}%/yr pace, work could be optional in about <b>${yrs<1?'under a year':Math.round(yrs)+' years'}</b> — on today's money alone.</div>`;
    } else h+=`<div class="sub-n pos" style="margin-top:8px">🎉 You've already passed your freedom number.</div>`;
  } else {
    h+=`<div class="sub-n" style="margin-top:8px;color:var(--brand)">Tap to set your monthly “freedom number” and see when work becomes optional.</div>`;
  }
  el.innerHTML=h;
  const c=$('fiCard'); if(c) c.onclick=openFISheet;
}
function openFISheet(){
  const t=totals('all'); if(!(t.value>0)) return;
  const monthly=t.value*0.04/12, need=+((state.goal||{}).fimo)||0, gr=growthRate();
  let body=`<p>The <b>4% rule</b> comes from decades of market history: a diversified portfolio can pay out about 4% of its value a year, keep rising with inflation, and still outlast a long retirement. It's the math behind “financial independence” — the point where your money can cover your life and working becomes a choice.</p>
    <div class="krow"><span class="k">Your portfolio</span><span><b>${fmt(t.value)}</b></span></div>
    <div class="krow"><span class="k">Safe income today</span><span><b class="pos">${fmt(monthly)}/mo</b></span></div>`;
  if(need>0){
    const fiNum=need*12/0.04, pct=Math.min(100,t.value/fiNum*100);
    body+=`<div class="krow"><span class="k">Freedom number (${fmt(need)}/mo)</span><span><b>${fmt(fiNum)}</b></span></div>
      <div class="krow"><span class="k">Progress</span><span><b class="pos">${pct.toFixed(0)}%</b></span></div>`;
    if(t.value<fiNum){ const yrs=Math.log(fiNum/t.value)/Math.log(1+gr);
      body+=`<p style="margin-top:10px">At your ~${(gr*100).toFixed(0)}%/yr growth on <b>today's money alone</b> (no new deposits assumed), you'd get there in about <b>${Math.round(yrs)} years</b>. Every euro you add pulls it closer.</p>`;
    } else body+=`<p class="pos" style="margin-top:10px">🎉 You've already passed your freedom number — the market is paying your way.</p>`;
  }
  body+=`<div class="ebtns" style="margin-top:14px"><button class="btn pri" id="fiSet">${need>0?'Change':'Set'} my monthly target</button></div>
    <div class="inc-note">Today's holdings compounded at your own growth rate — no assumed future deposits (your rule). Not advice.</div>`;
  openInfoSheet('Financial Independence', body);
  const b=$('fiSet'); if(b) b.onclick=()=>{
    const v=prompt('What monthly income would make work optional for you?', need||'');
    if(v==null) return; const n=parseFloat(String(v).replace(',','.'));
    state.goal=Object.assign({amt:0}, state.goal||{}, {fimo:n>0?n:0}); persist();
    closeDetail(); renderFI();
  };
}

/* ============ ASK — a private, on-device assistant that answers from YOUR numbers ============
   Free + local: no data leaves the phone. Open-ended questions it can't match fall through
   to askAI() (Cloudflare Workers AI, api.js) which the caller wires up. */
function fundReturn(sym){ const r=rows('all').find(x=>x.sym===sym); if(!r||!(r.cost>0)) return null; const g=r.qty*priceOf(sym)-r.cost; return {g, pct:g/r.cost*100, val:r.qty*priceOf(sym)}; }
function annualIncome(){ let inc=0; for(const r of rows('all')){ const dv=state.divs[r.sym]; if(dv&&dv.list){ const perSh=dv.list.filter(e=>e[0]>Date.now()-370*86400e3).reduce((a,e)=>a+e[1],0); inc+=perSh*r.qty; } } return inc; }
function askLocal(qRaw){
  const q=' '+qRaw.toLowerCase().replace(/[^a-z0-9%$.\- ]/g,' ').replace(/\s+/g,' ')+' ';
  const has=(...w)=>w.some(x=>q.includes(x));
  const t=totals('all'), cash=cashFor('all'), mine=t.value-cash;
  const dayBase=t.value-t.day, dayPct=dayBase>0?t.day/dayBase*100:0;
  const A=inner=>({confident:true, html:inner});
  if(!(t.value>0) && !has('hello','hi ','help','what can you')) return A(`Add some holdings first and I'll be able to answer that.`);

  // a specific fund by ticker or name?
  const sym=uniqSyms().find(s=>{ const a=s.toLowerCase(); return q.includes(' '+a+' ')||q.includes(' '+a.replace('-','.')+' ')||q.includes(' '+a.replace('-','')+' ')||(NAMES[s]&&NAMES[s].toLowerCase().split(/[ ]/).some(w=>w.length>3&&q.includes(w))); });
  if(sym && has('how','doing','up','down','return','gain','much','worth','performance')){
    const f=fundReturn(sym), q2=state.quotes[sym], dp=q2&&q2.prev>0?(q2.price/q2.prev-1)*100:0;
    if(f) return A(`<b>${sym.replace('-','.')}</b> is worth <b>${fmt(f.val)}</b> — ${f.g>=0?'up':'down'} <b class="${cls(f.g)}">${fmtSign(f.g)} (${fmtPct(f.pct)})</b> since you bought, and ${dp>=0?'+':''}${dp.toFixed(1)}% today. It's ${(f.val/mine*100).toFixed(0)}% of your holdings.`);
  }

  // overall standing
  if(has('how am i','how are we','how is my','how am i doing','overall','summary','how much have i made','how much did i make','total return','how is it going','how it going')){
    const pr=periodReturns(), all=pr.find(x=>x.k==='All'), ytd=pr.find(x=>x.k==='YTD');
    const gain=mine-rows('all').reduce((a,r)=>a+r.cost,0);
    return A(`Your portfolio is worth <b>${fmt(t.value)}</b>. All-time you're ${gain>=0?'up':'down'} <b class="${cls(gain)}">${fmtSign(gain)}</b>${all&&all.p!=null?` (a ${fmtPct(all.p)} market return)`:''}${ytd&&ytd.p!=null?`, and <b class="${cls(ytd.p)}">${fmtPct(ytd.p)}</b> so far this year`:''}. Today it's <b class="${cls(t.day)}">${fmtSign(t.day)} (${fmtPct(dayPct)})</b>.`);
  }
  // today
  if(has('today',"today's",'right now','so far today')){
    const movers=rows('all').map(r=>({s:r.sym,imp:r.qty*(priceOf(r.sym)-prevOf(r.sym))})).filter(m=>Math.abs(m.imp)>0.5).sort((a,b)=>Math.abs(b.imp)-Math.abs(a.imp));
    const m=movers[0];
    return A(`Today you're <b class="${cls(t.day)}">${fmtSign(t.day)} (${fmtPct(dayPct)})</b>, now at <b>${fmt(t.value)}</b>.${m?` Biggest move: <b>${m.s.replace('-','.')}</b> ${m.imp>=0?'+':''}${fmt(m.imp).replace('-','−')} on your shares.`:''}`);
  }
  // best / worst
  if(has('best','worst','winner','loser','biggest','top perform','worst perform','which fund')){
    const fr=rows('all').map(r=>({s:r.sym,...(fundReturn(r.sym)||{pct:0,g:0})})).filter(x=>x.g!=null).sort((a,b)=>b.pct-a.pct);
    if(fr.length){ const b=fr[0], w=fr[fr.length-1];
      if(has('worst','loser')) return A(`Your softest holding is <b>${w.s.replace('-','.')}</b> at <b class="${cls(w.pct)}">${fmtPct(w.pct)}</b> (${fmtSign(w.g)}). For a long-term index investor that's usually noise, not a reason to sell.`);
      return A(`Your best performer is <b>${b.s.replace('-','.')}</b>, up <b class="pos">${fmtPct(b.pct)}</b> (${fmtSign(b.g)}) since you bought it.${fr.length>1?` Your softest is ${w.s.replace('-','.')} at ${fmtPct(w.pct)}.`:''}`);
    }
  }
  // dividends / income
  if(has('dividend','income','pay me','passive','yield')){
    const inc=annualIncome(), yld=mine>0?inc/mine*100:0;
    return A(`Your funds pay you about <b class="pos">${fmt(inc)}/yr</b> in dividends right now (~${fmt(inc/12)}/mo, a ${yld.toFixed(2)}% yield) — and you reinvest it, so it compounds. In 4%-rule terms your whole portfolio could safely provide <b>${fmt(t.value*0.04/12)}/mo</b> for life.`);
  }
  // FI / retire
  if(has('retire','financial independence',' fi ','freedom','work optional','quit my job','never work','enough to live')){
    const monthly=t.value*0.04/12, need=+((state.goal||{}).fimo)||0, gr=growthRate();
    if(need>0){ const fiNum=need*12/0.04;
      if(t.value>=fiNum) return A(`You've hit it 🎉 — at your ${fmt(need)}/mo target, your ${fmt(t.value)} already covers financial independence.`);
      const yrs=Math.log(fiNum/t.value)/Math.log(1+gr);
      return A(`For <b>${fmt(need)}/mo</b> of freedom you need about <b>${fmt(fiNum)}</b> (the 4% rule). You're at ${fmt(t.value)} — <b>${(t.value/fiNum*100).toFixed(0)}%</b> there. On today's money growing ~${(gr*100).toFixed(0)}%/yr, that's roughly <b>${Math.round(yrs)} years</b> away, no new deposits needed.`);
    }
    return A(`Today your portfolio could safely pay you about <b class="pos">${fmt(monthly)}/mo</b> for life (the 4% rule). Tell me your target monthly spending — open the Financial Independence card and set it — and I'll tell you exactly how far away “work is optional” is.`);
  }
  // risk / volatility
  if(has('risk','risky','volatil','safe','how much can i lose','crash','drop','swing','sharpe')){
    const r=riskStats();
    if(r) return A(`Your volatility is <b>${r.vol.toFixed(1)}%/yr</b> — ${r.vol<15?'moderate':r.vol<25?'elevated':'high'}, normal for an all-stock mix. You swing ${r.beta<1?Math.round((1-r.beta)*100)+'% less':Math.round((r.beta-1)*100)+'% more'} than the S&P, your worst-ever dip was <b class="neg">${r.mdd.toFixed(0)}%</b>, and your risk-adjusted return (Sharpe) is <b>${r.sharpe.toFixed(2)}</b>${r.sharpe>=1?' — strong':''}. Tap Crash Test to see the dollar impact of past crashes.`);
  }
  // real / inflation
  if(has('inflation','real return','really worth','buying power','after inflation')){
    const rr=realReturn();
    if(rr) return A(`On paper you're up <b class="${cls(rr.nomTot)}">${fmtPct(rr.nomTot)}</b> all-time. After ~${(INFLATION*100).toFixed(1)}%/yr inflation over ${rr.years.toFixed(1)} years, that's <b class="${cls(rr.realTot)}">${fmtPct(rr.realTot)}</b> in real buying power — the honest number. Still well ahead of cash.`);
  }
  // diversification / concentration
  if(has('diversif','concentrat','spread out','too much','allocation','balanced','sectors')){
    const fr=rows('all').map(r=>({s:r.sym,w:r.qty*priceOf(r.sym)/Math.max(1,mine)})).sort((a,b)=>b.w-a.w);
    const big=fr[0];
    return A(`Your biggest single position is <b>${big.s.replace('-','.')}</b> at <b>${(big.w*100).toFixed(0)}%</b>${big.w>0.35&&!DIVERSIFIED_FUNDS.has(big.s)?' — a bit concentrated':''}. ${fr.filter(x=>DIVERSIFIED_FUNDS.has(x.s)).length?'Most of your money is in broad index funds, which each already hold hundreds of companies — so you\'re more diversified than the ticker count suggests.':''} See the Sectors and Where-Your-Money-Lives cards for the full picture.`);
  }
  // fees
  if(has('fee','expense ratio','cost me','paying in fees','advisory')){
    let wsum=0, fee=0; for(const r of rows('all')){ const m=FUND_META[r.sym]; const v=r.qty*priceOf(r.sym); if(m&&m.er!=null){ wsum+=v; fee+=v*m.er/100; } }
    const advis=(state.cash.main!=null)?0:0;
    const er=wsum>0?fee/wsum*100:0;
    return A(`Your funds' blended fee is about <b>${er.toFixed(2)}%/yr</b> ≈ <b>${fmt(fee)}/yr</b> — remarkably cheap (Vanguard index funds). Over 30 years as the balance grows, that's a tiny drag versus the ~1% many advisors charge, which on ${fmt(t.value)} would be ${fmt(t.value*0.01)}/yr.`);
  }
  // value / how much
  if(has('how much do i have','net worth','total value','worth','how much money','my money','balance')){
    return A(`You have <b>${fmt(t.value)}</b> total — ${fmt(mine)} invested across ${rows('all').length} funds${cash>0?` plus ${fmt(cash)} in cash`:''}.`);
  }
  // buy/sell/what-should-I-do → let the AI reason through it with math + disclaimer (falls through)
  // greeting / help
  if(has('hello','hi ','hey','what can you','help','who are you','what do you')){
    return A(`I'm your portfolio assistant — I answer from your real numbers, all on your phone. Try: <i>“How am I doing this year?”</i>, <i>“What's my best fund?”</i>, <i>“When can I retire?”</i>, <i>“Am I diversified?”</i>, or <i>“How risky am I?”</i>`);
  }
  return {confident:false, html:''};
}

/* ---- floating chat assistant (bubble bottom-right → slide-up chat window) ---- */
let aiBusy=false, aiOpen=false, aiSeq=0, aiMsgs=[];
const ASK_CHIPS=['How am I doing?','Best fund?','When can I retire?','Am I diversified?','How risky am I?'];
function aiRender(){
  const box=$('aiMsgs'); if(!box) return;
  box.innerHTML=aiMsgs.map(m=>`<div class="ai-msg ${m.role}"><div class="ai-bub">${m.html}</div>${m.src?`<div class="ai-src">${m.src}</div>`:''}</div>`).join('');
  box.scrollTop=box.scrollHeight;
}
function aiPush(role, html, src){ const id=++aiSeq; aiMsgs.push({id,role,html,src}); aiRender(); return id; }
function aiReplace(id, html, src){ const m=aiMsgs.find(x=>x.id===id); if(m){ m.html=html; m.src=src; aiRender(); } }
function aiRenderChips(){
  const el=$('aiChips'); if(!el) return;
  el.innerHTML=aiMsgs.length>1?'':ASK_CHIPS.map(c=>`<button type="button">${esc(c)}</button>`).join('');
  el.querySelectorAll('button').forEach(b=> b.onclick=()=>{ $('aiInput').value=b.textContent; aiSend(); });
}
function aiToggle(open){
  aiOpen = open!=null?open:!aiOpen;
  $('aiPanel').classList.toggle('show', aiOpen);
  $('aiFab').classList.toggle('hidden', aiOpen);
  if(aiOpen){
    if(!aiMsgs.length){ aiPush('ai', `Hi! I'm your portfolio assistant — I answer from your real numbers, privately on your phone. Ask me anything, or tap a suggestion:`); }
    aiRenderChips();
    setTimeout(()=>{ const i=$('aiInput'); if(i) i.focus(); }, 120);
  }
}
async function aiSend(){
  const inp=$('aiInput'); if(!inp||aiBusy) return;
  const q=inp.value.trim(); if(!q) return;
  inp.value=''; aiPush('user', esc(q)); aiRenderChips();
  const local=askLocal(q);
  if(local.confident){ aiPush('ai', local.html, '🔒 on your phone'); return; }
  if(typeof askAI!=='function' || !(lsGet('pt_push')||{}).token){
    aiPush('ai', `I can answer your returns, best/worst fund, dividends, risk, diversification, fees, and when you could retire. For open-ended questions, turn on Daily reports (⚙︎) to unlock the full AI.`, '🔒 on your phone');
    return;
  }
  aiBusy=true; const tid=aiPush('ai','<span class="askthinking">Thinking…</span>');
  try{
    const r=await askAI(q, askContext());
    const src=(r.lighter?'✨ AI · lighter model':'✨ AI')+(r.left!=null?` · ${r.left} left today`:'');
    aiReplace(tid, esc(r.answer).replace(/\n/g,'<br>'), src);
  }catch(e){
    aiReplace(tid, e&&e.message==='limit'?`You've used today's free AI questions — they reset tomorrow. The built-in answers still work any time.`:`Couldn't reach the AI just now — the built-in answers still work offline.`, '');
  }
  aiBusy=false;
}
function wireAi(){
  const fab=$('aiFab'); if(!fab || fab._wired) return; fab._wired=true;
  fab.onclick=()=>{ if(typeof haptic==='function') haptic(); aiToggle(true); };
  $('aiClose').onclick=()=>aiToggle(false);
  $('aiSend').onclick=aiSend;
  $('aiInput').addEventListener('keydown',e=>{ if(e.key==='Enter') aiSend(); });
}
/* compact, on-device summary sent to the user's own Cloudflare AI (they opted in) */
function askContext(){
  const t=totals('all'), mine=t.value-cashFor('all'), pr=periodReturns(), r=riskStats(), real=realReturn();
  const funds=rows('all').map(x=>{ const f=fundReturn(x.sym)||{}; return `${x.sym.replace('-','.')}: ${fmt(x.qty*priceOf(x.sym))} (${f.pct!=null?fmtPct(f.pct):'n/a'} all-time, ${(x.qty*priceOf(x.sym)/Math.max(1,mine)*100).toFixed(0)}% of portfolio)`; }).join('; ');
  const pget=k=>{ const x=pr.find(p=>p.k===k); return x&&x.p!=null?fmtPct(x.p):'n/a'; };
  const g=state.goal||{}, dayPct=(t.value-t.day)>0?t.day/(t.value-t.day)*100:0;
  return `Total ${fmt(t.value)} (invested ${fmt(mine)}${cashFor('all')>0?`, cash ${fmt(cashFor('all'))}`:''}). Today ${fmtSign(t.day)} (${fmtPct(dayPct)}). `
    +`Returns by period (deposit-adjusted market return, not counting new money): 1-week ${pget('1W')}, 1-month ${pget('1M')}, 6-month ${pget('6M')}, YTD ${pget('YTD')}, 1-year ${pget('1Y')}, all-time ${pget('All')}${real?`; all-time after inflation ${fmtPct(real.realTot)}`:''}. `
    +`Holdings: ${funds}. Dividends ~${fmt(annualIncome())}/yr. `
    +`${r?`Volatility ${r.vol.toFixed(0)}%/yr, beta ${r.beta.toFixed(2)} vs S&P, worst drawdown ${r.mdd.toFixed(0)}%, Sharpe ${r.sharpe.toFixed(2)}, safe 4%-rule income ${fmt(t.value*0.04/12)}/mo. `:''}`
    +`${g.amt>0?`Goal ${fmt(g.amt)} (${(t.value/g.amt*100).toFixed(0)}% there). `:''}${g.fimo>0?`Financial-independence target ${fmt(g.fimo)}/mo. `:''}`
    +`Owner is a long-term index-fund investor; projections never assume future deposits. Today's date ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}.`;
}

/* ============ TAX LOTS / SECTORS / HEATMAP / CONTRIB / PROJECTOR (Insights) ============ */
// Per-lot US short/long-term split (IRS rule: long-term requires MORE than one year held —
// day 366, or day 367 across a leap day). YR = 365.25 days is a fixed Actual/365.25 average-year
// offset, not a true calendar anniversary (new Date(y+1,m,d)) — so a lot bought on a leap day, or
// whose 1-year mark spans a leap year, can turn long-term up to ~18 hours early or late. This is
// a deliberate simplification (the same day-count basis as xirr()/riskStats() elsewhere in the
// app) for a "when does this become long-term" nudge, not a filed tax position — the edge-case
// drift is well under a day per lot and never changes which TAX YEAR a lot falls into.
// "Matching" here is trivial: every lot carries its own cost basis already (no FIFO/specific-lot
// selection), since the app has no sell/disposal feature — each lot is classified against its
// own purchase date, independent of any other lot. (The long-term-% figure this
// produces is read by renderMoreList()'s "Tax lots" meta line and rendered in
// full by openTaxSheet() — js/sheets.js — both unchanged maths, just no longer
// behind a dedicated renderTaxCard() now that the standalone Tax Lots card is gone.)
/* approximate sector mix per fund (published fund pages, estimates) */
const SECTOR_WEIGHTS = {
  'VOO':{Technology:33,Financials:13,'Consumer Disc.':11,'Comm. Services':10,Healthcare:10,Industrials:8,Other:15},
  'VTI':{Technology:31,Financials:14,'Consumer Disc.':11,Healthcare:11,'Comm. Services':9,Industrials:9,Other:15},
  'VXF':{Technology:20,Industrials:17,Financials:16,Healthcare:12,'Consumer Disc.':11,Other:24},
  'VXUS':{Financials:22,Industrials:14,Technology:13,'Consumer Disc.':10,Healthcare:9,Other:32},
  'VYM':{Financials:22,Healthcare:12,'Consumer Staples':12,Industrials:12,Technology:10,Other:32},
  'BRK-B':{Financials:100}
};
function renderHeatmap(){
  const md=monthlyDietzReturns();
  if(!md || Object.keys(md.ret).length<2){ $('hmBody').innerHTML='<div class="sub-n">Needs price history.</div>'; return; }
  const ret=md.ret;
  const years=new Set(Object.keys(ret).map(m=>m.slice(0,4)));
  const MN=['J','F','M','A','M','J','J','A','S','O','N','D'];
  // 14 columns cannot show a signed decimal on a 390px viewport, and the owner's
  // standing rule is that everything fits the width — so drop the decimal, not
  // the column. The year total keeps its decimal; it has a wider track.
  const dp=window.matchMedia('(max-width: 480px)').matches?0:1;
  let html='<div class="heatmap-wrap"><table class="heatmap"><caption class="sr">Monthly returns by year</caption><thead><tr><th><span class="sr">Year</span></th>'+MN.map(m=>`<th scope="col">${m}</th>`).join('')+'<th scope="col">Yr</th></tr></thead><tbody>';
  for(const y of [...years].sort().reverse()){
    let yr=1, any=false;
    html+=`<tr><th class="y" scope="row">${y}</th>`;
    for(let m=1;m<=12;m++){
      const k=y+'-'+String(m).padStart(2,'0');
      if(ret[k]==null){ html+='<td></td>'; continue; }
      any=true; yr*=1+ret[k]/100;
      const a=Math.min(.45,Math.abs(ret[k])/14);
      html+=`<td style="background:${ret[k]>=0?`rgba(${cvar('--green-rgb')},${a})`:`rgba(${cvar('--red-rgb')},${a})`}">${ret[k].toFixed(dp)}</td>`;
    }
    html+=any?`<td class="${cls(yr-1)}" style="font-weight:700">${((yr-1)*100).toFixed(1)}</td></tr>`:'<td></td></tr>';
  }
  $('hmBody').innerHTML=html+'</tbody></table></div>';
}
function renderContribChart(){
  const el=$('contribChart'); if(!window.Chart) return;
  const o=Chart.getChart(el); if(o) o.destroy();
  const per={};
  for(const l of state.lots){ if(!l.div) per[l.date.slice(0,7)]=(per[l.date.slice(0,7)]||0)+l.cost; }
  const keys=Object.keys(per).sort();
  if(!keys.length) return;
  const labels=[]; const data=[];
  let cur=keys[0];
  const end=dayStr(Date.now()).slice(0,7);
  while(cur<=end){ labels.push(cur); data.push(per[cur]||0);
    let [y,m]=cur.split('-').map(Number); m++; if(m>12){m=1;y++;} cur=y+'-'+String(m).padStart(2,'0'); }
  const cum=[]; let running=0; for(const v of data){ running+=v; cum.push(running); } // all-time running total
  const show=labels.slice(-24), sdata=data.slice(-24), scum=cum.slice(-24);
  const compact=v=>state.view.priv?'':new Intl.NumberFormat(appLocale(),{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate());
  el.setAttribute('role','img');
  el.setAttribute('aria-label', `Contributions chart, last ${show.length} months. Total deposited: ${fmt(cum[cum.length-1])}. Last month added: ${fmt(data[data.length-1])}.`);
  const contribChart=new Chart(el,{data:{labels:show,datasets:[
      {type:'bar',label:'That month',data:sdata,backgroundColor:cvar('--brand'),borderRadius:3,yAxisID:'y'},
      {type:'line',label:'Total deposited',data:scum,borderColor:CAT[3],borderWidth:1.8,pointRadius:0,pointHoverRadius:3,tension:0.35,cubicInterpolationMode:'monotone',yAxisID:'y1'}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{...CHART_TOOLTIP,callbacks:{label:c=>c.dataset.label+': '+fmt(c.parsed.y)}}},
      scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:6,maxRotation:0,font:{size:9},callback:function(v){const l=this.getLabelForValue(v);return l.slice(5)==='01'?l.slice(0,4):l.slice(5);}}},
              y:{grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:4,font:{size:9},callback:compact}},
              y1:{position:'right',grid:{display:false},border:{display:false},ticks:{color:CAT[3],maxTicksLimit:4,font:{size:9},callback:compact}}}}});
  attachScrubAny(contribChart, i=>{ const ro=$('contribRO'); if(!ro) return;
    ro.textContent = i==null ? '' : `${show[i]} · ${fmt(sdata[i])} added · ${fmt(scum[i])} deposited in total`; });
  const cs=$('contribSub');
  if(cs){ const m12=new Set(state.lots.filter(l=>!l.div && l.date>dayStr(Date.now()-370*86400e3)).map(l=>l.date.slice(0,7))).size;
    cs.textContent = m12>0 ? `You added money ${m12} of the last 12 months — consistency is the engine.` : ''; }
}

/* ============ LOOKING AHEAD (coach + projection) ============ */
/* cfmt (compact currency, privacy-aware) now lives in core.js */
function contribPace(){ // months of history + $/month pace from real buys
  const buys=state.lots.filter(l=>!l.div);
  const months=buys.length?Math.max(1,(Date.now()-new Date(buys.map(l=>l.date).sort()[0]).getTime())/2629800000):12;
  return { pmt: buys.reduce((a,l)=>a+l.cost,0)/months, buys };
}
function coachItems(){ // rules-based nudges computed from YOUR data — guidance, not advice
  const items=[];
  const t=totals('all'), rs=rows('all');
  const cash=cashFor('all'), cashPct=cash/Math.max(1,t.value);
  const rr=personalReturn('all'); const r=(rr!=null&&rr>0.005)?Math.min(rr,0.12):0.07;
  if(cashPct>0.05) items.push({ic:'💵', title:'Deploy idle cash', detail:`${fmt(cash)} · ${(cashPct*100).toFixed(0)}% uninvested`, sev:'warn', t:'Put idle cash to work',
    b:`${fmt(cash)} (${(cashPct*100).toFixed(0)}% of the portfolio) is uninvested. At your ~${(r*100).toFixed(0)}%/yr pace that's ≈${fmt(cash*r)} of growth per year sitting out.`});
  // drift vs the target mix set on the Allocation card
  if(state.targets && Object.keys(state.targets).length){
    const inv=rs.reduce((a,x)=>a+x.qty*priceOf(x.sym),0);
    if(inv>0){
      let worst=null;
      for(const [sym,tgt] of Object.entries(state.targets)){
        const c=(rs.find(x=>x.sym===sym)||{qty:0}).qty*priceOf(sym)/inv*100;
        const d=c-tgt; if(worst===null||d<worst.d) worst={sym,d};
      }
      if(worst && worst.d<-3) items.push({ic:'🎛️', title:'Feed the laggard', detail:`${worst.sym.replace('-','.')} is ${Math.abs(worst.d).toFixed(0)}% under target`, sev:'warn', t:'Rebalance with new money',
        b:`${worst.sym.replace('-','.')} sits ${Math.abs(worst.d).toFixed(1)}% below the target mix you set. Pointing the next deposit at it restores your chosen balance — no selling, no taxes.`});
    }
  }
  // single-company weight (index funds are already diversified — shared set in seed.js)
  const singles=rs.filter(x=>!DIVERSIFIED_FUNDS.has(x.sym)).map(x=>({sym:x.sym, w:x.qty*priceOf(x.sym)/Math.max(1,t.value)})).sort((a,b)=>b.w-a.w);
  if(singles.length && singles[0].w>0.15) items.push({ic:'⚖️', title:'Trim a big bet', detail:`${singles[0].sym.replace('-','.')} is ${(singles[0].w*100).toFixed(0)}% of everything`, sev:'warn', t:`${singles[0].sym.replace('-','.')} is a big single bet`,
    b:`${(singles[0].w*100).toFixed(0)}% of everything rides on one company. Steering new contributions to your index funds dilutes that gradually — no selling, no taxes.`});
  // all-equity note
  if(!rs.some(x=>['BND','BNDX','AGG','BSV'].includes(x.sym))){
    const rk=riskStats();
    items.push({ic:'🛡️', title:'Know your risk', detail:`100% stocks · worst dip ${rk?rk.mdd.toFixed(0):'–'}%`, sev:'info', t:'100% stocks — know the ride',
      b:`Maximum long-run growth, but your worst drop so far was ${rk?rk.mdd.toFixed(0):'-'}%. Fine for a long horizon; if a big goal is under ~5 years away, a slice of bonds (BND) softens the swings.`});
  }
  // tax lots turning long-term soon
  const YR=31557600000, now=Date.now();
  const turning=state.lots.map(l=>({sym:l.sym, g:l.qty*priceOf(l.sym)-l.cost, at:new Date(l.date+'T12:00:00').getTime()+YR}))
    .filter(x=>x.at>now && x.at<now+45*86400e3 && x.g>25).sort((a,b)=>a.at-b.at);
  if(turning.length){
    const x=turning[0], d=new Date(x.at).toLocaleDateString(appLocale(),{month:'short',day:'numeric'});
    const dl=Math.max(1,Math.ceil((x.at-now)/86400e3));
    items.push({ic:'🧾', title:'Tax timing', detail:`${x.sym.replace('-','.')} turns long-term in ${dl}d`, sev:'warn', t:`Selling ${x.sym.replace('-','.')}? Wait until ${d}`,
      b:`A lot with ${fmtSign(x.g)} of gain turns long-term on ${d} — before that, the gain would be taxed at the higher short-term rate.`});
  }
  // contribution cadence
  const {pmt, buys}=contribPace();
  const lastBuy=buys.map(l=>l.date).sort().pop();
  if(lastBuy){
    const days=Math.floor((now-new Date(lastBuy+'T12:00:00').getTime())/86400e3);
    if(days>40) items.push({ic:'🔁', title:'Keep investing', detail:`${days} days since your last buy`, sev:'warn', t:'Keep the contribution streak',
      b:`Last buy was ${days} days ago. Your pace so far has been ~${fmt(pmt)}/mo. The projection below shows what today's money does on its own — every new buy lifts the whole fan.`});
  }
  if(!state.goal||!(state.goal.amt>0)) items.push({ic:'🎯', title:'Set a goal', detail:'No target set yet', sev:'info', t:'Set a goal',
    b:'Give the money a number. A target unlocks the progress ring and a projected finish date on the Portfolio tab.'});
  // vs a savings account — what taking the market ride has actually been worth
  const sav=savingsAlt();
  if(sav && Math.abs(sav.ahead)>100) items.push({ic:'🏦', title:'Beating the bank', detail:`${fmtSign(sav.ahead)} vs a savings account`, sev:'info', t:'Your money vs a savings account',
    b:`If every deposit had gone into a 3%/yr savings account instead, you'd have <b>${fmt(sav.alt)}</b> today. You have <b>${fmt(sav.val)}</b> — <b class="${cls(sav.ahead)}">${fmtSign(sav.ahead)}</b> ${sav.ahead>=0?'ahead':'behind'} for taking the market ride. Over decades this gap is where wealth actually comes from.`});
  return items.slice(0,4);
}
function savingsAlt(){ // replay every real deposit into a 3%/yr savings account
  const t=totals('all'); if(!(t.value>0)) return null;
  let alt=0; const now=Date.now();
  for(const l of state.lots){ if(l.div) continue;
    const yrs=(now-new Date(l.date+'T12:00:00').getTime())/31557600000;
    if(yrs>=0) alt+=l.cost*Math.pow(1.03,yrs); }
  if(!alt) return null;
  alt+=(+state.cash.main||0)+(+state.cash.brok||0);
  return {alt, val:t.value, ahead:t.value-alt};
}
/* targetId defaults to the Insights sheet's own #coachGrid (openCoachSheet, still
   wired for anyone/anything that still calls it) — session 4 adds a second caller,
   renderHomeCoach() below, pointed at Home's #homeCoachGrid instead. Same items,
   same per-card tap-through to openInfoSheet(); only the mount point differs. */
function renderCoach(targetId){
  const grid=$(targetId||'coachGrid'); if(!grid) return;
  const items=coachItems();
  grid.innerHTML = items.length ? items.map(x=>
    `<div class="icard cmove sev-${x.sev||'info'}">
      <div class="cmhead"><span class="cicon">${x.ic}</span><span class="chev">›</span></div>
      <div class="ctitle">${esc(x.title)}</div>
      <div class="cdetail">${esc(x.detail)}</div></div>`).join('')
    : '<div class="icard wide"><div class="sub-n" style="text-align:center;padding:10px 0">✓ Nothing needs your attention — the portfolio is running clean.</div></div>';
  grid.querySelectorAll('.cmove').forEach((el,i)=> el.onclick=()=>openInfoSheet(items[i].t, `<p>${items[i].b}</p>`));
}
/* NEXT MOVES, moved to Home (DESIGN-TARGET.md session 3 left this open: "advice
   is not an insight and does not want a chart. Leave it behind the tap, or move
   it to Home." Session 4's call: move — Home is where the owner actually lands,
   and these are time-sensitive nudges (idle cash, a lot about to turn long-term,
   a contribution streak going cold), not something that should wait on him
   remembering to open Insights and tap "More". No chart added — same cards
   openCoachSheet already rendered, just mounted on Home instead of (only) behind
   a tap. Insights' #moreList no longer lists it (renderMoreList, below); the
   sheet-opening path (openCoachSheet/#coachGrid) is left intact rather than
   deleted, since test/i18n-coverage.spec.js's SHEET_OPENERS still exercises it
   directly by name. coachItems() already caps at 4 — small enough to show in
   full, no "see all" needed. */
function renderHomeCoach(){ renderCoach('homeCoachGrid'); }
let projYears=10;
function renderProjection(){
  const el=$('projChart'); if(!el||!window.Chart) return;
  const o=Chart.getChart(el); if(o) o.destroy();
  const V0=totals('all').value;
  const scen=[['Cautious 4%',0.04],['Average 7%',0.07],['Strong 10%',0.10]];
  const N=projYears*12, y0=new Date().getFullYear();
  const labels=[], data=scen.map(()=>[]);
  // pure compounding of what's invested TODAY — no future contributions (owner request:
  // "I want to see what my money can turn into")
  for(let m=0;m<=N;m++){
    labels.push(m);
    scen.forEach((sc,s)=>{ const rm=Math.pow(1+sc[1],1/12)-1;
      data[s].push(m ? data[s][m-1]*(1+rm) : V0); });
  }
  const goal=(state.goal&&state.goal.amt>0)?state.goal.amt:null;
  const ds=[
    {label:scen[0][0], data:data[0], borderColor:cvar('--faint'), borderDash:[4,4], borderWidth:1.3, pointRadius:0, fill:false, tension:0.2, cubicInterpolationMode:'monotone'},
    {label:scen[2][0], data:data[2], borderColor:cvar('--faint'), borderDash:[4,4], borderWidth:1.3, pointRadius:0,
     fill:{target:0}, backgroundColor:`rgba(${cvar('--green-rgb')},.07)`, tension:0.2, cubicInterpolationMode:'monotone'},
    {label:scen[1][0], data:data[1], borderColor:cvar('--brand'), borderWidth:2.2, pointRadius:0, fill:false, tension:0.2, cubicInterpolationMode:'monotone'}
  ];
  if(goal && goal<data[2][N]*1.4) ds.push({label:'Goal', data:labels.map(()=>goal), borderColor:cvar('--warn'), borderDash:[6,5], borderWidth:1.2, pointRadius:0, fill:false});
  el.setAttribute('role','img');
  el.setAttribute('aria-label', `Projection chart, ${projYears} years, no future deposits. In ${projYears} years: ${fmt(data[1][N])} at 7%/yr, range ${cfmt(data[0][N])} to ${cfmt(data[2][N])}.`);
  const projChart=new Chart(el,{type:'line',data:{labels,datasets:ds},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},
      plugins:{legend:{display:false},tooltip:{enabled:false}},
      scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:Math.min(projYears,8)+1,maxRotation:0,font:{size:9.5},
                 callback:v=>v%12===0?String(y0+v/12):''}},
              y:{grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,font:{size:10},
                 callback:v=>state.view.priv?'':cfmt(v)}}}}});
  const ro=$('projRO');
  const base=`In ${projYears} years: <b>${fmt(data[1][N])}</b> at 7%/yr <span style="color:var(--faint)">(range ${cfmt(data[0][N])} – ${cfmt(data[2][N])})</span>`;
  ro.innerHTML=base;
  attachScrubAny(projChart, i=>{
    if(i==null){ ro.innerHTML=base; return; }
    const yr=y0+Math.floor(i/12), mo=i%12;
    ro.innerHTML=`${yr}${mo?` +${mo}mo`:''} · <b>${fmt(data[1][i])}</b> avg <span style="color:var(--faint)">(${cfmt(data[0][i])} – ${cfmt(data[2][i])})</span>`;
  });
  let divLine='';
  { let fwd=0; for(const r2 of rows('all')){ const dv=state.divs[r2.sym]; if(!dv||!dv.list) continue;
      fwd+=r2.qty*dv.list.filter(e=>e[0]>Date.now()-370*86400e3).reduce((a,e)=>a+e[1],0); }
    if(fwd>0 && V0>0) divLine=t`Dividends alone could grow from ${fmt(fwd)}/yr today to ~${fmt(fwd*data[1][N]/V0)}/yr by ${y0+projYears}. `; }
  // Composed from independently-conditional pieces (divLine may be empty; the goal
  // sentence only appears when a goal is set) — each piece is t()-migrated on its
  // own and the RESULTS concatenated, not the template, so the existing
  // conditional structure is unchanged.
  $('projNote').textContent=divLine+t`What today's ${cfmt(V0)} can turn into on its own — no future deposits counted, compounded monthly at 4% / 7% / 10% a year. Long-run stock returns averaged 7–10% — nobody knows the future. `+(goal?t`Gold dashed line = your goal. `:'')+t`Not advice.`;
  renderMonteCarlo(V0, N, goal, y0);
}
/* Monte Carlo: bootstrap YOUR real monthly returns into many possible futures.
   Deterministic LCG seed → the numbers don't jitter on every re-render. */
function renderMonteCarlo(V0, N, goal, y0){
  const mc=$('projMC'); if(!mc) return;
  const md=monthlyDietzReturns();
  const pool=md?Object.values(md.ret).map(x=>x/100):[];
  if(!(V0>0) || pool.length<12){ mc.textContent=''; return; }
  let seed=((pool.length*7919 + N*104729 + Math.round(goal||0)) >>> 0) || 1;
  const rnd=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  const SIMS=400, finals=[]; let hit=0;
  for(let s=0;s<SIMS;s++){
    let v=V0;
    for(let m=0;m<N;m++) v*=1+pool[Math.floor(rnd()*pool.length)];
    finals.push(v); if(goal && v>=goal) hit++;
  }
  finals.sort((a,b)=>a-b);
  const p10=finals[Math.floor(SIMS*0.10)], p50=finals[Math.floor(SIMS*0.50)], p90=finals[Math.floor(SIMS*0.90)];
  mc.textContent=`Monte Carlo: replaying your own ${pool.length} real months ${SIMS}× → median ${cfmt(p50)} by ${y0+N/12}, likely range ${cfmt(p10)} – ${cfmt(p90)}`+(goal?` · you hit the goal in ${Math.round(hit/SIMS*100)}% of replays.`:'.');
}
if($('projSeg')) $('projSeg').querySelectorAll('button').forEach(b=> b.onclick=()=>{
  projYears=+b.dataset.y;
  $('projSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  renderProjection();
});


/* wire the floating assistant as soon as this file loads (DOM is already parsed when the
   app scripts are injected post-unlock) — robust against injected-script HTTP caching */
if(typeof wireAi==='function') wireAi();
