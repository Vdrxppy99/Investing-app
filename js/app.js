'use strict';
/* ============ PULL TO REFRESH ============ */
function wirePTR(){
  const ptr=$('ptr'); let startY=0, pulling=false, dist=0;
  const TH=72;
  window.addEventListener('touchstart', e=>{
    if(window.scrollY>4 || state.fetching) return;
    startY=e.touches[0].clientY; pulling=true; dist=0;
  }, {passive:true});
  window.addEventListener('touchmove', e=>{
    if(!pulling) return;
    dist=e.touches[0].clientY-startY;
    if(dist<=0){ ptr.style.height='0px'; ptr.classList.remove('armed'); return; }
    const h=Math.min(TH+20, dist*0.5);
    ptr.style.height=h+'px';
    ptr.classList.toggle('armed', h>=TH*0.7);
  }, {passive:true});
  window.addEventListener('touchend', ()=>{
    if(!pulling) return; pulling=false;
    if(ptr.classList.contains('armed')){
      ptr.classList.remove('armed'); ptr.classList.add('loading'); ptr.style.height=TH*0.7+'px';
      if(!$('page-markets').classList.contains('hidden') || !$('page-following').classList.contains('hidden')) refreshMarkets(true);
      refreshAll(true).then(()=>{ ptr.classList.remove('loading'); ptr.style.height='0px'; });
    } else { ptr.style.height='0px'; }
  });
}

/* iOS 17.4+ gives web apps a native haptic tick on switch toggles — borrow it for tab taps */
let haptEl=null;
function haptic(){
  try{
    if(!haptEl){ haptEl=document.createElement('input'); haptEl.type='checkbox'; haptEl.setAttribute('switch',''); haptEl.style.cssText='position:fixed;left:-99px;opacity:0;pointer-events:none'; document.body.appendChild(haptEl); }
    haptEl.click();
  }catch(e){}
}
/* opening the app clears the icon badge — you've seen the news */
function clearBadge(){ try{ if(navigator.clearAppBadge) navigator.clearAppBadge(); }catch(e){} }
clearBadge();
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) clearBadge(); });

