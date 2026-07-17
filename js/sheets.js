'use strict';
/* ============ TAP-THROUGH SHEETS ============ */
const stockCache={};
/* per-symbol news inside any holding/stock sheet */
const sheetNewsCache={};
async function loadSheetNews(sym){
  const box=$('sheetNews'); if(!box || box.dataset.sym!==sym) return;
  const cached=sheetNewsCache[sym];
  if(cached && Date.now()-cached.ts<20*60000){ paintSheetNews(sym, cached.list); return; }
  box.innerHTML='<div class="mload" style="padding:14px 0 4px">Loading news…</div>';
  const got=await fetchNewsQ(sym, sym); // junk/PR filtering happens inside
  sheetNewsCache[sym]={list:got.slice(0,4), ts:Date.now()};
  paintSheetNews(sym, sheetNewsCache[sym].list);
}
function paintSheetNews(sym, list){
  const box=$('sheetNews'); if(!box || box.dataset.sym!==sym) return; // sheet closed or another symbol opened
  box.innerHTML = list.length
    ? `<div style="font-size:13px;font-weight:700;margin-top:18px">Latest news</div>`+list.map(i=>
        `<a class="snrow" href="${esc(i.link)}" target="_blank" rel="noopener">
          <div class="sntitle">${esc(i.title)}</div>
          <div class="nmeta">${esc(i.pub)} · ${agoStr(i.t)}</div></a>`).join('')
    : '';
}
const EXPLAIN = {
  'Total profit':['Total profit','Your total gain since you started — current value minus everything you\'ve deposited. This includes both price gains and dividends you\'ve received.'],
  'Deposited':['Total deposited','Every dollar you\'ve added across both accounts, taken from Vanguard\'s performance page. It\'s the baseline your total profit is measured against.'],
  'Return / yr':['Return per year','Your money-weighted annual return (XIRR). Unlike a simple average, it accounts for <b>when</b> you invested each dollar — so a well-timed buy counts more. It reflects your real experience as an investor.'],
  'Profit':['Profit','Unrealized gain on the shares you currently hold in this account — market value minus what you paid (your cost basis).'],
  'Invested':['Invested','Your cost basis: the total you paid for the shares you still hold in this account.']
};
function openInfoSheet(title, html){
  $('detailSheet').innerHTML = `<div class="sheet-head"><div class="hsym" style="font-size:18px">${title}</div><button class="xbtn" id="detailX" aria-label="Close">✕</button></div><div class="infobody">${html}</div>`;
  $('detail').classList.remove('hidden');
  $('detailX').onclick=closeDetail;
  $('detailX').focus({preventScroll:true});
}
/* in-app replacements for native alert()/confirm() — they match the design system
   (and never say "localhost says…"). Vault flows keep native dialogs: they run pre-unlock. */
