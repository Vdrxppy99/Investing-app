'use strict';

/* One tooltip shape for every chart in the app. Previously each of the eight
   charts inlined its own literal and they had drifted: some carried titleColor,
   some didn't; none carried padding, radius or caret size.

   The colour properties are ACCESSORS, not values. Spreading (`{...CHART_TOOLTIP}`)
   invokes them, so each chart still resolves the theme tokens at construction
   time — the theme toggle in app.js:225 repaints without a reload, and a frozen
   snapshot taken when this file loaded would strand every chart on dark colours.
   Loaded before insights.js, so its charts can reference it too. */
const CHART_TOOLTIP = {
  get backgroundColor() { return cvar('--card2'); },
  get borderColor() { return cvar('--line'); },
  borderWidth: 1,
  get titleColor() { return cvar('--mut'); },
  get bodyColor() { return cvar('--tx'); },
  displayColors: false,
  padding: 10,
  cornerRadius: 8,
  caretSize: 5,
  titleFont: { weight: 600 },
  bodyFont: { weight: 500 }
};

/* ============ RENDER: HEADER + LIST ============ */
/* DESIGN-TARGET's hero line: today's $/% delta AND the all-time return
   together, replacing the old chip list (Profit/Invested/Deposited/Return-
   per-yr) and the separate "vs S&P 500 today" sentence — neither has a slot
   in the redesigned hero. Return/yr (XIRR) still surfaces on Insights; the
   others don't have a home yet (see UPGRADE_PLAN.md backlog). */
function renderHeader(){
  if(scrubbing) return;
  const t = totals(state.view.acc);
  const dayPct = (t.value-t.day)>0 ? t.day/(t.value-t.day)*100 : 0;
  $('totalVal').innerHTML = `<span id="tvNum">${fmt(t.value)}</span>`;
  if(typeof rollUpTvNum==='function') rollUpTvNum(t.value);
  const dep = +state.deposits || 0;
  const allTimePct = (state.view.acc==='all' && dep>0) ? (t.value-dep)/dep*100
    : (t.invested>0 ? t.profit/t.invested*100 : 0);
  const arrow = t.day>=0 ? '▲' : '▼';
  $('todayLine').innerHTML = `<span class="${cls(t.day)} n">${arrow} ${fmtSign(t.day)} · ${fmtPct(dayPct)}</span>`
    + `<span class="hero__alltime">all time <b class="${cls(allTimePct)} n">${fmtPct(allTimePct)}</b></span>`;
  $('ccyBtn').textContent = state.view.ccy==='USD' ? '$' : '€';
  // keep the pinned glass bar in sync with live ticks (it's visible on every non-Portfolio tab)
  if($('miniBar').classList.contains('show') && typeof paintMiniBar==='function') paintMiniBar();
}
function renderChips(){
  $('accChips').innerHTML = ['all','main','brok'].map(a=>
    `<button data-a="${a}" class="${state.view.acc===a?'on':''}">${a==='all'?'All':esc(ACCOUNTS[a]||a)}</button>`).join('');
  $('accChips').querySelectorAll('button').forEach(b=> b.onclick = ()=>{ state.view.acc=b.dataset.a; renderAll(); });
}
/* ETF vs individual-stock split for the DESIGN-TARGET holdings grouping
   ("ETFs · 5 — $129,051.24" / "Stocks · 1 — $18,990.12"). A simple known-ticker
   list, same spirit as DIVERSIFIED_FUNDS (js/app.js) — good enough for display
   grouping, not a claim about fund structure. Anything not recognized here
   (a user-added individual stock) falls into "Stocks". */
const KNOWN_ETFS = new Set(['VOO','VTI','VXF','VXUS','VYM','VT','VNQ','VGT','BND','SCHD','QQQ','AVUV','GLDM']);
function assetGroupOf(sym){ return KNOWN_ETFS.has(sym) ? 'ETFs' : 'Stocks'; }

const lastShownPx = {};
/* Row anatomy per DESIGN-TARGET: squircle tile, name + ticker, "qty sh · avg
   cost", a sparkline, value, and TOTAL return % — today's move belongs on
   Home (R4), not here. */
function holdingRow(r){
  const p=priceOf(r.sym), val=r.qty*p, pl=val-r.cost, plp=r.cost>0?pl/r.cost*100:0;
  const was = lastShownPx[r.sym];
  const tick = (was!=null && p!==was) ? (p>was ? ' tick-up' : ' tick-down') : '';
  lastShownPx[r.sym] = p;
  const avg = r.qty>0 ? r.cost/r.qty : 0;
  return `<button type="button" class="hrow${tick}" data-sym="${esc(r.sym)}">
    ${badgeHtml(r.sym)}
    <div class="hmid">
      <div class="hsym"><span class="hname">${esc((NAMES[r.sym]||r.sym.replace('-','.')).replace(/^Vanguard /,''))}</span> <span class="htick">${esc(r.sym.replace('-','.'))}</span></div>
      <div class="hinfo">${r.qty.toFixed(3).replace(/\.?0+$/,'')} sh · avg ${fmtPx(avg)}</div>
    </div>
    <div class="hspark">${spark(r.sym)}</div>
    <div class="hright">
      <div class="hval">${fmt(val)}</div>
      <div class="hpl ${cls(pl)}">${fmtPct(plp)}</div>
    </div></button>`;
}
function renderList(){
  const rs = rows(state.view.acc); // pre-sorted by value
  if(!rs.length){
    $('holdList').innerHTML = `<div class="empty"><div class="ei">📄</div><div class="et">No holdings yet</div>
      <div class="eb">Add your first position with ⚙︎ above, or restore everything from a backup file.</div>
      <button class="btn pri" id="emptyAdd">Open settings</button></div>`;
    $('emptyAdd').onclick=openEdit;
  } else {
    const groups = {ETFs:[], Stocks:[]};
    for(const r of rs) groups[assetGroupOf(r.sym)].push(r);
    $('holdList').innerHTML = ['ETFs','Stocks'].filter(g=>groups[g].length).map(g=>{
      const gtot = groups[g].reduce((a,r)=>a+r.qty*priceOf(r.sym),0);
      return `<h2 class="section__label">${g} &middot; ${groups[g].length}<em>${fmt(gtot)}</em></h2>` + groups[g].map(holdingRow).join('');
    }).join('');
    $('holdList').querySelectorAll('.hrow').forEach(el=> el.onclick = ()=>openDetail(el.dataset.sym));
  }
  const cash = cashFor(state.view.acc);
  $('cashRow').classList.toggle('hidden', !(cash>0));
  $('cashRow').innerHTML = `<span>Cash · settlement fund</span><span class="n">${fmt(cash)}</span>`;
  renderAllocStrip();
}
/* Sort-by-today/profit segmented control retired with the R1 rebuild — holdings
   are now grouped by asset class (ETFs/Stocks) rather than one flat sorted
   list, and grouping is the organizing principle DESIGN-TARGET specifies.
   Rows still sort by value within each group (rows()'s natural order). */
/* ============ RENDER: ALLOCATION + INCOME ============ */
/* DESIGN-TARGET replaces the donut CARD with a flat strip folded directly
   under the hero chart — no legend, no numbers, just proportional colour.
   The donut, legend, asset-class breakdown and target-mix/rebalance planner
   all still exist (unchanged maths) but only render when openAllocSheet()
   is tapped open, via the same #allocChart/#allocLegend/#allocClasses/#tgtWrap
   ids renderAlloc() has always targeted — renderAlloc() itself just no-ops
   now when the sheet isn't open (the ids don't exist in the DOM until then). */