/* ============ PAGE SWITCHING ============ */
function showPage(p){
  if(p!=='markets' && $('searchResults')){ $('searchResults').style.display='none'; if($('mktSearch')) $('mktSearch').value=''; if($('mktSearchX')) $('mktSearchX').style.display='none'; }
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden', el.id!=='page-'+p));
  // .rail-nav__item shares this loop with .tabbar__item (desktop rail + mobile tabbar are one
  // nav, just relaid out per breakpoint). aria-current has to be kept in sync alongside .on:
  // css/layout.css's `.rail-nav__item[aria-current="page"]` rule lives in the `layout` @layer,
  // which is declared after `components` (see CLAUDE.md's @layer order), so it beats
  // `.rail-nav__item.on` from components.css regardless of source order or specificity — if
  // aria-current were left on the markup's static "Home" button forever, the rail would show
  // Home highlighted permanently no matter which tab .on actually landed on.
  document.querySelectorAll('.tabbar__item, .rail-nav__item').forEach(b=>{
    const active=b.dataset.page===p;
    b.classList.toggle('on', active);
    if(active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0,0);
  // entrance animation plays once per page per session, not on every revisit
  const pg=$('page-'+p); if(pg && !pg.classList.contains('seen')) setTimeout(()=>pg.classList.add('seen'), 450);
  // money is ALWAYS visible: tabs without their own hero pin the glass balance bar (owner
  // request); Home and Portfolio each have their own total in view, so they stay
  // scroll-triggered instead, or the pinned bar would double the number on screen
  const pin = p!=='portfolio' && p!=='home';
  document.body.classList.toggle('mbfix', pin);
  if(pin){ paintMiniBar(); $('miniBar').classList.add('show'); }
  else $('miniBar').classList.toggle('show', window.scrollY>170);
  if(p==='markets' || p==='following') refreshMarkets(false);
  if(p==='insights') renderInsights();
}
/* Tab switches use the View Transitions API (UPGRADE_PLAN.md Phase 3) — a directional
   slide matching the tabbar's left-to-right order, feature-detected so unsupported
   browsers just get the instant swap they already had. Reduced motion is handled by the
   ::view-transition-* override in base.css, not duplicated here (the transition still
   runs — the DOM still updates correctly — it just renders with no visible animation).
   UPGRADE_PLAN.md Phase R4: Home is now the landing tab, slotted in before 'markets' —
   this is the five tabs left-to-right exactly as they appear in the tabbar/rail-nav markup. */
const TAB_ORDER=['home','markets','portfolio','insights','following'];
function focusPageHeading(p){
  const id={home:'homeTitle',markets:'marketsTitle',portfolio:'pfTitle',insights:'insightsTitle',following:'followingTitle'}[p];
  const el=id&&$(id); if(el) el.focus({preventScroll:true});
}
document.querySelectorAll('.tabbar__item, .rail-nav__item').forEach(b=> b.onclick=()=>{
  haptic();
  const target=b.dataset.page;
  const current=document.querySelector('.tabbar__item.on')?.dataset.page;
  if(!document.startViewTransition || current===target){ showPage(target); focusPageHeading(target); return; }
  const dir = TAB_ORDER.indexOf(target) > TAB_ORDER.indexOf(current) ? 'forward' : 'backward';
  const vt = document.startViewTransition({ update:()=>showPage(target), types:[dir] });
  vt.finished.finally(()=>focusPageHeading(target));
});
/* one delegated tap handler per page for every symbol row/card — survives any re-render.
   Markets and Following were one 'Explore' page pre-R3; each needs its own listener now
   that they're separate elements. */
['page-markets','page-following'].forEach(id=> $(id).addEventListener('click', e=>{
  const el=e.target.closest('.mrow, .idx-card');
  if(el && el.dataset.sym) openStockSheet(el.dataset.sym, el.dataset.name||'');
}));
$('page-insights').addEventListener('click', e=>{ // look-through rows now live here too
  const el=e.target.closest('.mrow');
  if(el && el.dataset.sym) openStockSheet(el.dataset.sym, el.dataset.name||'');
});
/* swipe a bottom sheet down to dismiss it (mobile). Checks .sheet__body's
   scrollTop, not the outer .sheet's — the sheet rebuild (UPGRADE_PLAN.md R1)
   moved the actual scroll container to .sheet__body, so a drag started while
   the body is scrolled down must still scroll it rather than dismissing. */
function wireSheetDrag(sheetId, closeFn){
  const sh=$(sheetId); const body=sh.querySelector('.sheet__body');
  const scrollTop=()=> body ? body.scrollTop : 0;
  let y0=null, dy=0, dragging=false;
  sh.addEventListener('touchstart', e=>{ if(scrollTop()>2) return; y0=e.touches[0].clientY; dy=0; dragging=true; }, {passive:true});
  sh.addEventListener('touchmove', e=>{
    if(!dragging||y0==null) return;
    dy=e.touches[0].clientY-y0;
    if(dy>0 && scrollTop()<=2) sh.style.transform=`translateY(${dy}px)`;
  }, {passive:true});
  sh.addEventListener('touchend', ()=>{
    if(!dragging) return; dragging=false;
    sh.style.transition='transform .2s ease';
    if(dy>110){ sh.style.transform='translateY(110%)'; setTimeout(()=>{ closeFn(); sh.style.transform=''; sh.style.transition=''; }, 190); }
    else { sh.style.transform=''; setTimeout(()=>sh.style.transition='', 210); }
  });
}
wireSheetDrag('detailSheet', closeDetail);
wireSheetDrag('editSheet', ()=>$('editModal').classList.add('hidden'));
wireSearch(); wirePTR();
/* #divTitle lived on #incomeCard, which left the Portfolio screen in R1 (see
   renderIncome's comment) — no trigger element for openDivSheet exists until
   R4 gives dividends a home on Insights or Home. */
if($('divTitle')) $('divTitle').onclick=openDivSheet;
$('healthCard').onclick=openHealthSheet;
$('sectorCard').onclick=openSectorSheet;
/* taxCard/peCard/riskCard/locCard no longer exist as static elements (R2 —
   UPGRADE_PLAN.md — folded into #modGrid tiles and #moreList disclose rows).
   Their onclick wiring now happens where they're built: renderModGrid() and
   renderMoreList() in js/insights.js. */

/* ============ WIRING ============ */
function ringSvg(pct, color, r){
  const R=r||46, C=2*Math.PI*R, off=C*(1-Math.min(1,Math.max(0,pct)));
  return `<svg width="${(R+8)*2}" height="${(R+8)*2}" viewBox="0 0 ${(R+8)*2} ${(R+8)*2}">
    <circle class="rc" cx="${R+8}" cy="${R+8}" r="${R}"/>
    <circle class="rp" cx="${R+8}" cy="${R+8}" r="${R}" style="stroke:${color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/></svg>`;
}
/* Goal left the Portfolio screen in R1 (DESIGN-TARGET.md — it belongs on Home)
   and lands there for real in R4: #goalCard/#goalBody now live on Home, and
   the old ring gauge is replaced by a flat .goalbar (DESIGN-TARGET's Home
   frame shows a progress bar, not a ring — the ring stays defined in
   css/components.css since healthScore()'s .hscore ring still uses it) with
   the percentage moved out to #goalPct, the "sec" header's trailing value,
   matching every other Home section (#moverTotal, #homePr). Same underlying
   math as before — totals(), personalReturn(), the monthly-compounding ETA
   loop — none of it changed. */
function renderGoalForm(prefill){ // shared by first-time setup and "Change goal" (prefilled — never lose the number)
  const body=$('goalBody'); const pctEl=$('goalPct'); if(!body) return;
  if(pctEl) pctEl.textContent='';
  body.innerHTML=`<div class="goalset">
    <p class="t-caption muted">Set a target and track your progress with a projected finish date based on your real return.</p>
    <input id="goalInput" type="number" inputmode="decimal" placeholder="Target amount, e.g. 100000" aria-label="Goal amount"${prefill>0?` value="${prefill}"`:''}>
    <button class="btn pri btn--full" id="goalSave">${prefill>0?'Update goal':'Set goal'}</button>
    ${prefill>0?'<div class="ebtns"><button class="btn sec" id="goalCancel">Cancel</button><button class="btn warn" id="goalRemove">Remove goal</button></div>':''}</div>`;
  $('goalSave').onclick=()=>{ const v=+$('goalInput').value; if(v>0){ state.goal={amt:v}; lsSet('pt_goal',state.goal); renderGoal(); if(typeof renderProjection==='function' && !$('page-insights').classList.contains('hidden')) renderProjection(); } };
  const gc=$('goalCancel'); if(gc) gc.onclick=renderGoal;
  const gr=$('goalRemove'); if(gr) gr.onclick=()=>{ state.goal=null; lsSet('pt_goal',null); renderGoal(); };
}
function renderGoal(){
  const body=$('goalBody'); const pctEl=$('goalPct'); if(!body) return;
  const t=totals('all');
  if(!state.goal || !(state.goal.amt>0)){ renderGoalForm(0); return; }
  const goal=state.goal.amt, pctRaw=t.value/goal, remain=goal-t.value;
  const rr=personalReturn('all'); const r=(rr!=null&&rr>0.005)?Math.min(rr,0.15):0.08; // cap optimism
  let eta='';
  if(remain>0){
    // months for TODAY'S money alone to compound to the goal — no future deposits assumed (owner request)
    const rm=Math.pow(1+r,1/12)-1; let v=t.value, m=0;
    while(v<goal && m<720){ v=v*(1+rm); m++; }
    const yr=new Date(); yr.setMonth(yr.getMonth()+m);
    eta = (m<720 && t.value>0) ? yr.toLocaleDateString([],{month:'short',year:'numeric'}) : '—';
  } else { eta='Reached'; }
  if(pctEl) pctEl.textContent=(pctRaw*100).toFixed(0)+'%';
  body.innerHTML=`<div class="stack stack--tight">
    <div class="goalrow"><span>${fmt(t.value)} of ${fmt(goal)}</span><span>${eta}</span></div>
    <div class="goalbar"><i></i></div>
    <p class="t-caption muted">${remain>0?fmt(remain)+' to go — every new buy pulls that date closer. ':fmt(-remain)+' past target. '}<a href="#" id="goalEdit">Change goal</a></p>
  </div>`;
  body.querySelector('.goalbar > i').style.setProperty('--w', (Math.min(1,pctRaw)*100).toFixed(1)+'%');
  $('goalEdit').onclick=e=>{ e.preventDefault(); renderGoalForm(goal); };
}
function healthScore(){
  const rs=rows('all'), t=totals('all'), inv=Math.max(1,t.value-cashFor('all'));
  const metrics=[];
  // 1. Diversification — broad index funds ARE diversification; only single companies count as concentration
  const singles=rs.filter(r=>!DIVERSIFIED_FUNDS.has(r.sym)).map(r=>({sym:r.sym, w:r.qty*priceOf(r.sym)/inv})).sort((a,b)=>b.w-a.w);
  const top=singles.length?singles[0].w:0;
  const divScore=Math.max(0,Math.min(100, 100-(top-0.10)*250));
  metrics.push({k:'Diversification', v:divScore,
    detail: top>0?`Biggest single stock ${(top*100).toFixed(0)}%`:'No concentrated bets',
    tip: top>0.15?`${singles[0].sym.replace('-','.')} alone is ${(top*100).toFixed(0)}% of the portfolio — index funds can't protect you from one company's bad decade.`:null});
  // 2. Global exposure — reward international 20-45%
  const intl=rs.filter(r=>r.sym==='VXUS').reduce((a,r)=>a+r.qty*priceOf(r.sym),0)/inv;
  const gScore=intl<0.05?35:intl<0.15?70:intl<=0.45?100:80;
  metrics.push({k:'Global exposure', v:gScore, detail:`${(intl*100).toFixed(0)}% international`, tip: intl<0.10?`Only ${(intl*100).toFixed(0)}% international — most advisors suggest 20-40% for diversification.`:null});
  // 3. Fees — reward low weighted expense ratio
  let fee=0,val=0; for(const r of rs){ const m=FUND_META[r.sym]; const v=r.qty*priceOf(r.sym); val+=v; if(m) fee+=v*m.er/100; }
  const er=val>0?fee/val*100:0;
  const feeScore=Math.max(0,Math.min(100,100-(er-0.03)*400));
  metrics.push({k:'Cost efficiency', v:feeScore, detail:`${er.toFixed(3)}% avg fee`, tip: er>0.15?`Your blended fee is ${er.toFixed(2)}%/yr — check whether the advised account's cost is worth it.`:null});
  // 4. Cash drag — penalize idle cash
  const cashPct=cashFor('all')/Math.max(1,t.value);
  const cashScore=cashPct<0.02?100:cashPct<0.05?85:cashPct<0.1?60:35;
  metrics.push({k:'Cash deployed', v:cashScore, detail:`${(cashPct*100).toFixed(1)}% in cash`, tip: cashPct>0.05?`${(cashPct*100).toFixed(0)}% sitting in cash is a drag on long-term growth.`:null});
  const score=Math.round(metrics.reduce((a,m)=>a+m.v,0)/metrics.length);
  return {score, metrics};
}
/* DESIGN-TARGET.md / five-tabs.html frame 4: ring is always brand-indigo and
   the grade letter is plain text — green/red are reserved for gain/loss
   figures, and a composite A–F grade is neither. Below the ring: one sentence
   naming the single weakest metric (the lowest-scoring one with a tip), not
   the old 4-bar breakdown — that full breakdown still lives one tap away in
   openHealthSheet(), unchanged. */
function renderHealth(){
  const {score,metrics}=healthScore();
  const grade=score>=85?'A':score>=75?'B':score>=65?'C':score>=50?'D':'F';
  const weakest=metrics.filter(m=>m.tip).sort((a,b)=>a.v-b.v)[0];
  const oneLiner=weakest?weakest.tip:'Diversification, global mix, cost and cash deployment are all strong — nothing is holding the grade down.';
  $('healthBody').innerHTML=`
    <div class="hsplit">
      <div class="hscore">${ringSvg(score/100, cvar('--brand'), 40)}<div class="rt"><b>${grade}</b><span>${score}/100</span></div></div>
      <div class="hgrade"><div class="hg">Portfolio health</div>
        <div class="hd">${oneLiner}</div></div>
    </div>`;
}
/* Movers left the Portfolio screen in R1 (DESIGN-TARGET.md — attribution
   belongs on Home) and lands there for real in R4. Two pieces owed from R1
   (UPGRADE_PLAN.md's R4 note) land here too, since this is that section's
   front door: #moverTotal (the section header's trailing value, matching
   every other Home "sec") and #moverNarrative, the "vs S&P 500 today" line
   that also used to live on the Portfolio hero — same comparison formula as
   maybeShowRecap() below (voo.price/voo.prev-1 vs dayPct), not reinvented. */
function renderMover(){ // day-change attribution: which holdings drove today's move
  const card=$('moverCard'); const totalEl=$('moverTotal'), narrEl=$('moverNarrative'); if(!card) return;
  const rs=rows(state.view.acc);
  const items=rs.map(r=>{
    const p=priceOf(r.sym), pv=prevOf(r.sym); if(!(pv>0)||!(p>0)) return null;
    return {sym:r.sym, pct:(p/pv-1)*100, impact:r.qty*(p-pv)};
  }).filter(x=>x && Math.abs(x.pct)>=0.01).sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));
  if(!items.length){ card.style.display='none'; if(totalEl) totalEl.textContent=''; if(narrEl) narrEl.textContent=''; return; }
  card.style.display='';
  const tot=items.reduce((a,x)=>a+x.impact,0);
  const totAbs=items.reduce((a,x)=>a+Math.abs(x.impact),0);
  if(totalEl) totalEl.innerHTML=`<span class="${cls(tot)}">${fmtSign(tot)}</span>`;
  if(narrEl){
    const t=totals(state.view.acc);
    const dayPct=(t.value-t.day)>0 ? t.day/(t.value-t.day)*100 : 0;
    const voo=state.quotes.VOO, sp=(voo&&voo.prev>0)?(voo.price/voo.prev-1)*100:null;
    narrEl.textContent = sp!=null ? `${dayPct-sp>=0?'Ahead of':'Behind'} the S&P 500 today by ${Math.abs(dayPct-sp).toFixed(2)}%.` : '';
  }
  $('moverBody').innerHTML = items.slice(0,3).map(x=>{
    const share = totAbs>0 ? Math.round(Math.abs(x.impact)/totAbs*100) : 0;
    return `<div class="mrow" data-sym="${esc(x.sym)}">${badgeHtml(x.sym,true)}
      <div class="mmid"><div class="msym">${esc((NAMES[x.sym]||x.sym.replace('-','.')).replace(/^Vanguard /,''))}</div><div class="mname">drove ${share}% of today's move</div></div>
      <div class="mright"><span class="pctpill ${x.pct>=0?'up':'down'}">${fmtPct(x.pct)}</span><div class="msub">${fmtSign(x.impact)}</div></div></div>`;
  }).join('');
  $('moverBody').querySelectorAll('.mrow').forEach(el=> el.onclick=()=>openDetail(el.dataset.sym));
}
/* ============ HOME (R4) ============
   The glance screen. No new maths anywhere below — every figure is computed
   by a function that already existed elsewhere; this section just gives each
   one a render target on the new landing tab. */
