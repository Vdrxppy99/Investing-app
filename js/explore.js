'use strict';
/* ============ MARKETS TAB ============ */
const IDX_LIST = [{s:'^GSPC',n:'S&P 500'},{s:'^DJI',n:'Dow Jones'},{s:'^IXIC',n:'Nasdaq'},{s:'^GDAXI',n:'DAX'}];
/* fund metadata — expense ratios, P/E and exchange from published Vanguard fund pages (estimates, update occasionally) */
const FUND_META = {
  'VOO':{er:0.03, pe:26, exch:'NYSE Arca'}, 'VTI':{er:0.03, pe:25, exch:'NYSE Arca'},
  'VXF':{er:0.06, pe:20, exch:'NYSE Arca'}, 'VXUS':{er:0.05, pe:16, exch:'Nasdaq'},
  'VYM':{er:0.06, pe:18, exch:'NYSE Arca'}, 'BRK-B':{er:0, pe:12, exch:'NYSE'}
};
/* approximate top-holdings weights (% of fund) from published fund data — estimates */
const LOOK_WEIGHTS = {
  'VOO':{NVDA:8.0,MSFT:7.0,AAPL:5.8,AMZN:4.2,GOOGL:4.3,META:3.0,AVGO:2.8,TSLA:2.0,'BRK-B':1.6,JPM:1.5},
  'VTI':{NVDA:6.8,MSFT:6.0,AAPL:5.0,AMZN:3.6,GOOGL:3.7,META:2.6,AVGO:2.4,TSLA:1.7,'BRK-B':1.4,JPM:1.3},
  'VXUS':{TSM:2.4,ASML:1.3,SAP:1.1,TCEHY:1.0,TM:0.9,AZN:0.8,NVS:0.8,SHEL:0.7},
  'VYM':{AVGO:6.5,JPM:4.0,XOM:3.2,JNJ:2.8,PG:2.6,HD:2.4,ABBV:2.4,KO:2.0,CVX:1.9,WMT:1.8}
};
const LOOK_NAMES = {NVDA:'NVIDIA',MSFT:'Microsoft',AAPL:'Apple',AMZN:'Amazon',GOOGL:'Alphabet',META:'Meta',AVGO:'Broadcom',TSLA:'Tesla',JPM:'JPMorgan',TSM:'TSMC',ASML:'ASML',SAP:'SAP',TCEHY:'Tencent',TM:'Toyota',AZN:'AstraZeneca',NVS:'Novartis',SHEL:'Shell',XOM:'ExxonMobil',JNJ:'Johnson & Johnson',PG:'Procter & Gamble',HD:'Home Depot',ABBV:'AbbVie',KO:'Coca-Cola',CVX:'Chevron',WMT:'Walmart','BRK-B':'Berkshire (extra, inside funds)'};

/* diversification ideas — funds that add something the current mix lacks (research prompts, not advice) */
const IDEAS = [
  {sym:'BND',  name:'Vanguard Total Bond Market ETF',    why:'You are ~100% stocks. Bonds are the classic cushion when markets fall.'},
  {sym:'VNQ',  name:'Vanguard Real Estate ETF',          why:'Property and REIT income — an asset class your index funds barely touch.'},
  {sym:'SCHD', name:'Schwab US Dividend Equity ETF',     why:'Pairs with VYM: focuses on companies that grow their dividend year after year.'},
  {sym:'AVUV', name:'Avantis US Small Cap Value ETF',    why:'Adds the small-cap value tilt — historically strong, and VXF only gives you the size part.'},
  {sym:'QQQ',  name:'Invesco Nasdaq-100 ETF',            why:'A concentrated mega-cap tech bet. You already own these via VOO/VTI — this doubles down.'},
  {sym:'VT',   name:'Vanguard Total World Stock ETF',    why:'The one-fund portfolio: your whole VTI + VXUS combo in a single ticker.'},
  {sym:'GLDM', name:'SPDR Gold MiniShares',              why:'Gold moves differently from stocks — a small slice can smooth the ride.'},
  {sym:'VGT',  name:'Vanguard Information Technology ETF', why:'Pure tech-sector tilt if the S&P\'s ~33% tech is not enough for you.'}
];