$('allocStrip').onclick = openAllocSheet;
// id param lets Home (R4) paint a second copy of the same strip (#homeAllocStrip)
// from the same holdings — no second computation, just a second paint target.
function renderAllocStrip(id){
  const el=$(id||'allocStrip'); if(!el) return;
  const rs = rows(state.view.acc).filter(r=>r.qty*priceOf(r.sym)>0);
  const tot = rs.reduce((a,r)=>a+r.qty*priceOf(r.sym),0);
  if(!tot){ el.innerHTML=''; el.disabled=true; return; }
  el.disabled=false;
  el.innerHTML = rs.map(()=>'<i></i>').join('');
  el.querySelectorAll('i').forEach((it,i)=>{
    const r=rs[i], pct=r.qty*priceOf(r.sym)/tot*100;
    it.style.setProperty('--w', pct.toFixed(1)+'%');
    it.style.setProperty('--seg', colorOf(r.sym));
  });
}
function openAllocSheet(){
  if($('allocStrip').disabled) return;
  $('detailSheetHead').innerHTML = `<h2 class="hsym sheet__title">Allocation</h2><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `<div class="alloc"><div class="alloc__donut"><canvas id="allocChart"></canvas></div>
    <div id="allocLegend"></div></div>
    <div id="allocClasses"></div>
    <div id="tgtWrap"></div>`;
  showOverlay('detail');
  $('detailX').onclick=closeDetail;
  $('detailX').focus({preventScroll:true});
  ensureChartJs().catch(()=>{}).then(renderAlloc);
}
let allocChart=null;
const ASSET_CLASSES = { 'US stocks':['VOO','VTI','VXF'], 'International':['VXUS'], 'Dividend':['VYM'], 'Berkshire':['BRK-B'] };
function renderAlloc(){
  const el=$('allocChart'); if(!el) return; // sheet closed — nothing to draw into
  const rs = rows(state.view.acc).filter(r=>r.qty*priceOf(r.sym)>0);
  if(window.Chart){ const orphan=Chart.getChart(el); if(orphan) orphan.destroy(); }
  allocChart=null;
  const tot = rs.reduce((a,r)=>a+r.qty*priceOf(r.sym),0);
  if(!tot || !window.Chart) return;
  const centerOpt = { l1: rs.length+' funds', l2: fmt(tot).replace(/[.,]\d\d(\s|$)/,'$1') };
  el.setAttribute('role','img');
  el.setAttribute('aria-label', `Allocation donut chart. ${rs.map(r=>`${r.sym.replace('-','.')} ${(r.qty*priceOf(r.sym)/tot*100).toFixed(1)}%`).join(', ')}.`);
  allocChart = new Chart(el,{type:'doughnut',
    data:{labels:rs.map(r=>r.sym.replace('-','.')), datasets:[{data:rs.map(r=>r.qty*priceOf(r.sym)), backgroundColor:rs.map(r=>colorOf(r.sym)), borderWidth:2, borderColor:cvar('--card'), hoverOffset:5}]},
    options:{responsive:true, maintainAspectRatio:false, cutout:'72%',
      plugins:{legend:{display:false},centerTxt:centerOpt, tooltip:{...CHART_TOOLTIP,
        callbacks:{label:c=>c.label+': '+fmt(c.parsed)+' ('+(c.parsed/tot*100).toFixed(1)+'%)'}}}}});
  $('allocLegend').innerHTML = rs.map(r=>{
    const v=r.qty*priceOf(r.sym);
    return `<button type="button" class="alg"><span class="dot" style="${bstyle(colorOf(r.sym))}"></span>${esc(r.sym.replace('-','.'))}<span class="alp">${(v/tot*100).toFixed(1)}%</span></button>`;
  }).join('');
  $('allocClasses').innerHTML = Object.entries(ASSET_CLASSES).map(([k,syms])=>{
    const v = rs.filter(r=>syms.includes(r.sym)).reduce((a,r)=>a+r.qty*priceOf(r.sym),0);
    return v>0 ? `<span>${k} <b>${(v/tot*100).toFixed(0)}%</b></span>` : '';
  }).join('');
  renderTargetMix(rs, tot);
}

/* ---- target mix: the % you WANT each holding at; drift + where new money goes ---- */
function renderTargetMix(rs, tot){
  const box=$('tgtWrap'); if(!box) return;
  if(box.querySelector('.tgtedit')) return; // editor open — don't wipe it on a background refresh
  const depInp=box.querySelector('#tgtDep'); // ...same for a deposit being planned
  if(depInp && (depInp.value || document.activeElement===depInp)) return;
  const tg=state.targets;
  if(!tg || !Object.keys(tg).length){
    box.innerHTML=`<a href="#" id="tgtSet" class="tgtlink">🎛 Set a target mix — see drift and where new money should go ›</a>`;
    $('tgtSet').onclick=e=>{ e.preventDefault(); openTargetEditor(rs, tot); };
    return;
  }
  const cur={}; rs.forEach(r=>cur[r.sym]=r.qty*priceOf(r.sym)/tot*100);
  const syms=[...new Set([...Object.keys(tg), ...rs.map(r=>r.sym)])];
  const maxV=Math.max(10, ...syms.map(s=>Math.max(tg[s]||0, cur[s]||0)));
  let worst=null;
  const rowsH=syms.map(sym=>{
    const t=tg[sym]||0, c=cur[sym]||0, d=c-t;
    if(worst===null||d<worst.d) worst={sym,d};
    return `<div class="tgtrow"><span class="dot" style="${bstyle(colorOf(sym))}"></span><span class="tgs">${esc(sym.replace('-','.'))}</span>
      <div class="tgtrack"><i class="cur" style="width:${(c/maxV*100).toFixed(1)}%"></i><i class="mark" style="left:${(t/maxV*100).toFixed(1)}%"></i></div>
      <span class="tgd ${Math.abs(d)<=2?'ok':'off'}">${d>=0?'+':'−'}${Math.abs(d).toFixed(1)}%</span></div>`;
  }).join('');
  const tip = (worst && worst.d<-1)
    ? `<div class="tgtnext">Next deposit → <b>${esc(worst.sym.replace('-','.'))}</b> (${Math.abs(worst.d).toFixed(1)}% under target). Buying the laggard rebalances without selling — no taxes.</div>`
    : `<div class="tgtnext">✓ Everything is within reach of its target.</div>`;
  const plan=`<div class="tgtplan"><input id="tgtDep" type="number" inputmode="decimal" placeholder="Adding money? e.g. 500" aria-label="Deposit amount to plan">
    <button class="btn pri" id="tgtDepGo" style="min-height:38px;padding:8px 14px">Plan it</button></div><div id="tgtDepOut"></div>`;
  box.innerHTML=`<div class="tgthead">Target mix · bar = now, notch = target <a href="#" id="tgtEditLnk">edit</a></div>${rowsH}${tip}${plan}`;
  $('tgtEditLnk').onclick=e=>{ e.preventDefault(); openTargetEditor(rs, tot); };
  $('tgtDepGo').onclick=()=>planDeposit(rs, tot);
  $('tgtDep').addEventListener('keydown',e=>{ if(e.key==='Enter') planDeposit(rs, tot); });
}
function planDeposit(rs, tot){ // split a deposit so it closes the target-mix gaps first
  const D=+$('tgtDep').value, out=$('tgtDepOut'), tg=state.targets;
  if(!(D>0)||!tg){ out.innerHTML=''; return; }
  const newTot=tot+D;
  const need=[]; let needSum=0;
  for(const [sym,pct] of Object.entries(tg)){
    const cur=(rs.find(r=>r.sym===sym)||{qty:0}).qty*priceOf(sym);
    const gap=Math.max(0, pct/100*newTot - cur); // $ short of target AFTER the deposit lands
    if(gap>0){ need.push({sym,gap}); needSum+=gap; }
  }
  let allocs=[];
  if(needSum<=0){ // already balanced — split by target weights
    allocs=Object.entries(tg).map(([sym,pct])=>({sym, amt:D*pct/100}));
  } else if(needSum<=D){ // close every gap, spread the remainder by target weights
    const rest=D-needSum;
    allocs=need.map(x=>({sym:x.sym, amt:x.gap + rest*(tg[x.sym]||0)/100}));
    const used=allocs.reduce((a,x)=>a+x.amt,0);
    if(used<D-0.5 && allocs.length) allocs[0].amt+=D-used;
  } else { // not enough to close everything — biggest gaps get their fair share
    allocs=need.map(x=>({sym:x.sym, amt:D*x.gap/needSum}));
  }
  allocs=allocs.filter(x=>x.amt>=1).sort((a,b)=>b.amt-a.amt);
  out.innerHTML=allocs.map(x=>{
    const px = priceOf(x.sym);
    const shStr = px>0 ? ` · ${(x.amt/px).toFixed(2)} sh @ ${fmtPx(px)}` : '';
    return `<div class="inc-row"><span>${esc(x.sym.replace('-','.'))} ${shStr}</span><span><b>${fmt(x.amt)}</b></span></div>`;
  }).join('')
    +`<div class="inc-note">Buying in these amounts lands the mix closest to your targets — estimates, not advice.</div>`;
}
function openTargetEditor(rs, tot){
  const box=$('tgtWrap'), tg=state.targets||{};
  const rowsH=rs.map(r=>{
    const v = tg[r.sym]!=null ? tg[r.sym] : Math.round(r.qty*priceOf(r.sym)/tot*100);
    return `<label class="tgtedit-row">${esc(r.sym.replace('-','.'))}<input type="number" inputmode="decimal" min="0" max="100" step="1" data-tsym="${esc(r.sym)}" value="${v}">%</label>`;
  }).join('');
  box.innerHTML=`<div class="tgthead">Target mix — the % you want each holding at</div><div class="tgtedit">${rowsH}</div>
    <div class="tgtsum" id="tgtSum"></div>
    <div class="ebtns"><button class="btn pri" id="tgtSave">Save targets</button><button class="btn sec" id="tgtCancel">Cancel</button><button class="btn sec" id="tgtClear">Remove</button></div>`;
  const sum=()=>{ let s=0; box.querySelectorAll('[data-tsym]').forEach(i=>s+=+i.value||0);
    $('tgtSum').textContent=`Adds up to ${s.toFixed(0)}%`+(Math.abs(s-100)<=2?' ✓':' — aim for 100%'); return s; };
  box.querySelectorAll('[data-tsym]').forEach(i=>i.oninput=sum); sum();
  $('tgtSave').onclick=()=>{
    const s=sum(); if(Math.abs(s-100)>5){ $('tgtSum').innerHTML='<span style="color:var(--red)">Targets should add up to roughly 100% — now '+s.toFixed(0)+'%.</span>'; return; }
    const t={}; box.querySelectorAll('[data-tsym]').forEach(i=>{ const v=+i.value||0; if(v>0) t[i.dataset.tsym]=v; });
    state.targets=Object.keys(t).length?t:null; lsSet('pt_targets',state.targets);
    box.innerHTML=''; renderAlloc(); if(typeof renderCoach==='function') renderCoach();
  };
  $('tgtCancel').onclick=()=>{ box.innerHTML=''; renderAlloc(); };
  $('tgtClear').onclick=()=>{ state.targets=null; lsSet('pt_targets',null); box.innerHTML=''; renderAlloc(); if(typeof renderCoach==='function') renderCoach(); };
}
let divsFetching=false;
async function fetchDivs(sym){
  try{
    // 5y of distributions: powers the deep-dive sheet's payout history + growth (r5 flag busts old 1y caches once)
    const j=await tryFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5y&interval=1mo&events=div`,true);
    const ev=(j.chart.result[0].events||{}).dividends||{};
    state.divs[sym]={ list:Object.values(ev).map(e=>[e.date*1000,e.amount]).sort((a,b)=>a[0]-b[0]), ts:Date.now(), r5:true };
    return true;
  }catch(e){ return false; }
}
async function ensureDivs(){
  if(divsFetching) return;
  const TTL=24*3600e3;
  const stale=uniqSyms().filter(s=>{const d=state.divs[s]; return !d||!d.ts||!d.r5||Date.now()-d.ts>TTL;});
  if(!stale.length) return;
  divsFetching=true;
  const res=await Promise.allSettled(stale.map(fetchDivs));
  divsFetching=false;
  lsSet('pt_divs',state.divs); lsSet('pt_goal',state.goal);
  if(res.some(r=>r.status==='fulfilled'&&r.value===true)){ renderIncome(); if(typeof renderComingUp==='function') renderComingUp(); }
}
let earningsFetching=false;
/* One batched call to the Worker's /earnings proxy (worker/src/earnings.js) rather than
   per-symbol requests — it does its own KV caching, so this only reaches EarningsWhispers
   for symbols this edge hasn't seen in 24h. A network failure here (Worker down, offline)
   just leaves the stale symbols stale — dividends are fetched separately and unaffected. */
async function fetchEarnings(syms){
  try{
    const r=await fetch(PUSH_URL+'/earnings?syms='+encodeURIComponent(syms.join(',')),{cache:'no-store'});
    if(!r.ok) return false;
    const j=await r.json();
    for(const s of syms) state.earnings[s]={ ...(j[s]||{none:true}), ts:Date.now() };
    return true;
  }catch(e){ return false; }
}
async function ensureEarnings(){
  if(earningsFetching) return;
  const TTL=24*3600e3;
  const stale=uniqSyms().filter(s=>{const e=state.earnings[s]; return !e||!e.ts||Date.now()-e.ts>TTL;});
  if(!stale.length) return;
  earningsFetching=true;
  const ok=await fetchEarnings(stale);
  earningsFetching=false;
  lsSet('pt_earnings',state.earnings);
  if(ok && typeof renderComingUp==='function') renderComingUp();
}
/* Dividends left the Portfolio screen in R1 (DESIGN-TARGET.md — they belong on
   Home, built in R4). #incomeCard no longer exists here; this no-ops until R4
   gives it a new home, rather than being deleted — the forecasting maths below
   is unchanged and still correct. */