function homeGreeting(){ // time-of-day only, deliberately — no display-name field exists anywhere else in the app (js/vault.js's DEFAULT_USER is a login credential, not a profile name), and this is public source in a GitHub Pages repo
  const h=new Date().getHours();
  return h<12?'Good morning':h<18?'Good afternoon':'Good evening';
}
/* "Markets open/close in XhYm" — chrome, not a financial figure, so it isn't
   bound by the golden master. Same weekend/holiday-aware walk marketOpen()/
   lastCloseKey() already use, same lack of full DST rigor as they have. */
function marketCountdownText(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date());
  const g=t=>parts.find(p=>p.type===t).value;
  const wd=g('weekday'), nowMin=+g('hour')*60 + +g('minute');
  const dow={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[wd];
  const isTrading=x=>{ const d=x.getUTCDay(); return d!==0 && d!==6 && !US_MARKET_HOLIDAYS.has(x.toISOString().slice(0,10)); };
  const today=new Date(`${g('year')}-${g('month')}-${g('day')}T00:00:00Z`);
  const todayTrading = dow>=1 && dow<=5 && isTrading(today);
  if(todayTrading && nowMin>=570 && nowMin<960){
    const left=960-nowMin;
    return `Markets close in ${Math.floor(left/60)}h ${left%60}m`;
  }
  let d=new Date(today);
  if(!(todayTrading && nowMin<570)) do{ d.setUTCDate(d.getUTCDate()+1); }while(!isTrading(d));
  const daysAhead=Math.round((d-today)/86400000);
  const left = 570-nowMin + daysAhead*1440;
  return `Markets open in ${Math.floor(left/60)}h ${left%60}m`;
}
function renderHomeChrome(){
  const g=$('homeGreet'), c=$('homeCountdown');
  if(g) g.textContent=homeGreeting();
  if(c) c.textContent=marketCountdownText();
}
/* 62px sparkline for the Home card — modeled on design/target/five-tabs.html's
   P()/big() reference (same cubic-bezier path builder), but reading real data
   (buildSeries('all') sliced to 1M, the shortest range with 2+ baked points —
   see test/smoke.spec.js) instead of a hardcoded array, and the live --primary
   token via the var()-in-SVG-attribute convention spark() (js/core.js) already
   uses, instead of a literal hex. One brand colour, not --green/--red: gain/
   loss already reads from the sign on #homeToday, matching R1/Phase-3's "never
   colour alone" rule for the hero chart. */