const SECTOR_ETFS=[['XLK','Technology'],['XLF','Financials'],['XLV','Healthcare'],['XLY','Consumer Disc.'],['XLC','Comm. Services'],['XLI','Industrials'],['XLE','Energy'],['XLP','Staples'],['XLU','Utilities'],['XLRE','Real Estate'],['XLB','Materials']];
const mkt = { idx:{}, lists:{}, ts:0, fetching:false };
async function fetchIndexCard(x){
  try{
    const j=await tryFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(x.s)}?range=1d&interval=15m`,true);
    const d=parseYahoo(j);
    if(d.price>0) mkt.idx[x.s]={price:d.price, prev:d.prev||d.price, spark:d.c.slice(-40)};
    return true;
  }catch(e){ return false; }
}
async function fetchScreener(id){
  try{
    const j=await tryFetch(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${id}&count=6`,true);
    const qs=(j.finance.result[0].quotes||[]).filter(q=>q.regularMarketPrice>0);
    mkt.lists[id]=qs.map(q=>({sym:q.symbol,name:q.shortName||q.longName||q.symbol,px:q.regularMarketPrice,pct:q.regularMarketChangePercent||0}));
    return true;
  }catch(e){ return false; }
}
function lookExposure(){ // your indirect $ in each mega-cap via fund top-holdings weights
  const per={};
  for(const r of rows('all')){
    const w=LOOK_WEIGHTS[r.sym]; if(!w) continue;
    const fv=r.qty*priceOf(r.sym);
    for(const [t,pc] of Object.entries(w)){
      if(!per[t]) per[t]={usd:0,via:[]};
      per[t].usd += fv*pc/100;
      if(!per[t].via.includes(r.sym)) per[t].via.push(r.sym);
    }
  }
  return Object.entries(per).map(([t,v])=>({sym:t,...v})).sort((a,b)=>b.usd-a.usd);
}
async function refreshMarkets(force){
  if(mkt.fetching) return;
  if(!force && Date.now()-mkt.ts<5*60000){ renderMarkets(); return; }
  mkt.fetching=true; renderMarkets();
  const QUOTE_TTL=5*60000;
  const watchJobs=(state.watch||[])
    .filter(w=>{const q=state.quotes[w.sym]; return !q||!q.ts||Date.now()-q.ts>QUOTE_TTL;})
    .map(w=>fetchQuote(w.sym));
  const owned=new Set(rows('all').map(r=>r.sym));
  const ideaJobs=IDEAS.filter(i=>!owned.has(i.sym))
    .filter(i=>{const q=state.quotes[i.sym]; return !q||!q.ts||Date.now()-q.ts>QUOTE_TTL;})
    .map(i=>fetchQuote(i.sym));
  const sectorJobs=SECTOR_ETFS
    .filter(([s])=>{const q=state.quotes[s]; return !q||!q.ts||Date.now()-q.ts>QUOTE_TTL;})
    .map(([s])=>fetchQuote(s));
  await Promise.allSettled([...IDX_LIST.map(fetchIndexCard), fetchScreener('most_actives'), fetchScreener('day_gainers'), fetchScreener('day_losers'), ...watchJobs, ...ideaJobs, ...sectorJobs]);
  mkt.ts=Date.now(); mkt.fetching=false;
  lsSet('pt_quotes',state.quotes);
  renderMarkets();
}
function sparkArr(pts,W,H,up){
  const v=(pts||[]).filter(x=>x!=null); if(v.length<3) return '';
  const min=Math.min(...v),max=Math.max(...v),rng=(max-min)||1;
  const d=v.map((p,i)=>`${i?'L':'M'}${(i/(v.length-1)*W).toFixed(1)} ${(H-2-(p-min)/rng*(H-4)).toFixed(1)}`).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="${up?'var(--green)':'var(--red)'}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
function mRow(sym,name,pxHtml,pct){
  const pill = pct==null ? '' : `<span class="pctpill ${pct>=0?'up':'down'}">${fmtPct(pct)}</span>`;
  return `<div class="mrow" data-sym="${esc(sym)}" data-name="${esc(name||'')}">${badgeHtml(sym)}
    <div class="mmid"><div class="msym">${esc(sym.replace('-','.'))}</div><div class="mname">${esc(name||'')}</div></div>
    <div class="mright"><div class="mpx">${pxHtml}</div><div class="mchg">${pill}</div></div></div>`;
}
function renderMarkets(){
  const cards=IDX_LIST.map(x=>{
    const d=mkt.idx[x.s]; if(!d) return '';
    const pct=d.prev>0?(d.price/d.prev-1)*100:0;
    return `<div class="idx-card" data-sym="${esc(x.s)}" data-name="${esc(x.n)}"><div class="n">${x.n}</div><div class="p">${d.price.toLocaleString(undefined,{maximumFractionDigits:0})}</div><div class="c ${cls(pct)}">${fmtPct(pct)}</div>${sparkArr(d.spark,102,26,pct>=0)}</div>`;
  }).join('');
  $('idxRow').innerHTML = cards || `<div class="mload">${mkt.fetching?'Loading indices…':'Couldn’t load — tap the Explore tab again to retry.'}</div>`;
  // sector pulse: every sector ETF, hottest first, heat-tinted like a compact heatmap
  const secs=SECTOR_ETFS.map(([s,n])=>{ const q=state.quotes[s];
      return q&&q.prev>0 ? {s,n,pct:(q.price/q.prev-1)*100} : null; }).filter(Boolean)
    .sort((a,b)=>b.pct-a.pct);
  $('sectorRow').innerHTML = secs.length ? secs.map(x=>{
    const a=Math.min(.4,Math.abs(x.pct)/4+.06);
    const col=x.pct>=0?`rgba(${cvar('--green-rgb')},${a})`:`rgba(${cvar('--red-rgb')},${a})`;
    return `<div class="idx-card" data-sym="${esc(x.s)}" data-name="${esc(x.n)} sector (${esc(x.s)})" style="background:${col};flex-basis:118px">
      <div class="n">${esc(x.n)}</div><div class="c ${cls(x.pct)}" style="font-size:15px;font-weight:800;margin-top:4px">${fmtPct(x.pct)}</div>
      <div class="n" style="margin-top:5px;opacity:.7">${esc(x.s)}</div></div>`;
  }).join('') : (mkt.fetching ? `<div class="mload">Loading sectors…</div>` : `<div class="mload">Couldn’t load — tap Explore again.</div>`);
  const wl=state.watch||[];
  $('watchWrap').style.display = wl.length ? '' : 'none';
  $('watchList').innerHTML = wl.map(w=>{
    const q=state.quotes[w.sym];
    const isIdx=w.sym.startsWith('^');
    const px = q&&q.price>0 ? (isIdx ? q.price.toLocaleString(undefined,{maximumFractionDigits:2}) : fmtPx(q.price)) : '…';
    const pct = q&&q.prev>0 ? (q.price/q.prev-1)*100 : null;
    return mRow(w.sym, w.name, px, pct);
  }).join('');
  const ownedNow=new Set(rows('all').map(r=>r.sym));
  $('ideaList').innerHTML = IDEAS.filter(i=>!ownedNow.has(i.sym)).map(i=>{
    const q=state.quotes[i.sym];
    const px = q&&q.price>0 ? fmtPx(q.price) : '…';
    const pct = q&&q.prev>0 ? (q.price/q.prev-1)*100 : null;
    const pill = pct==null ? '' : `<span class="pctpill ${pct>=0?'up':'down'}">${fmtPct(pct)}</span>`;
    return `<div class="mrow" data-sym="${esc(i.sym)}" data-name="${esc(i.name)}">${badgeHtml(i.sym)}
      <div class="mmid"><div class="msym">${esc(i.sym)}</div><div class="mname">${esc(i.name)}</div><div class="iwhy">${esc(i.why)}</div></div>
      <div class="mright"><div class="mpx">${px}</div><div class="mchg">${pill}</div></div></div>`;
  }).join('') || '<div class="mload">You own everything on the ideas list — impressive.</div>';
  const fill=(id,el)=>{ const L=mkt.lists[id];
    $(el).innerHTML = L&&L.length ? L.map(q=>mRow(q.sym,q.name,fmtPx(q.px),q.pct)).join('')
      : (mkt.fetching ? skel(4) : `<div class="mload">Couldn’t load — tap the Explore tab again to retry.</div>`); };
  fill('most_actives','activeList'); fill('day_gainers','gainList'); fill('day_losers','loseList');
  /* row taps are handled by one delegated listener on #page-explore (app.js) —
     no per-row wiring, so rows re-rendered mid-fetch can never lose their handler */
}

/* ============ MARKET SEARCH ============ */
let searchTimer=null, lastQuery='';
async function runSearch(q){
  const box=$('searchResults');
  try{
    const j=await tryFetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,true);
    if(q!==lastQuery) return;
    const qs=(j.quotes||[]).filter(x=>x.symbol && (x.quoteType==='EQUITY'||x.quoteType==='ETF'||x.quoteType==='INDEX'));
    if(!qs.length){ box.innerHTML='<div class="mload" style="padding:18px">No matches for “'+esc(q)+'”.</div>'; box.style.display=''; return; }
    // US listings first (they get live prices); foreign listings trail, dimmed
    qs.sort((a,b)=>(a.symbol.includes('.')?1:0)-(b.symbol.includes('.')?1:0));
    box.innerHTML=qs.slice(0,8).map(x=>{
      const nm=esc(x.shortname||x.longname||'');
      const tag=x.quoteType==='ETF'?'ETF':x.quoteType==='INDEX'?'Index':esc(x.exchange||'Stock');
      return `<div class="mrow${x.symbol.includes('.')?' dim':''}" data-sym="${esc(x.symbol)}" data-name="${nm}">${badgeHtml(x.symbol)}
        <div class="mmid"><div class="msym">${esc(x.symbol.replace('-','.'))}</div><div class="mname">${nm}</div></div>
        <div class="mright"><div class="mchg" style="color:var(--mut)">${tag}</div></div></div>`;
    }).join('');
    box.style.display='';
    // pull live prices for the US-listed results and swap them in (foreign listings quote in local currency — skip those)
    const QT=5*60000;
    const top=qs.slice(0,8).map(x=>x.symbol).filter(s=>!s.includes('.'));
    Promise.allSettled(top.map(s=>{
      const qq=state.quotes[s];
      return (qq&&qq.ts&&Date.now()-qq.ts<QT) ? Promise.resolve(true) : fetchQuote(s);
    })).then(()=>{
      if(q!==lastQuery) return;
      box.querySelectorAll('.mrow').forEach(el=>{
        const s=el.dataset.sym, qq=state.quotes[s];
        if(!qq||!(qq.price>0)||s.includes('.')) return;
        const pctv=qq.prev>0?(qq.price/qq.prev-1)*100:null;
        const right=el.querySelector('.mright');
        if(right) right.innerHTML=`<div class="mpx">${s.startsWith('^')?qq.price.toLocaleString(undefined,{maximumFractionDigits:2}):fmtPx(qq.price)}</div>
          <div class="mchg">${pctv==null?'':`<span class="pctpill ${pctv>=0?'up':'down'}">${fmtPct(pctv)}</span>`}</div>`;
      });
    });
  }catch(e){ box.innerHTML='<div class="mload" style="padding:18px">Search needs a connection.</div>'; box.style.display=''; }
}
function wireSearch(){
  const inp=$('mktSearch'), x=$('mktSearchX');
  inp.oninput=()=>{ const q=inp.value.trim(); lastQuery=q; x.style.display=q?'':'none';
    clearTimeout(searchTimer);
    if(q.length<1){ $('searchResults').style.display='none'; return; }
    searchTimer=setTimeout(()=>runSearch(q), 260); };
  x.onclick=()=>{ inp.value=''; lastQuery=''; x.style.display='none'; $('searchResults').style.display='none'; inp.focus(); };
}
