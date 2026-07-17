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
      if(!$('page-news').classList.contains('hidden')) refreshNews(true);
      if(!$('page-explore').classList.contains('hidden')) refreshMarkets(true);
      refreshAll(true).then(()=>{ ptr.classList.remove('loading'); ptr.style.height='0px'; });
    } else { ptr.style.height='0px'; }
  });
}

/* ============ PAGE SWITCHING ============ */
function showPage(p){
  if(p!=='explore' && $('searchResults')){ $('searchResults').style.display='none'; if($('mktSearch')) $('mktSearch').value=''; if($('mktSearchX')) $('mktSearchX').style.display='none'; }
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden', el.id!=='page-'+p));
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('on', b.dataset.page===p));
  window.scrollTo(0,0);
  // entrance animation plays once per page per session, not on every revisit
  const pg=$('page-'+p); if(pg && !pg.classList.contains('seen')) setTimeout(()=>pg.classList.add('seen'), 450);
  // money is ALWAYS visible: tabs without the hero pin the glass balance bar (owner request);
  // on Portfolio it stays scroll-triggered so it never doubles the hero
  const pin = p!=='portfolio';
  document.body.classList.toggle('mbfix', pin);
  if(pin){ paintMiniBar(); $('miniBar').classList.add('show'); }
  else $('miniBar').classList.toggle('show', window.scrollY>170);
  if(p==='explore') refreshMarkets(false);
  if(p==='news') refreshNews(false);
  if(p==='insights') renderInsights();
}
document.querySelectorAll('.tabbar button').forEach(b=> b.onclick=()=>showPage(b.dataset.page));
/* one delegated tap handler for every symbol row/card on Explore — survives any re-render */
$('page-explore').addEventListener('click', e=>{
  const el=e.target.closest('.mrow, .idx-card');
  if(el && el.dataset.sym) openStockSheet(el.dataset.sym, el.dataset.name||'');
});
$('page-insights').addEventListener('click', e=>{ // look-through rows now live here too
  const el=e.target.closest('.mrow');
  if(el && el.dataset.sym) openStockSheet(el.dataset.sym, el.dataset.name||'');
});
/* swipe a bottom sheet down to dismiss it (mobile) */
function wireSheetDrag(sheetId, closeFn){
  const sh=$(sheetId); let y0=null, dy=0, dragging=false;
  sh.addEventListener('touchstart', e=>{ if(sh.scrollTop>2) return; y0=e.touches[0].clientY; dy=0; dragging=true; }, {passive:true});
  sh.addEventListener('touchmove', e=>{
    if(!dragging||y0==null) return;
    dy=e.touches[0].clientY-y0;
    if(dy>0 && sh.scrollTop<=2) sh.style.transform=`translateY(${dy}px)`;
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
$('taxCard').onclick=openTaxSheet;
$('divTitle').onclick=openDivSheet;
$('peCard').onclick=openPESheet;
$('riskCard').onclick=openRiskSheet;
$('healthCard').onclick=openHealthSheet;
$('sectorCard').onclick=openSectorSheet;
$('locCard').onclick=openLocSheet;

/* ============ WIRING ============ */
function ringSvg(pct, color, r){
  const R=r||46, C=2*Math.PI*R, off=C*(1-Math.min(1,Math.max(0,pct)));
  return `<svg width="${(R+8)*2}" height="${(R+8)*2}" viewBox="0 0 ${(R+8)*2} ${(R+8)*2}">
    <circle class="rc" cx="${R+8}" cy="${R+8}" r="${R}"/>
    <circle class="rp" cx="${R+8}" cy="${R+8}" r="${R}" style="stroke:${color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/></svg>`;
}
function renderGoalForm(prefill){ // shared by first-time setup and "Change goal" (prefilled — never lose the number)
  const card=$('goalCard');
  card.querySelector('.card-title').style.display='';
  $('goalBody').innerHTML=`<div class="goalset">
    <div style="color:var(--mut);font-size:12.5px;line-height:1.5;margin-bottom:10px;font-weight:500">Set a target and track your progress with a projected finish date based on your real return.</div>
    <input id="goalInput" type="number" inputmode="decimal" placeholder="Target amount, e.g. 100000" aria-label="Goal amount"${prefill>0?` value="${prefill}"`:''}>
    <button class="btn pri" id="goalSave" style="width:100%;margin-top:10px">${prefill>0?'Update goal':'Set goal'}</button>
    ${prefill>0?'<div class="ebtns" style="margin-top:8px"><button class="btn sec" id="goalCancel" style="flex:1">Cancel</button><button class="btn warn" id="goalRemove" style="flex:1">Remove goal</button></div>':''}</div>`;
  $('goalSave').onclick=()=>{ const v=+$('goalInput').value; if(v>0){ state.goal={amt:v}; lsSet('pt_goal',state.goal); renderGoal(); if(typeof renderProjection==='function' && !$('page-insights').classList.contains('hidden')) renderProjection(); } };
  const gc=$('goalCancel'); if(gc) gc.onclick=renderGoal;
  const gr=$('goalRemove'); if(gr) gr.onclick=()=>{ state.goal=null; lsSet('pt_goal',null); renderGoal(); };
}
function renderGoal(){
  const card=$('goalCard'), t=totals('all');
  if(!state.goal || !(state.goal.amt>0)){ renderGoalForm(0); return; }
  const goal=state.goal.amt, pct=t.value/goal, remain=goal-t.value;
  const rr=personalReturn('all'); const r=(rr!=null&&rr>0.005)?Math.min(rr,0.15):0.08; // cap optimism
  let eta='';
  if(remain>0){
    // months for TODAY'S money alone to compound to the goal — no future deposits assumed (owner request)
    const rm=Math.pow(1+r,1/12)-1; let v=t.value, m=0;
    while(v<goal && m<720){ v=v*(1+rm); m++; }
    const yr=new Date(); yr.setMonth(yr.getMonth()+m);
    eta = (m<720 && t.value>0) ? `Today's money alone gets there <span class="eta">${yr.toLocaleDateString([],{month:'short',year:'numeric'})}</span> at ~${(r*100).toFixed(0)}%/yr — every new buy pulls that date closer.` : `Today's balance alone won't compound to this within 60 years — new deposits will do the heavy lifting.`;
  } else { eta=`<span class="eta">Goal reached</span> — ${fmt(-remain)} past target. Time for a bigger one?`; }
  card.querySelector('.card-title').style.display='none';
  $('goalBody').innerHTML=`<div class="goalwrap">
    <div class="ring">${ringSvg(pct, remain>0?'var(--brand)':'var(--green)')}<div class="rt"><b>${(pct*100).toFixed(0)}%</b><span>of goal</span></div></div>
    <div class="goalinfo"><div class="gt">${fmt(t.value)} of ${fmt(goal)}</div>
      <div class="gs">${remain>0?fmt(remain)+' to go · ':''}${eta}</div>
      <div class="gs" style="margin-top:6px"><a href="#" id="goalEdit" style="color:var(--mut)">Change goal</a></div></div></div>`;
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
function renderHealth(){
  const {score,metrics}=healthScore();
  const grade=score>=85?'A':score>=75?'B':score>=65?'C':score>=50?'D':'F';
  const col=score>=75?cvar('--green'):score>=55?cvar('--warn'):cvar('--red');
  const label=score>=85?'Excellent':score>=75?'Strong':score>=65?'Solid':score>=50?'Needs work':'At risk';
  const barCol=v=>v>=75?cvar('--green'):v>=50?cvar('--warn'):cvar('--red');
  const tips=metrics.filter(m=>m.tip).slice(0,3);
  $('healthBody').innerHTML=`
    <div class="hsplit">
      <div class="hscore">${ringSvg(score/100, col, 40)}<div class="rt"><b style="color:${col}">${grade}</b><span>${score}/100</span></div></div>
      <div class="hgrade"><div class="hg">${label}</div>
        <div class="hd">A blend of your diversification, global mix, fees, and how much is put to work.</div></div>
    </div>
    <div class="hbars">${metrics.map(m=>`<div class="hmet"><div class="t"><span>${m.k}</span><span class="s">${m.detail}</span></div>
      <div class="bar"><i style="width:${m.v.toFixed(0)}%;background:${barCol(m.v)}"></i></div></div>`).join('')}</div>
    ${tips.length?`<div class="htips">${tips.map(t=>`<div class="htip"><span class="ti">→</span><span>${t.tip}</span></div>`).join('')}</div>`:''}`;
}
function renderMover(){ // day-change attribution: which holdings drove today's move
  const card=$('moverCard'); const rs=rows(state.view.acc);
  const items=rs.map(r=>{
    const p=priceOf(r.sym), pv=prevOf(r.sym); if(!(pv>0)||!(p>0)) return null;
    return {sym:r.sym, pct:(p/pv-1)*100, impact:r.qty*(p-pv)};
  }).filter(x=>x && Math.abs(x.pct)>=0.01).sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));
  if(!items.length){ card.style.display='none'; return; }
  card.style.display='';
  const tot=items.reduce((a,x)=>a+x.impact,0);
  $('moverBody').innerHTML = `<div class="drivehead"><span>Today's drivers</span><span class="${cls(tot)}">${fmtSign(tot)}</span></div>`+
    items.slice(0,3).map(x=>`<div class="drow" data-sym="${esc(x.sym)}">
      ${badgeHtml(x.sym,true)}
      <div class="mmid"><div class="msym">${esc(x.sym.replace('-','.'))}</div></div>
      <div class="mright"><span class="${cls(x.impact)}" style="font-weight:700;font-size:13.5px">${fmtSign(x.impact)}</span>
      <span class="pctpill ${x.pct>=0?'up':'down'}" style="margin-left:8px">${fmtPct(x.pct)}</span></div></div>`).join('');
  $('moverBody').querySelectorAll('.drow').forEach(el=> el.onclick=()=>openDetail(el.dataset.sym));
}
function renderAll(){
  renderMover(); renderGoal(); renderHomePr(); renderStale(); renderHeader(); renderChips(); renderList(); renderChart(); renderAlloc(); renderIncome(); setStatus();
  if(!$('page-insights').classList.contains('hidden')) renderInsights();
  if(!$('page-explore').classList.contains('hidden')) renderMarkets();
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
window.addEventListener('scroll', ()=>{
  if(mbTick) return; mbTick=true;
  setTimeout(()=>{
    mbTick=false;
    if($('page-portfolio').classList.contains('hidden')) return; // other tabs keep the bar pinned (showPage owns it)
    const show=window.scrollY>170 && !document.body.classList.contains('locked');
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