function renderHomeSpark(){
  const svg=$('homeSpark'); if(!svg) return;
  const s=buildSeries('all'); const A=s?sliceRange(s,'1M').value:[];
  if(A.length<2){ svg.innerHTML=''; return; }
  const w=304, h=62;
  const lo=Math.min(...A), hi=Math.max(...A), sp=(hi-lo)||1;
  const X=i=>i*w/(A.length-1), Y=v=>(1-(v-lo)/sp)*h;
  let d=`M${X(0).toFixed(1)} ${Y(A[0]).toFixed(1)}`;
  for(let i=1;i<A.length;i++){ const a=X(i-1),b=Y(A[i-1]),c=X(i),e=Y(A[i]),m=(a+c)/2;
    d+=` C${m.toFixed(1)} ${b.toFixed(1)},${m.toFixed(1)} ${e.toFixed(1)},${c.toFixed(1)} ${e.toFixed(1)}`; }
  svg.innerHTML = `<defs><linearGradient id="homeSparkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--primary)" stop-opacity=".26"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#homeSparkGrad)"/>
    <path d="${d}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="${X(A.length-1).toFixed(1)}" cy="${Y(A[A.length-1]).toFixed(1)}" r="3.2" fill="var(--primary)"/>`;
}
function renderHomeCard(){
  const el=$('homeTotal'); if(!el) return;
  const t=totals(state.view.acc);
  const dayPct=(t.value-t.day)>0 ? t.day/(t.value-t.day)*100 : 0;
  el.textContent=fmt(t.value);
  const arrow=t.day>=0?'▲':'▼';
  $('homeToday').innerHTML=`<span class="${cls(t.day)} n">${arrow} ${fmtSign(t.day)} · ${fmtPct(dayPct)}</span><span class="hero__alltime">today</span>`;
  renderHomeSpark();
  renderAllocStrip('homeAllocStrip');
}
/* "Coming up" duplicates renderIncome()'s (js/portfolio.js) "upcoming" loop
   rather than refactoring it into a shared helper — same math, a second
   presentation surface (#incomeCard still doesn't exist; this doesn't touch
   it), not new maths, and not worth the risk of reshaping code that already
   works to avoid ~8 duplicated lines. */
