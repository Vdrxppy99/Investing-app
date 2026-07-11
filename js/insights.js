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
if(window.Chart) Chart.register(centerTxt);
function drawDonut(id, labels, data, colors, center){
  const el=$(id); if(!window.Chart) return null;
  const o=Chart.getChart(el); if(o) o.destroy();
  return new Chart(el,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:cvar('--card')}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false},centerTxt:center||false,
      tooltip:{backgroundColor:cvar('--card2'),borderColor:cvar('--line'),borderWidth:1,bodyColor:cvar('--tx'),displayColors:false,callbacks:{label:c=>c.label+': '+fmt(c.parsed)}}}}});
}
function donutLegend(el, items, total){
  $(el).innerHTML = items.map(i=>`<div class="alg"><span class="dot" style="background:${i.color}"></span>${esc(i.label)}<span class="alp">${(i.v/total*100).toFixed(1)}%</span></div>`).join('');
}
function renderGainsTable(){
  const rs=rows('all');
  let unrl=0;
  const trs=rs.map(r=>{
    const u=r.qty*priceOf(r.sym)-r.cost; unrl+=u;
    return `<tr data-sym="${esc(r.sym)}"><td>${esc(r.sym.replace('-','.'))} <span style="color:var(--mut)">›</span></td><td>${r.qty.toFixed(2)}</td><td>${fmt(0)}</td><td class="${cls(u)}">${fmtSign(u)}</td></tr>`;
  }).join('');
  $('gainsTable').innerHTML = `<tr><th>Asset</th><th>Owned</th><th>Realized</th><th>Unrealized</th></tr>${trs}
    <tr><td>Total</td><td></td><td>${fmt(0)}</td><td class="${cls(unrl)}"><b>${fmtSign(unrl)}</b></td></tr>`;
  $('gainsTable').querySelectorAll('tr[data-sym]').forEach(tr=> tr.onclick=()=>openDetail(tr.dataset.sym));
}
function stackBar(el, items){ // part-of-whole as a single stacked bar
  const tot=items.reduce((a,i)=>a+i.v,0)||1;
  $(el).innerHTML = items.map(i=>`<span style="width:${(i.v/tot*100).toFixed(2)}%;background:${i.color}" title="${esc(i.label)}"></span>`).join('');
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
function renderLocDonut(){
  const items=locItems();
  stackBar('locBar', items);
  donutLegend('locLegend', items, items.reduce((a,i)=>a+i.v,0));
}
function renderLook(){
  if(!$('lookList')) return;
  const sub=$('lookSub');
  if(sub){
    const syms=new Set(rows('all').map(r=>r.sym));
    let n=0;
    if(syms.has('VTI')) n+=3600; else { if(syms.has('VOO')) n+=500; if(syms.has('VXF')) n+=3400; }
    if(syms.has('VXUS')) n+=8300;
    sub.textContent = n>1000 ? `Your funds hold ~${n.toLocaleString()} companies across ~50 countries — these are your biggest slices.` : '';
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
  const ddChart=new Chart(el,{type:'line',data:{labels,datasets:[{data:dd,borderColor:cvar('--red'),
      backgroundColor:`rgba(${cvar('--red-rgb')},.13)`,fill:true,pointRadius:0,borderWidth:1.6,tension:.25}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{backgroundColor:cvar('--card2'),borderColor:cvar('--line'),borderWidth:1,titleColor:cvar('--mut'),bodyColor:cvar('--tx'),displayColors:false,
        callbacks:{label:c=>c.parsed.y<-0.05?c.parsed.y.toFixed(1)+'% below peak':'At the peak'}}},
      scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,maxRotation:0,font:{size:10},callback:function(v){return this.getLabelForValue(v).slice(5);}}},
              y:{max:0,grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:4,font:{size:10},callback:v=>v+'%'}}}}});
  attachScrubAny(ddChart, i=>{
    $('ddStat').innerHTML = i==null ? ddBase :
      `${niceLbl(labels[i])} · <b class="${dd[i]<-0.05?'neg':'pos'}">${dd[i]<-0.05?dd[i].toFixed(1)+'% below peak':'at the peak'}</b>`;
  });
}
function renderPECard(){
  const rs=rows('all'); let wsum=0, earn=0;
  for(const r of rs){ const m=FUND_META[r.sym]; if(!m||!m.pe) continue; const v=r.qty*priceOf(r.sym); wsum+=v; earn+=v/m.pe; }
  const pe=earn>0?wsum/earn:0;
  $('peCard').innerHTML='<div class="it">Portfolio P/E <span class="chev">›</span></div>'+
    `<div class="big-n">${pe.toFixed(1)}×</div><div class="sub-n">You pay ~$${pe.toFixed(0)} per $1 of yearly earnings across everything you own.</div>`+
    rs.filter(r=>FUND_META[r.sym]).map(r=>`<div class="krow"><span class="k">${esc(r.sym.replace('-','.'))}</span><span>${FUND_META[r.sym].pe}×</span></div>`).join('');
}
function riskStats(){
  const rs=rows('all'); const t=totals('all');
  const investedVal=Math.max(1,t.value-cashFor('all'));
  const w={}; for(const r of rs) w[r.sym]=r.qty*priceOf(r.sym)/investedVal;
  const H={};
  for(const r of rs){ const h=state.history[r.sym]; if(!h) continue; const m={}; for(let i=0;i<h.t.length;i++) if(h.c[i]!=null) m[dayStr(h.t[i])]=h.c[i]; H[r.sym]=m; }
  const days=[...new Set([].concat(...Object.values(H).map(m=>Object.keys(m))))].sort().slice(-253);
  const rets=[], voo=[];
  for(let i=1;i<days.length;i++){
    let rp=0;
    for(const s of Object.keys(H)){ const a=H[s][days[i-1]], b=H[s][days[i]]; if(a&&b) rp+=(w[s]||0)*(b/a-1); }
    rets.push(rp);
    const va=H.VOO&&H.VOO[days[i-1]], vb=H.VOO&&H.VOO[days[i]];
    voo.push(va&&vb?vb/va-1:null);
  }
  if(rets.length<30) return null;
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const mu=mean(rets);
  const vol=Math.sqrt(mean(rets.map(r=>(r-mu)**2)))*Math.sqrt(252)*100;
  const pairs=rets.map((r,i)=>[r,voo[i]]).filter(p=>p[1]!=null);
  const mx=mean(pairs.map(p=>p[1])), my=mean(pairs.map(p=>p[0]));
  const cov=mean(pairs.map(p=>(p[0]-my)*(p[1]-mx))), vx=mean(pairs.map(p=>(p[1]-mx)**2));
  const beta=vx>0?cov/vx:1;
  let peak=0, mdd=0; const s=buildSeries('all');
  if(s) for(const v of s.value){ if(v>peak) peak=v; if(peak>0){ const dd=(v-peak)/peak; if(dd<mdd) mdd=dd; } }
  return {vol, beta, mdd:mdd*100};
}
function renderRiskCard(){
  const r=riskStats();
  if(!r){ $('riskCard').innerHTML='<div class="it">Risk <span class="chev">›</span></div><div class="sub-n">Needs a year of price history — connect once.</div>'; return; }
  const lvl = r.vol<10?['Low',cvar('--green')]:r.vol<18?['Moderate','#fab219']:r.vol<28?['Elevated','#ec835a']:['High',cvar('--red')];
  $('riskCard').innerHTML='<div class="it">Risk <span class="chev">›</span></div>'+
    `<span class="risk-badge" style="background:${lvl[1]}22;color:${lvl[1]}">${lvl[0]}</span>`+
    `<div class="krow"><span class="k">Volatility (1Y)</span><span>${r.vol.toFixed(1)}%</span></div>
     <div class="krow"><span class="k">Beta vs S&P 500</span><span>${r.beta.toFixed(2)}</span></div>
     <div class="krow"><span class="k">Max drawdown</span><span class="neg">${r.mdd.toFixed(1)}%</span></div>`+
    `<div class="sub-n" style="margin-top:9px">${r.beta<0.995?`You swing ${Math.round((1-r.beta)*100)}% less than the market.`:r.beta>1.005?`You swing ${Math.round((r.beta-1)*100)}% more than the market.`:'You move in lockstep with the market.'}</div>`;
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
  const ds=Object.keys(ASSET_CLASSES).map(k=>({label:k, data:[], borderColor:colors[k], borderWidth:1.8, pointRadius:0, pointHoverRadius:3, tension:.25, fill:false}));
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
  const worthChart=new Chart(el,{type:'line',data:{labels:days,datasets:shown},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{backgroundColor:cvar('--card2'),borderColor:cvar('--line'),borderWidth:1,titleColor:cvar('--mut'),bodyColor:cvar('--tx'),displayColors:false,callbacks:{label:c=>c.dataset.label+': '+fmt(c.parsed.y)}}},
      scales:{x:{grid:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,maxRotation:0,font:{size:10},callback:function(v){return this.getLabelForValue(v).slice(5);}}},
              y:{grid:{color:cvar('--grid')},border:{display:false},ticks:{color:cvar('--mut'),maxTicksLimit:5,font:{size:10},callback:v=>state.view.priv?'':new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate())}}}}});
  $('worthLegend').innerHTML=shown.map(d=>`<div class="alg"><span class="dot" style="background:${d.borderColor}"></span>${d.label}</div>`).join('');
  attachScrubAny(worthChart, i=>{ const ro=$('worthRO'); if(!ro) return;
    ro.textContent = i==null ? '' : `${niceLbl(days[i])} · `+shown.map(d=>`${d.label} ${cfmt(d.data[i])}`).join(' · '); });
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
  const body = `<p>How much your portfolio swings, measured from your real price history.</p>
    <div class="krow"><span class="k">Volatility (1Y)</span><span>${r.vol.toFixed(1)}%</span></div>
    <div class="krow"><span class="k">Beta vs S&P 500</span><span>${r.beta.toFixed(2)}</span></div>
    <div class="krow"><span class="k">Max drawdown</span><span class="neg">${r.mdd.toFixed(1)}%</span></div>
    <p style="margin-top:12px"><b>Volatility</b> is the size of your typical swing — under 15% is calm for stocks. <b>Beta</b> of ${r.beta.toFixed(2)} means you move ${r.beta<1?'less':'more'} than the S&P 500 (1.0 = in lockstep). <b>Max drawdown</b> is the worst peak-to-trough drop you\'ve lived through.</p>`;
  openInfoSheet('Risk', body);
}
function openHealthSheet(){
  const {score,metrics}=healthScore();
  const barCol=v=>v>=75?cvar('--green'):v>=50?'#fab219':cvar('--red');
  const body = `<p>A single grade for your portfolio\'s shape, averaged from four checks. Tap any bar\'s topic below to see where you stand and how to improve.</p>`
    + metrics.map(m=>`<div class="hmet"><div class="t"><span>${m.k}</span><span class="s">${m.detail} · ${Math.round(m.v)}/100</span></div><div class="bar"><i style="width:${m.v.toFixed(0)}%;background:${barCol(m.v)}"></i></div>${m.tip?`<div class="htip" style="margin-top:7px"><span class="ti">→</span><span>${m.tip}</span></div>`:'<div class="htip" style="margin-top:7px;color:var(--mut)"><span class="ti">✓</span><span>Looking good here.</span></div>'}</div>`).join('')
    + `<p style="margin-top:6px;color:var(--faint);font-size:11px">Score = average of the four checks. Guidance, not financial advice.</p>`;
  openInfoSheet('Portfolio Health · '+score+'/100', body);
}
function periodReturns(){ // deposit-adjusted returns: modified Dietz short windows, chained monthly Dietz long ones
  const s=buildSeries('all'); if(!s||s.labels.length<3) return [];
  const n=s.labels.length;
  const eom={}; for(let i=0;i<n;i++) eom[s.labels[i].slice(0,7)]=s.value[i];
  const depM={}; for(const l of state.lots){ if(!l.div) depM[l.date.slice(0,7)]=(depM[l.date.slice(0,7)]||0)+l.cost; }
  const months=Object.keys(eom).sort(); const mret={};
  for(let i=1;i<months.length;i++){ const m=months[i], v0=eom[months[i-1]], d=depM[m]||0;
    if(v0>0) mret[m]=(eom[m]-v0-d)/(v0+d/2); }
  const out=[];
  for(const [k,cut,mode] of [['1W',rangeCutoff('1W'),'dietz'],['1M',rangeCutoff('1M'),'dietz'],['6M',rangeCutoff('6M'),'chain'],['YTD',rangeCutoff('YTD'),'chainIncl'],['1Y',rangeCutoff('1Y'),'chain'],['All','0000-00-00','chainIncl']]){
    let i=s.labels.findIndex(d=>d>=cut); if(i<0) i=0;
    if(i>=n-1){ out.push({k,p:null}); continue; }
    let p=null;
    if(mode==='dietz'){
      const V0=s.value[i], D=state.lots.filter(l=>!l.div&&l.date>s.labels[i]).reduce((a,l)=>a+l.cost,0);
      if(V0+D/2>0) p=(s.value[n-1]-V0-D)/(V0+D/2)*100;
    } else {
      const cutM=s.labels[i].slice(0,7); let acc=1, any=false;
      for(const m of months) if(mret[m]!=null && (mode==='chainIncl' ? m>=cutM : m>cutM)){ acc*=1+mret[m]; any=true; }
      if(any) p=(acc-1)*100;
    }
    out.push({k,p});
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
  }
  html += `<div class="inc-note">Your returns are deposit-adjusted (new money doesn't inflate them); S&P 500 = VOO price change over the same window, excluding its dividends. "Same buys" replays each of your ${state.lots.filter(l=>!l.div).length} purchases into VOO on the same dates — the honest benchmark for your timing. Tap a period to see it on the chart.</div>`;
  $('perfBody').innerHTML=html;
  $('perfBody').querySelectorAll('tr[data-r]').forEach(tr=> tr.onclick=()=>{
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
function renderInsights(){ renderHealth(); renderPerf(); renderDrawdown(); renderCoach(); renderProjection(); renderGainsTable(); renderLook(); ensureLookQuotes(); renderLocDonut(); renderPECard(); renderRiskCard(); renderTaxCard(); renderSectorDonut(); renderHeatmap(); renderWorthChart(); renderContribChart(); setTimeout(ensureChartsSized,150); }

/* ============ TAX LOTS / SECTORS / HEATMAP / CONTRIB / PROJECTOR (Insights) ============ */
function renderTaxCard(){
  const now=Date.now(), YR=31557600000;
  let st=0, lt=0; const turning=[];
  for(const l of state.lots){
    const g=l.qty*priceOf(l.sym)-l.cost;
    const bought=new Date(l.date+'T12:00:00').getTime();
    if(now-bought>=YR) lt+=g;
    else { st+=g; turning.push({sym:l.sym, when:bought+YR, g}); }
  }
  turning.sort((a,b)=>a.when-b.when);
  const tot=st+lt, ltPct=tot>0?lt/tot*100:0;
  $('taxCard').innerHTML='<div class="it">Tax Lots <span class="chev">›</span></div>'+
    `<div class="big-n">${ltPct.toFixed(0)}%</div><div class="sub-n">of your gains are long-term (lower US tax rate)</div>`+
    `<div class="krow"><span class="k">Long-term gains</span><span class="${cls(lt)}">${fmtSign(lt)}</span></div>
     <div class="krow"><span class="k">Short-term gains</span><span class="${cls(st)}">${fmtSign(st)}</span></div>`+
    turning.slice(0,3).map(x=>`<div class="krow"><span class="k">${esc(x.sym.replace('-','.'))} ${fmtSign(x.g)} → LT</span><span>${new Date(x.when).toLocaleDateString([],{month:'short',day:'numeric'})}</span></div>`).join('');
}
/* approximate sector mix per fund (published fund pages, estimates) */
const SECTOR_WEIGHTS = {
  'VOO':{Technology:33,Financials:13,'Consumer Disc.':11,'Comm. Services':10,Healthcare:10,Industrials:8,Other:15},
  'VTI':{Technology:31,Financials:14,'Consumer Disc.':11,Healthcare:11,'Comm. Services':9,Industrials:9,Other:15},
  'VXF':{Technology:20,Industrials:17,Financials:16,Healthcare:12,'Consumer Disc.':11,Other:24},
  'VXUS':{Financials:22,Industrials:14,Technology:13,'Consumer Disc.':10,Healthcare:9,Other:32},
  'VYM':{Financials:22,Healthcare:12,'Consumer Staples':12,Industrials:12,Technology:10,Other:32},
  'BRK-B':{Financials:100}
};
function renderSectorDonut(){
  const per={};
  for(const r of rows('all')){
    const w=SECTOR_WEIGHTS[r.sym]; if(!w) continue;
    const v=r.qty*priceOf(r.sym);
    for(const [s,pc] of Object.entries(w)) per[s]=(per[s]||0)+v*pc/100;
  }
  let other=per['Other']||0; delete per['Other'];
  const items=Object.entries(per).sort((a,b)=>b[1]-a[1]);
  const top=items.slice(0,6); other += items.slice(6).reduce((a,x)=>a+x[1],0);
  if(other>0) top.push(['Other',other]);
  const tot=top.reduce((a,x)=>a+x[1],0)||1; const max=top[0][1]||1;
  const ss=$('sectorSub');
  if(ss && top.length) ss.textContent=`${top[0][0]} is your biggest bet at ${(top[0][1]/tot*100).toFixed(0)}% — every ${top[0][0].toLowerCase()} rally works for you.`;
  $('sectorBars').innerHTML = top.map(([label,v])=>`<div class="hbrow"><div class="t"><span>${esc(label)}</span><span class="p">${(v/tot*100).toFixed(1)}%</span></div><div class="bar"><i style="width:${(v/max*100).toFixed(1)}%"></i></div></div>`).join('');
}
function renderHeatmap(){
  const s=buildSeries('all'); if(!s||s.labels.length<40){ $('hmBody').innerHTML='<div class="sub-n">Needs price history.</div>'; return; }
  const endOfMonth={}; // 'YYYY-MM' -> last value seen that month
  for(let i=0;i<s.labels.length;i++) endOfMonth[s.labels[i].slice(0,7)]=s.value[i];
  const dep={}; // deposits per month
  for(const l of state.lots){ if(!l.div) dep[l.date.slice(0,7)]=(dep[l.date.slice(0,7)]||0)+l.cost; }
  const months=Object.keys(endOfMonth).sort();
  const ret={}; const years=new Set();
  for(let i=1;i<months.length;i++){
    const m=months[i], v0=endOfMonth[months[i-1]], v1=endOfMonth[m], d=dep[m]||0;
    if(v0>0) ret[m]=(v1-v0-d)/(v0+d/2)*100;
    years.add(m.slice(0,4));
  }
  const MN=['J','F','M','A','M','J','J','A','S','O','N','D'];
  let html='<table class="hm"><tr><th></th>'+MN.map(m=>`<th>${m}</th>`).join('')+'<th>Yr</th></tr>';
  for(const y of [...years].sort().reverse()){
    let yr=1, any=false;
    html+=`<tr><td class="y">${y}</td>`;
    for(let m=1;m<=12;m++){
      const k=y+'-'+String(m).padStart(2,'0');
      if(ret[k]==null){ html+='<td></td>'; continue; }
      any=true; yr*=1+ret[k]/100;
      const a=Math.min(.45,Math.abs(ret[k])/14);
      html+=`<td style="background:${ret[k]>=0?`rgba(${cvar('--green-rgb')},${a})`:`rgba(${cvar('--red-rgb')},${a})`}">${ret[k].toFixed(1)}</td>`;
    }
    html+=any?`<td class="${cls(yr-1)}" style="font-weight:700">${((yr-1)*100).toFixed(1)}</td></tr>`:'<td></td></tr>';
  }
  $('hmBody').innerHTML=html+'</table>';
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
  const compact=v=>state.view.priv?'':new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact'}).format(v*rate());
  const contribChart=new Chart(el,{data:{labels:show,datasets:[
      {type:'bar',label:'That month',data:sdata,backgroundColor:cvar('--brand'),borderRadius:3,yAxisID:'y'},
      {type:'line',label:'Total deposited',data:scum,borderColor:CAT[3],borderWidth:1.8,pointRadius:0,pointHoverRadius:3,tension:.25,yAxisID:'y1'}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{backgroundColor:cvar('--card2'),borderColor:cvar('--line'),borderWidth:1,titleColor:cvar('--mut'),bodyColor:cvar('--tx'),displayColors:false,callbacks:{label:c=>c.dataset.label+': '+fmt(c.parsed.y)}}},
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
function cfmt(v){ return state.view.priv?'••••':new Intl.NumberFormat(state.view.ccy==='EUR'?'de-DE':'en-US',{style:'currency',currency:state.view.ccy,notation:'compact',maximumFractionDigits:1}).format(v*rate()); }
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
  if(cashPct>0.05) items.push({ic:'⚡', stat:`${(cashPct*100).toFixed(1)}%`, label:'cash sitting idle', sev:'warn', t:'Put idle cash to work',
    b:`${fmt(cash)} (${(cashPct*100).toFixed(0)}% of the portfolio) is uninvested. At your ~${(r*100).toFixed(0)}%/yr pace that's ≈${fmt(cash*r)} of growth per year sitting out.`});
  // single-company weight (index funds are already diversified)
  const DIV=new Set(['VOO','VTI','VXF','VXUS','VYM','VT','BND','VNQ','SCHD','QQQ','AVUV','GLDM','VGT','BRK-B']); // BRK.B = diversified conglomerate
  const singles=rs.filter(x=>!DIV.has(x.sym)).map(x=>({sym:x.sym, w:x.qty*priceOf(x.sym)/Math.max(1,t.value)})).sort((a,b)=>b.w-a.w);
  if(singles.length && singles[0].w>0.15) items.push({ic:'⚖️', stat:`${(singles[0].w*100).toFixed(0)}%`, label:`in ${singles[0].sym.replace('-','.')} alone`, sev:'warn', t:`${singles[0].sym.replace('-','.')} is a big single bet`,
    b:`${(singles[0].w*100).toFixed(0)}% of everything rides on one company. Steering new contributions to your index funds dilutes that gradually — no selling, no taxes.`});
  // all-equity note
  if(!rs.some(x=>['BND','BNDX','AGG','BSV'].includes(x.sym))){
    const rk=riskStats();
    items.push({ic:'🛡️', stat:`${rk?Math.abs(rk.mdd).toFixed(0):'–'}%`, label:'worst drop · all stocks', sev:'info', t:'100% stocks — know the ride',
      b:`Maximum long-run growth, but your worst drop so far was ${rk?rk.mdd.toFixed(0):'-'}%. Fine for a long horizon; if a big goal is under ~5 years away, a slice of bonds (BND) softens the swings.`});
  }
  // tax lots turning long-term soon
  const YR=31557600000, now=Date.now();
  const turning=state.lots.map(l=>({sym:l.sym, g:l.qty*priceOf(l.sym)-l.cost, at:new Date(l.date+'T12:00:00').getTime()+YR}))
    .filter(x=>x.at>now && x.at<now+45*86400e3 && x.g>25).sort((a,b)=>a.at-b.at);
  if(turning.length){
    const x=turning[0], d=new Date(x.at).toLocaleDateString([],{month:'short',day:'numeric'});
    const dl=Math.max(1,Math.ceil((x.at-now)/86400e3));
    items.push({ic:'🧾', stat:`${dl}d`, label:`${x.sym.replace('-','.')} → long-term`, sev:'warn', t:`Selling ${x.sym.replace('-','.')}? Wait until ${d}`,
      b:`A lot with ${fmtSign(x.g)} of gain turns long-term on ${d} — before that, the gain would be taxed at the higher short-term rate.`});
  }
  // contribution cadence
  const {pmt, buys}=contribPace();
  const lastBuy=buys.map(l=>l.date).sort().pop();
  if(lastBuy){
    const days=Math.floor((now-new Date(lastBuy+'T12:00:00').getTime())/86400e3);
    if(days>40) items.push({ic:'🔁', stat:`${days}d`, label:'since your last buy', sev:'warn', t:'Keep the contribution streak',
      b:`Last buy was ${days} days ago. The projections below assume your ${fmt(pmt)}/mo pace continues — consistency is the whole engine.`});
  }
  if(!state.goal||!(state.goal.amt>0)) items.push({ic:'🎯', stat:'Set one', label:'no goal yet', sev:'info', t:'Set a goal',
    b:'Give the money a number. A target unlocks the progress ring and a projected finish date on the Portfolio tab.'});
  return items.slice(0,4);
}
function renderCoach(){
  const grid=$('coachGrid'); if(!grid) return;
  const items=coachItems();
  grid.innerHTML = items.length ? items.map(x=>
    `<div class="icard cmove sev-${x.sev||'info'}"><span class="chev">›</span>
      <div class="cicon">${x.ic}</div>
      <div class="big-n">${x.stat}</div>
      <div class="sub-n">${x.label}</div></div>`).join('')
    : '<div class="icard wide"><div class="sub-n" style="text-align:center;padding:10px 0">✓ Nothing needs your attention — the portfolio is running clean.</div></div>';
  grid.querySelectorAll('.cmove').forEach((el,i)=> el.onclick=()=>openInfoSheet(items[i].t, `<p>${items[i].b}</p>`));
}
let projYears=10;
function renderProjection(){
  const el=$('projChart'); if(!el||!window.Chart) return;
  const o=Chart.getChart(el); if(o) o.destroy();
  const V0=totals('all').value;
  const {pmt}=contribPace();
  const scen=[['Cautious 4%',0.04],['Average 7%',0.07],['Strong 10%',0.10]];
  const N=projYears*12, y0=new Date().getFullYear();
  const labels=[], data=scen.map(()=>[]);
  for(let m=0;m<=N;m++){
    labels.push(m);
    scen.forEach((sc,s)=>{ const rm=Math.pow(1+sc[1],1/12)-1;
      data[s].push(m ? data[s][m-1]*(1+rm)+pmt : V0); });
  }
  const goal=(state.goal&&state.goal.amt>0)?state.goal.amt:null;
  const ds=[
    {label:scen[0][0], data:data[0], borderColor:cvar('--faint'), borderDash:[4,4], borderWidth:1.3, pointRadius:0, fill:false, tension:.15},
    {label:scen[2][0], data:data[2], borderColor:cvar('--faint'), borderDash:[4,4], borderWidth:1.3, pointRadius:0,
     fill:{target:0}, backgroundColor:`rgba(${cvar('--green-rgb')},.07)`, tension:.15},
    {label:scen[1][0], data:data[1], borderColor:cvar('--brand'), borderWidth:2.2, pointRadius:0, fill:false, tension:.15}
  ];
  if(goal && goal<data[2][N]*1.4) ds.push({label:'Goal', data:labels.map(()=>goal), borderColor:'#fab219', borderDash:[6,5], borderWidth:1.2, pointRadius:0, fill:false});
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
    if(fwd>0 && V0>0) divLine=`Dividends alone could grow from ${fmt(fwd)}/yr today to ~${fmt(fwd*data[1][N]/V0)}/yr by ${y0+projYears}. `; }
  $('projNote').textContent=divLine+`Assumes your real ${fmt(pmt)}/mo contribution pace continues, compounded monthly at 4% / 7% / 10% a year. Long-run stock returns averaged 7–10% — nobody knows the future. ${goal?'Gold dashed line = your goal. ':''}Not advice.`;
}
if($('projSeg')) $('projSeg').querySelectorAll('button').forEach(b=> b.onclick=()=>{
  projYears=+b.dataset.y;
  $('projSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  renderProjection();
});

