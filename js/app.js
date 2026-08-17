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
    if(!haptEl){ haptEl=document.createElement('input'); haptEl.type='checkbox'; haptEl.setAttribute('switch',''); haptEl.setAttribute('aria-hidden','true'); haptEl.tabIndex=-1; haptEl.style.position='fixed'; haptEl.style.left='-99px'; haptEl.style.opacity='0'; haptEl.style.pointerEvents='none'; document.body.appendChild(haptEl); }
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
  // .krow (js/explore.js renderMarkets' #sectorRow) had data-sym/data-name from its
  // first commit but no handler anywhere, wired or delegated — looked tappable, did
  // nothing, for everyone, not just keyboard users (UPGRADE_PLAN.md Phase 4).
  const el=e.target.closest('.mrow, .idx-card, .krow');
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
wireSheetDrag('editSheet', ()=>hideOverlay('editModal'));
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
   matching every other Home section (#moverTotal, #homePr).
   Phase 6: the deterministic "compound today's money at your trailing return"
   ETA is gone. state.goal now carries a target `year`, required to ask a
   probability question at all ("82% chance of reaching $X by 2045" needs a
   "by"). Existing saved goals from before this phase have amt but no year —
   renderGoal() below treats that the same as "goal set, date missing" and
   asks for one, rather than guessing. */
function renderGoalForm(prefillAmt, prefillYear){ // shared by first-time setup and "Change goal" (prefilled — never lose the numbers)
  const body=$('goalBody'); const pctEl=$('goalPct'); if(!body) return;
  if(pctEl) pctEl.textContent='';
  const nowYear=new Date().getFullYear();
  body.innerHTML=`<div class="goalset">
    <p class="t-caption muted">Set a target and target year to see your odds of getting there.</p>
    <input id="goalInput" type="number" inputmode="decimal" placeholder="Target amount, e.g. 100000" aria-label="Goal amount"${prefillAmt>0?` value="${prefillAmt}"`:''}>
    <input id="goalYearInput" type="number" inputmode="numeric" step="1" placeholder="Target year, e.g. ${nowYear+15}" aria-label="Target year"${prefillYear>0?` value="${prefillYear}"`:''}>
    <button class="btn pri btn--full" id="goalSave">${prefillAmt>0?'Update goal':'Set goal'}</button>
    ${prefillAmt>0?'<div class="ebtns"><button class="btn sec" id="goalCancel">Cancel</button><button class="btn warn" id="goalRemove">Remove goal</button></div>':''}</div>`;
  const refreshInsightsProjections=()=>{
    if($('page-insights').classList.contains('hidden')) return;
    if(typeof renderProjection==='function') renderProjection();
    if(typeof renderProjMod==='function') renderProjMod();
  };
  $('goalSave').onclick=()=>{
    const v=+$('goalInput').value, y=Math.round(+$('goalYearInput').value)||0;
    if(v>0){ state.goal={amt:v, year:y>0?y:undefined}; lsSet('pt_goal',state.goal); renderGoal(); refreshInsightsProjections(); }
  };
  const gc=$('goalCancel'); if(gc) gc.onclick=renderGoal;
  const gr=$('goalRemove'); if(gr) gr.onclick=()=>{ state.goal=null; lsSet('pt_goal',null); renderGoal(); refreshInsightsProjections(); };
}
/* ═══ THE HEADLINE PROJECTION — one definition, every surface ════════════════
   Two screens used to answer the same question differently. Home's goal card ran
   runMonteCarloProjection() with a contribution rate derived from lot history
   (the average monthly cost of the owner's real non-dividend buys); Insights'
   projection module ran the same engine at zero. On the demo dataset that is
   ~100% versus 87% for one goal — same defect class as the Home-vs-Portfolio
   total, the three theme-colour copies and the three hardcoded active states.

   The owner's call: the MAIN projection excludes contributions. The headline
   question is "what does my money do if I never add another dollar", so
   monthlyContribution is 0 here permanently, and the ONLY place in the app a
   contribution figure enters a projection is the Insights module's what-if
   input — a number he types, never one inferred from past buying pace.

   Both surfaces go through projectionParams()/runProjection() so there is no
   second copy of the model constants and no second cache to drift. With a fixed
   seed the engine is a pure function of its params, so a shared key is a
   guarantee that two surfaces showing the same key show the same number, not
   just a speed optimisation. */
const PROJECTION_MODEL=Object.freeze({meanReal:0.07, sdReal:0.12, meanInfl:0.02, sdInfl:0.008, paths:10000, seed:20260101});
function projectionParams(v0, years, goal, monthlyContribution){
  return Object.assign({v0, years, goal:(goal>0?goal:null), monthlyContribution:Math.max(0,monthlyContribution||0)}, PROJECTION_MODEL);
}
/* $50 value bucket so a price tick that moves the total by pennies replays the
   cached run instead of re-simulating 10,000 paths — the tolerance renderGoal()
   already used, kept, just moved next to the params it belongs to. */
function projectionKey(p){ return `${p.goal}|${p.years}|${Math.round(p.v0/50)*50}|${p.monthlyContribution.toFixed(2)}`; }
/* A MAP, not one slot: Home's headline run and the Insights what-if's own run are
   both live at once, and renderAll() re-renders both on every price poll — a
   single-slot cache would miss on both every tick and fire two 10,000-path runs
   per poll. Capped at 8 entries, oldest evicted (insertion order), which is more
   than the handful of distinct keys any one session produces. */
const projCache=new Map();
function runProjection(params){
  const key=projectionKey(params);
  const hit=projCache.get(key);
  if(hit) return Promise.resolve(hit.result);
  return runProbabilisticGoal(params).then(result=>{
    projCache.set(key,{result, at:Date.now()});
    if(projCache.size>8) projCache.delete(projCache.keys().next().value);
    return result;
  });
}
/* When this exact projection was last really computed (not merely re-rendered) —
   Insights' "Computed X ago" line. 0 if it has never run. */
function projectionComputedAt(params){ const e=projCache.get(projectionKey(params)); return e?e.at:0; }
let mcWorker=null, mcReqId=0;
function getMcWorker(){
  if(mcWorker===null && window.Worker){
    try{ mcWorker=new Worker('js/monte-carlo-worker.js'); }catch(_){ mcWorker=false; }
  }
  return mcWorker||null;
}
function runProbabilisticGoal(params){
  const worker=getMcWorker();
  if(!worker) return Promise.resolve(runMonteCarloProjection(params)); // no Worker support: same pure function, main thread
  const reqId=++mcReqId;
  return new Promise(res=>{
    const handler=e=>{ if(e.data.reqId!==reqId) return; worker.removeEventListener('message',handler); res(e.data.result); };
    worker.addEventListener('message',handler);
    worker.postMessage(Object.assign({reqId},params));
  });
}
function renderGoal(){
  const body=$('goalBody'); const pctEl=$('goalPct'); if(!body) return;
  // Named `tot`, not `t` — this function's body composes t`` translated
  // sentences below (fixed this session: a bare `const t=totals('all')` here
  // silently shadowed the global i18n tag function for the whole scope, so
  // every t`` call in this function threw "t is not a function" instead of
  // falling back to English — same convention openCrashSheet() already uses
  // in js/insights.js for the same reason).
  const tot=totals('all');
  if(!state.goal || !(state.goal.amt>0)){ renderGoalForm(0); return; }
  const goal=state.goal.amt, year=state.goal.year, pctRaw=tot.value/goal;
  if(pctEl) pctEl.textContent=(Math.min(999,pctRaw*100)).toFixed(0)+'%';
  const bar=`<div class="goalbar"><i style="--w:${(Math.min(1,pctRaw)*100).toFixed(1)}%"></i></div>`;
  const editLink=`<a href="#" id="goalEdit">Change goal</a>`;
  if(tot.value>=goal){
    body.innerHTML=`<div class="stack stack--tight">
      <div class="goalrow"><span>${fmt(tot.value)} of ${fmt(goal)}</span><span class="pos">Reached</span></div>
      ${bar}<p class="t-caption muted">🎉 Goal reached. ${editLink}</p></div>`;
    $('goalEdit').onclick=e=>{ e.preventDefault(); renderGoalForm(goal, year); };
    return;
  }
  const nowYear=new Date().getFullYear();
  if(!(year>0)){
    body.innerHTML=`<div class="stack stack--tight">
      <div class="goalrow"><span>${fmt(tot.value)} of ${fmt(goal)}</span><span>—</span></div>
      ${bar}<p class="t-caption muted">Set a target year to see your odds of getting there. ${editLink}</p></div>`;
    $('goalEdit').onclick=e=>{ e.preventDefault(); renderGoalForm(goal, year); };
    return;
  }
  if(year<=nowYear){
    body.innerHTML=`<div class="stack stack--tight">
      <div class="goalrow"><span>${fmt(tot.value)} of ${fmt(goal)}</span><span>—</span></div>
      ${bar}<p class="t-caption muted">Target year ${year} has passed — update it to see a projection. ${editLink}</p></div>`;
    $('goalEdit').onclick=e=>{ e.preventDefault(); renderGoalForm(goal, year); };
    return;
  }
  const years=year-nowYear;
  body.innerHTML=`<div class="stack stack--tight">
    <div class="goalrow"><span>${fmt(tot.value)} of ${fmt(goal)}</span><span>Calculating…</span></div>
    ${bar}<p class="t-caption muted">Running 10,000 simulated paths… ${editLink}</p></div>`;
  $('goalEdit').onclick=e=>{ e.preventDefault(); renderGoalForm(goal, year); };
  const params=projectionParams(tot.value, years, goal, 0); // never a derived contribution — see PROJECTION_MODEL above
  const apply=result=>{
    if(!$('goalBody')||!state.goal||state.goal.amt!==goal||state.goal.year!==year) return; // stale by the time it resolves
    const pct=(result.probabilityOfGoal*100).toFixed(0);
    body.innerHTML=`<div class="stack stack--tight">
      <div class="goalrow"><span>${fmt(tot.value)} of ${fmt(goal)}</span><span>${year}</span></div>
      ${bar}
      <p class="big-n" style="margin-top:2px">${pct}%<span style="font-size:14px;font-weight:500;color:var(--mut)"> ${t`chance by ${year}`}</span></p>
      <p class="t-caption muted" id="goalMedianLine"></p>
      <div class="chart-box chart-box--sheet"><div id="goalFan"></div></div>
      <p class="t-caption muted">Assumes 7% ± 12%/yr real return, 2% ± 0.8%/yr inflation, no future deposits — see Insights to try a monthly amount. Pre-tax. Not advice. ${editLink}</p>
    </div>`;
    $('goalEdit').onclick=e=>{ e.preventDefault(); renderGoalForm(goal, year); };
    drawGoalFan(result.fan, goal, nowYear);
    // Session 6: the projected date the median path itself reaches the goal —
    // separate from probabilityOfGoal above (odds of reaching it BY the target
    // year), and separate from the target year the owner picked. Resolved as
    // its own runProjection() call, independent of `params` above and painted
    // into #goalMedianLine once it resolves, rather than gating the pct/bar/
    // chart the user is actually waiting on behind a second 10,000-path run.
    // Always searched over a fixed 30-year cap regardless of `years` (the
    // target could be closer or further out than that), never extrapolated
    // past it — "if the median path doesn't reach it within 30 years, say so"
    // (owner requirement). goal:null/monthlyContribution:0 since only the
    // fan's own p50 series is read here, never probabilityOfGoal — which also
    // means this run's params can land on the exact same cache key
    // js/insights.js's renderProjMod() base run uses for its own 30y/no-goal/
    // no-contribution question, when the portfolio value matches (see that
    // file's comment on runProjection()'s shared cache).
    const capParams=projectionParams(tot.value, 30, null, 0);
    runProjection(capParams).then(capResult=>{
      const el=$('goalMedianLine');
      if(!el || !state.goal || state.goal.amt!==goal || state.goal.year!==year) return; // stale by the time it resolves
      const capP50=capResult.fan.p50;
      let hitYear=null;
      for(let i=0;i<capP50.length;i++){ if(capP50[i]>=goal){ hitYear=i; break; } }
      el.innerHTML = hitYear!=null
        ? t`The median path reaches your goal around ${`<b>${nowYear+hitYear}</b>`}.`
        : t`The median path doesn't reach your goal within 30 years.`;
    });
  };
  runProjection(params).then(apply);
}
/* The live-tick-safe half of the goal card: patches the "$X of $Y" figure and the
   progress bar's width in place from the current live total, without touching (or
   re-triggering) the Monte Carlo simulation renderGoal() above owns. Safe to call
   before any goal exists or while the card is mid-calculation/showing "reached"/"set
   a year" — .goalrow/.goalbar just aren't there yet in some of those states, so this
   quietly no-ops. "Materially changed" — goal amount, target year, monthly
   contribution rate, or the portfolio value crossing the $50 band `key` above already
   rounds to — still only reaches the simulation through a full renderGoal() call
   (renderAll(), or saving the goal-edit form): that's the SAME tolerance the code
   already chose for when a re-simulate is worth it, just evaluated at full-render
   frequency instead of every 10s poll tick, which is what makes it safe to call from
   there at all. */
function renderGoalProgress(){
  const body=$('goalBody'); if(!body || !state.goal || !(state.goal.amt>0)) return;
  const goal=state.goal.amt, t=totals('all'), pctRaw=t.value/goal;
  const pctEl=$('goalPct'); if(pctEl) pctEl.textContent=(Math.min(999,pctRaw*100)).toFixed(0)+'%';
  const amtEl=body.querySelector('.goalrow span:first-child');
  if(amtEl) amtEl.textContent=`${fmt(t.value)} of ${fmt(goal)}`;
  const barEl=body.querySelector('.goalbar i');
  if(barEl) barEl.style.setProperty('--w', (Math.min(1,pctRaw)*100).toFixed(1)+'%');
}
/* targetId defaults to Home's own #goalFan — session 5 adds a second caller,
   js/insights.js's renderProjMod(), pointed at Insights' #projFan mount instead. The
   chart instance is stashed on the element itself (el._lwcChart) rather than a single
   module-level variable, so two independent mount points can each hold their own
   instance without a second copy of this function or a chart-instances map.

   Redraw guard: renderAll() runs on every price poll and re-applies the cached
   projection result, which used to tear this chart down (el.innerHTML='') and
   build a new one every tick — one empty frame per poll, on both mount points,
   for a chart whose data had not changed. The fan only depends on the result
   object, the goal and the theme, so remember which of those is on screen and
   return early when they still match. Theme is in the key because the series
   colours are read from CSS variables here, once, at build time. */
/* ── The percentile cone, as a filled band ──────────────────────────────────
   Reported defect: p10 and p90 rendered as thin dashed grey LineSeries with
   nothing between them, so the module read as three unrelated guide lines
   rather than one distribution. Lightweight Charts has no band series and an
   AreaSeries fills from its line down to the BOTTOM of the pane, not to a
   second series — so the cone cannot be expressed with the built-in series
   types without painting an opaque mask over the lower half, and a mask would
   then make the p25–p75 overlay impossible. A series primitive gets the
   library's own coordinate converters and paints the polygons itself, beneath
   the series (zOrder 'bottom').

   Both bands use the SAME fill, painted twice where they overlap, so the middle
   half of the distribution reads roughly twice as dense. No stroke on either
   band edge: the band is the mark, the p50 line is the only line.

   Colour is passed in already resolved by the caller (cvar() off :root), which
   is what keeps the theme toggle repainting — see drawGoalFan()'s drawKey. */
function fanBandPrimitive(times, bands, fill){
  let host=null;
  const view={
    zOrder:()=>'bottom',
    renderer:()=>({ draw(target){
      if(!host) return;
      const ts=host.chart.timeScale(), series=host.series;
      target.useBitmapCoordinateSpace(scope=>{
        const ctx=scope.context, hr=scope.horizontalPixelRatio, vr=scope.verticalPixelRatio;
        ctx.save();
        ctx.fillStyle=fill;
        for(const b of bands){
          const pts=[];
          for(let i=0;i<times.length;i++){
            const x=ts.timeToCoordinate(times[i]);
            const hi=series.priceToCoordinate(b.hi[i]), lo=series.priceToCoordinate(b.lo[i]);
            if(x==null||hi==null||lo==null) continue;
            pts.push([x*hr, hi*vr, lo*vr]);
          }
          if(pts.length<2) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
          for(let i=pts.length-1;i>=0;i--) ctx.lineTo(pts[i][0], pts[i][2]);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });
    }})
  };
  return { attached(p){ host=p; }, detached(){ host=null; }, updateAllViews(){}, paneViews(){ return [view]; } };
}
/* Direct labels at the right edge — the end of the band (p90 above, p10 below)
   and the goal line's own value. Drawn in MEDIA coordinate space so the 11px
   type is 11 CSS px on every device pixel ratio rather than 11 bitmap pixels.
   Priority order is goal, then p90, then p10, and a label whose baseline lands
   within one line-height of an already-placed one is dropped — which is what
   makes the brief's "if they collide, drop the p10 label, not both" fall out
   rather than needing a special case. */
function fanLabelPrimitive(lastTime, entries){
  let host=null;
  const view={
    zOrder:()=>'top',
    renderer:()=>({ draw(target){
      if(!host) return;
      const ts=host.chart.timeScale(), series=host.series;
      target.useMediaCoordinateSpace(scope=>{
        const ctx=scope.context;
        const xEnd=ts.timeToCoordinate(lastTime);
        if(xEnd==null) return;
        const x=Math.min(xEnd, scope.mediaSize.width)-4;
        ctx.save();
        ctx.textAlign='right';
        ctx.textBaseline='middle';
        const placed=[];
        for(const e of entries){
          const y=series.priceToCoordinate(e.value);
          if(y==null || !e.text) continue;
          if(placed.some(p=>Math.abs(p-y)<13)) continue;
          placed.push(y);
          ctx.font=`${e.weight} 11px 'Inter',-apple-system,BlinkMacSystemFont,sans-serif`;
          ctx.fillStyle=e.color;
          ctx.fillText(e.text, x, Math.max(7, Math.min(scope.mediaSize.height-7, y+e.dy)));
        }
        ctx.restore();
      });
    }})
  };
  return { attached(p){ host=p; }, detached(){ host=null; }, updateAllViews(){}, paneViews(){ return [view]; } };
}
function drawGoalFan(fan, goal, y0, targetId, whatIf){
  const LC=window.LightweightCharts;
  const el=$(targetId||'goalFan'); if(!el||!LC) return;
  const drawKey=`${y0}|${goal}|${document.documentElement.dataset.theme}|${state.view.priv?1:0}|${state.view.ccy}|${fan.p50[fan.p50.length-1]}|${whatIf?whatIf.contrib:0}|${whatIf?whatIf.fan.p50[whatIf.fan.p50.length-1]:0}`;
  if(el._lwcChart && el._lwcKey===drawKey) return;
  if(el._lwcChart){ el._lwcChart.remove(); el._lwcChart=null; }
  el._lwcKey=drawKey;
  el.innerHTML='';
  const brand=cvar('--brand'), soft=cvar('--brand-soft'), mut=cvar('--mut'), faint=cvar('--faint'), grid=cvar('--grid');
  const priceFormatter=v=>state.view.priv?'':cfmt(v);
  const marginTop=0.14, marginBottom=0.06;
  const chart=LC.createChart(el,{
    autoSize:true,
    layout:{ background:{type:LC.ColorType.Solid,color:'transparent'}, textColor:mut,
             fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif", fontSize:10, attributionLogo:false },
    grid:{ vertLines:{visible:false}, horzLines:{color:grid} },
    rightPriceScale:{ visible:true, borderVisible:false, scaleMargins:{top:marginTop,bottom:marginBottom} },
    leftPriceScale:{ visible:false },
    timeScale:{ visible:true, borderVisible:false, fixLeftEdge:true, fixRightEdge:true, rightOffset:0,
      tickMarkFormatter:t=>String(t.year) },
    handleScroll:false, handleScale:false,
    localization:{ priceFormatter },
  });
  const asTime=y=>({ year:y0+y, month:1, day:1 });
  const times=fan.years.map(asTime);
  // p10/p90 no longer exist as series, so the price scale can no longer see them.
  // Widen the p50 series' own autoscale to cover the whole cone (and the goal
  // line, which sits outside it whenever the goal is a stretch) — otherwise the
  // band is clipped at the top and the goal line falls off the chart entirely.
  // The what-if median (when present) can outrun the base cone's own p90 on a
  // large contribution, so it has to be in this same autoscale or its dashed
  // line draws off the top of the pane.
  const lo=Math.min(...fan.p10), hi=Math.max(...fan.p90);
  const whatIfHi=whatIf?Math.max(...whatIf.fan.p50):-Infinity;
  const rawMax=Math.max(hi, goal>0?goal:hi, whatIfHi), rawMin=Math.min(lo, goal>0?goal:lo);
  // scaleMargins reserves marginTop of the PANE height as blank space above the
  // top of whatever priceRange autoscaleInfoProvider returns — but the returned
  // maxValue itself is exactly the highest drawn value with zero price-unit
  // padding, so the highest point (the what-if line at a large monthly figure,
  // reproduced live at $2000/mo) is drawn AT that margin boundary: all of the
  // margin's pixels are spent getting from the container edge down to the data
  // point, leaving nothing for the point's own stroke or the label drawn above
  // it (fanLabelPrimitive's dy:-9). Confirmed empirically: changing scaleMargins
  // after the fact moves the data point's own pixel position (topCoordY tracked
  // getVisibleRange().to exactly in both cases) — margin is genuine screen space,
  // it's just all already claimed by the time the highest point is reached.
  // Fix: push maxValue itself above rawMax by a price-unit amount equal to a
  // real pixel budget (half the thickest line's stroke + the label's own glyph
  // height, measured via canvas — not eyeballed — + a few px buffer), converted
  // to price units via the pane's actual render geometry. tsHeight comes from
  // the chart itself (stable immediately after createChart, verified: 28px for
  // this exact fontSize/border config, before any series or data exist) rather
  // than a hardcoded axis-height guess.
  const tsHeight=chart.timeScale().height()||28;
  const paneRenderPx=Math.max(1, (el.clientHeight-tsHeight)*(1-marginTop-marginBottom));
  const labelCtx=drawGoalFan._measureCtx||(drawGoalFan._measureCtx=document.createElement('canvas').getContext('2d'));
  labelCtx.font=`650 11px 'Inter',-apple-system,BlinkMacSystemFont,sans-serif`;
  const labelMetrics=labelCtx.measureText('Goal $0,123.45/mo');
  const labelPx=(Number.isFinite(labelMetrics.actualBoundingBoxAscent)&&Number.isFinite(labelMetrics.actualBoundingBoxDescent))
    ? labelMetrics.actualBoundingBoxAscent+labelMetrics.actualBoundingBoxDescent : 11*1.3;
  const strokeHalfPx=1; // p50's own lineWidth (2px) is the thickest candidate for the top point
  const headroomPx=strokeHalfPx+labelPx+4;
  // Expanding maxValue also expands the total span mapped into the same
  // paneRenderPx, which would eat back part of a naively-added headroom (a
  // pricePerPx computed from the PRE-expansion span overstates the padding a
  // post-expansion pixel is worth). Solved exactly rather than approximated:
  // headroomPrice*paneRenderPx/(rawSpan+headroomPrice) === headroomPx.
  const rawSpan=Math.max(1e-9, rawMax-rawMin);
  const headroomPrice=headroomPx*rawSpan/Math.max(1, paneRenderPx-headroomPx);
  const maxValue=rawMax+headroomPrice;
  const p50=chart.addSeries(LC.LineSeries,{ color:brand, lineWidth:2,
    crosshairMarkerVisible:true, crosshairMarkerRadius:3.5,
    crosshairMarkerBackgroundColor:brand, priceLineVisible:false, lastValueVisible:false,
    autoscaleInfoProvider:()=>({ priceRange:{ minValue:rawMin, maxValue } }) });
  p50.setData(fan.years.map((y,i)=>({time:times[i], value:fan.p50[i]})));
  // p25/p75 is optional so a result object cached from before js/monte-carlo.js
  // grew the quartiles still draws the outer band rather than throwing.
  const bands=[{lo:fan.p10, hi:fan.p90}];
  if(fan.p25 && fan.p75) bands.push({lo:fan.p25, hi:fan.p75});
  p50.attachPrimitive(fanBandPrimitive(times, bands, soft));
  if(goal>0){
    const goalLine=chart.addSeries(LC.LineSeries,{ color:mut, lineWidth:1, lineStyle:LC.LineStyle.Dashed,
      crosshairMarkerVisible:false, priceLineVisible:false, lastValueVisible:false,
      autoscaleInfoProvider:()=>null });
    goalLine.setData(fan.years.map(y=>({time:asTime(y), value:goal})));
  }
  // The what-if's own line, drawn over the base cone — its only two outputs are
  // this line and the result sentence beneath the control (js/insights.js
  // renderProjMod()). Brand, not mut/faint, so it reads as "your typed scenario"
  // rather than as another statistical guide line.
  if(whatIf){
    const whatIfLine=chart.addSeries(LC.LineSeries,{ color:brand, lineWidth:1.5, lineStyle:LC.LineStyle.Dashed,
      crosshairMarkerVisible:false, priceLineVisible:false, lastValueVisible:false,
      autoscaleInfoProvider:()=>null });
    whatIfLine.setData(fan.years.map((y,i)=>({time:times[i], value:whatIf.fan.p50[i]})));
  }
  const n=fan.years.length-1;
  p50.attachPrimitive(fanLabelPrimitive(times[n], [
    goal>0 ? {value:goal, text:`${t`Goal`} ${cfmt(goal)}`, color:mut, weight:650, dy:-9} : {},
    whatIf ? {value:whatIf.fan.p50[n], text:`+${fmt(whatIf.contrib)}/mo`, color:brand, weight:650, dy:-9} : {},
    {value:fan.p90[n], text:cfmt(fan.p90[n]), color:faint, weight:600, dy:0},
    {value:fan.p10[n], text:cfmt(fan.p10[n]), color:faint, weight:600, dy:0},
  ]));
  chart.timeScale().setVisibleLogicalRange({ from:0, to:fan.years.length-1 });
  el._lwcChart=chart;
}
function healthScore(){
  const rs=rows('all'), t=totals('all'), inv=Math.max(1,t.value-cashFor('all'));
  // Every metric below divides by inv (clamped to 1 so it never divides by zero) and
  // treats "no evidence of a problem" as "no problem" — with rs empty that's backwards:
  // no holdings scored Diversification and Cost efficiency a perfect 100 ("no concentrated
  // bets" / an average fee of nothing) and Cash deployed a perfect 100 whenever cash was
  // also 0. A portfolio that doesn't exist isn't healthy; it's unmeasured. Caught in a
  // bug-hunt session, live-reproduced as a B/84 grade on an empty demo portfolio.
  if(!rs.length) return {score:null, metrics:null};
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
  if(score==null){
    $('healthBody').innerHTML=`
    <div class="hsplit">
      <div class="hscore">${ringSvg(0, cvar('--mut'), 40)}<div class="rt"><b>—</b></div></div>
      <div class="hgrade"><div class="hg">Portfolio health</div>
        <div class="hd">Add a holding to see your portfolio's health check.</div></div>
    </div>`;
    return;
  }
  const grade=score>=85?'A':score>=75?'B':score>=65?'C':score>=50?'D':'F';
  const weakest=metrics.filter(m=>m.tip).sort((a,b)=>a.v-b.v)[0];
  // healthScore() above deliberately scores single-STOCK concentration only ("broad index
  // funds ARE diversification; only single companies count as concentration" — its own
  // comment); it never weighs sector or country weight, on purpose, so it can't move when
  // Sector/Geographic mix show real concentration (26% one sector, 83% one country in the
  // live demo data — a bug-hunt session caught this exact contradiction: A/100, "nothing is
  // holding the grade down", on a screen that then shows that). The number can't change
  // here — healthScore()'s score is a golden-master figure — so the fix is the claim: it no
  // longer says "nothing" is holding the grade down, it names what this score does and does
  // not cover and points at the cards that actually answer sector/country concentration.
  const oneLiner=weakest?weakest.tip:"Single-stock risk, global mix, cost and cash deployment are all strong by this score. It doesn't weigh sector or country concentration — see Sector exposure and Where your money lives below.";
  $('healthBody').innerHTML=`
    <div class="hsplit">
      <div class="hscore">${ringSvg(score/100, cvar('--brand'), 40)}<div class="rt"><b>${grade}</b><span>${score}/100</span></div></div>
      <div class="hgrade"><div class="hg">Portfolio health</div>
        <div class="hd">${oneLiner}</div></div>
    </div>`;
}
/* Home v2 §1 — Daily Movers bar chart, replacing the old text-row attribution
   list (moverTotal/moverNarrative retired with it: the new header — "Stay on
   top" / "Your Daily Movers" — has no slot for a trailing $ total or the old
   "vs S&P 500 today" sentence). gainers = pct>=0, losers = pct<0 — the same
   >=0-is-pos convention cls() already uses elsewhere, so a portfolio where
   every holding is flat at 0.00% renders all of them under Gainers (each at
   the --mv-bar-min sliver, maxAbs being 0) rather than under neither view. */
function renderMover(){
  const body=$('moverBody'); if(!body) return;
  const view=state.view.moversView;
  const items=rows(state.view.acc).map(r=>{
    const p=priceOf(r.sym), pv=prevOf(r.sym); if(!(pv>0)||!(p>0)) return null;
    return {sym:r.sym, pct:(p/pv-1)*100};
  }).filter(Boolean);
  const pool = view==='losers' ? items.filter(x=>x.pct<0).sort((a,b)=>a.pct-b.pct)
                                : items.filter(x=>x.pct>=0).sort((a,b)=>b.pct-a.pct);
  const visible = pool.slice(0,5);
  if(!visible.length){
    body.innerHTML = `<p class="movers-empty t-caption muted">No ${view==='losers'?'losers':'gainers'} today.</p>`;
    return;
  }
  const maxAbs = Math.max(...visible.map(x=>Math.abs(x.pct)));
  body.innerHTML = visible.map(x=>{
    const c=x.pct>=0?'pos':'neg';
    const frac = maxAbs>0 ? Math.abs(x.pct)/maxAbs : 0;
    return `<button type="button" class="mvcol" data-sym="${esc(x.sym)}" data-frac="${frac.toFixed(4)}">
      <div class="mv-zone"><span class="mv-pct ${c}">${fmtPct(x.pct)}</span><div class="mv-bar ${c}"></div></div>
      ${badgeHtml(x.sym,true)}
      <span class="mv-tick">${esc(x.sym.replace('-','.'))}</span></button>`;
  }).join('');
  const barMax=parseFloat(cvar('--mv-bar-max'))||88, barMin=parseFloat(cvar('--mv-bar-min'))||6;
  body.querySelectorAll('.mvcol').forEach(el=>{
    const frac=parseFloat(el.dataset.frac)||0;
    el.querySelector('.mv-bar').style.setProperty('--h', (barMin+frac*(barMax-barMin)).toFixed(1)+'px');
    el.onclick=()=>openDetail(el.dataset.sym);
  });
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
    return window.t`Markets close in ${Math.floor(left/60)}h ${left%60}m`;
  }
  let d=new Date(today);
  if(!(todayTrading && nowMin<570)) do{ d.setUTCDate(d.getUTCDate()+1); }while(!isTrading(d));
  const daysAhead=Math.round((d-today)/86400000);
  const left = 570-nowMin + daysAhead*1440;
  return window.t`Markets open in ${Math.floor(left/60)}h ${left%60}m`;
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
/* "Coming up" merges two independent feeds — dividend ex-dates (duplicating
   renderIncome()'s (js/portfolio.js) "upcoming" loop rather than refactoring
   it into a shared helper: same math, a second presentation surface, not
   worth reshaping code that already works to avoid ~8 duplicated lines) and
   confirmed earnings dates (state.earnings, populated by ensureEarnings() in
   js/portfolio.js via the Worker's /earnings proxy — worker/src/earnings.js).
   Earnings only ever contributes a row when the source's own confirmDate is
   set — an unconfirmed/estimated date is never shown (DESIGN-TARGET.md §2:
   "never display a guessed or approximated date"), so ETFs and any stock
   without an officially-announced date simply don't appear here, same as
   they wouldn't in the dividend loop if they paid none. Either feed can be
   empty or stale on its own (a Worker/EarningsWhispers hiccup doesn't touch
   state.divs) — the merge just sorts whatever's actually present. */
function renderComingUp(){
  const sec=$('comingSection'); const body=$('comingBody'); if(!body) return;
  const now=Date.now(), horizon=now+180*86400e3;
  const upcoming=[];
  for(const r of rows(state.view.acc)){
    const d=state.divs[r.sym];
    if(d && d.list && d.list.length){
      const yr=d.list.filter(e=>e[0]>now-370*86400e3);
      for(const e of yr){
        const next=e[0]+31557600000; // same payout, one year later
        if(next>now && next<horizon) upcoming.push({sym:r.sym, when:next, kind:'div', est:r.qty*e[1]});
      }
    }
    const ed=state.earnings[r.sym];
    if(ed && !ed.none && ed.date){
      const when=Date.parse(ed.date+'T00:00:00Z');
      if(when>now && when<horizon) upcoming.push({sym:r.sym, when, kind:'earn', q:ed.q, qy:ed.qy});
    }
  }
  upcoming.sort((a,b)=>a.when-b.when);
  if(!upcoming.length){ if(sec) sec.style.display='none'; ensureDivs(); ensureEarnings(); return; }
  if(sec) sec.style.display='';
  body.innerHTML = upcoming.slice(0,3).map(u=>{
    const days=Math.max(0,Math.ceil((u.when-now)/86400000));
    const dateStr=new Date(u.when).toLocaleDateString(appLocale(),{month:'short',day:'numeric'});
    const title = u.kind==='earn' ? `Q${u.q} ${u.qy} earnings · ${dateStr}` : `Dividend · ex-div ${dateStr}`;
    return `<button type="button" class="drow" data-sym="${esc(u.sym)}">${badgeHtml(u.sym,true)}
      <div class="mmid"><div class="msym">${title}</div>${u.kind==='div'?`<div class="mname">estimated ${fmt(u.est)}</div>`:''}</div>
      <div class="mright"><span class="chip chip--primary">${days}d</span></div></button>`;
  }).join('');
  body.querySelectorAll('.drow').forEach(el=> el.onclick=()=>openDetail(el.dataset.sym));
}
/* Home v2 §4 — Price highlights, the Empower pattern: top 3 holdings by
   lifetime total return (r.cost>0 ? pl/r.cost*100 : 0 — the exact formula
   holdingRow() in js/portfolio.js uses for the same figure on the Portfolio
   tab), not today's move (that's §1's job). Only positive returns qualify as
   a "highlight" — a portfolio where every holding is underwater says so
   plainly instead of surfacing its least-bad loser as if it were one. */
function renderPriceHighlights(){
  const body=$('highlightBody'); if(!body) return;
  const rs=rows(state.view.acc).filter(r=>r.qty*priceOf(r.sym)>0);
  const top=rs.map(r=>{
    const p=priceOf(r.sym), val=r.qty*p, pl=val-r.cost, plp=r.cost>0?pl/r.cost*100:0;
    return {sym:r.sym, plp};
  }).filter(x=>x.plp>0).sort((a,b)=>b.plp-a.plp).slice(0,3);
  if(!top.length){
    body.innerHTML=`<p class="t-caption muted">Every holding is down right now — no highlights to show.</p>`;
    return;
  }
  body.innerHTML = top.map(x=>`<button type="button" class="mrow" data-sym="${esc(x.sym)}">${badgeHtml(x.sym,true)}
      <div class="mmid"><div class="msym">${esc(x.sym.replace('-','.'))}</div><div class="mname">${esc((NAMES[x.sym]||x.sym.replace('-','.')).replace(/^Vanguard /,''))}</div></div>
      <div class="mright"><span class="pctpill up">${fmtPct(x.plp)}</span></div></button>`).join('');
  body.querySelectorAll('.mrow').forEach(el=> el.onclick=()=>openDetail(el.dataset.sym));
}
$('homeAllocStrip').onclick = openAllocSheet;
/* Home v2 §5 — Portfolio insights: three .stat tiles, the exact module-tile
   component js/insights.js's renderModGrid() built for Insights' #modGrid
   (same markup/classes — deliberately not a second tile style), each opening
   the Insights tab on tap by replaying the rail-nav/tabbar Insights button's
   own click (haptic + view transition + focus included, not reimplemented).
   No new maths: health grade uses renderHealth()'s own score/grade
   thresholds above; XIRR/vs VOO use the same personalReturn()/spPathValue()
   calls renderModGrid() (js/insights.js) already makes.
   #moverNarrative — the "Ahead of/Behind the S&P 500 today" sentence — lived
   on the old text-row movers (R4), was dropped when the Home v2 §1 bar-chart
   header had no slot for it, and has now been deleted three times across
   R1/R4/the movers session. It answers "did I beat the market today", which
   nothing else on Home does — the vs-VOO tile beside it is a lifetime
   figure, not a daily one — so it gets a permanent home here as this
   section's lead line, next to the tile it's most related to. Same
   dayPct/S&P comparison formula R4 used, not reinvented.
   #moverTotal (the old header's $ total for today's movers) is NOT restored:
   it duplicated #homeToday's day-dollar figure exactly (both sum the same
   day-change across the same holdings), and the new bar-chart movers header
   has no slot for a second copy of that number — genuinely redundant, not
   lost like the narrative was. */
function renderHomeInsights(){
  const grid=$('homeInsights'); const narrEl=$('moverNarrative');
  if(narrEl){
    const t=totals(state.view.acc);
    const dayPct=(t.value-t.day)>0 ? t.day/(t.value-t.day)*100 : 0;
    const voo=state.quotes.VOO, sp=(voo&&voo.prev>0)?(voo.price/voo.prev-1)*100:null;
    narrEl.textContent = sp!=null ? `${dayPct-sp>=0?'Ahead of':'Behind'} the S&P 500 today by ${Math.abs(dayPct-sp).toFixed(2)}%.` : '';
  }
  if(!grid) return;
  const {score}=healthScore();
  const grade=score!=null?(score>=85?'A':score>=75?'B':score>=65?'C':score>=50?'D':'F'):'—';
  const rr=personalReturn('all');
  const t=totals('all'), sp=spPathValue(), mine=t.value-cashFor('all');
  const vsVoo=(sp && sp.value>0) ? (mine-sp.value)/sp.value*100 : null;
  const tile=(label,value,tone,sub)=>
    `<button type="button" class="stat press">`+
    `<div class="stat__label">${esc(label)}</div>`+
    `<div class="stat__value${tone?` ${tone}`:''}">${esc(value)}</div>`+
    `<div class="stat__delta">${esc(sub)}</div></button>`;
  grid.innerHTML =
    tile('Health', grade, '', score!=null?`${score}/100`:'not enough data') +
    tile('XIRR', rr!=null?fmtPct(rr*100):'—', rr!=null?cls(rr*100):'', 'annualised') +
    tile('vs VOO', vsVoo!=null?fmtPct(vsVoo):'—', vsVoo!=null?cls(vsVoo):'', 'same buys in VOO');
  grid.querySelectorAll('.stat').forEach(el=> el.onclick=()=> document.querySelector('.tabbar__item[data-page="insights"]').click());
}
/* Every surface that shows a figure derived from live quotes (state.quotes) — on
   ANY tab — belongs in this one list. refreshAll()'s fast quotes-only phase and
   refreshQuotesOnly()'s 10-60s market-hours poll both repaint through here instead
   of each keeping their own hand-written subset, which is how Home's hero card
   (#homeTotal/#homeToday) went stale in the first place: it was added to renderAll()
   but never to either partial-render path, so Portfolio's header kept ticking while
   Home's sat frozen at its last full render. A new live surface only needs to be
   added HERE to reach every refresh path.
   The FULL renderGoal() is deliberately NOT here even though it also reads
   totals(all) — on a cache miss it dispatches a 10,000-path Monte Carlo run to a
   Worker (see its own comment), which is not something a 10s poll tick should be
   triggering. renderGoalProgress() is its split-off cheap half (see its own
   comment) — patches the goal card's live figures in place, never touches the
   simulation — so the goal card doesn't have the exact bug this fix exists for. */
function renderLiveSurfaces(){
  renderHeader(); renderList(); renderMover();
  renderHomeCard(); renderHomePr(); renderPriceHighlights(); renderHomeInsights();
  renderGoalProgress();
}
/* The FULL renderGoal/renderIncome are still called here — renderIncome() still
   no-ops (see its own guard: #incomeCard was never rebuilt, Home's renderComingUp()
   covers that ground instead) while renderGoal() paints Home's goal card for real,
   simulation included (renderGoalProgress(), in renderLiveSurfaces() above, already
   kept the figures live between full renders — this re-render is what a materially
   changed input actually reaches the simulation through). renderAlloc() likewise
   no-ops unless the allocation sheet is open — renderAllocStrip() (called from
   renderList() and renderHomeCard(), both in renderLiveSurfaces() above) is what
   actually paints the always-visible strips. */
function renderAll(){
  renderLiveSurfaces();
  renderGoal(); renderStale(); renderChips(); renderChart(); renderAlloc(); renderIncome(); setStatus();
  renderHomeChrome(); renderComingUp(); renderHomeCoach();
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
// Bug fix (UPGRADE_PLAN.md): these two toggles only ever synced the .on class, never
// aria-selected — so index.html's hardcoded default (Profit / 1M) stayed
// aria-selected="true" forever, and since css/components.css's `.seg__item[aria-selected=
// "true"]` rule paints the identical solid-fill highlight as `.seg__item.on` (by design,
// per that rule's own comment — the two mechanisms are meant to be interchangeable), the
// default chip and whichever one the user actually picked both rendered lit at once. Same
// class of bug as the rail-nav fix in commit 1b374e9 (a selection attribute the markup
// hardcodes, never cleared by the code that sets a new selection) — verified by reading
// getAttribute('aria-selected') across every chip after clicking, not by screenshot.
const syncSel=(container,active)=>container.querySelectorAll('button').forEach(x=>{
  x.classList.toggle('on',x===active); x.setAttribute('aria-selected', x===active?'true':'false');
});
$('metricSeg').querySelectorAll('button').forEach(b=>{
  b.classList.toggle('on', b.dataset.m===state.view.metric); // sync highlight to the saved/default metric
  b.setAttribute('aria-selected', b.dataset.m===state.view.metric?'true':'false');
  b.onclick=()=>{ state.view.metric=b.dataset.m; lsSet('pt_metric',b.dataset.m); syncSel($('metricSeg'),b); renderChart(); };
});
$('rangeSeg').querySelectorAll('button').forEach(b=> b.onclick=()=>{ state.view.range=b.dataset.r; syncSel($('rangeSeg'),b); renderChart(); });
// Daily Movers gainers/losers toggle (Home v2 §1) — built with syncSel from the
// start, the same fix metricSeg/rangeSeg needed above, so this isn't a fourth
// instance of the bug syncSel's own comment describes.
$('moverToggle').querySelectorAll('button').forEach(b=>{
  b.classList.toggle('on', b.dataset.view===state.view.moversView);
  b.setAttribute('aria-selected', b.dataset.view===state.view.moversView?'true':'false');
  b.onclick=()=>{ state.view.moversView=b.dataset.view; syncSel($('moverToggle'),b); renderMover(); };
});
// Markets screener toggle (DESIGN-TARGET.md §2) — R3 collapsed the three screener
// lists into one segmented card but never attached a click handler, so #screenSeg
// has rendered since R3 without ever doing anything (test/active-state.spec.js now
// covers this). No saved state (unlike moversView): the card always opens on
// "Active", same as before this fix.
$('screenSeg').querySelectorAll('button').forEach(b=>{
  b.onclick=()=>{
    syncSel($('screenSeg'),b);
    document.querySelectorAll('#page-markets [data-screen-panel]').forEach(p=>{ p.hidden = p.dataset.screenPanel!==b.dataset.screen; });
  };
});
/* ── The three global view controls: hide amounts, theme, currency ───────────
   Two defects, one mechanism.

   (a) They rendered as solid black shapes. css/base.css's icon rule is scoped to
   `svg[aria-hidden="true"]` — correctly, so chart <text> stops inheriting a
   stroke — but all three buttons destroyed that markup at runtime: privBtn and
   themeBtn overwrote innerHTML with their own hand-rolled <svg> strings (no
   aria-hidden), and js/portfolio.js's renderHeader() replaced #ccyBtn's contents
   with a "$"/"€" TEXT glyph, leaving no <svg> at all. The rule never matched, so
   the icons fell back to the UA defaults: fill #000, stroke none. Measured, not
   inferred. The fix is that nothing writes icon markup any more — each button
   keeps the one sprite <svg aria-hidden="true"> index.html ships and only its
   <use href> changes, so the attribute the CSS contract keys on cannot be
   written away again.

   (b) All three lived only in the Portfolio appbar, so they were unreachable
   from Home. index.html now carries the same group there. Instances are
   addressed by data-act and never by id, and there is exactly ONE painter and
   ONE click handler per control, so the two copies cannot drift apart — the
   thing that goes wrong the moment a control is duplicated. */
function paintAct(act, icon, label, pressed){
  document.querySelectorAll(`[data-act="${act}"]`).forEach(b=>{
    const u=b.querySelector('svg > use');
    if(u) u.setAttribute('href','#i-'+icon);
    b.setAttribute('aria-label', label);
    if(pressed===undefined) b.removeAttribute('aria-pressed');
    else b.setAttribute('aria-pressed', pressed?'true':'false');
  });
}
/* privacy mode — mask YOUR dollar amounts (••••••), keep percentages + market prices */
function paintPriv(){
  paintAct('priv', state.view.priv?'eye-off':'eye', state.view.priv?'Show amounts':'Hide amounts', state.view.priv);
}
/* A stable action label plus aria-pressed for the state, rather than a label that
   flips: "Toggle theme, pressed" is what a screen reader should say in dark mode. */
function paintTheme(){
  paintAct('theme', document.documentElement.dataset.theme==='dark'?'moon':'sun', 'Toggle theme',
    document.documentElement.dataset.theme==='dark');
}
/* Not a pressed/unpressed toggle — two peer currencies — so the label names the
   destination and there is no aria-pressed to misread. */
function paintCcy(){
  paintAct('ccy', state.view.ccy==='USD'?'dollar':'euro', state.view.ccy==='USD'?'Switch to euros':'Switch to dollars');
}
/* One delegated listener for all three, on both appbars. Delegation rather than a
   per-element binding so a control added to a third appbar needs no JS change,
   and so there is no second binding pass that could bind one instance and miss
   another. */
document.addEventListener('click', e=>{
  const b=e.target.closest && e.target.closest('[data-act]'); if(!b) return;
  if(b.dataset.act==='priv'){
    state.view.priv=!state.view.priv; lsSet('pt_priv', state.view.priv);
    paintPriv(); renderAll();
  } else if(b.dataset.act==='theme'){
    const t = document.documentElement.dataset.theme==='dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t; lsSet('pt_theme', t);
    paintTheme();
    // index.html now ships a light AND a dark theme-color <meta>, picked automatically by
    // prefers-color-scheme for the pre-JS/launch-screen case — but an explicit in-app
    // toggle must win over the OS signal once the user has actually chosen, so both tags
    // get overwritten to the SAME value: whichever --canvas just became active. cvar()
    // reads it live off :root, so this can never hold a value that disagrees with
    // css/tokens.css (the single source of truth CLAUDE.md requires) the way the old
    // hardcoded #0b0f0d/#f3f7f4 pair did.
    const themeColor = cvar('--canvas');
    document.querySelectorAll('meta[name=theme-color]').forEach(m=>m.setAttribute('content', themeColor));
    renderAll(); // charts re-read the tokens
  } else if(b.dataset.act==='ccy'){
    state.view.ccy = state.view.ccy==='USD'?'EUR':'USD'; lsSet('pt_ccy',state.view.ccy);
    paintCcy(); renderAll();
  }
});
paintPriv(); paintTheme(); paintCcy();
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
  document.querySelector('.brand').innerHTML = g+`<span class="bdate"> · ${new Date().toLocaleDateString(appLocale(),{weekday:'short',month:'short',day:'numeric'})}</span>`;
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
  const mName=p0.toLocaleDateString(appLocale(), now.getFullYear()!==p0.getFullYear() ? {month:'long',year:'numeric'} : {month:'long'});
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
  const nice=new Date(day+'T12:00:00').toLocaleDateString(appLocale(),{weekday:'long',month:'short',day:'numeric'});
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