function renderComingUp(){
  const sec=$('comingSection'); const body=$('comingBody'); if(!body) return;
  const upcoming=[];
  for(const r of rows(state.view.acc)){
    const d=state.divs[r.sym]; if(!d||!d.list||!d.list.length) continue;
    const yr=d.list.filter(e=>e[0]>Date.now()-370*86400e3);
    for(const e of yr){
      const next=e[0]+31557600000; // same payout, one year later
      if(next>Date.now() && next<Date.now()+180*86400e3) upcoming.push({sym:r.sym, when:next, est:r.qty*e[1]});
    }
  }
  upcoming.sort((a,b)=>a.when-b.when);
  if(!upcoming.length){ if(sec) sec.style.display='none'; ensureDivs(); return; }
  if(sec) sec.style.display='';
  body.innerHTML = upcoming.slice(0,3).map(u=>{
    const days=Math.max(0,Math.ceil((u.when-Date.now())/86400000));
    return `<div class="drow" data-sym="${esc(u.sym)}">${badgeHtml(u.sym,true)}
      <div class="mmid"><div class="msym">Dividend · ex-div ${new Date(u.when).toLocaleDateString([],{month:'short',day:'numeric'})}</div><div class="mname">estimated ${fmt(u.est)}</div></div>
      <div class="mright"><span class="chip chip--primary">${days}d</span></div></div>`;
  }).join('');
  body.querySelectorAll('.drow').forEach(el=> el.onclick=()=>openDetail(el.dataset.sym));
}
$('homeAllocStrip').onclick = openAllocSheet;
/* renderMover/renderGoal/renderIncome are still called here — renderIncome()
   still no-ops (see its own guard: #incomeCard was never rebuilt, Home's
   renderComingUp() covers that ground instead) while renderMover()/renderGoal()
   now paint Home for real. renderAlloc() likewise no-ops unless the allocation
   sheet is open — renderAllocStrip() (called from renderList() and
   renderHomeCard()) is what actually paints the always-visible strips. */
