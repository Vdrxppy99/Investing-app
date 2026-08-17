/* Phase 6 — Monte Carlo goal-projection engine. Pure: params in, distribution out.
   No DOM, no `state`, no globals from the rest of the app — this file is loaded
   three ways (main-thread <script>, importScripts() inside js/monte-carlo-worker.js,
   and require() from test/monte-carlo.spec.js) and must behave identically in all three.

   Model: each simulated year draws an independent real-return and inflation rate,
   combines them into a nominal return (Fisher: (1+real)(1+infl)-1), compounds the
   portfolio (in nominal dollars, contributions added at year-end in FIXED nominal
   dollars — they are not indexed to inflation), then deflates back to today's
   dollars by the same path's realized cumulative inflation. For a pure lump sum
   (no contributions) this deflation exactly cancels the inflation draw regardless
   of volatility, which is what makes the zero-volatility case reduce to simple
   real compound growth — see test/monte-carlo.spec.js for the closed-form checks. */
(function (root) {
  'use strict';

  // mulberry32: small, fast, deterministic 32-bit PRNG. Same seed -> same sequence,
  // forever, across Node/browser/Worker (no reliance on Math.random).
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Box-Muller: one standard-normal sample from two uniform draws.
  function randNormal(rand) {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function percentileSorted(sortedArr, p) {
    const idx = Math.min(sortedArr.length - 1, Math.floor(p * sortedArr.length));
    return sortedArr[idx];
  }

  function runMonteCarloProjection(params) {
    const {
      v0, years, monthlyContribution = 0, goal = null,
      meanReal, sdReal, meanInfl, sdInfl,
      paths = 10000, seed = 1,
    } = params;

    const T = years;
    const contribAnnual = monthlyContribution * 12;
    const rand = mulberry32(seed);

    const pathsByYear = new Array(T + 1);
    for (let y = 0; y <= T; y++) pathsByYear[y] = new Float64Array(paths);

    let goalHits = 0;
    for (let p = 0; p < paths; p++) {
      let vNom = v0;
      let cumInfl = 1;
      pathsByYear[0][p] = v0;
      let hit = goal != null && v0 >= goal;
      for (let y = 1; y <= T; y++) {
        const real = meanReal + sdReal * randNormal(rand);
        const infl = meanInfl + sdInfl * randNormal(rand);
        const nominal = (1 + real) * (1 + infl) - 1;
        vNom = vNom * (1 + nominal) + contribAnnual;
        cumInfl *= (1 + infl);
        const vReal = vNom / cumInfl;
        pathsByYear[y][p] = vReal;
        if (goal != null && !hit && vReal >= goal) hit = true;
      }
      if (hit) goalHits++;
    }

    /* p25/p75 are additive (the p10/p50/p90 figures every caller already reads are
       untouched): drawGoalFan() paints the inner quartile band over the outer decile
       band with the SAME fill, so the middle half of the distribution reads about
       twice as dense. Without them the cone is one flat wash with no indication of
       where the mass actually sits. */
    const fan = { years: [], p10: [], p25: [], p50: [], p75: [], p90: [] };
    for (let y = 0; y <= T; y++) {
      const sorted = Array.from(pathsByYear[y]).sort((a, b) => a - b);
      fan.years.push(y);
      fan.p10.push(percentileSorted(sorted, 0.10));
      fan.p25.push(percentileSorted(sorted, 0.25));
      fan.p50.push(percentileSorted(sorted, 0.50));
      fan.p75.push(percentileSorted(sorted, 0.75));
      fan.p90.push(percentileSorted(sorted, 0.90));
    }

    return {
      probabilityOfGoal: goal != null ? goalHits / paths : null,
      fan,
    };
  }

  const api = { mulberry32, randNormal, runMonteCarloProjection };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
