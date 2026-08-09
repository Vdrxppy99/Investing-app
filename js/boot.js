'use strict';
const cvar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
/* validated categorical palette (fixed order; gray only for "Other") */
const CAT = ['#3987e5','#199e70','#c98500','#9085e9','#d55181','#d95926'];
document.documentElement.dataset.theme = (function(){ try{const t=localStorage.getItem('pt_theme'); return t?JSON.parse(t):'dark';}catch(e){return 'dark';} })();
/* Chart.js is lazy-loaded (UPGRADE_PLAN.md Phase 4) — it's only needed once a
   holding sheet or the Insights tab opens, not on first paint. Every chart
   call site awaits ensureChartJs() before touching window.Chart; this is the
   one place that actually injects the <script> and runs the one-time setup
   that used to run unconditionally here at boot (defaults, tooltip shape,
   the scrubLine/centerTxt plugins js/portfolio.js and js/insights.js define
   at their own load time but can't register until Chart exists). Memoized so
   concurrent callers share one load, and a failed load (offline, first-ever
   use, nothing cached yet) can be retried by a later call rather than being
   stuck rejected forever. */
let chartJsReady = null;
function ensureChartJs(){
  if(window.Chart) return Promise.resolve(window.Chart);
  if(chartJsReady) return chartJsReady;
  chartJsReady = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/chart.umd.min.js';
    s.onload = () => {
      Chart.defaults.font.family = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
      Chart.defaults.font.weight = 500;
      // one premium tooltip shape everywhere (colors stay per-chart — they read live theme tokens)
      const tt = Chart.defaults.plugins.tooltip;
      tt.cornerRadius = 11; tt.padding = {x:13, y:10}; tt.caretSize = 0;
      tt.titleMarginBottom = 6; tt.titleFont = {weight:600, size:11}; tt.bodyFont = {weight:600, size:12.5};
      if(typeof scrubLine !== 'undefined') Chart.register(scrubLine);
      if(typeof centerTxt !== 'undefined') Chart.register(centerTxt);
      resolve(window.Chart);
    };
    s.onerror = () => { chartJsReady = null; reject(new Error('chart.js failed to load')); };
    document.head.appendChild(s);
  });
  return chartJsReady;
}
