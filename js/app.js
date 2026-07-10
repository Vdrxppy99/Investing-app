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
function renderGoal(){
  const card=$('goalCard'), t=totals('all');
  if(!state.goal || !(state.goal.amt>0)){
    card.querySelector('.card-title').style.display='';
    $('goalBody').innerHTML=`<div class="goalset">
      <div style="color:var(--mut);font-size:12.5px;line-height:1.5;margin-bottom:10px;font-weight:500">Set a target and track your progress with a projected finish date based on your real return.</div>
      <input id="goalInput" type="number" inputmode="decimal" placeholder="Target amount, e.g. 100000">
      <button class="btn pri" id="goalSave" style="width:100%;margin-top:10px">Set goal</button></div>`;
    $('goalSave').onclick=()=>{ const v=+$('goalInput').value; if(v>0){ state.goal={amt:v}; lsSet('pt_goal',state.goal); renderGoal(); } };
    return;
  }
  const goal=state.goal.amt, pct=t.value/goal, remain=goal-t.value;
  const rr=personalReturn('all'); const r=(rr!=null&&rr>0.005)?Math.min(rr,0.15):0.08; // cap optimism
  let eta='';
  if(remain>0){
    // months to reach goal at rate r with current monthly contribution
    const buys=state.lots.filter(l=>!l.div);
    const months=buys.length?Math.max(1,(Date.now()-new Date(buys.map(l=>l.date).sort()[0]).getTime())/2629800000):12;
    const pmt=buys.reduce((a,l)=>a+l.cost,0)/months;
    const rm=Math.pow(1+r,1/12)-1; let v=t.value, m=0;
    while(v<goal && m<720){ v=v*(1+rm)+pmt; m++; }
    const yr=new Date(); yr.setMonth(yr.getMonth()+m);
    eta = m<720 ? `On track for <span class="eta">${yr.toLocaleDateString([],{month:'short',year:'numeric'})}</span> at ~${(r*100).toFixed(0)}%/yr + your ${fmt(pmt)}/mo pace.` : `Increase contributions to reach this within 60 years.`;
  } else { eta=`<span class="eta">Goal reached</span> — ${fmt(-remain)} past target. Time for a bigger one?`; }
  card.querySelector('.card-title').style.display='none';
  $('goalBody').innerHTML=`<div class="goalwrap">
    <div class="ring">${ringSvg(pct, remain>0?'var(--brand)':'var(--green)')}<div class="rt"><b>${(pct*100).toFixed(0)}%</b><span>of goal</span></div></div>
    <div class="goalinfo"><div class="gt">${fmt(t.value)} of ${fmt(goal)}</div>
      <div class="gs">${remain>0?fmt(remain)+' to go · ':''}${eta}</div>
      <div class="gs" style="margin-top:6px"><a href="#" id="goalEdit" style="color:var(--mut)">Change goal</a></div></div></div>`;
  $('goalEdit').onclick=e=>{ e.preventDefault(); state.goal=null; lsSet('pt_goal',null); renderGoal(); };
}
function healthScore(){
  const rs=rows('all'), t=totals('all'), inv=Math.max(1,t.value-cashFor('all'));
  const metrics=[];
  // 1. Diversification — penalize concentration in largest single holding
  const top=Math.max(0,...rs.map(r=>r.qty*priceOf(r.sym)/inv));
  const divScore=Math.max(0,Math.min(100, 100-(top-0.25)*220));
  metrics.push({k:'Diversification', v:divScore, detail:`Largest holding ${(top*100).toFixed(0)}%`, tip: top>0.30?`Your largest position is ${(top*100).toFixed(0)}% of the portfolio — concentration adds single-name risk.`:null});
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
  const col=score>=75?cvar('--green'):score>=55?'#fab219':cvar('--red');
  const label=score>=85?'Excellent':score>=75?'Strong':score>=65?'Solid':score>=50?'Needs work':'At risk';
  const barCol=v=>v>=75?cvar('--green'):v>=50?'#fab219':cvar('--red');
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
      <div class="badge sm" style="${bstyle(colorOf(x.sym))}">${badge(x.sym)}</div>
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
$('benchBtn').onclick = ()=>{ // cycle: off → S&P 500 → Total World → off
  const next = state.view.bench==='off' ? 'VOO' : state.view.bench==='VOO' ? 'VT' : 'off';
  state.view.bench=next; lsSet('pt_bench', next);
  if(next==='VT') ensureBenchHistory('VT').then(ok=>{ if(ok) renderChart(); });
  renderChart();
};
$('metricSeg').querySelectorAll('button').forEach(b=> b.onclick=()=>{ state.view.metric=b.dataset.m; $('metricSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); renderChart(); });
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
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeDetail(); $('editModal').classList.add('hidden'); } });

(function(){ const h=new Date().getHours();
  const g = h<5?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  document.querySelector('.brand').innerHTML = g+`<span class="bdate"> · ${new Date().toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}</span>`;
})();
renderAll();
animateTotal();
refreshAll(false).then(schedulePoll);
setInterval(()=>{ if(!state.fetching) setStatus(); }, 1000);
if('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); } // keep the "Xs ago" stamp ticking