function toast(msg, bad){
  const t=$('toast'); if(!t) return;
  t.textContent=msg; t.className='show'+(bad?' bad':'');
  clearTimeout(t._h); t._h=setTimeout(()=>{ t.className=''; }, 2800);
}
function showConfirm(title, msg, yesLabel, onYes){
  openInfoSheet(title, `<p>${msg}</p>
    <div class="ebtns"><button class="btn warn" id="cfYes">${yesLabel}</button><button class="btn sec" id="cfNo">Cancel</button></div>`);
  $('cfYes').onclick=()=>{ closeDetail(); onYes(); };
  $('cfNo').onclick=closeDetail;
}
function explainStat(key){ const e=EXPLAIN[key]; if(e) openInfoSheet(e[0], `<p>${e[1]}</p>`); }
function openListSheet(title, bodyHtml, note){
  $('detailSheet').innerHTML = `<div class="sheet-head"><div class="hsym" style="font-size:18px">${title}</div><button class="xbtn" id="detailX" aria-label="Close">✕</button></div>
    ${bodyHtml}${note?`<div class="inc-note">${note}</div>`:''}`;
  $('detail').classList.remove('hidden');
  $('detailX').onclick=closeDetail;
  $('detailX').focus({preventScroll:true});
}
async function openStockSheet(sym, name){
  if(!sym) return;
  if(rows(state.view.acc).some(r=>r.sym===sym)){ openDetail(sym); return; } // you own it — show the richer holding view
  const isIdx=sym.startsWith('^');
  const fmtP=v=>isIdx ? v.toLocaleString(undefined,{maximumFractionDigits:2}) : fmtPx(v);
  const q=state.quotes[sym];
  $('detailSheet').innerHTML = `<div class="sheet-head"><div>
      <div class="hsym" style="font-size:18px">${esc(sym.replace('-','.'))}</div>
      <div style="color:var(--mut);font-size:13px;margin-top:2px">${esc(name||'')}</div>
      <div id="ssPrice" style="font-size:26px;font-weight:700;margin-top:8px">${q?fmtP(q.price):'…'}</div>
    </div><div style="display:flex;gap:8px;align-items:flex-start"><button class="xbtn" id="watchBtn" style="font-size:17px"></button><button class="xbtn" id="detailX">✕</button></div></div>
    <div class="chart-box" style="height:180px"><canvas id="detailChart"></canvas><div id="detailMsg" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:13px">Loading chart…</div></div>
    <div class="scrubro" id="detailRO">↔ drag the chart to see any date's price</div>
    <div class="stats" id="ssStats"></div>
    <div id="sheetNews" data-sym="${esc(sym)}"></div>`;
  $('detail').classList.remove('hidden');
  $('detailX').onclick=closeDetail;
  $('detailX').focus({preventScroll:true});
  if(!sym.startsWith('^')) loadSheetNews(sym);
  const inWatch=()=>(state.watch||[]).some(w=>w.sym===sym);
  const paintWatch=()=>{ const b=$('watchBtn'); if(!b) return;
    b.textContent=inWatch()?'★':'☆';
    b.style.color=inWatch()?'var(--brand)':'';
    b.title=b.ariaLabel=inWatch()?'Remove from watchlist':'Add to watchlist'; };
  $('watchBtn').onclick=()=>{
    if(inWatch()) state.watch=state.watch.filter(w=>w.sym!==sym);
    else state.watch=[...(state.watch||[]), {sym, name:name||''}];
    lsSet('pt_watch',state.watch); paintWatch();
    if(!$('page-explore').classList.contains('hidden')) renderMarkets();
  };
  paintWatch();
  if(detailChart){ detailChart.destroy(); detailChart=null; }
  try{
    let d=stockCache[sym];
    if(!d || Date.now()-d.ts>10*60000){
      const j=await tryFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`,true);
      d=parseYahoo(j); d.ts=Date.now(); stockCache[sym]=d;
    }
    if(!$('ssPrice')) return; // sheet was closed or replaced meanwhile
    const closes=d.c, labels=d.t.map(dayStr);
    $('ssPrice').innerHTML = `${fmtP(d.price)} <span style="font-size:14px" class="${cls(d.price-d.prev)}">${fmtPct(d.prev>0?(d.price/d.prev-1)*100:0)} today</span>`;
    detailChart=drawChart('detailChart', labels, closes, $('detailMsg'));
    wireDetailScrub(detailChart, labels, closes, 'detailRO');
    const hi=Math.max(...closes), lo=Math.min(...closes);
    $('ssStats').innerHTML=`
      <div class="stat"><div class="k">52w high</div><div class="v">${fmtP(hi)}</div></div>
      <div class="stat"><div class="k">52w low</div><div class="v">${fmtP(lo)}</div></div>
      <div class="stat"><div class="k">1Y change</div><div class="v ${cls(d.price-closes[0])}">${fmtPct(closes[0]>0?(d.price/closes[0]-1)*100:0)}</div></div>
      <div class="stat"><div class="k">vs 52w high</div><div class="v ${cls(d.price-hi)}">${fmtPct(hi>0?(d.price/hi-1)*100:0)}</div></div>`;
  }catch(e){ if($('detailMsg')) $('detailMsg').textContent='Couldn’t load the chart — check your connection.'; }
}
function openTaxSheet(){
  const YR=31557600000, now=Date.now();
  const items=state.lots.map(l=>{
    const b=new Date(l.date+'T12:00:00').getTime();
    return {l, b, g:l.qty*priceOf(l.sym)-l.cost, lt:now-b>=YR};
  }).sort((a,b)=>(a.lt===b.lt) ? a.b-b.b : (a.lt?1:-1));
  const body=items.map(x=>`<div class="krow"><span class="k">${esc(x.l.sym.replace('-','.'))} · ${new Date(x.b).toLocaleDateString([],{month:'short',day:'numeric',year:'2-digit'})}${x.l.div?' · div':''}</span>
    <span><span class="${cls(x.g)}">${fmtSign(x.g)}</span> ${x.lt?'<span class="pctpill up" style="font-size:10px">LT</span>':`<span class="pctpill down" style="font-size:10px">LT ${new Date(x.b+YR).toLocaleDateString([],{month:'short',day:'numeric'})}</span>`}</span></div>`).join('');
  openListSheet('Tax lots · all '+items.length, body, 'LT = long-term (held over 1 year → lower US capital-gains rate). Red pills show when that lot turns long-term. Estimates — not tax advice.');
}
function openSectorSheet(){
  const per={};
  for(const r of rows('all')){
    const w=SECTOR_WEIGHTS[r.sym]; if(!w) continue;
    const v=r.qty*priceOf(r.sym);
    for(const [s,pc] of Object.entries(w)) per[s]=(per[s]||0)+v*pc/100;
  }
  const tot=Object.values(per).reduce((a,b)=>a+b,0);
  const body=Object.entries(per).sort((a,b)=>b[1]-a[1]).map(([s,v])=>
    `<div class="krow"><span class="k">${esc(s)}</span><span>${fmt(v)} <span style="color:var(--mut)">· ${(v/tot*100).toFixed(1)}%</span></span></div>`).join('');
  openListSheet('Sectors', body, 'Estimated from each fund’s published sector mix — funds rebalance over time, so treat as approximate.');
}
function openLocSheet(){
  const subs={'United States':'VOO · VTI · VXF · VYM · BRK.B','Europe':'via VXUS','Asia-Pacific':'via VXUS','Emerging markets':'via VXUS','Canada & other':'via VXUS','Cash':'settlement funds'};
  const items=locItems();
  const tot=items.reduce((a,i)=>a+i.v,0);
  const body=items.map(i=>`<div class="krow"><span class="k">${i.label}<br><span style="font-size:10.5px">${subs[i.label]||''}</span></span><span>${fmt(i.v)} <span style="color:var(--mut)">· ${(i.v/tot*100).toFixed(1)}%</span></span></div>`).join('');
  openListSheet('Where your money lives', body, 'Regional split of VXUS estimated from its published country mix — treat as approximate.');
}
