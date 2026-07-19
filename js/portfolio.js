'use strict';
/* ============ RENDER: HEADER + LIST ============ */
function renderHeader(){
  if(scrubbing) return;
  const t = totals(state.view.acc);
  const dayPct = (t.value-t.day)>0 ? t.day/(t.value-t.day)*100 : 0;
  $('totalVal').innerHTML = `<span id="tvNum">${fmt(t.value)}</span>` + ` <span class="daypill ${t.day>=0?'up':'down'}">${fmtSign(t.day)} · ${fmtPct(dayPct)}</span>`;
  const plPct = t.invested>0 ? t.profit/t.invested*100 : 0;
  const dep = +state.deposits || 0;
  const chips = [];
  if(state.view.acc==='all' && dep>0){
    const earn = t.value - dep;
    chips.push({k:'Total profit', v:`${fmtSign(earn)} (${fmtPct(earn/dep*100)})`, c:cls(earn)});
    chips.push({k:'Deposited', v:fmt(dep)});
  } else {
    chips.push({k:'Profit', v:`${fmtSign(t.profit)} (${fmtPct(plPct)})`, c:cls(t.profit)});
    chips.push({k:'Invested', v:fmt(t.invested)});
  }
  const rr = personalReturn(state.view.acc);
  if(rr!=null) chips.push({k:'Return / yr', v:fmtPct(rr*100), c:cls(rr)});
  $('totalSub').innerHTML = chips.map(c=>`<div class="chip" data-ex="${c.k}"><span class="lbl">${c.k} <span class="cq">?</span></span><span class="${c.c||''}">${c.v}</span></div>`).join('');
  $('totalSub').querySelectorAll('.chip').forEach(el=>el.onclick=()=>explainStat(el.dataset.ex));
  // the 3-second story: how today compares to the market
  const voo=state.quotes.VOO, tl=$('todayLine');
  if(tl){
    if(voo && voo.prev>0 && (t.value-t.day)>0){
      const sp=(voo.price/voo.prev-1)*100, d=dayPct-sp;
      tl.className='todayline '+(Math.abs(d)<0.02?'':cls(d));
      tl.textContent = Math.abs(d)<0.02 ? 'Moving with the market today'
        : d>0 ? `Outpacing the S&P 500 by ${d.toFixed(2)}% today`
              : `Trailing the S&P 500 by ${Math.abs(d).toFixed(2)}% today`;
    } else tl.textContent='';
  }
  $('ccyBtn').textContent = state.view.ccy==='USD' ? '$' : '€';
  // keep the pinned glass bar in sync with live ticks (it's visible on every non-Portfolio tab)
  if($('miniBar').classList.contains('show') && typeof paintMiniBar==='function') paintMiniBar();
}
function renderChips(){
  $('accChips').innerHTML = ['all','main','brok'].map(a=>
    `<button data-a="${a}" class="${state.view.acc===a?'on':''}">${a==='all'?'All':esc(ACCOUNTS[a]||a)}</button>`).join('');
  $('accChips').querySelectorAll('button').forEach(b=> b.onclick = ()=>{ state.view.acc=b.dataset.a; renderAll(); });
}
const lastShownPx = {};
function renderList(){
  let rs = rows(state.view.acc); // pre-sorted by value
  const sm = state.view.sort;
  if(sm==='day') rs=[...rs].sort((a,b)=>{
    const da=prevOf(a.sym)>0?priceOf(a.sym)/prevOf(a.sym)-1:0, db=prevOf(b.sym)>0?priceOf(b.sym)/prevOf(b.sym)-1:0;
    return db-da; });
  else if(sm==='profit') rs=[...rs].sort((a,b)=>{
    const pa=a.cost>0?(a.qty*priceOf(a.sym)-a.cost)/a.cost:0, pb=b.cost>0?(b.qty*priceOf(b.sym)-b.cost)/b.cost:0;
    return pb-pa; });
  const wtot = rs.reduce((a,x)=>a+x.qty*priceOf(x.sym),0)||1;
  $('holdList').innerHTML = rs.map(r=>{
    const p=priceOf(r.sym), val=r.qty*p, pl=val-r.cost, plp=r.cost>0?pl/r.cost*100:0;
    const dp = prevOf(r.sym)>0 ? (p/prevOf(r.sym)-1)*100 : 0;
    const was = lastShownPx[r.sym];
    const tick = (was!=null && p!==was) ? (p>was ? ' tick-up' : ' tick-down') : '';
    lastShownPx[r.sym] = p;
    return `<div class="hrow${tick}" data-sym="${esc(r.sym)}">
      ${badgeHtml(r.sym)}
      <div class="hmid">
        <div class="hsym">${esc((NAMES[r.sym]||r.sym.replace('-','.')).replace(/^Vanguard /,''))} <span class="htick">${esc(r.sym.replace('-','.'))}</span></div>
        <div class="hinfo">${fmtPx(p)} <span class="${cls(dp)}">${fmtPct(dp)}</span> · ${r.qty.toFixed(3).replace(/\.?0+$/,'')} sh</div>
      </div>
      <div class="hspark">${spark(r.sym)}</div>
      <div class="hright">
        <div class="hval">${fmt(val)}</div>
        <div class="hpl ${cls(pl)}">${fmtSign(pl)} · ${fmtPct(plp)}</div>
      </div><div class="wbar"><i style="width:${(val/wtot*100).toFixed(1)}%"></i></div></div>`;
  }).join('') || `<div class="empty"><div class="ei">📄</div><div class="et">No holdings yet</div>
    <div class="eb">Add your first position with ⚙︎ above, or restore everything from a backup file.</div>
    <button class="btn pri" id="emptyAdd" style="margin-top:12px">Open settings</button></div>`;
  const ea=$('emptyAdd'); if(ea) ea.onclick=openEdit;
  $('holdList').querySelectorAll('.hrow').forEach(el=> el.onclick = ()=>openDetail(el.dataset.sym));
  const cash = cashFor(state.view.acc);
  $('cashRow').style.display = cash>0 ? 'flex' : 'none';
  $('cashRow').innerHTML = `<span>Cash · settlement fund</span><span>${fmt(cash)}</span>`;
}
$('sortSeg').querySelectorAll('button').forEach(b=>{
  b.classList.toggle('on', b.dataset.s===state.view.sort);
  b.onclick=()=>{ state.view.sort=b.dataset.s; lsSet('pt_sort',b.dataset.s);
    $('sortSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); renderList(); };
});
/* ============ RENDER: ALLOCATION + INCOME ============ */
let allocChart=null;
const ASSET_CLASSES = { 'US stocks':['VOO','VTI','VXF'], 'International':['VXUS'], 'Dividend':['VYM'], 'Berkshire':['BRK-B'] };
function renderAlloc(){
  const rs = rows(state.view.acc).filter(r=>r.qty*priceOf(r.sym)>0);
  const el=$('allocChart');
  if(window.Chart){ const orphan=Chart.getChart(el); if(orphan) orphan.destroy(); }
  allocChart=null;
  const tot = rs.reduce((a,r)=>a+r.qty*priceOf(r.sym),0);
  $('allocCard').style.display = (tot>0 && window.Chart) ? '' : 'none';
  if(!tot || !window.Chart) return;
  const centerOpt = { l1: rs.length+' funds', l2: fmt(tot).replace(/[.,]\d\d(\s|$)/,'$1') };
  allocChart = new Chart(el,{type:'doughnut',
    data:{labels:rs.map(r=>r.sym.replace('-','.')), datasets:[{data:rs.map(r=>r.qty*priceOf(r.sym)), backgroundColor:rs.map(r=>colorOf(r.sym)), borderWidth:2, borderColor:cvar('--card'), hoverOffset:5}]},
    options:{responsive:true, maintainAspectRatio:false, cutout:'72%',
      plugins:{legend:{display:false},centerTxt:centerOpt, tooltip:{backgroundColor:cvar('--card2'),borderColor:cvar('--line'),borderWidth:1,bodyColor:cvar('--tx'),displayColors:false,
        callbacks:{label:c=>c.label+': '+fmt(c.parsed)+' ('+(c.parsed/tot*100).toFixed(1)+'%)'}}}}});
  $('allocLegend').innerHTML = rs.map(r=>{
    const v=r.qty*priceOf(r.sym);
    return `<div class="alg"><span class="dot" style="${bstyle(colorOf(r.sym))}"></span>${esc(r.sym.replace('-','.'))}<span class="alp">${(v/tot*100).toFixed(1)}%</span></div>`;
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
  out.innerHTML=allocs.map(x=>`<div class="inc-row"><span>${esc(x.sym.replace('-','.'))}</span><span><b>${fmt(x.amt)}</b></span></div>`).join('')
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
  if(res.some(r=>r.status==='fulfilled'&&r.value===true)) renderIncome();
}
function renderIncome(){
  const rl = state.lots.filter(l=>l.div && (state.view.acc==='all'||l.acc===state.view.acc));
  const card=$('incomeCard');
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
    const calChart=new Chart(cal,{type:'bar',data:{labels,datasets:[{data,backgroundColor:cvar('--brand'),borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
        tooltip:{backgroundColor:cvar('--card2'),borderColor:cvar('--line'),borderWidth:1,bodyColor:cvar('--tx'),displayColors:false,callbacks:{label:c=>'~'+fmt(c.parsed.y)}}},
        scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),font:{size:9},maxRotation:0,autoSkip:false}},
                y:{display:false}}}});
    attachScrubAny(calChart, i=>{ const ro=$('divRO'); if(!ro) return;
      ro.textContent = i==null ? '' : `${labels[i]} · ~${fmt(data[i])} expected`; });
  }
  ensureDivs();
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
  const labels=[], value=[], profit=[];
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
    labels.push(fmtT(t)); value.push(v); profit.push(v-cash-inv);
  }
  if(!labels.length) return null;
  if(marketOpen()){ // live point
    const tt=totals(acc);
    labels.push(fmtT(Date.now())); value.push(tt.value); profit.push(tt.value-cash-inv);
  }
  return {labels,value,profit};
}
let mainChart=null, chartBaseV=0; // portfolio value at range start — % base for the profit metric
/* --- universal scrubbing: drag ANY chart to read exact values at a point in time --- */
const scrubLine = { id:'scrubLine',
  afterDatasetsDraw(c){
    if(c._scrub==null) return;
    if(c.config.plugins && c.config.plugins.length) return; // the hero chart draws its own scrub
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
if(window.Chart) Chart.register(scrubLine);
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
const heroFx = { id:'heroFx',
  beforeDatasetsDraw(c){ const g=c.ctx; g.save();
    g.shadowColor=`rgba(${c._up!==false?cvar('--green-rgb'):cvar('--red-rgb')},.34)`; g.shadowBlur=20; g.shadowOffsetY=8; },
  afterDatasetsDraw(c){ const g=c.ctx; g.restore();
    const ds=c.data.datasets[0].data; if(!ds||ds.length<2) return;
    const meta=c.getDatasetMeta(0);
    let mi=0,ma=0; ds.forEach((v,i)=>{ if(v!=null){ if(v<ds[mi])mi=i; if(v>ds[ma])ma=i; } });
    const lab=(i,above)=>{ const p=meta.data[i]; if(!p) return;
      g.font="600 10px Inter,-apple-system,sans-serif"; g.fillStyle=cvar('--mut');
      g.textAlign = p.x<64?'left' : p.x>c.chartArea.right-64?'right' : 'center';
      g.fillText(fmt(ds[i]), p.x, above?p.y-9:p.y+17); };
    if(ma!==mi && !state.view.priv){ lab(ma,true); lab(mi,false); }
    if(c._scrub!=null){ const p=meta.data[c._scrub]; if(p){
      g.strokeStyle=cvar('--faint'); g.lineWidth=1; g.setLineDash([3,3]);
      g.beginPath(); g.moveTo(p.x,c.chartArea.top); g.lineTo(p.x,c.chartArea.bottom); g.stroke(); g.setLineDash([]);
      g.fillStyle=c._up!==false?cvar('--green'):cvar('--red');
      g.beginPath(); g.arc(p.x,p.y,4.5,0,7); g.fill();
      g.strokeStyle=cvar('--card'); g.lineWidth=2; g.stroke(); } }
  }};
function drawChart(canvasId, labels, data, msgEl, bench, markers, hero){
  if(!window.Chart){ if(msgEl) msgEl.textContent='Connect to the internet once to load the chart library.'; return null; }
  if(msgEl) msgEl.textContent = labels.length<2 ? 'Chart appears after the first online price update.' : '';
  const el=$(canvasId);
  const orphan = Chart.getChart(el); if(orphan) orphan.destroy();
  if(labels.length<2) return null;
  const up = data.length>1 ? data[data.length-1]>=data[0] : true;
  const rgb = up?cvar('--green-rgb'):cvar('--red-rgb');
  const solid = up?cvar('--green'):cvar('--red');
  const ctx=el.getContext('2d');
  // three-stop fill: present under the line, gone by mid-chart — the Apple Stocks look
  const g=ctx.createLinearGradient(0,0,0,(el.parentNode.clientHeight||220));
  g.addColorStop(0, `rgba(${rgb},.26)`); g.addColorStop(.55, `rgba(${rgb},.07)`); g.addColorStop(1,'rgba(0,0,0,0)');
  let stroke=solid;
  if(hero){ stroke=ctx.createLinearGradient(0,0,(el.parentNode.clientWidth||340),0);
    stroke.addColorStop(0,`rgba(${rgb},.45)`); stroke.addColorStop(1,solid); }
  const datasets=[{label:'Portfolio', data, borderColor:stroke, backgroundColor:g, fill:true, borderWidth:hero?2.5:1.9, pointRadius:0, pointHoverRadius:hero?0:4, pointHoverBackgroundColor:solid, tension:.28}];
  if(bench) datasets.push({label:benchName(), data:bench, borderColor:cvar('--mut'), borderDash:[4,4], borderWidth:1.4, pointRadius:0, pointHoverRadius:hero?0:3, fill:false, tension:.28});
  if(markers) datasets.push({label:'Buys', data:markers.data, showLine:false, pointRadius:3.4, pointHoverRadius:5, pointBackgroundColor:cvar('--brand'), pointBorderColor:cvar('--card'), pointBorderWidth:1.5, fill:false});
  const cfg={type:'line', data:{labels, datasets},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:600,easing:'easeOutQuart'},
      interaction:{mode:'index',intersect:false},
      layout: hero ? {padding:{top:24,bottom:10,left:8,right:8}} : {},
      plugins:{legend:{display:false},
        tooltip: hero ? {enabled:false} : {
          backgroundColor:cvar('--card2'),borderColor:cvar('--line'),borderWidth:1,titleColor:cvar('--mut'),bodyColor:cvar('--tx'),displayColors:false,
          callbacks:{
            title:items=>{ const d=items[0].label; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d+'T12:00:00').toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'}) : d; },
            label:c=>{ if(c.dataset.label==='Buys') return 'Bought: '+fmt(markers.amt[c.dataIndex]);
              return (c.chart.data.datasets.length>1 ? c.dataset.label+': ' : '')+fmt(c.parsed.y); },
            afterLabel:c=>{ if(c.datasetIndex!==0) return ''; const d0=c.dataset.data[0]; if(c.dataIndex===0 || d0==null) return '';
              const diff=c.parsed.y-d0; let s=fmtSign(diff);
              if(d0>0) s+=` (${fmtPct((c.parsed.y/d0-1)*100)})`;
              return s+' since range start'; }}}},
      scales: hero ? {x:{display:false},
        y:{display:true,position:'right',grid:{color:cvar('--grid')},border:{display:false},
           ticks:{color:cvar('--mut'),maxTicksLimit:4,font:{size:9.5},padding:2,
           callback:v=>state.view.priv?'':new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate())}}} : {
        x:{display:true,grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,maxRotation:0,font:{size:10},
           callback:function(v){ const l=this.getLabelForValue(v); return /^\d{4}-/.test(l)?l.slice(5):l; }}},
        y:{display:true,grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,font:{size:10},
           callback:v=>new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate())}}}},
    plugins: hero ? [heroFx] : []};
  const c=new Chart(el,cfg); c._up=up; return c;
}
let scrubbing=false;
function attachScrub(c, labels, data){
  const el=c.canvas; let deltaSave=null;
  const idx=e=>{ const r=el.getBoundingClientRect(); const x=e.clientX-r.left;
    const {left,right}=c.chartArea; const t=Math.min(1,Math.max(0,(x-left)/(right-left)));
    return Math.round(t*(data.length-1)); };
  const move=e=>{ const i=idx(e); if(i===c._scrub) return; c._scrub=i; c.update('none');
    if($('tvNum')) $('tvNum').textContent=fmt(data[i]);
    const lb=labels[i];
    const nice=/^\d{4}-\d{2}-\d{2}$/.test(lb) ? new Date(lb+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : lb;
    const d0=data[0], diff=data[i]-d0;
    const pct=(state.view.metric==='value'&&d0>0)?` (${fmtPct((data[i]/d0-1)*100)})`:(state.view.metric==='profit'&&chartBaseV>0)?` (${fmtPct(diff/chartBaseV*100)})`:'';
    $('chartDelta').innerHTML=`<span class="${cls(diff)}">${fmtSign(diff)}${pct}</span> <span class="rng">· ${nice}</span>`; };
  el.onpointerdown=e=>{ try{el.setPointerCapture(e.pointerId);}catch(x){} scrubbing=true; deltaSave=$('chartDelta').innerHTML; move(e); };
  el.onpointermove=e=>{ if(scrubbing) move(e); };
  el.onpointerup=el.onpointercancel=()=>{ if(!scrubbing) return; scrubbing=false; c._scrub=null; c.update('none'); renderHeader(); if(deltaSave!=null) $('chartDelta').innerHTML=deltaSave; };
}
function renderChart(){
  if(mainChart){ mainChart.destroy(); mainChart=null; }
  const dEl=$('chartDelta');
  let s;
  if(state.view.range==='1D'){
    s = buildIntradaySeries(state.view.acc);
    if(!s){
      mainChart = drawChart('mainChart',[],[], $('chartMsg'));
      $('chartMsg').textContent='Loading today’s prices…';
      dEl.textContent=''; ensureIntraday(); return;
    }
    ensureIntraday(); // keep it fresh in the background
  } else {
    const full = buildSeries(state.view.acc);
    if(!full){ mainChart = drawChart('mainChart',[],[], $('chartMsg')); dEl.textContent=''; return; }
    s = sliceRange(full, state.view.range);
    // all-time-high marker under the chart — the number a wealth manager quotes first
    const ath=Math.max(...full.value), cur=full.value[full.value.length-1];
    const off=ath>0?(cur/ath-1)*100:0;
    $('athLine').innerHTML = off>=-0.05
      ? `<span class="pos">◆ At an all-time high</span>`
      : `All-time high ${fmt(ath)} · <span class="${off<-5?'neg':''}">${off.toFixed(1)}%</span> below it`;
  }
  const data = state.view.metric==='profit' ? s.profit : s.value;
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
  mainChart = drawChart('mainChart', s.labels, data, $('chartMsg'), bench, markers, true);
  if(mainChart) attachScrub(mainChart, s.labels, data);
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
  $('detailSheet').innerHTML = `
    <div class="sheet-head"><div>
      <div class="hsym" style="font-size:18px">${esc(sym.replace('-','.'))}</div>
      <div style="color:var(--mut);font-size:13px;margin-top:2px">${esc(NAMES[sym]||'')}</div>
      <div style="font-size:26px;font-weight:700;margin-top:8px">${fmtPx(p)} <span style="font-size:14px" class="${cls(dp)}">${fmtPct(dp)} today</span></div>
    </div><button class="xbtn" id="detailX">✕</button></div>
    <div class="chart-box" style="height:180px"><canvas id="detailChart"></canvas><div id="detailMsg" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:13px"></div></div>
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
    })()}<div id="sheetNews" data-sym="${esc(sym)}"></div>`;
  showOverlay('detail');
  $('detailX').onclick = closeDetail;
  $('detailX').focus({preventScroll:true});
  loadSheetNews(sym);
  if(detailChart){ detailChart.destroy(); detailChart=null; }
  const h=state.history[sym];
  const ih=state.intraday[sym];
  if(state.view.range==='1D' && ih && ih.t && ih.t.length>1){
    const labels=[], closes=[];
    for(let i=0;i<ih.t.length;i++) if(ih.c[i]!=null){ labels.push(new Date(ih.t[i]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})); closes.push(ih.c[i]); }
    detailChart = drawChart('detailChart', labels, closes, $('detailMsg'));
    wireDetailScrub(detailChart, labels, closes, 'detailRO');
  } else if(h && h.t && h.t.length>1){
    const cut=rangeCutoff(state.view.range==='1D' ? '1W' : state.view.range);
    const labels=[], closes=[];
    for(let i=0;i<h.t.length;i++){ if(h.c[i]==null) continue; const d=dayStr(h.t[i]); if(d>=cut){ labels.push(d); closes.push(h.c[i]); } }
    const today=dayStr(Date.now());
    if(labels.length && labels[labels.length-1]===today) closes[closes.length-1]=p; else { labels.push(today); closes.push(p); }
    detailChart = drawChart('detailChart', labels, closes, $('detailMsg'));
    wireDetailScrub(detailChart, labels, closes, 'detailRO');
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
  $('editSheet').innerHTML = `
    <div class="sheet-head"><div class="hsym" style="font-size:17px">Edit holdings</div><button class="xbtn" id="editX">✕</button></div>
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
    <div style="font-size:12.5px;font-weight:700;margin-top:18px">Security</div>
    <div class="ebtns"><button class="btn sec" id="lockNow">🔒 Lock now</button><button class="btn sec" id="faceTgl"></button><button class="btn sec" id="chgPass">Change passcode</button><button class="btn sec" id="cloudTgl"></button></div>
    <div style="color:var(--mut);font-size:11.5px;margin-top:6px;line-height:1.55">Your holdings are AES-256 encrypted on this device. The passcode always unlocks; Face ID is a convenience on top of it. Cloud backup keeps an encrypted copy on your own server — unreadable without your passcode, so a lost phone loses nothing.</div>
    <div style="font-size:12.5px;font-weight:700;margin-top:18px">Daily reports</div>
    <div class="ebtns"><button class="btn sec" id="pushTgl"></button><button class="btn sec" id="pushTest" style="display:none">Send test now</button></div>
    <div style="color:var(--mut);font-size:11.5px;margin-top:6px;line-height:1.55">Lock-screen notification at US market open (~15:35) and close (~22:15) with your day's dollars and biggest movers — even while the app is closed. Notifications are end-to-end encrypted.</div>
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
  $('importBtn').onclick=()=>$('importFile').click();
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
    const n=prompt('New passcode (min 6 characters)'); if(n==null) return;
    if(n.length<6){ alert('Too short — use at least 6 characters.'); return; }
    try{ await vaultChangePass(o,n); alert('Passcode changed.'); }
    catch(e){ alert('Current passcode was wrong.'); }
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
    $('pushTest').style.display = on ? '' : 'none';
  };
  paintPush();
  $('pushTgl').onclick=async()=>{
    const on=!!(lsGet('pt_push')||{}).on;
    $('pushTgl').textContent='…';
    if(on) await pushDisable(); else await pushEnable();
    paintPush();
  };
  $('pushTest').onclick=()=>{ $('pushTest').disabled=true; pushTest().finally(()=>{ $('pushTest').disabled=false; }); };
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
function exportBackup(){
  const data={ app:'portfolio-tracker', v:1, exported:new Date().toISOString(),
    holdings:state.holdings, lots:state.lots, cash:state.cash, deposits:state.deposits, confirmed:state.confirmed, ccy:state.view.ccy, watch:state.watch,
    goal:state.goal, targets:state.targets, push:lsGet('pt_push'), bk:lsGet('pt_bk') };
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
      if(d.goal&&d.goal.amt>0) state.goal=d.goal;
      if(d.targets&&typeof d.targets==='object') state.targets=d.targets;
      if(d.push&&d.push.token) lsSet('pt_push', d.push); // keeps the report server's token — same account, no re-pairing
      if(d.bk&&d.bk.k) lsSet('pt_bk', d.bk);            // keeps cloud backup armed too
      persist(); hideOverlay('editModal'); renderAll(); refreshAll(true);
      toast('Backup restored — '+state.holdings.length+' positions, '+state.lots.length+' lots.');
    }catch(e){ toast('That file is not a valid portfolio backup.', true); }
  };
  r.readAsText(file);
}
$('editModal').addEventListener('click', e=>{ if(e.target.id==='editModal') hideOverlay('editModal'); });