function renderIncome(){
  const card=$('incomeCard'); if(!card) return;
  const rl = state.lots.filter(l=>l.div && (state.view.acc==='all'||l.acc===state.view.acc));
  // forecast: trailing-12-month distributions per share × shares you hold now
  let fwd=0; const upcoming=[]; const byMonth={};
  const t=totals(state.view.acc);
  for(const r of rows(state.view.acc)){
    const d=state.divs[r.sym]; if(!d||!d.list||!d.list.length) continue;
    const yr=d.list.filter(e=>e[0]>Date.now()-370*86400e3);
    fwd += r.qty*yr.reduce((a,e)=>a+e[1],0);
    for(const e of yr){
      const next=e[0]+31557600000; // same payout, one year later
      if(next>Date.now() && next<Date.now()+180*86400e3) upcoming.push({sym:r.sym, when:next, est:r.qty*e[1]});
      if(next>Date.now() && next<Date.now()+365*86400e3) byMonth[dayStr(next).slice(0,7)]=(byMonth[dayStr(next).slice(0,7)]||0)+r.qty*e[1];
    }
  }
  upcoming.sort((a,b)=>a.when-b.when);
  if(!rl.length && fwd<=0){ card.style.display='none'; ensureDivs(); return; }
  card.style.display='';
  let html='';
  if(fwd>0){
    const yld=t.value>0?fwd/t.value*100:0;
    html += `<div class="inc-total">${fmt(fwd)}<span> projected next 12 mo · ~${yld.toFixed(2)}% yield</span></div>`;
    if(window.Chart && Object.keys(byMonth).length) html += `<div class="scrubro" id="divRO"></div><div style="position:relative;height:110px;margin:2px 0 10px"><canvas id="divCal"></canvas></div>`;
    html += upcoming.slice(0,4).map(u=>`<div class="inc-row"><span>≈ ${new Date(u.when).toLocaleDateString([],{month:'short',day:'numeric'})} · ${esc(u.sym.replace('-','.'))}</span><span>~${fmt(u.est)}</span></div>`).join('');
  } else { html += `<div style="color:var(--mut);font-size:12px">Income forecast loads with the next online update.</div>`; }
  if(rl.length){
    const byYear={};
    for(const l of rl) byYear[l.date.slice(0,4)]=(byYear[l.date.slice(0,4)]||0)+l.cost;
    const total=rl.reduce((a,l)=>a+l.cost,0);
    html += `<div style="font-size:12.5px;font-weight:700;margin-top:14px">Received &amp; reinvested · ${fmt(total)}</div>` +
      Object.entries(byYear).sort((a,b)=>b[0].localeCompare(a[0])).map(([y,v])=>`<div class="inc-row"><span>${y}</span><span>${fmt(v)}</span></div>`).join('');
  }
  html += `<div class="inc-note">Forecast = each fund's last 12 months of distributions × your current shares (estimate — funds vary payouts). History counts Brokerage reinvestment lots; advised-account dividends are blended into purchases.</div>`;
  $('incomeBody').innerHTML=html;
  // 12-month payout calendar — quarterly humps make the income rhythm visible
  const cal=$('divCal');
  if(cal && window.Chart){
    const o=Chart.getChart(cal); if(o) o.destroy();
    const labels=[], data=[]; const now=new Date();
    for(let i=1;i<=12;i++){
      const dt=new Date(now.getFullYear(), now.getMonth()+i, 1);
      const k=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
      labels.push(dt.toLocaleDateString([],{month:'short'})); data.push(byMonth[k]||0);
    }
    cal.setAttribute('role','img');
    cal.setAttribute('aria-label', `Dividend forecast by month, next 12 months, total ${fmt(fwd)}.`);
    const calChart=new Chart(cal,{type:'bar',data:{labels,datasets:[{data,backgroundColor:cvar('--brand'),borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
        tooltip:{...CHART_TOOLTIP,callbacks:{label:c=>'~'+fmt(c.parsed.y)}}},
        scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),font:{size:9},maxRotation:0,autoSkip:false}},
                y:{display:false}}}});
    attachScrubAny(calChart, i=>{ const ro=$('divRO'); if(!ro) return;
      ro.textContent = i==null ? '' : `${labels[i]} · ~${fmt(data[i])} expected`; });
  }
  ensureDivs(); ensureEarnings();
}
/* dividends deep dive — tap the Dividends card title */
function openDivSheet(){
  const rs=rows(state.view.acc);
  const rows12=[]; let tot=0; const byYear={};
  for(const r of rs){
    const d=state.divs[r.sym]; if(!d||!d.list||!d.list.length) continue;
    const perSh=d.list.filter(e=>e[0]>Date.now()-370*86400e3).reduce((a,e)=>a+e[1],0);
    if(perSh>0){
      const inc=perSh*r.qty; tot+=inc;
      rows12.push({sym:r.sym, inc,
        yld:priceOf(r.sym)>0 ? perSh/priceOf(r.sym)*100 : 0,
        yoc:(r.cost>0&&r.qty>0) ? perSh/(r.cost/r.qty)*100 : 0});
    }
    for(const e of d.list){ const y=new Date(e[0]).getFullYear(); byYear[y]=(byYear[y]||0)+e[1]*r.qty; }
  }
  if(!rows12.length){ openInfoSheet('Dividends','<p>Income details appear after the next online update pulls each fund’s distribution history.</p>'); return; }
  rows12.sort((a,b)=>b.inc-a.inc);
  const years=Object.keys(byYear).sort(), curY=new Date().getFullYear();
  const maxY=Math.max(...years.map(y=>byYear[y]),1);
  const bars=years.map(y=>`<div class="hbrow"><div class="t"><span>${y}${+y===curY?' · so far':''}</span><span class="p">${fmt(byYear[y])}</span></div>
    <div class="bar"><i style="width:${(byYear[y]/maxY*100).toFixed(1)}%"></i></div></div>`).join('');
  let growth='';
  const full=years.filter(y=>+y<curY);
  if(full.length>=2){
    const a=byYear[full[full.length-1]], b=byYear[full[full.length-2]];
    if(b>0) growth=`<div class="sub-n" style="margin-top:8px">Payouts grew <b class="${cls(a-b)}">${fmtPct((a/b-1)*100)}</b> in ${full[full.length-1]} vs ${full[full.length-2]} — the raise you get for just holding.</div>`;
  }
  const body=`<div class="inc-total">${fmt(tot)}<span> projected next 12 mo</span></div>`
    + rows12.map(x=>`<div class="krow"><span class="k">${esc(x.sym.replace('-','.'))}</span>
        <span>${fmt(x.inc)}/yr <span style="color:var(--mut)">· ${x.yld.toFixed(2)}% yield · ${x.yoc.toFixed(2)}% on cost</span></span></div>`).join('')
    + `<div style="font-size:13px;font-weight:700;margin-top:18px">Payout history · at today's share counts</div>${bars}${growth}`;
  openListSheet('Dividend income', body,
    'History = each fund’s actual per-share distributions × the shares you hold TODAY (not what you held back then) — it shows the income power of your current position, and growth reflects the funds raising their payouts. Estimates, not advice.');
}
let staleDismissed=false;
function renderStale(){
  const el=$('staleBanner');
  const conf=state.confirmed;
  const days = conf ? Math.floor((Date.now()-new Date(conf+'T12:00:00').getTime())/86400000) : 999;
  if(staleDismissed || !conf || days<STALE_DAYS){ el.classList.add('hidden'); return; }
  const when = new Date(conf+'T12:00:00').toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'});
  el.innerHTML = `<span class="ic">⚠︎</span>
    <span class="tx">Holdings last confirmed <b>${when}</b> (${days} days ago). Buy anything since? Send your latest Vanguard statement to refresh, or log it here.</span>
    <button class="act" id="staleAct">Update</button>
    <button class="x" id="staleX" title="Dismiss" aria-label="Dismiss reminder">✕</button>`;
  el.classList.remove('hidden');
  $('staleAct').onclick = openEdit;
  $('staleX').onclick = ()=>{ staleDismissed=true; el.classList.add('hidden'); };
}
function markConfirmed(){ state.confirmed = dayStr(Date.now()); staleDismissed=false; }
/* NYSE full-day closures (update yearly — one line of maintenance) */
const US_MARKET_HOLIDAYS=new Set([
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24'
]);
function marketOpen(){
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date());
  const g = t=>{ const x=parts.find(p=>p.type===t); return x?x.value:''; };
  const wd = g('weekday'); if(wd==='Sat'||wd==='Sun') return false;
  if(US_MARKET_HOLIDAYS.has(`${g('year')}-${g('month')}-${g('day')}`)) return false;
  const m = parseInt(g('hour'),10)*60 + parseInt(g('minute'),10);
  return m>=570 && m<960; // 9:30–16:00 ET
}
function setStatus(){
  const st=$('status');
  if(window.vaultSaveError || window.storageFull){ // data at risk beats everything else on this line
    st.className='status err';
    $('statusTx').textContent='⚠ Couldn’t save your changes on this device — export a backup now (⚙︎).';
    return;
  }
  const newest = Math.max(...uniqSyms().map(s=>state.quotes[s]?state.quotes[s].ts:0), SEED_TS);
  const age = Math.max(0, Math.round((Date.now()-newest)/1000));
  let when;
  if(age<8) when='just now';
  else if(age<90) when=age+'s ago';
  else if(age<5400) when=Math.round(age/60)+' min ago';
  else when=new Date(newest).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const mkt = marketOpen() ? '' : ' · market closed';
  st.className = 'status'+(state.live?' live':'');
  $('statusTx').textContent = state.fetching ? 'Updating prices…' : (state.live ? `Live · ${when}${mkt}` : `Prices from ${when} — will update when online${mkt}`);
}

/* ============ SERIES / CHART ============ */
const RANGES = {'1D':1,'1W':7,'2W':14,'1M':31,'6M':183,'YTD':0,'1Y':366,'5Y':1830,'MAX':999999};
function rangeCutoff(range){ // 'YYYY-MM-DD' string; labels are compared lexicographically
  if(range==='MAX') return '0000-00-00';
  if(range==='YTD') return new Date().getFullYear()+'-01-01';
  return dayStr(Date.now()-(RANGES[range]||31)*86400000);
}
/* buildSeries is the app's hottest expensive path (900+ days × every symbol) and is
   called by the chart, period pills, drawdown, risk, heatmap… — memoize on everything
   that can change its output. quotesRev only bumps on REAL price changes (core.js). */