function renderAll(){
  renderMover(); renderGoal(); renderStale(); renderHeader(); renderChips(); renderList(); renderChart(); renderAlloc(); renderIncome(); setStatus();
  renderHomeChrome(); renderHomeCard(); renderHomePr(); renderComingUp();
  if(!$('page-insights').classList.contains('hidden')) renderInsights();
  if(!$('page-markets').classList.contains('hidden')) renderMarkets();
  if(!$('page-following').classList.contains('hidden')) renderFollowing();
}
$('benchBtn').onclick = ()=>{ // cycle: off → S&P 500 → Total World → Nasdaq 100 → off
  const next = state.view.bench==='off' ? 'VOO' : state.view.bench==='VOO' ? 'VT' : state.view.bench==='VT' ? 'QQQ' : 'off';
  state.view.bench=next; lsSet('pt_bench', next);
  if(next==='VT'||next==='QQQ') ensureBenchHistory(next).then(ok=>{ if(ok) renderChart(); });
  renderChart();
};
$('metricSeg').querySelectorAll('button').forEach(b=>{
  b.classList.toggle('on', b.dataset.m===state.view.metric); // sync highlight to the saved/default metric
  b.onclick=()=>{ state.view.metric=b.dataset.m; lsSet('pt_metric',b.dataset.m); $('metricSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); renderChart(); };
});
$('rangeSeg').querySelectorAll('button').forEach(b=> b.onclick=()=>{ state.view.range=b.dataset.r; $('rangeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); renderChart(); });
$('ccyBtn').onclick = ()=>{ state.view.ccy = state.view.ccy==='USD'?'EUR':'USD'; lsSet('pt_ccy',state.view.ccy); renderAll(); };
/* privacy mode — mask YOUR dollar amounts (••••••), keep percentages + market prices */
const EYE_OPEN = `<svg viewBox="0 0 24 24"><path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z"/><circle cx="12" cy="12" r="3.2"/></svg>`;
const EYE_OFF  = `<svg viewBox="0 0 24 24"><path d="M10.6 5.1A11.3 11.3 0 0 1 12 5c7 0 11 7 11 7a18.4 18.4 0 0 1-2.2 3.2M6.6 6.6C3.4 8.6 1 12 1 12s4 7.5 11 7.5a11 11 0 0 0 5.4-1.4"/><path d="M9.9 9.9a3.2 3.2 0 0 0 4.5 4.5"/><path d="M3 3l18 18"/></svg>`;
function paintPriv(){
  $('privBtn').innerHTML = state.view.priv ? EYE_OFF : EYE_OPEN;
  $('privBtn').title = state.view.priv ? 'Show amounts' : 'Hide amounts';
}
$('privBtn').onclick = ()=>{
  state.view.priv=!state.view.priv; lsSet('pt_priv', state.view.priv);
  paintPriv(); renderAll();
};
paintPriv();
$("themeBtn").innerHTML = document.documentElement.dataset.theme==="dark" ? `<svg viewBox='0 0 24 24'><path d='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'/></svg>` : `<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='4'/><path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/></svg>`;
$('themeBtn').onclick = ()=>{
  const t = document.documentElement.dataset.theme==='dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; lsSet('pt_theme', t);
  $("themeBtn").innerHTML = t==="dark" ? `<svg viewBox='0 0 24 24'><path d='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'/></svg>` : `<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='4'/><path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/></svg>`;
  document.querySelector('meta[name=theme-color]').setAttribute('content', t==='dark' ? '#0b0f0d' : '#f3f7f4');
  renderAll(); // charts re-read the tokens
};
function animateTotal(){ // one-time count-up on launch
  if(state.view.priv) return; // nothing to count up behind the mask
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return; // final number is already on screen
  const el=$('tvNum'); if(!el) return;
  const target=totals(state.view.acc).value; if(!(target>0)) return;
  const t0=performance.now(), from=target*0.962;
  (function tick(now){
    const k=Math.min(1,(now-t0)/700), e=1-Math.pow(1-k,3);
    const cur=$('tvNum'); if(!cur) return;
    cur.textContent=fmt(from+(target-from)*e);
    if(k<1) requestAnimationFrame(tick);
  })(t0);
}
/* Number roll-up on value change (UPGRADE_PLAN.md Phase 3) — renderHeader() calls this
   every time it renders; it only actually animates when the total moved from what was
   last shown (a live price tick), never on the very first render (animateTotal() above
   owns the launch count-up) and never behind the privacy mask or reduced motion. Duration
   comes from --dur-data (tokens.css) — the token named for exactly this kind of change,
   not a new one. */
let _tvLastValue = null;
function rollUpTvNum(target){
  const prev = _tvLastValue;
  _tvLastValue = target;
  if(prev==null || prev===target) return;
  if(state.view.priv) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dur = parseFloat(cvar('--dur-data')) || 0; if(!(dur>0)) return;
  const t0=performance.now();
  (function tick(now){
    const k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,3);
    const cur=$('tvNum'); if(!cur) return;
    cur.textContent=fmt(prev+(target-prev)*e);
    if(k<1) requestAnimationFrame(tick);
  })(t0);
}
$('editBtn').onclick = openEdit;
$('refreshBtn').onclick = ()=>refreshAll(true);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ refreshQuotesOnly(); schedulePoll(); } });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeDetail(); hideOverlay('editModal'); } });

/* glass mini-bar: compact balance appears when the header scrolls away */
function paintMiniBar(){
  const t=totals(state.view.acc);
  const dayPct=(t.value-t.day)>0 ? t.day/(t.value-t.day)*100 : 0;
  $('mbVal').textContent=fmt(t.value);
  const d=$('mbDay'); d.textContent=`${fmtSign(t.day)} · ${fmtPct(dayPct)}`;
  d.className='daypill '+(t.day>=0?'up':'down');
}
let mbTick=false;
/* R1 shortened the Portfolio hero+chart block a lot (mover/goal/dividends/the
   allocation donut all left for Home/R4), so a hardcoded 170px threshold — sized
   for the OLD, much taller layout — now fires while the range segmented control
   or the allocation strip is still on screen, and the fixed top bar covers them:
   real, reproducible click-interception (caught by Phase 0's smoke suite driving
   #rangeSeg). Measure the actual bottom edge of the hero composition instead of
   guessing a new constant, so this stays correct as that block's height changes
   again in later phases. #allocStrip is the last element of that composition
   before the holdings list. */
