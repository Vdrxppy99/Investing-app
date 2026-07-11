'use strict';
/* ============ NEWS TAB ============
   Headlines matched to the user's holdings via the Yahoo Finance search feed,
   then RANKED like an editor would: stories about funds you own first, then the
   companies inside them, then broad-market news — fresher = higher, wire-service
   filing spam dropped entirely. Cached in localStorage so the tab opens instantly. */
const NEWS_TTL = 20*60000;
const newsSt = { fetching:false, filter:'all', sort:'top', cache: lsGet('pt_news') || {items:[], ts:0} };

/* regulatory/PR filing noise that pollutes ticker searches — never news */
const JUNK_TITLE = /net asset value|form 8\.[35]|form 6-k|holding\(s\) in company|director\/pdmr|transaction in own shares|total voting rights|results of agm|block listing|treasury shares|passive foreign investment|standard form for notification/i;
const JUNK_PUB = /business wire|pr newswire|globe ?newswire|newsfile|accesswire|acn newswire|prweb/i;
/* listicle mills — allowed, but they shouldn't outrank real reporting */
const LISTICLE_PUB = /insider monkey|motley fool|zacks|benzinga|24\/7 wall st|simply wall st/i;
/* themes that actually move this portfolio (broad index funds + Berkshire) */
const HOT_TERMS = /vanguard|s&p ?500|etf|index fund|dividend|berkshire|buffett|\bfed\b|federal reserve|interest rate|inflation|nasdaq|dow jones|tariff|earnings|jobs report|treasury yield|bull market|bear market|recession|all-time high|sell-?off/i;

