// Paste into the page console (or run via the browser tool) AFTER entering demo
// mode. Produces the same shape as redesign/baseline-numbers.txt so Phase 8 can
// diff against it.
//
// Reads innerText rather than the source, because the contract is about what the
// user SEES. Sorted so that reordering the DOM — which the redesign does
// constantly — is never mistaken for a changed calculation.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 60 && typeof window.showPage !== 'function'; i++) await sleep(250);
  const grab = () => ((document.body.innerText || '').match(/[$€£]?-?[0-9][0-9,.]*%?/g) || [])
    .map(s => s.trim()).filter(s => /[0-9]/.test(s));
  const out = {};
  for (const p of ['portfolio', 'markets', 'insights']) {
    window.showPage(p); await sleep(2500); out[p] = grab().sort();
  }
  return { counts: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), data: out };
})()