let _bsKey='', _bsVal=null;
function buildSeries(acc){
  let hts=0; for(const s of uniqSyms()){ const h=state.history[s]; if(h&&h.ts&&h.ts>hts) hts=h.ts; }
  const key=acc+'|'+state.lots.length+'|'+state.holdings.map(h=>h.acc+h.sym+h.qty+':'+h.cost).join(',')+'|'+cashFor(acc)+'|'+hts+'|'+quotesRev;
  if(key===_bsKey) return _bsVal;
  const s=buildSeriesRaw(acc);
  _bsKey=key; _bsVal=s;
  return s;
}
function buildSeriesRaw(acc){
  const rs = rows(acc); const cash = cashFor(acc);
  const withHist = rs.filter(r=>state.history[r.sym] && state.history[r.sym].t && state.history[r.sym].t.length>1);
  if(!withHist.length) return null;
  const useLots = hasLots(acc);
  const daySet = new Set();
  const maps = {};
  for(const r of withHist){
    const h=state.history[r.sym]; maps[r.sym]={};
    for(let i=0;i<h.t.length;i++){ if(h.c[i]!=null){ const d=dayStr(h.t[i]); daySet.add(d); maps[r.sym][d]=h.c[i]; } }
  }
  const days=[...daySet].sort();
  const labels=[], value=[], profit=[];
  const last={};
  const invNow = rs.reduce((a,r)=>a+r.cost,0);
  for(const d of days){
    const ls = useLots ? lotState(acc,d) : null;
    let v=cash, held=false, ok=true;
    for(const r of rs){
      const q = ls ? (ls.qty[r.sym]||0) : r.qty;
      if(maps[r.sym] && maps[r.sym][d]!=null) last[r.sym]=maps[r.sym][d];
      if(q<=0) continue;
      held=true;
      const px = last[r.sym]!=null ? last[r.sym] : (maps[r.sym] ? null : priceOf(r.sym));
      if(px==null){ ok=false; break; }
      v += q*px;
    }
    if(!ok || !held) continue; // skip days before the first purchase
    const inv = ls ? ls.cost : invNow;
    labels.push(d); value.push(v); profit.push(v-cash-inv); // profit = unrealized gain on money invested by that day
  }
  // append/replace today with live quote
  const t=totals(acc), today=dayStr(Date.now());
  const invToday = useLots ? lotState(acc,today).cost : invNow;
  const pNow = useLots ? t.value-cash-invToday : t.profit;
  if(labels.length && labels[labels.length-1]===today){ value[value.length-1]=t.value; profit[profit.length-1]=pNow; }
  else { labels.push(today); value.push(t.value); profit.push(pNow); }
  return {labels,value,profit};
}
function sliceRange(series, range){
  const cut=rangeCutoff(range);
  let i=series.labels.findIndex(d=>d>=cut); if(i<0) i=0;
  return {labels:series.labels.slice(i), value:series.value.slice(i), profit:series.profit.slice(i)};
}
function buildIntradaySeries(acc){ // 1D view: portfolio value per 5-min bar, current share counts
  const rs = rows(acc); const cash = cashFor(acc);
  const withI = rs.filter(r=>state.intraday[r.sym] && state.intraday[r.sym].t && state.intraday[r.sym].t.length>1);
  if(!withI.length) return null;
  const tSet=new Set(); const maps={};
  for(const r of withI){
    const h=state.intraday[r.sym]; maps[r.sym]={};
    for(let i=0;i<h.t.length;i++){ if(h.c[i]!=null){ tSet.add(h.t[i]); maps[r.sym][h.t[i]]=h.c[i]; } }
  }
  const ts=[...tSet].sort((a,b)=>a-b);
  const fmtT = ms=>new Date(ms).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const useLots = hasLots(acc);
  const inv = useLots ? lotState(acc, dayStr(Date.now())).cost : rs.reduce((a,r)=>a+r.cost,0);
  const labels=[], value=[], profit=[], times=[];
  const last={};
  for(const t of ts){
    let v=cash, ok=true;
    for(const r of rs){
      if(maps[r.sym] && maps[r.sym][t]!=null) last[r.sym]=maps[r.sym][t];
      let px = last[r.sym];
      if(px==null){ if(maps[r.sym]){ ok=false; break; } px=priceOf(r.sym); }
      v += r.qty*px;
    }
    if(!ok) continue;
    labels.push(fmtT(t)); value.push(v); profit.push(v-cash-inv); times.push(t);
  }
  if(!labels.length) return null;
  if(marketOpen()){ // live point
    const tt=totals(acc), now=Date.now();
    labels.push(fmtT(now)); value.push(tt.value); profit.push(tt.value-cash-inv); times.push(now);
  }
  // `times`: raw ms epoch per point, parallel to `labels` — the hero chart (Lightweight
  // Charts) needs real UTCTimestamp seconds, not the pre-formatted "2:30 PM" label strings.
  return {labels,value,profit,times};
}
let chartBaseV=0; // portfolio value at range start — % base for the profit metric
/* --- universal scrubbing: drag ANY chart to read exact values at a point in time --- */
const scrubLine = { id:'scrubLine',
  afterDatasetsDraw(c){
    if(c._scrub==null) return;
    if(!c.chartArea) return;
    const g=c.ctx, i=c._scrub;
    let x=null; const dots=[];
    c.data.datasets.forEach((ds,k)=>{
      const m=c.getDatasetMeta(k); if(m.hidden) return;
      const p=m.data[i]; if(!p) return;
      if(x==null) x=p.x;
      dots.push([p, typeof ds.borderColor==='string'?ds.borderColor:(typeof ds.backgroundColor==='string'?ds.backgroundColor:cvar('--brand'))]);
    });
    if(x==null) return;
    g.save();
    g.strokeStyle=cvar('--faint'); g.lineWidth=1; g.setLineDash([3,3]);
    g.beginPath(); g.moveTo(x,c.chartArea.top); g.lineTo(x,c.chartArea.bottom); g.stroke(); g.setLineDash([]);
    for(const [p,col] of dots){
      g.fillStyle=col; g.beginPath(); g.arc(p.x,p.y,4,0,7); g.fill();
      g.strokeStyle=cvar('--card'); g.lineWidth=1.5; g.stroke();
    }
    g.restore();
  }};
// registered by ensureChartJs() (js/boot.js) once Chart.js actually loads — it's lazy now.
function attachScrubAny(c, onMove){ // onMove(i) with index, onMove(null) when released
  const el=c.canvas;
  el.style.touchAction='pan-y'; // horizontal drag scrubs, vertical swipe still scrolls the page
  const idx=e=>{
    const r=el.getBoundingClientRect(), x=e.clientX-r.left;
    const n=(c.data.labels||[]).length; if(n<2||!c.chartArea) return 0;
    const {left,right}=c.chartArea;
    if(!(right-left>2)) return 0; // chart not laid out yet
    const t=Math.min(1,Math.max(0,(x-left)/(right-left)));
    return Math.round(t*(n-1));
  };
  const move=e=>{ const i=idx(e); if(i===c._scrub) return; c._scrub=i; c.update('none'); onMove(i); };
  el.onpointerdown=e=>{
    try{ el.setPointerCapture(e.pointerId); }catch(x){}
    if(c.chartArea && !(c.chartArea.right-c.chartArea.left>2)){ try{ c.resize(); }catch(x){} } // throttled layouts
    if(c.options.plugins.tooltip){ c._ttWas=c.options.plugins.tooltip.enabled!==false; c.options.plugins.tooltip.enabled=false; }
    c._scrubbing=true; move(e);
  };
  el.onpointermove=e=>{ if(c._scrubbing) move(e); };
  el.onpointerup=el.onpointercancel=()=>{
    if(!c._scrubbing) return;
    c._scrubbing=false; c._scrub=null;
    if(c.options.plugins.tooltip && c._ttWas!==undefined) c.options.plugins.tooltip.enabled=c._ttWas;
    c.update('none'); onMove(null);
  };
}
function niceLbl(l){ return /^\d{4}-\d{2}-\d{2}$/.test(l) ? new Date(l+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : l; }
function wireDetailScrub(c, labels, closes, roId){ // price readout for holding/stock sheets
  const ro=$(roId); if(!ro||!c) return;
  const hint=ro.textContent;
  attachScrubAny(c, i=>{
    if(i==null){ ro.textContent=hint; return; }
    const v=closes[i], d0=closes[0];
    ro.textContent=`${niceLbl(labels[i])} · ${fmtPx(v)}${d0>0?` · ${fmtPct((v/d0-1)*100)} over range`:''}`;
  });
}
function drawChart(canvasId, labels, data, msgEl, bench, markers){
  if(!window.Chart){ if(msgEl) msgEl.textContent='Connect to the internet once to load the chart library.'; return null; }
  if(msgEl) msgEl.textContent = labels.length<2 ? 'Chart appears after the first online price update.' : '';
  const el=$(canvasId);
  const orphan = Chart.getChart(el); if(orphan) orphan.destroy();
  if(labels.length<2) return null;
  const up = data.length>1 ? data[data.length-1]>=data[0] : true;
  // Canvas has no text alternative of its own — role="img" + a start/end/direction
  // summary covers both call sites (holding detail, stock sheet) since they share
  // this one draw function.
  const chg = data[0] ? (data[data.length-1]/data[0]-1)*100 : 0;
  el.setAttribute('role','img');
  el.setAttribute('aria-label', `Price chart, ${labels.length} points, ${up?'up':'down'} ${Math.abs(chg).toFixed(1)}% from ${fmt(data[0])} to ${fmt(data[data.length-1])} over the period.`);
  const rgb = up?cvar('--green-rgb'):cvar('--red-rgb');
  const solid = up?cvar('--green'):cvar('--red');
  const ctx=el.getContext('2d');
  // three-stop fill: present under the line, gone by mid-chart — the Apple Stocks look
  const g=ctx.createLinearGradient(0,0,0,(el.parentNode.clientHeight||220));
  g.addColorStop(0, `rgba(${rgb},.26)`); g.addColorStop(.55, `rgba(${rgb},.07)`); g.addColorStop(1,'rgba(0,0,0,0)');
  const datasets=[{label:'Portfolio', data, borderColor:solid, backgroundColor:g, fill:true, borderWidth:1.9, pointRadius:0, pointHoverRadius:4, pointHoverBackgroundColor:solid, tension:0.35, cubicInterpolationMode:'monotone'}];
  if(bench) datasets.push({label:benchName(), data:bench, borderColor:cvar('--mut'), borderDash:[4,4], borderWidth:1.4, pointRadius:0, pointHoverRadius:3, fill:false, tension:0.35, cubicInterpolationMode:'monotone'});
  if(markers) datasets.push({label:'Buys', data:markers.data, showLine:false, pointRadius:3.4, pointHoverRadius:5, pointBackgroundColor:cvar('--brand'), pointBorderColor:cvar('--card'), pointBorderWidth:1.5, fill:false});
  const cfg={type:'line', data:{labels, datasets},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:600,easing:'easeOutQuart'},
      interaction:{mode:'index',intersect:false},
      layout: {},
      plugins:{legend:{display:false},
        tooltip: {
          ...CHART_TOOLTIP,
          callbacks:{
            title:items=>{ const d=items[0].label; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d+'T12:00:00').toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'}) : d; },
            label:c=>{ if(c.dataset.label==='Buys') return 'Bought: '+fmt(markers.amt[c.dataIndex]);
              return (c.chart.data.datasets.length>1 ? c.dataset.label+': ' : '')+fmt(c.parsed.y); },
            afterLabel:c=>{ if(c.datasetIndex!==0) return ''; const d0=c.dataset.data[0]; if(c.dataIndex===0 || d0==null) return '';
              const diff=c.parsed.y-d0; let s=fmtSign(diff);
              if(d0>0) s+=` (${fmtPct((c.parsed.y/d0-1)*100)})`;
              return s+' since range start'; }}}},
      scales: {
        x:{display:true,grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,maxRotation:0,font:{size:10},
           callback:function(v){ const l=this.getLabelForValue(v); return /^\d{4}-/.test(l)?l.slice(5):l; }}},
        y:{display:true,grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,font:{size:10},
           callback:v=>new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate())}}}},
    plugins: []};
  const c=new Chart(el,cfg); c._up=up; return c;
}