function miniBarThreshold(){
  const marker = $('allocStrip');
  return marker ? marker.getBoundingClientRect().bottom + window.scrollY : 170;
}
window.addEventListener('scroll', ()=>{
  if(mbTick) return; mbTick=true;
  setTimeout(()=>{
    mbTick=false;
    if($('page-portfolio').classList.contains('hidden')) return; // other tabs keep the bar pinned (showPage owns it)
    const show=window.scrollY>miniBarThreshold() && !document.body.classList.contains('locked');
    if(show) paintMiniBar();
    $('miniBar').classList.toggle('show', show);
  }, 80);
}, {passive:true});
$('miniBar').onclick=()=>{
  if($('page-portfolio').classList.contains('hidden')) showPage('portfolio'); // tap the balance → jump home
  else window.scrollTo({top:0,behavior:'smooth'});
};

(function(){ const h=new Date().getHours();
  const g = h<5?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  document.querySelector('.brand').innerHTML = g+`<span class="bdate"> · ${new Date().toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}</span>`;
})();
renderAll();
animateTotal();
if(typeof wireAi==='function') wireAi(); // floating chat assistant — available on every page
if(window.DEMO_MODE){ const db=document.getElementById('demoBadge'); if(db) db.onclick=window.exitDemo; } // tap the DEMO badge to leave
setTimeout(()=>$('page-portfolio').classList.add('seen'), 600); // launch animation played — don't replay on tab returns
(function(){ // quiet "you got the new version" note after an auto-update (version read from the footer — no extra bump site)
  const m=document.querySelector('.foot'), v=m&&(m.textContent.match(/v(\d+\.\d+)/)||[])[1];
  if(!v) return;
  const seen=lsGet('pt_ver');
  if(seen && seen!==v) setTimeout(()=>toast('Updated to v'+v+' ✓'), 1100);
  lsSet('pt_ver', v);
})();
refreshAll(false).then(schedulePoll);
setInterval(()=>{ if(!state.fetching) setStatus(); }, 1000);
/* ---- bulletproof auto-update ----
   updateViaCache:'none' forces the browser to fetch sw.js fresh every check (never from
   its HTTP cache) — without this, a cached sw.js hides new versions and the app goes stale.
   When a new worker takes control we reload once so the new code shows immediately. */
if('serviceWorker' in navigator){
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(reloading) return; reloading=true; location.reload();
  });
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).then(reg=>{
      reg.update();
      // re-check for a new version whenever the app comes back to the foreground
      document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) reg.update(); });
      setInterval(()=>reg.update(), 60*60*1000); // and hourly while open
    }).catch(()=>{});
  });
}

/* ============ MARKET OPEN & CLOSE OVERVIEWS ============
   The "daily update message" ×2, delivered the no-server way: the first time the
   app is opened during market hours you get the OPEN overview (how the day is
   starting), and the first open after 4pm ET you get the CLOSE overview — both
   built from the drivers math. Once per event, per day. */