function newsLookSyms(){ return lookExposure().slice(0,4).map(l=>l.sym); } // biggest companies inside the funds
function newsThumb(n){
  try{
    const rs = n.thumbnail.resolutions;
    const small = rs.find(r=>r.width && r.width<=400) || rs[rs.length-1];
    return small.url || null;
  }catch(e){ return null; }
}
async function fetchNewsQ(q, tag){
  try{
    const j = await tryFetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=10`, true);
    return (j.news||[]).map(n=>({
      id: n.uuid || n.link, title: n.title || '', pub: n.publisher || '',
      link: n.link || '', t: (n.providerPublishTime||0)*1000, th: newsThumb(n), tags: [tag]
    })).filter(n=>n.title && n.link && !JUNK_TITLE.test(n.title) && !JUNK_PUB.test(n.pub));
  }catch(e){ return []; }
}
async function refreshNews(force){
  renderNews();
  if(newsSt.fetching) return;
  const c = newsSt.cache;
  if(!force && c.items.length && Date.now()-c.ts < NEWS_TTL) return;
  newsSt.fetching = true; renderNews();
  // one query per fund you own, the biggest companies inside those funds, and the broad market
  const queries = [
    ...uniqSyms().map(s=>[s, s]),
    ...newsLookSyms().map(s=>[s, s]),
    ['stock market today','Market']
  ];
  const results = await Promise.allSettled(queries.map(([q,tag])=>fetchNewsQ(q,tag)));
  const byId = {};
  for(const r of results){
    if(r.status!=='fulfilled') continue;
    for(const it of r.value){
      if(byId[it.id]){ for(const t of it.tags) if(!byId[it.id].tags.includes(t)) byId[it.id].tags.push(t); }
      else byId[it.id] = it;
    }
  }
  const items = Object.values(byId).sort((a,b)=>b.t-a.t).slice(0,80);
  if(items.length){ c.items = items; c.ts = Date.now(); lsSet('pt_news', c); }
  newsSt.fetching = false;
  renderNews();
}
function agoStr(t){
  if(!t) return '';
  const s = (Date.now()-t)/1000;
  if(s < 3600) return Math.max(1, Math.round(s/60)) + 'm ago';
  if(s < 86400) return Math.round(s/3600) + 'h ago';
  if(s < 7*86400) return Math.round(s/86400) + 'd ago';
  return new Date(t).toLocaleDateString([], {month:'short', day:'numeric'});
}
/* editorial score: why this story matters to THIS portfolio, right now */
function newsScore(i, owned, look){
  let s = 0;
  const ageH = (Date.now()-i.t)/3600e3;
  s += Math.max(0, 1 - ageH/48) * 4;               // freshness: +4 brand new → 0 at 48h
  if(i.tags.some(t=>owned.has(t))) s += 3;          // directly about a fund you own
  else if(i.tags.some(t=>look.has(t))) s += 2;      // about a company inside your funds
  else s += 0.5;                                    // general market
  if(HOT_TERMS.test(i.title)) s += 1.5;             // theme that moves index portfolios
  if(LISTICLE_PUB.test(i.pub)) s -= 1.5;            // rank real reporting above listicles
  return s;
}
function newsMeta(i){
  return `${esc(i.pub)} · ${agoStr(i.t)} ${i.tags.map(t=>`<span class="ntag">${esc(String(t).replace('-','.'))}</span>`).join('')}`;
}
function renderNews(){
  if(!$('newsList')) return;
  const owned = new Set(uniqSyms());
  const look = new Set(newsLookSyms());
  const chips = ['all', ...uniqSyms(), '__inside', 'Market'];
  if(!chips.includes(newsSt.filter)) newsSt.filter = 'all';
  $('newsChips').innerHTML = chips.map(t=>{
    const label = t==='all' ? 'All' : t==='__inside' ? 'Inside funds' : esc(String(t).replace('-','.'));
    return `<button data-t="${esc(t)}" class="${newsSt.filter===t?'on':''}">${label}</button>`;
  }).join('');
  $('newsChips').querySelectorAll('button').forEach(b=> b.onclick = ()=>{ newsSt.filter=b.dataset.t; renderNews(); });
  let items = newsSt.cache.items.filter(i=>!JUNK_TITLE.test(i.title) && !JUNK_PUB.test(i.pub));
  if(newsSt.filter==='__inside') items = items.filter(i=>i.tags.some(t=>look.has(t)));
  else if(newsSt.filter!=='all') items = items.filter(i=>i.tags.includes(newsSt.filter));
  items = items.map(i=>({ ...i, _s: newsScore(i, owned, look) }));
  items.sort(newsSt.sort==='top' ? (a,b)=>b._s-a._s || b.t-a.t : (a,b)=>b.t-a.t);
  // hoist the best illustrated story into a hero card
  let hero = null;
  const hi = items.findIndex((x,k)=>k<4 && x.th);
  if(hi>-1 && items.length>2){ hero = items[hi]; items = items.filter((_,k)=>k!==hi); }
  $('newsList').innerHTML = (hero ? `
    <a class="nhero" href="${esc(hero.link)}" target="_blank" rel="noopener">
      <img src="${esc(hero.th)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">
      <div class="nhbody"><div class="nhkick">${newsSt.sort==='top'?'Top story':'Latest'}</div>
        <div class="nhtitle">${esc(hero.title)}</div>
        <div class="nmeta">${newsMeta(hero)}</div></div></a>` : '')
  + (items.length ? items.map((i,k)=>`
    <a class="nrow" href="${esc(i.link)}" target="_blank" rel="noopener">
      <div class="nmid">
        <div class="ntitle">${esc(i.title)}</div>
        <div class="nmeta">${newsMeta(i)}</div>
      </div>
      ${i.th?`<img class="nimg" src="${esc(i.th)}" alt="" ${k>5?'loading="lazy"':''} referrerpolicy="no-referrer" onerror="this.remove()">`:''}
    </a>`).join('')
    : (hero ? '' : (newsSt.fetching ? skel(6) : `<div class="mload">No stories yet — connect to the internet and pull to refresh.</div>`)));
}
$('newsSort').querySelectorAll('button').forEach(b=> b.onclick = ()=>{
  newsSt.sort=b.dataset.n;
  $('newsSort').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  renderNews();
});