/* ============ HERO CHART (Lightweight Charts) ============
   Portfolio tab's big glanceable chart only — every OTHER chart in the app
   (holding detail, drawdown, worth, contributions, dividend calendar) stays on
   Chart.js via drawChart() above. Design constraints (UPGRADE_PLAN.md Phase 2):
   one accent colour for the series regardless of up/down (gain/loss reads from
   the sign/pill next to the chart, not line colour alone — a red/green-only
   encoding is invisible to ~8% of men); one muted neutral for the benchmark
   overlay, which is reference, not a competing series; every colour read from
   css/tokens.css via cvar(), never a literal hex, so the theme toggle repaints
   it exactly like every other chart (renderAll() already destroys and rebuilds
   this chart on every call, theme change included). */
let heroChart=null, heroSeries=null, heroBenchSeries=null, heroMarkersApi=null, heroData=null, heroResizeObs=null, heroPendingObs=null; // heroData: {times,labels,data} — index-aligned, used by updateChartLive() + scrub
function drawHeroChart(times, labels, data, msgEl, bench, markers){
  const LC = window.LightweightCharts;
  if(!LC){ if(msgEl) msgEl.textContent='Connect to the internet once to load the chart library.'; return null; }
  if(msgEl) msgEl.textContent = labels.length<2 ? 'Chart appears after the first online price update.' : '';
  const el=$('mainChart');
  if(heroPendingObs){ heroPendingObs.disconnect(); heroPendingObs=null; }
  if(heroResizeObs){ heroResizeObs.disconnect(); heroResizeObs=null; }
  if(heroChart){ heroChart.remove(); heroChart=null; heroSeries=null; heroBenchSeries=null; heroMarkersApi=null; }
  el.innerHTML='';
  if(labels.length<2) return null;
  // Lightweight Charts owns everything under #mainChart and rebuilds it on every redraw
  // (el.innerHTML='' above), so the label lives on this stable container, not on any
  // canvas it creates internally.
  el.setAttribute('role','img');
  { const chg = data[0] ? (data[data.length-1]/data[0]-1)*100 : 0;
    el.setAttribute('aria-label', `Portfolio chart, ${labels.length} points, ${chg>=0?'up':'down'} ${Math.abs(chg).toFixed(1)}% over the period.`); }
  // #mainChart is display:none on every tab but Portfolio, and renderAll() draws this
  // chart unconditionally at boot — so the very first draw, before the user has ever
  // opened Portfolio, would otherwise happen against a 0×0 container. Measured (canvas
  // bitmap width/height vs the canvas's own getBoundingClientRect, sampled every animation
  // frame): creating a chart against 0×0 and resizing it later, once the tab opens, leaves
  // a brief window where the bitmap scales non-uniformly (one axis's ratio to its own CSS
  // size doesn't match the other) — a real, visible line distortion, not merely blurriness.
  // Never creating the chart against 0×0 in the first place removes that window outright:
  // if the container has no size yet, wait for the container's own first real size instead
  // of asking Lightweight Charts to recover from zero.
  const rect = el.getBoundingClientRect();
  if(rect.width<=0 || rect.height<=0){
    heroPendingObs = new ResizeObserver(entries => {
      const box = entries[0] && entries[0].contentRect;
      if(!box || box.width<=0 || box.height<=0) return;
      heroPendingObs.disconnect(); heroPendingObs=null;
      drawHeroChart(times, labels, data, msgEl, bench, markers);
    });
    heroPendingObs.observe(el);
    return null;
  }
  const brand=cvar('--brand'), brandRgb=cvar('--brand-rgb'), mut=cvar('--mut'), grid=cvar('--grid'),
        card=cvar('--card'), faint=cvar('--faint');
  const priceFormatter = v => state.view.priv ? '' :
    new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate());
  // NOT autoSize: managing size ourselves (this measured rect at creation, then the
  // ResizeObserver below for every later change) gives one deterministic size transition
  // instead of relying on the vendor bundle's own internal autoSize/ResizeObserver timing.
  const chart=LC.createChart(el, {
    width: rect.width, height: rect.height,
    layout:{ background:{type:LC.ColorType.Solid,color:'transparent'}, textColor:mut,
             fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif", fontSize:10,
             attributionLogo:false }, // Apache-2.0 permits removing TradingView's built-in chart-corner logo; see vendor/lightweight-charts.standalone.production.js license header
    grid:{ vertLines:{visible:false}, horzLines:{color:grid} },
    rightPriceScale:{ visible:true, borderVisible:false, scaleMargins:{top:0.16,bottom:0.06} },
    leftPriceScale:{ visible:false },
    // fixLeftEdge/fixRightEdge/rightOffset:0 — without them, a sparse series (a 2-point
    // weekly-baked range, or any short window) pads itself with empty logical bars on the
    // left to preserve a default ~6px bar spacing, instead of stretching to fill the width
    // (confirmed by isolated reproduction: identical setData + setVisibleLogicalRange({from:0,
    // to:n-1}) alone still yielded a padded range; only fixing both edges at creation made
    // the range come out correct immediately). This was a real bug in every sparse range
    // since Phase 2 — found while capturing this phase's "before" screenshots.
    timeScale:{ visible:false, borderVisible:false, fixLeftEdge:true, fixRightEdge:true, rightOffset:0 },
    crosshair:{ mode:LC.CrosshairMode.Normal,
      vertLine:{ color:faint, width:1, style:LC.LineStyle.Dashed, labelVisible:false },
      horzLine:{ visible:false, labelVisible:false } },
    handleScroll:false, handleScale:false,
    localization:{ priceFormatter },
  });
  // Guard against 0×0: #mainChart is display:none on every tab but Portfolio, so a resize
  // fired while hidden would just re-confirm zero — skip it and let the next real resize
  // (when the tab becomes visible) size the chart correctly instead.
  heroResizeObs = new ResizeObserver(entries => {
    const box = entries[0] && entries[0].contentRect;
    if(!box || box.width<=0 || box.height<=0) return;
    chart.resize(box.width, box.height);
  });
  heroResizeObs.observe(el);
  el.style.touchAction='pan-y'; // horizontal drag scrubs, vertical swipe still scrolls the page

  const series = chart.addSeries(LC.AreaSeries, {
    lineColor:brand, lineWidth:2, topColor:`rgba(${brandRgb},.26)`, bottomColor:`rgba(${brandRgb},0)`,
    crosshairMarkerVisible:true, crosshairMarkerRadius:4.5,
    crosshairMarkerBackgroundColor:brand, crosshairMarkerBorderColor:card, crosshairMarkerBorderWidth:1.5,
    priceLineVisible:false, lastValueVisible:false, priceFormat:{type:'custom', formatter:priceFormatter, minMove:0.01},
  });
  series.setData(times.map((t,i)=>({time:t, value:data[i]})));

  let benchSer=null;
  if(bench){
    benchSer = chart.addSeries(LC.LineSeries, {
      color:mut, lineWidth:1.4, lineStyle:LC.LineStyle.Dashed, crosshairMarkerVisible:false,
      priceLineVisible:false, lastValueVisible:false,
    });
    benchSer.setData(times.map((t,i)=> bench[i]==null ? {time:t} : {time:t, value:bench[i]}));
  }

  let markersApi=null;
  if(markers){
    const pts = [];
    for(let i=0;i<times.length;i++) if(markers.data[i]!=null) pts.push({time:times[i], position:'inBar', shape:'circle', color:brand, size:1});
    if(pts.length) markersApi = LC.createSeriesMarkers(series, pts);
  }

  // NOT fitContent(): for sparse data (e.g. a 22-point month, or 2 weekly-baked points)
  // fitContent() keeps bar spacing near its ~6px default and pads the REMAINDER of the
  // width with empty space on the left, rather than stretching the line edge-to-edge —
  // correct for a "load more history by scrolling" trading chart, wrong for a hero chart
  // that must always fill its box like every prior Chart.js range did. Forcing the exact
  // logical range stretches the existing points across the full width instead.
  chart.timeScale().setVisibleLogicalRange({ from:0, to: times.length-1 });
  heroChart=chart; heroSeries=series; heroBenchSeries=benchSer; heroMarkersApi=markersApi;
  heroData = {times, labels, data};
  return chart;
}
let scrubbing=false;
function attachHeroScrub(chart, series, times, labels, data){
  const el=$('mainChart');
  const idx=e=>{
    const r=el.getBoundingClientRect(), x=e.clientX-r.left;
    const logical=chart.timeScale().coordinateToLogical(x);
    if(logical==null) return null;
    return Math.max(0, Math.min(times.length-1, Math.round(logical)));
  };
  let deltaSave=null, scrubI=null;
  const move=e=>{ const i=idx(e); if(i==null||i===scrubI) return; scrubI=i;
    chart.setCrosshairPosition(data[i], times[i], series);
    if($('tvNum')) $('tvNum').textContent=fmt(data[i]);
    const lb=labels[i];
    const nice=/^\d{4}-\d{2}-\d{2}$/.test(lb) ? new Date(lb+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : lb;
    const d0=data[0], diff=data[i]-d0;
    const pct=(state.view.metric==='value'&&d0>0)?` (${fmtPct((data[i]/d0-1)*100)})`:(state.view.metric==='profit'&&chartBaseV>0)?` (${fmtPct(diff/chartBaseV*100)})`:'';
    $('chartDelta').innerHTML=`<span class="${cls(diff)}">${fmtSign(diff)}${pct}</span> <span class="rng">· ${nice}</span>`; };
  el.onpointerdown=e=>{ try{el.setPointerCapture(e.pointerId);}catch(x){} scrubbing=true; deltaSave=$('chartDelta').innerHTML; move(e); };
  el.onpointermove=e=>{ if(scrubbing) move(e); };
  el.onpointerup=el.onpointercancel=()=>{ if(!scrubbing) return; scrubbing=false; scrubI=null; chart.clearCrosshairPosition(); renderHeader(); if(deltaSave!=null) $('chartDelta').innerHTML=deltaSave; };
}
function renderChart(){
  const dEl=$('chartDelta');
  let s;
  if(state.view.range==='1D'){
    s = buildIntradaySeries(state.view.acc);
    if(!s){
      drawHeroChart([],[],[], $('chartMsg'));
      $('chartMsg').textContent='Loading today’s prices…';
      dEl.textContent=''; ensureIntraday(); return;
    }
    ensureIntraday(); // keep it fresh in the background
  } else {
    const full = buildSeries(state.view.acc);
    if(!full){ drawHeroChart([],[],[], $('chartMsg')); dEl.textContent=''; return; }
    s = sliceRange(full, state.view.range);
    // all-time-high marker under the chart — the number a wealth manager quotes first
    const ath=Math.max(...full.value), cur=full.value[full.value.length-1];
    const off=ath>0?(cur/ath-1)*100:0;
    $('athLine').innerHTML = off>=-0.05
      ? `<span class="pos">◆ At an all-time high</span>`
      : `All-time high ${fmt(ath)} · <span class="${off<-5?'neg':''}">${off.toFixed(1)}%</span> below it`;
  }
  const data = state.view.metric==='profit' ? s.profit : s.value;
  // non-1D ranges: labels ARE 'YYYY-MM-DD' strings already, a valid Lightweight Charts
  // BusinessDay Time as-is. 1D: labels are pre-formatted "2:30 PM" strings for the OLD
  // Chart.js category axis — Lightweight Charts needs real UTCTimestamp SECONDS instead
  // (foot-gun: UTCTimestamp is seconds, not ms — s.times here is ms from buildIntradaySeries).
  const times = state.view.range==='1D' ? s.times.map(ms=>Math.floor(ms/1000)) : s.labels;
  const benchOK = state.view.metric==='value' && state.view.range!=='1D';
  const bench = (state.view.bench!=='off' && benchOK) ? benchSeries(s.labels, s.value) : null;
  $('benchBtn').classList.toggle('on', state.view.bench!=='off' && benchOK);
  $('benchBtn').style.visibility = benchOK ? 'visible' : 'hidden';
  $('benchBtn').textContent = 'vs ' + (state.view.bench==='VT' ? 'World' : state.view.bench==='QQQ' ? 'Nasdaq' : 'S&P 500');
  $('benchBtn').title = 'Tap to cycle: off → S&P 500 → Total World (VT) → Nasdaq 100 (QQQ)';
  let markers=null;
  if(state.view.range!=='1D'){ // dot on the line for every purchase in view
    const buyByDay={};
    for(const l of state.lots){
      if(l.div) continue;
      if(state.view.acc!=='all' && l.acc!==state.view.acc) continue;
      buyByDay[l.date]=(buyByDay[l.date]||0)+l.cost;
    }
    const md=s.labels.map((d,i)=>buyByDay[d]!=null?data[i]:null);
    if(md.some(v=>v!=null)) markers={data:md, amt:s.labels.map(d=>buyByDay[d]||0)};
  }
  const hc = drawHeroChart(times, s.labels, data, $('chartMsg'), bench, markers);
  if(hc) attachHeroScrub(hc, heroSeries, times, s.labels, data);
  chartBaseV = s.value[0]||0;
  if(data.length>1){
    const d0=data[0], d1=data[data.length-1], diff=d1-d0;
    let pct='';
    if(state.view.metric==='value' && d0>0) pct = ` (${fmtPct((d1/d0-1)*100)})`;
    else if(state.view.metric==='profit' && chartBaseV>0) pct = ` (${fmtPct(diff/chartBaseV*100)})`; // profit change as % of portfolio at range start
    dEl.innerHTML = `<span class="${cls(diff)}">${fmtSign(diff)}${pct}</span> <span class="rng">· ${state.view.metric} · ${state.view.range}</span>`;
  } else dEl.textContent='';
}

/* ============ DETAIL VIEW ============ */
let detailChart=null;
function openDetail(sym){
  const r = rows(state.view.acc).find(x=>x.sym===sym); if(!r) return;
  const p=priceOf(sym), val=r.qty*p, pl=val-r.cost, plp=r.cost>0?pl/r.cost*100:0;
  const dp = prevOf(sym)>0 ? (p/prevOf(sym)-1)*100 : 0;
  // wealth-manager stats: weight, day impact, 52w range, income, cost
  const tAll=totals(state.view.acc);
  const weight=tAll.value>0 ? val/tAll.value*100 : 0;
  const dayImp=r.qty*(p-prevOf(sym));
  let hi52=null, lo52=null;
  const hh=state.history[sym];
  if(hh&&hh.t&&hh.t.length){
    const cut=Date.now()-365*86400e3, cl=[];
    for(let i=0;i<hh.t.length;i++) if(hh.c[i]!=null&&hh.t[i]>=cut) cl.push(hh.c[i]);
    cl.push(p);
    if(cl.length>5){ hi52=Math.max(...cl); lo52=Math.min(...cl); }
  }
  let yld=null, incYr=null, yoc=null;
  const dv=state.divs[sym];
  if(dv&&dv.list&&dv.list.length){
    const perSh=dv.list.filter(e=>e[0]>Date.now()-370*86400e3).reduce((a,e)=>a+e[1],0);
    if(perSh>0&&p>0){ yld=perSh/p*100; incYr=perSh*r.qty; }
    if(perSh>0&&r.cost>0&&r.qty>0) yoc=perSh/(r.cost/r.qty)*100; // yield on what YOU paid — rises as the position ages
  }
  const er=(typeof FUND_META!=='undefined'&&FUND_META[sym])?FUND_META[sym].er:null;
  const accLines = Object.keys(r.accs).length>1
    ? `<div class="accbreak">${Object.entries(r.accs).map(([a,x])=>`<div>${esc(ACCOUNTS[a]||a)} — ${x.qty.toFixed(3).replace(/\.?0+$/,'')} sh · ${fmt(x.qty*p)} <span class="${cls(x.qty*p-x.cost)}">(${fmtSign(x.qty*p-x.cost)})</span></div>`).join('')}</div>` : '';
  $('detailSheetHead').innerHTML = `<div class="sheet__idrow">${badgeHtml(sym)}<div class="sheet__idcol">
      <h2 class="hsym sheet__title">${esc(sym.replace('-','.'))}</h2>
      <div class="sheet__sub">${esc(NAMES[sym]||'')}</div>
      <div class="sheet__price">${fmtPx(p)} <span class="t-label ${cls(dp)}">${fmtPct(dp)} today</span></div>
    </div></div><button class="xbtn" id="detailX" aria-label="Close">✕</button>`;
  $('detailSheetBody').innerHTML = `
    <div class="chart-box chart-box--sheet"><canvas id="detailChart"></canvas><div id="detailMsg" class="chart-box__msg"></div></div>
    <div class="scrubro" id="detailRO">↔ drag the chart to see any date's price</div>
    <div class="stats">
      <div class="stat"><div class="k">Shares</div><div class="v">${r.qty.toFixed(3).replace(/\.?0+$/,'')}</div></div>
      <div class="stat"><div class="k">Avg cost</div><div class="v">${fmtPx(r.cost/r.qty)}</div></div>
      <div class="stat"><div class="k">Invested</div><div class="v">${fmt(r.cost)}</div></div>
      <div class="stat"><div class="k">Value</div><div class="v">${fmt(val)}</div></div>
      <div class="stat"><div class="k">Profit</div><div class="v ${cls(pl)}">${fmtSign(pl)}</div></div>
      <div class="stat"><div class="k">Profit %</div><div class="v ${cls(pl)}">${fmtPct(plp)}</div></div>
      <div class="stat"><div class="k">Weight</div><div class="v">${weight.toFixed(1)}% <span class="statsub">of portfolio</span></div></div>
      <div class="stat"><div class="k">Today</div><div class="v ${cls(dayImp)}">${fmtSign(dayImp)}</div></div>
      ${hi52!=null?`<div class="stat"><div class="k">vs 52w high</div><div class="v ${cls(p-hi52)}">${fmtPct(hi52>0?(p/hi52-1)*100:0)}</div></div>`:''}
      ${yld!=null?`<div class="stat"><div class="k">Dividend yield</div><div class="v">${yld.toFixed(2)}% <span class="statsub">≈${fmt(incYr)}/yr</span></div></div>`:''}
      ${yoc!=null?`<div class="stat"><div class="k">Yield on cost</div><div class="v">${yoc.toFixed(2)}% <span class="statsub">on what you paid</span></div></div>`:''}
      ${er!=null?`<div class="stat"><div class="k">Fund fee</div><div class="v">${er.toFixed(2)}% <span class="statsub">≈${fmt(val*er/100)}/yr</span></div></div>`:''}
    </div>${hi52!=null&&hi52>lo52?`<div class="rangebar"><div class="rb-track"><i style="left:${Math.min(100,Math.max(0,(p-lo52)/(hi52-lo52)*100)).toFixed(1)}%"></i></div>
      <div class="rb-lbls"><span>${fmtPx(lo52)}</span><span>52-week range</span><span>${fmtPx(hi52)}</span></div></div>`:''}${accLines}${(function(){
      const ls=state.lots.filter(l=>l.sym===sym && (state.view.acc==='all'||l.acc===state.view.acc)).sort((a,b)=>b.date.localeCompare(a.date));
      if(!ls.length) return '';
      return `<div style="font-size:13px;font-weight:700;margin-top:16px">Your purchases (${ls.length})</div>`+ls.map(l=>{
        const g=l.qty*p-l.cost;
        return `<div class="krow"><span class="k">${new Date(l.date+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'2-digit'})}${l.div?' · dividend':''}</span><span>${l.qty.toFixed(3).replace(/\.?0+$/,'')} sh @ ${fmtPx(l.cost/l.qty)} <span class="${cls(g)}">${fmtSign(g)}</span></span></div>`;
      }).join('');
    })()}${(function(){
      const al=(lsGet('pt_alerts')||[]).find(a=>a.sym===sym);
      return `<div style="font-size:13px;font-weight:700;margin-top:16px">Price alert</div>
        <div class="krow"><span class="k">${al?`Push me at ${fmtPx(al.at)} (${al.dir==='up'?'on the way up':'on the way down'})`:'Get a push when it hits a price you pick'}</span>
        <span><button class="btn sec" id="alertBtn" style="padding:6px 12px;font-size:12px">${al?'Remove':'🔔 Set'}</button></span></div>`;
    })()}`;
  showOverlay('detail');
  $('detailX').onclick = closeDetail;
  $('detailX').focus({preventScroll:true});
  const ab=$('alertBtn');
  if(ab) ab.onclick=()=>{
    const list=lsGet('pt_alerts')||[];
    const i=list.findIndex(a=>a.sym===sym);
    if(i>-1){ list.splice(i,1); lsSet('pt_alerts',list); toast('Price alert removed.'); if(typeof pushSyncNow==='function') pushSyncNow(); openDetail(sym); return; }
    const v=prompt(`Push me when ${sym.replace('-','.')} reaches $`); if(v==null) return;
    const at=parseFloat(String(v).replace(',','.'));
    if(!(at>0)){ toast('Enter a price like 700 or 89.50', true); return; }
    const dir=at>=priceOf(sym)?'up':'down';
    list.push({sym, at, dir}); lsSet('pt_alerts',list);
    toast(`You'll get a push when ${sym.replace('-','.')} ${dir==='up'?'climbs to':'falls to'} ${fmtPx(at)}.`);
    if(typeof pushSyncNow==='function') pushSyncNow();
    openDetail(sym);
  };
  if(detailChart){ detailChart.destroy(); detailChart=null; }
  const h=state.history[sym];
  const ih=state.intraday[sym];
  if(state.view.range==='1D' && ih && ih.t && ih.t.length>1){
    const labels=[], closes=[];
    for(let i=0;i<ih.t.length;i++) if(ih.c[i]!=null){ labels.push(new Date(ih.t[i]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})); closes.push(ih.c[i]); }
    ensureChartJs().catch(()=>{}).then(()=>{
      if(!$('detailChart')) return; // sheet closed or replaced while Chart.js was loading
      detailChart = drawChart('detailChart', labels, closes, $('detailMsg'));
      wireDetailScrub(detailChart, labels, closes, 'detailRO');
    });
  } else if(h && h.t && h.t.length>1){
    const cut=rangeCutoff(state.view.range==='1D' ? '1W' : state.view.range);
    const labels=[], closes=[];
    for(let i=0;i<h.t.length;i++){ if(h.c[i]==null) continue; const d=dayStr(h.t[i]); if(d>=cut){ labels.push(d); closes.push(h.c[i]); } }
    const today=dayStr(Date.now());
    if(labels.length && labels[labels.length-1]===today) closes[closes.length-1]=p; else { labels.push(today); closes.push(p); }
    ensureChartJs().catch(()=>{}).then(()=>{
      if(!$('detailChart')) return; // sheet closed or replaced while Chart.js was loading
      detailChart = drawChart('detailChart', labels, closes, $('detailMsg'));
      wireDetailScrub(detailChart, labels, closes, 'detailRO');
    });
  } else if($('detailMsg')) $('detailMsg').textContent='Price chart appears after the first online update.';
}
function closeDetail(){ hideOverlay('detail'); setTimeout(()=>{ if(detailChart && $('detail').classList.contains('hidden')){ detailChart.destroy(); detailChart=null; } }, 200); }
$('detail').addEventListener('click', e=>{ if(e.target.id==='detail') closeDetail(); });