function etParts(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit'}).formatToParts(new Date());
  const g=t=>p.find(x=>x.type===t).value;
  return { wd:g('weekday'), h:+g('hour'), iso:`${g('year')}-${g('month')}-${g('day')}` };
}
function lastCloseKey(){ // YYYY-MM-DD of the most recently COMPLETED US trading day (weekend + holiday aware)
  const {wd,h,iso}=etParts();
  const d=new Date(iso+'T00:00:00Z');
  const isTrading=x=>{ const g=x.getUTCDay(); return g!==0 && g!==6 && !US_MARKET_HOLIDAYS.has(x.toISOString().slice(0,10)); };
  const dow={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[wd];
  if(dow>=1 && dow<=5 && h>=16 && isTrading(d)) return d.toISOString().slice(0,10);
  do{ d.setUTCDate(d.getUTCDate()-1); }while(!isTrading(d));
  return d.toISOString().slice(0,10);
}
function maybeShowMonthlyRecap(){
  // "Your June in review" — once, on the first open of a new month (skips if the month's half over)
  if(lsGet('pt_recap_off')) return;
  if(document.body.classList.contains('locked')) return;
  if(!$('detail').classList.contains('hidden') || !$('editModal').classList.contains('hidden')) return;
  const now=new Date();
  const ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  if(lsGet('pt_recap_month')===ym) return;
  if(now.getDate()>14){ lsSet('pt_recap_month', ym); return; }
  if(!state.lots.length) return;
  const md=typeof monthlyDietzReturns==='function' ? monthlyDietzReturns() : null;
  const p0=new Date(now.getFullYear(), now.getMonth()-1, 1);
  const pm=p0.getFullYear()+'-'+String(p0.getMonth()+1).padStart(2,'0');
  if(!md || md.ret[pm]==null) return;             // needs a full prior month of history
  const pct=md.ret[pm];
  // dollar gain = V1 − V0 − deposits (same window the heatmap uses)
  const s=buildSeries('all'); const eom={};
  for(let i=0;i<s.labels.length;i++) eom[s.labels[i].slice(0,7)]=s.value[i];
  const months=Object.keys(eom).sort(), pi=months.indexOf(pm);
  let divs=0, deps=0;
  for(const l of state.lots){ if(l.date.slice(0,7)!==pm) continue; if(l.div) divs+=l.cost; else deps+=l.cost; }
  const gain = pi>0 ? eom[pm]-eom[months[pi-1]]-deps : null;
  const perf=[];
  for(const r of rows('all')){
    const h=state.history[r.sym]; if(!h||!h.t||h.t.length<40) continue;
    let a=null,b=null;
    for(let i=0;i<h.t.length;i++){ const mm=dayStr(h.t[i]).slice(0,7);
      if(mm===months[pi-1]) a=h.c[i]; else if(mm===pm) b=h.c[i]; }
    if(a>0&&b>0) perf.push({sym:r.sym, pct:(b/a-1)*100});
  }
  perf.sort((x,y)=>y.pct-x.pct);
  const best=perf[0], worst=perf[perf.length-1];
  const sp=perf.find(x=>x.sym===benchSym()) || perf.find(x=>x.sym==='VOO');
  const mName=p0.toLocaleDateString([], now.getFullYear()!==p0.getFullYear() ? {month:'long',year:'numeric'} : {month:'long'});
  const krow=(k,v)=>`<div class="krow"><span class="k">${k}</span><span>${v}</span></div>`;
  openInfoSheet(`Your ${mName} in review`, `
    <div style="font-size:28px;font-weight:800;margin:4px 0 2px" class="${cls(gain!=null?gain:pct)}">${gain!=null?fmtSign(gain):fmtPct(pct)}</div>
    <p style="margin-top:4px">Your investments ${pct>=0?'returned':'gave back'} <b class="${cls(pct)}">${fmtPct(pct)}</b> in ${mName}${sp?` — the S&P 500 did ${fmtPct(sp.pct)}`:''}.</p>
    ${best?krow('Best fund',`<b class="pos">${best.sym.replace('-','.')} ${fmtPct(best.pct)}</b>`):''}
    ${worst&&perf.length>1?krow('Toughest fund',`<b class="${cls(worst.pct)}">${worst.sym.replace('-','.')} ${fmtPct(worst.pct)}</b>`):''}
    ${divs>0?krow('Dividends collected',`<b class="pos">${fmt(divs)}</b>`):''}
    ${deps>0?krow('New money invested',`<b>${fmt(deps)}</b>`):''}
    ${state.goal&&state.goal.amt>0?krow('Goal progress',`<b>${Math.min(100,totals('all').value/state.goal.amt*100).toFixed(0)}%</b>`):''}
    <div class="inc-note" style="margin-top:14px">Shows once a month. Return is deposit-adjusted — it measures the market, not your contributions.</div>`);
  lsSet('pt_recap_month', ym);
}
function maybeShowRecap(){
  if(lsGet('pt_recap_off')) return;
  if(document.body.classList.contains('locked')) return;
  if(!$('detail').classList.contains('hidden') || !$('editModal').classList.contains('hidden')) return; // don't interrupt
  if(!state.live) return;                // need fresh prices to tell the truth
  const open=marketOpen();
  const day = open ? etParts().iso : lastCloseKey();
  const key = day + (open ? '-open' : '-close');
  if(lsGet('pt_recap_last')===key) return;
  const rs=rows('all'); if(!rs.length) return;
  if(!open){ // for a close recap the quotes must actually be from that close day
    const newest=Math.max(...uniqSyms().map(s=>state.quotes[s]?state.quotes[s].ts:0));
    if(dayStr(newest)<day) return;
  }
  const t=totals('all');
  const dayPct=(t.value-t.day)>0 ? t.day/(t.value-t.day)*100 : 0;
  const items=rs.map(r=>{ const pv=prevOf(r.sym), pc=priceOf(r.sym);
    if(!(pv>0&&pc>0)) return null; return {sym:r.sym, pct:(pc/pv-1)*100, imp:r.qty*(pc-pv)}; }).filter(Boolean);
  const ups=items.filter(x=>x.imp>0).sort((a,b)=>b.imp-a.imp).slice(0,3);
  const dns=items.filter(x=>x.imp<0).sort((a,b)=>a.imp-b.imp).slice(0,3);
  const voo=state.quotes.VOO, sp=(voo&&voo.prev>0)?(voo.price/voo.prev-1)*100:null;
  const row=x=>`<div class="krow"><span class="k">${esc(x.sym.replace('-','.'))}</span>
    <span><span class="${cls(x.imp)}">${fmtSign(x.imp)}</span> <span class="pctpill ${x.pct>=0?'up':'down'}" style="font-size:10px">${fmtPct(x.pct)}</span></span></div>`;
  const nice=new Date(day+'T12:00:00').toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});
  const vsSp = sp!=null ? ` — ${dayPct-sp>=0?'ahead of':'behind'} the S&P 500 (${fmtPct(sp)}) by ${Math.abs(dayPct-sp).toFixed(2)}%` : '';
  openInfoSheet((open?'Markets open · ':'Market close · ')+nice, `
    <div style="font-size:28px;font-weight:800;margin:4px 0 2px" class="${cls(t.day)}">${fmtSign(t.day)}</div>
    <p style="margin-top:4px">${open
      ? `Your portfolio is <b class="${cls(t.day)}">${fmtPct(dayPct)}</b> so far today at <b>${fmt(t.value)}</b>${vsSp}.`
      : `Your portfolio closed <b class="${cls(t.day)}">${fmtPct(dayPct)}</b> at <b>${fmt(t.value)}</b>${vsSp}.`}</p>
    ${ups.length?`<div style="font-weight:700;font-size:13px;margin-top:14px">Top movers</div>${ups.map(row).join('')}`:''}
    ${dns.length?`<div style="font-weight:700;font-size:13px;margin-top:14px">Laggards</div>${dns.map(row).join('')}`:''}
    <div class="inc-note" style="margin-top:14px">Shows once at each market open and close. <a href="#" id="recapOff" style="color:var(--mut)">Don't show automatically</a></div>`);
  const off=$('recapOff'); if(off) off.onclick=e=>{ e.preventDefault(); lsSet('pt_recap_off',true); closeDetail(); };
  lsSet('pt_recap_last', key);
}
