'use strict';
/* ============ NEWS HELPERS ============
   The News TAB was retired in v10.10 (owner call: never used, off-brand for the app).
   What remains powers the "Latest news" list inside each stock/holding sheet — headlines
   exactly where you're already asking about a fund (sheets.js calls fetchNewsQ + agoStr). */

/* regulatory/PR filing noise that pollutes ticker searches — never news */
const JUNK_TITLE = /net asset value|form 8\.[35]|form 6-k|holding\(s\) in company|director\/pdmr|transaction in own shares|total voting rights|results of agm|block listing|treasury shares|passive foreign investment|standard form for notification/i;
const JUNK_PUB = /business wire|pr newswire|globe ?newswire|newsfile|accesswire|acn newswire|prweb/i;

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
function agoStr(t){
  if(!t) return '';
  const s = (Date.now()-t)/1000;
  if(s < 3600) return Math.max(1, Math.round(s/60)) + 'm ago';
  if(s < 86400) return Math.round(s/3600) + 'h ago';
  if(s < 7*86400) return Math.round(s/86400) + 'd ago';
  return new Date(t).toLocaleDateString([], {month:'short', day:'numeric'});
}