/* ============ EDIT HOLDINGS ============ */
function openEdit(){
  const rowsHtml = state.holdings.map((h,i)=>`<tr>
    <td><select data-i="${i}" data-f="acc"><option value="main" ${h.acc==='main'?'selected':''}>Main</option><option value="brok" ${h.acc==='brok'?'selected':''}>Brokerage</option></select></td>
    <td><input data-i="${i}" data-f="sym" value="${esc(h.sym)}"></td>
    <td><input data-i="${i}" data-f="qty" type="number" step="any" value="${h.qty}"></td>
    <td><input data-i="${i}" data-f="cost" type="number" step="any" value="${h.cost}"></td>
    <td><button class="del" data-i="${i}">✕</button></td></tr>`).join('');
  $('editSheetHead').innerHTML = `<h2 class="hsym sheet__title">Edit holdings</h2><button class="xbtn" id="editX" aria-label="Close">✕</button>`;
  $('editSheetBody').innerHTML = `
    <div class="buybox">
      <div class="buytitle">Record a purchase</div>
      <div class="buyrow">
        <select id="buyAcc"><option value="main">Main</option><option value="brok" selected>Brokerage</option></select>
        <input id="buySym" placeholder="Ticker e.g. VOO" autocapitalize="characters">
        <input id="buyDate" type="date" value="${dayStr(Date.now())}">
      </div>
      <div class="buyrow">
        <input id="buyQty" type="number" step="any" inputmode="decimal" placeholder="Shares">
        <input id="buyCost" type="number" step="any" inputmode="decimal" placeholder="Total cost $">
        <button class="btn pri" id="buyAdd">Add</button>
      </div>
      <label class="buydiv"><input type="checkbox" id="buyDiv"> Dividend reinvestment (not new money)</label>
      <div class="buyhint">Adds a lot to the history AND updates the position — chart, cost basis and deposits stay accurate.</div>
    </div>
    <div style="color:var(--mut);font-size:12.5px;margin-top:16px">Or correct positions directly (cost = total paid, USD):</div>
    <table class="etable"><thead><tr><th>Account</th><th>Ticker</th><th>Shares</th><th>Cost $</th><th></th></tr></thead><tbody id="etbody">${rowsHtml}</tbody></table>
    <button class="btn sec" id="addRow" style="margin-top:10px">+ Add position</button>
    <div class="cashedit">
      <label>Main cash $<input id="cashMain" type="number" step="any" value="${state.cash.main||0}"></label>
      <label>Brokerage cash $<input id="cashBrok" type="number" step="any" value="${state.cash.brok||0}"></label>
      <label>Total deposited $<input id="depTotal" type="number" step="any" value="${state.deposits||0}"></label>
    </div>
    <div style="color:var(--mut);font-size:12px;margin-top:8px">Total deposited = all money you've put in (Vanguard performance page). Used for "Total earnings", which includes dividends and realized gains.</div>
    <div class="ebtns"><button class="btn pri" id="saveEdit">Save</button><button class="btn sec" id="cancelEdit">Cancel</button></div>
    <div class="ebtns"><button class="btn sec" id="exportBtn">⬇ Export backup</button><button class="btn sec" id="importBtn">⬆ Import backup</button><button class="btn sec" id="csvBtn">⬇ CSV</button><button class="btn warn" id="resetSeed">Erase all holdings</button></div>
    <div class="ebtns"><button class="btn sec" id="shareBtn">📤 Share performance card</button><button class="btn sec" id="speakBtn">🗣️ Speak my briefing</button></div>
    <div style="color:var(--mut);font-size:11.5px;margin-top:6px;line-height:1.55">The share card shows percentages only — never your dollar amounts. Tip: a Siri Shortcut that opens the app with <b>?brief=1</b> makes it speak on command.</div>
    ${window.DEMO_MODE ? `
    <div style="font-size:12.5px;font-weight:700;margin-top:18px">Example portfolio</div>
    <div class="ebtns"><button class="btn pri" id="exitDemoBtn">← Exit the demo</button></div>
    <div style="color:var(--mut);font-size:11.5px;margin-top:6px;line-height:1.55">You're exploring a fictional example portfolio. Nothing here is saved and it can't see, read, or touch any real account. Exit to return to the lock screen.</div>
    ` : `
    <div style="font-size:12.5px;font-weight:700;margin-top:18px">Security</div>
    <div class="ebtns"><button class="btn sec" id="lockNow">🔒 Lock now</button><button class="btn sec" id="faceTgl"></button><button class="btn sec" id="chgPass">Change passcode</button><button class="btn sec" id="cloudTgl"></button></div>
    <div style="color:var(--mut);font-size:11.5px;margin-top:6px;line-height:1.55">Your holdings are AES-256 encrypted on this device. The passcode always unlocks; Face ID is a convenience on top of it. Cloud backup keeps an encrypted copy on your own server — unreadable without your passcode, so a lost phone loses nothing.</div>
    <div style="font-size:12.5px;font-weight:700;margin-top:18px">Daily reports</div>
    <div class="ebtns"><button class="btn sec" id="pushTgl"></button><button class="btn sec" id="pushTest" style="display:none">Send test now</button></div>
    <div style="color:var(--mut);font-size:11.5px;margin-top:6px;line-height:1.55">Lock-screen notification at US market open (~15:35) and close (~22:15) with your day's dollars and biggest movers — even while the app is closed. Notifications are end-to-end encrypted.</div>
    `}
    <input type="file" id="importFile" accept=".json,application/json" style="display:none">`;
  showOverlay('editModal');
  $('editX').onclick=$('cancelEdit').onclick=()=>hideOverlay('editModal');
  $('editX').focus({preventScroll:true});
  $('buyAdd').onclick=()=>{
    const acc=$('buyAcc').value, sym=$('buySym').value.trim().toUpperCase().replace('.','-'),
          date=$('buyDate').value, qty=+$('buyQty').value, cost=+$('buyCost').value, div=$('buyDiv').checked;
    if(!sym || !date || !(qty>0) || !(cost>0)){ toast('Fill in ticker, date, shares and total cost first.', true); return; }
    state.lots.push(div ? {acc,sym,date,qty,cost,div:true} : {acc,sym,date,qty,cost});
    const h=state.holdings.find(x=>x.acc===acc && x.sym===sym);
    if(h){ h.qty+=qty; h.cost+=cost; } else state.holdings.push({acc,sym,qty,cost});
    if(!div) state.deposits=(+state.deposits||0)+cost; // new money in — adjust in the field below if it came from existing cash
    markConfirmed(); persist(); hideOverlay('editModal'); renderAll(); refreshAll(true);
  };
  $('exportBtn').onclick=exportBackup;
  $('csvBtn').onclick=exportCSV;
  $('shareBtn').onclick=sharePerfCard;
  $('speakBtn').onclick=speakBriefing;
  $('importBtn').onclick=()=>$('importFile').click();
  if(window.DEMO_MODE){ $('exitDemoBtn').onclick=window.exitDemo; } else { // security + reports touch the real vault/Worker — real mode only
  $('lockNow').onclick=()=>vaultLock();
  const ft=$('faceTgl');
  const paintFt=()=>{ ft.textContent = vaultFaceEnabled() ? 'Disable Face ID' : 'Enable Face ID'; };
  paintFt();
  vaultFaceAvailable().then(ok=>{ if(!ok && !vaultFaceEnabled()) ft.style.display='none'; });
  ft.onclick=async()=>{
    try{
      if(vaultFaceEnabled()) vaultDisableFace();
      else { ft.textContent='Follow the Face ID prompt…'; await vaultEnableFace(); }
    }catch(e){ toast("Face ID isn't available on this device yet — the passcode still protects everything.", true); }
    paintFt();
  };
  $('chgPass').onclick=async()=>{
    const o=prompt('Current passcode'); if(o==null) return;
    const n=prompt('New passcode (min 8 characters, not all numbers)'); if(n==null) return;
    try{ await vaultChangePass(o,n); alert('Passcode changed.'); }
    catch(e){ alert(e&&e.code==='weak' ? e.message : 'Current passcode was wrong.'); }
  };
  const paintCloud=()=>{ const b=lsGet('pt_bk'); $('cloudTgl').textContent = (b&&b.k) ? '☁️ Cloud backup: on' : '☁️ Cloud backup: off'; };
  paintCloud();
  $('cloudTgl').onclick=()=>{
    const b=lsGet('pt_bk');
    if(b&&b.k){
      showConfirm('Turn off cloud backup?','The encrypted copy on your server will be deleted. Everything stays on this phone.','Turn off',
        async()=>{ await cloudDisable(); paintCloud(); toast('Cloud backup off.'); });
    } else {
      (async()=>{
        const p=prompt('Confirm your passcode to enable encrypted cloud backup'); if(p==null) return;
        $('cloudTgl').textContent='Encrypting…';
        try{
          const ok=await cloudEnable(p);
          toast(ok ? 'Cloud backup on — your data now survives a lost phone.' : 'Cloud backup on — the first upload will finish when you’re online.');
        }catch(e){ toast('Wrong passcode.', true); }
        paintCloud();
      })();
    }
  };
  const paintPush=()=>{
    const on=!!(lsGet('pt_push')||{}).on;
    $('pushTgl').textContent = on ? 'Turn off reports' : '🔔 Turn on reports';
    $('pushTest').style.display=''; $('pushTest').style.opacity = on ? '1' : '.5'; // always visible — never looks "removed"
  };
  paintPush();
  if(typeof pushVerify==='function') pushVerify().then(paintPush); // correct the label against the real subscription
  $('pushTgl').onclick=async()=>{
    const on=!!(lsGet('pt_push')||{}).on;
    $('pushTgl').disabled=true; $('pushTgl').textContent='…';
    try{ if(on) await pushDisable(); else await pushEnable(); }catch(e){}
    $('pushTgl').disabled=false; paintPush(); // always re-sync the label, even if the call failed
  };
  $('pushTest').onclick=()=>{
    if(!(lsGet('pt_push')||{}).on){ toast('Turn on Daily reports first, then tap Send test.', true); return; }
    $('pushTest').disabled=true; pushTest().finally(()=>{ $('pushTest').disabled=false; });
  };
  } // end real-mode-only security/reports wiring
  $('importFile').onchange=e=>{ if(e.target.files[0]) importBackup(e.target.files[0]); };
  $('editSheet').querySelectorAll('.del').forEach(b=> b.onclick=()=>{ readEditInputs(); state.holdings.splice(+b.dataset.i,1); openEdit(); });
  $('addRow').onclick=()=>{ readEditInputs(); state.holdings.push({acc:'brok',sym:'',qty:0,cost:0}); openEdit(); };
  $('resetSeed').onclick=()=>showConfirm('Erase all holdings?',
    'ALL holdings, lots, cash and deposits will be removed from this device. Export a backup first if you might want them back.',
    'Erase everything', ()=>{ state.holdings=[]; state.lots=[]; state.cash={main:0,brok:0}; state.deposits=0; state.confirmed=''; staleDismissed=false; persist(); hideOverlay('editModal'); renderAll(); });
  $('saveEdit').onclick=()=>{
    readEditInputs();
    state.holdings = state.holdings.filter(h=>h.sym && h.qty>0);
    state.cash = { main:+$('cashMain').value||0, brok:+$('cashBrok').value||0 };
    state.deposits = +$('depTotal').value||0;
    markConfirmed(); persist(); hideOverlay('editModal'); renderAll(); refreshAll(true);
  };
}
function readEditInputs(){
  $('editSheet').querySelectorAll('[data-f]').forEach(inp=>{
    const h=state.holdings[+inp.dataset.i]; if(!h) return;
    const f=inp.dataset.f;
    h[f] = (f==='qty'||f==='cost') ? (+inp.value||0) : inp.value.trim().toUpperCase().replace('.','-');
  });
}
/* persist = the SMALL personal/pref keys only. The heavy caches (quotes, history,
   intraday, divs) are saved at their fetch sites — re-stringifying ~300KB of history
   here on every refresh was the main-thread cost, not a safety net. */
