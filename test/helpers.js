'use strict';
/* Shared fixtures for the Phase 0 smoke suite + golden-master diff.
   Everything the app computes from "now" (XIRR's elapsed time, the dividend-forecast
   cutoff, the trailing-year annual-income window) is frozen to this exact instant so
   the suite is deterministic on any day it runs — it MUST match the instant the
   golden-master JSON was captured at (test/golden/golden-master.json). */
const FROZEN_TIME = 1785627943103; // 2026-08-01T23:45:43.103Z

// Real Yahoo/Stooq/proxy/FX hosts the app calls on every load (js/api.js) — blocked so
// the suite never depends on network availability and never drifts from live prices.
const EXTERNAL_HOSTS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'stooq.com',
  'api.allorigins.win',
  'corsproxy.io',
  'api.frankfurter.dev',
  'portfolio-push.portfolio-push.workers.dev',
];

async function blockExternalNetwork(page) {
  await page.route('**/*', (route) => {
    let hostname;
    try { hostname = new URL(route.request().url()).hostname; } catch (e) { return route.continue(); }
    if (EXTERNAL_HOSTS.includes(hostname)) return route.abort();
    return route.continue();
  });
}

// Enters the built-in "demo" passcode on a fresh (no-vault) device — the setup step's
// own handler short-circuits to the sandboxed example portfolio (js/vault.js) before ever
// deriving a real key, so this never touches the encrypted vault.
async function unlockDemo(page) {
  await page.goto('/');
  await page.locator('#setPass1').fill('demo');
  await page.locator('#setupBtn').click();
  await page.waitForFunction(() => !document.body.classList.contains('locked'));
  await page.waitForFunction(() => {
    const el = document.getElementById('tvNum');
    return !!el && el.textContent.trim() !== '' && el.textContent.trim() !== '—';
  });
  // #tvNum plays a one-time 700ms count-up animation (js/app.js animateTotal) — let it
  // finish so a snapshot of the DOM text isn't caught mid-count.
  await page.waitForTimeout(900);
  // refreshAll() may auto-open the monthly/daily recap sheet (js/insights.js
  // maybeShowMonthlyRecap/maybeShowRecap) on a fresh browser profile — its scrim sits
  // over the tabbar and range controls even while transitioning closed. Escape is the
  // app's own dismiss shortcut (js/app.js keydown handler), so clear it before interacting.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// Pulls every pure financial figure the UI displays straight from the shared global
// functions (js/core.js, js/insights.js, js/app.js) rather than scraping rendered
// strings — precise, and immune to markup/formatting changes that don't touch the math.
async function collectFigures(page) {
  return page.evaluate(() => {
    const t = totals('all');
    const holdings = rows('all').map((r) => ({
      sym: r.sym,
      qty: r.qty,
      cost: +r.cost.toFixed(2),
      value: +(r.qty * priceOf(r.sym)).toFixed(2),
      gain: +(r.qty * priceOf(r.sym) - r.cost).toFixed(2),
    }));
    const risk = riskStats();
    const health = healthScore();
    // Projection figures — added session 7, closing the gap flagged in the prior
    // session's report ("golden master doesn't cover the projection card, so its
    // currency headline has no regression guard"). Called directly against the
    // pure engine (runMonteCarloProjection(), js/monte-carlo.js) rather than
    // through the async Worker path (runProjection()/runProbabilisticGoal()) —
    // same fixed seed either way (PROJECTION_MODEL.seed, js/app.js), but this
    // stays synchronous and never depends on Worker support in the test runner.
    // #projModCard's own base params: v0 = the real demo total, 30-year run,
    // no goal, no contribution — see js/insights.js's PROJ_MOD_YEARS comment.
    const projFan = runMonteCarloProjection(projectionParams(t.value, 30, null, 0)).fan;
    const projection = {};
    for (const h of [5, 10, 20, 30]) {
      projection[h] = {
        p10: +projFan.p10[h].toFixed(2),
        p50: +projFan.p50[h].toFixed(2),
        p90: +projFan.p90[h].toFixed(2),
      };
    }
    // Home's goal probability — a FIXED goal/year, independent of whatever
    // state.goal the demo dataset ships (js/demo.js's pt_goal has an amount but
    // no year, so it can't answer "chance by year" on its own; same {amt,year}
    // test/projection-consistency.spec.js's GOAL constant already uses, for one
    // less magic number in the suite).
    const goalYears = 2036 - new Date().getFullYear();
    const goalProbability = +(runMonteCarloProjection(projectionParams(t.value, goalYears, 200000, 0)).probabilityOfGoal * 100).toFixed(2);
    return {
      totals: {
        value: +t.value.toFixed(2),
        invested: +t.invested.toFixed(2),
        profit: +t.profit.toFixed(2),
        day: +t.day.toFixed(2),
      },
      xirr: personalReturn('all'),
      monthlyDietz: monthlyDietzReturns(),
      risk: risk && {
        vol: +risk.vol.toFixed(4),
        beta: +risk.beta.toFixed(4),
        mdd: +risk.mdd.toFixed(4),
        sharpe: +risk.sharpe.toFixed(4),
        annRet: +risk.annRet.toFixed(4),
      },
      health: health && { score: health.score },
      annualIncome: +annualIncome().toFixed(2),
      holdings,
      holdingsCount: holdings.length,
      totalValText: document.getElementById('tvNum').textContent,
      projection,
      goalProbability,
    };
  });
}

module.exports = { FROZEN_TIME, blockExternalNetwork, unlockDemo, collectFigures };