function persist(){ lsSet('pt_holdings',state.holdings); lsSet('pt_lots',state.lots); lsSet('pt_cash',state.cash); lsSet('pt_deposits',state.deposits); lsSet('pt_confirmed',state.confirmed); lsSet('pt_divs',state.divs); lsSet('pt_goal',state.goal); lsSet('pt_targets',state.targets); lsSet('pt_watch',state.watch); lsSet('pt_fx',state.fx); lsSet('pt_ccy',state.view.ccy); if(typeof pushSyncSoon==='function') pushSyncSoon(); /* holdings changed → keep the report server's copy current */ if(typeof cloudBackupSoon==='function') cloudBackupSoon(); }
function exportCSV(){ // spreadsheet-friendly dump: positions, then every purchase lot
  const lines=['Positions','Account,Symbol,Shares,Cost basis USD,Price USD,Value USD,Profit USD'];
  for(const h of state.holdings){
    const p=priceOf(h.sym);
    lines.push([ACCOUNTS[h.acc]||h.acc, h.sym, h.qty, h.cost.toFixed(2), p?p.toFixed(2):'', (h.qty*p).toFixed(2), (h.qty*p-h.cost).toFixed(2)].join(','));
  }
  lines.push('','Purchase lots','Account,Symbol,Date,Shares,Cost USD,Dividend reinvestment');
  for(const l of state.lots) lines.push([ACCOUNTS[l.acc]||l.acc, l.sym, l.date, l.qty, l.cost.toFixed(2), l.div?'yes':''].join(','));
  const blob=new Blob([lines.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='portfolio-'+dayStr(Date.now())+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}
/* ---- share card: a branded performance image for the iOS share sheet.
   PERCENTAGES ONLY — this image is designed to leave the phone, so no dollar amounts. */
async function sharePerfCard(){
  const md=typeof monthlyDietzReturns==='function'?monthlyDietzReturns():null;
  if(!md||!Object.keys(md.ret).length){ toast('Needs a bit more price history first.', true); return; }
  const yr=String(new Date().getFullYear());
  const comp=ms=>ms.reduce((a,m)=>a*(1+md.ret[m]/100),1)-1;
  const all=comp(Object.keys(md.ret))*100;
  const ytdMs=Object.keys(md.ret).filter(m=>m.startsWith(yr));
  const ytd=ytdMs.length?comp(ytdMs)*100:null;
  let sp=null; // S&P YTD from VOO's own price history
  const vh=state.history.VOO;
  if(vh&&vh.t&&vh.t.length){
    let a=null; const jan=Date.parse(yr+'-01-01');
    for(let i=0;i<vh.t.length;i++){ if(vh.t[i]<jan) a=vh.c[i]; }
    const pNow=priceOf('VOO');
    if(a>0&&pNow>0) sp=(pNow/a-1)*100;
  }
  const cv=document.createElement('canvas'); cv.width=1080; cv.height=1350;
  const x=cv.getContext('2d');
  const g=x.createLinearGradient(0,0,0,1350); g.addColorStop(0,'#0a0f0d'); g.addColorStop(1,'#10201a');
  x.fillStyle=g; x.fillRect(0,0,1080,1350);
  const glow=x.createRadialGradient(870,1120,60,870,1120,700); glow.addColorStop(0,'rgba(38,208,124,.16)'); glow.addColorStop(1,'rgba(38,208,124,0)');
  x.fillStyle=glow; x.fillRect(0,0,1080,1350);
  // normalized 1-year curve — pure shape, no axes, no numbers
  const s=buildSeries('all'); const cut=Date.now()-365*86400e3;
  const pts=[]; for(let i=0;i<s.labels.length;i++){ const t=Date.parse(s.labels[i]+'T12:00:00'); if(t>=cut&&s.value[i]>0) pts.push(s.value[i]); }
  if(pts.length>10){
    const mn=Math.min(...pts), mx=Math.max(...pts), sp2=mx-mn||1;
    x.beginPath();
    pts.forEach((v,i)=>{ const px=80+i/(pts.length-1)*920, py=1120-((v-mn)/sp2)*300; i?x.lineTo(px,py):x.moveTo(px,py); });
    x.strokeStyle='#26d07c'; x.lineWidth=10; x.lineCap='round'; x.lineJoin='round';
    x.shadowColor='rgba(38,208,124,.55)'; x.shadowBlur=28; x.stroke(); x.shadowBlur=0;
    const lp=[80+920,1120-((pts[pts.length-1]-mn)/sp2)*300];
    x.fillStyle='#5ee7a5'; x.beginPath(); x.arc(lp[0],lp[1],16,0,7); x.fill();
    x.fillStyle='#fff'; x.beginPath(); x.arc(lp[0],lp[1],7,0,7); x.fill();
  }
  x.textAlign='left'; x.fillStyle='#8fa39a'; x.font='600 40px -apple-system,Inter,sans-serif';
  x.fillText('MY PORTFOLIO',80,150);
  x.fillStyle=all>=0?'#26d07c':'#ff6b6b'; x.font='800 190px -apple-system,Inter,sans-serif';
  x.fillText((all>=0?'+':'')+all.toFixed(1)+'%',72,390);
  x.fillStyle='#e7efe9'; x.font='600 46px -apple-system,Inter,sans-serif';
  x.fillText('all-time return · every deposit counted',80,470);
  x.fillStyle='#8fa39a'; x.font='500 44px -apple-system,Inter,sans-serif';
  let ln=590;
  if(ytd!=null){ x.fillText(`This year: ${(ytd>=0?'+':'')+ytd.toFixed(1)}%${sp!=null?`   ·   S&P 500: ${(sp>=0?'+':'')+sp.toFixed(1)}%`:''}`,80,ln); ln+=70; }
  x.fillText('Long-term index investor · dividends reinvested',80,ln);
  x.fillStyle='#5b6f66'; x.font='500 36px -apple-system,Inter,sans-serif';
  x.fillText('tracked with an app I built with AI — $0, private, mine',80,1270);
  cv.toBlob(async b=>{
    try{
      const f=new File([b],'my-portfolio.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],title:'My Portfolio'}); return; }
    }catch(e){ if(e&&e.name==='AbortError') return; }
    const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='my-portfolio.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Card saved — sharing straight to apps works on your phone.');
  },'image/png');
}
/* ---- Siri briefing: the day, spoken with Apple's built-in voices ---- */
function briefingText(){
  const t=totals('all');
  const movers=rows('all').map(r=>({sym:r.sym, imp:r.qty*(priceOf(r.sym)-prevOf(r.sym))})).filter(m=>Math.abs(m.imp)>0.5).sort((a,b)=>Math.abs(b.imp)-Math.abs(a.imp));
  const m=movers[0];
  const g=(state.goal&&state.goal.amt>0)?` You're ${Math.min(100,t.value/state.goal.amt*100).toFixed(0)} percent of the way to your goal.`:'';
  return `Your portfolio is worth ${Math.round(t.value).toLocaleString('en-US')} dollars, ${t.day>=0?'up':'down'} ${Math.abs(Math.round(t.day))} dollars today.`
    +(m?` Biggest mover: ${String(NAMES[m.sym]||m.sym).split(' ')[0]}, ${m.imp>=0?'adding':'costing'} ${Math.abs(Math.round(m.imp))} dollars.`:'')+g;
}
function speakBriefing(){
  try{
    const u=new SpeechSynthesisUtterance(briefingText());
    u.lang='en-US'; u.rate=1.02;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){ toast('Speech isn’t available in this browser.', true); }
}
function exportBackup(){
  const data={ app:'portfolio-tracker', v:1, exported:new Date().toISOString(),
    holdings:state.holdings, lots:state.lots, cash:state.cash, deposits:state.deposits, confirmed:state.confirmed, ccy:state.view.ccy, watch:state.watch,
    goal:state.goal, targets:state.targets, push:lsGet('pt_push'), alerts:lsGet('pt_alerts') };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='portfolio-backup-'+dayStr(Date.now())+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}
function importBackup(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!d || !Array.isArray(d.holdings)) throw new Error('bad');
      state.holdings=d.holdings; state.lots=Array.isArray(d.lots)?d.lots:[];
      state.cash=d.cash||{main:0,brok:0}; state.deposits=+d.deposits||0;
      if(d.confirmed) state.confirmed=d.confirmed;
      if(d.ccy==='USD'||d.ccy==='EUR') state.view.ccy=d.ccy;
      if(Array.isArray(d.watch)) state.watch=d.watch;
      if(d.goal&&(d.goal.amt>0||d.goal.fimo>0)) state.goal=d.goal;
      if(d.targets&&typeof d.targets==='object') state.targets=d.targets;
      if(d.push&&d.push.token) lsSet('pt_push', d.push); // keeps the report server's token — same account, no re-pairing
      // pt_bk (cloud key) is intentionally never imported — no longer exported (TP-1) and an
      // untrusted file's bk would redirect future cloud uploads to an attacker's key.
      if(Array.isArray(d.alerts)) lsSet('pt_alerts', d.alerts);
      persist(); hideOverlay('editModal'); renderAll(); refreshAll(true);
      toast('Backup restored — '+state.holdings.length+' positions, '+state.lots.length+' lots.');
    }catch(e){ toast('That file is not a valid portfolio backup.', true); }
  };
  r.readAsText(file);
}
$('editModal').addEventListener('click', e=>{ if(e.target.id==='editModal') hideOverlay('editModal'); });
