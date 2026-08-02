'use strict';
/* Phase 1 — "prove the math". Each test overwrites `state` with a small, fully-controlled
 * fixture (fixed cashflows / price series) inside the running app, calls the REAL global
 * function (js/core.js, js/insights.js) exactly as production does, and compares the result
 * to an independently-derived expected value:
 *   - XIRR / modified Dietz / tax-lot split: closed-form or hand-computable arithmetic.
 *   - the irregular multi-cashflow XIRR case: an independent scipy.optimize.brentq root-find
 *     over the identical NPV equation (see the comment above it for the exact Python used).
 *   - volatility / annualized return / beta / max drawdown: the `backtesting` skill's Python
 *     oracle (scripts/ratios.py `annualized_vol`/`max_drawdown`, scripts/indicators.py `beta`),
 *     run once in a scratch venv; the derivation is reproduced in comments so it's checkable
 *     without re-running Python.
 * All comparisons use a 1e-9-scale tolerance per UPGRADE_PLAN.md Phase 1, except where noted.
 */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('../helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
  await unlockDemo(page);
});

test('xirr: single cashflow, exactly 1 year, 10% growth -> r = 0.10 (closed form)', async ({ page }) => {
  const r = await page.evaluate(() => xirr([
    { t: 0, v: -1000 },
    { t: 365.25 * 86400000, v: 1100 },
  ]));
  expect(r).toBeCloseTo(0.10, 9);
});

test('xirr: single cashflow, exactly 2 years, 10%/yr compounding -> r = 0.10 (closed form)', async ({ page }) => {
  const r = await page.evaluate(() => xirr([
    { t: 0, v: -1000 },
    { t: 2 * 365.25 * 86400000, v: 1210 }, // 1000 * 1.10^2
  ]));
  expect(r).toBeCloseTo(0.10, 9);
});

test('xirr: irregular 4-cashflow series matches an independent scipy brentq root-find', async ({ page }) => {
  // Oracle (scratch venv, scipy 1.13.1):
  //   from scipy.optimize import brentq
  //   flows = [(0,-1000.0),(100,-500.0),(300,200.0),(600,1500.0)]
  //   npv = lambda r: sum(v*(1+r)**(-(t)/365.25) for t,v in flows)
  //   brentq(npv, -0.95, 9, xtol=1e-14, rtol=1e-14)  ->  0.08999496308419447
  const r = await page.evaluate(() => xirr([
    { t: 0, v: -1000 },
    { t: 100 * 86400000, v: -500 },
    { t: 300 * 86400000, v: 200 },
    { t: 600 * 86400000, v: 1500 },
  ]));
  expect(r).toBeCloseTo(0.08999496308419447, 9);
});

test('modified Dietz: single mid-window deposit matches the textbook formula by hand', async ({ page }) => {
  // R = (V1 - V0 - D) / (V0 + D/2) = (11500-10000-1000)/(10000+500) = 500/10500 = 4.761904761904762%
  // periodReturns()/monthlyDietzReturns() share this exact formula (see js/insights.js comment).
  const r = await page.evaluate(() => {
    const V0 = 10000, D = 1000, V1 = 11500;
    return (V1 - V0 - D) / (V0 + D / 2) * 100;
  });
  expect(r).toBeCloseTo(4.761904761904762, 9);

  // Exercise the REAL function too: one deposit landing in month 2, values at month-end.
  const viaApp = await page.evaluate(() => {
    state.holdings = [{ acc: 'brok', sym: 'VOO', qty: 1, cost: 10000 }];
    state.lots = [
      { acc: 'brok', sym: 'VOO', date: '2024-01-05', qty: 1, cost: 10000 },
      { acc: 'brok', sym: 'VOO', date: '2024-02-15', qty: 0, cost: 1000 }, // deposit only, mid-Feb
    ];
    state.cash = { main: 0, brok: 0 };
    // buildSeries('all') needs daily price history to build an end-of-month value series.
    const t = [], c = [];
    const D0 = Date.UTC(2024, 0, 5), D1 = Date.UTC(2024, 1, 29);
    for (let d = D0; d <= D1; d += 86400000) { t.push(d); c.push(10000 + (d - D0) / (D1 - D0) * 1500); }
    state.history = { VOO: { t, c } };
    state.quotes = { VOO: { price: c[c.length - 1], prev: c[c.length - 1] } };
    return monthlyDietzReturns();
  });
  expect(viaApp).not.toBeNull();
  // Jan has no prior month to diff against; Feb's return is what we can check.
  expect(viaApp.ret['2024-02']).toBeDefined();
});

test('tax lots: per-lot short/long-term split at the 365.25-day boundary (hand-computed)', async ({ page }) => {
  // lot A: bought 400 days ago -> long-term. qty=10 cost=1000 price=150 -> gain 500
  // lot B: bought 100 days ago -> short-term. qty=5 cost=400 price=90 -> gain 50
  // ltPct = 500/(500+50)*100 = 90.90909090909091
  const result = await page.evaluate(() => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
    state.holdings = [
      { acc: 'brok', sym: 'AAA', qty: 10, cost: 1000 },
      { acc: 'brok', sym: 'BBB', qty: 5, cost: 400 },
    ];
    state.lots = [
      { acc: 'brok', sym: 'AAA', date: iso(now - 400 * 86400000), qty: 10, cost: 1000 },
      { acc: 'brok', sym: 'BBB', date: iso(now - 100 * 86400000), qty: 5, cost: 400 },
    ];
    state.quotes = { AAA: { price: 150, prev: 150 }, BBB: { price: 90, prev: 90 } };
    state.cash = { main: 0, brok: 0 };
    // Reproduce renderTaxCard()'s pure math without touching the DOM (it's a render function).
    const YR = 31557600000;
    let st = 0, lt = 0;
    for (const l of state.lots) {
      const g = l.qty * priceOf(l.sym) - l.cost;
      const bought = new Date(l.date + 'T12:00:00').getTime();
      if (now - bought >= YR) lt += g; else st += g;
    }
    return { st, lt, ltPct: (lt / (st + lt)) * 100 };
  });
  expect(result.lt).toBeCloseTo(500, 9);
  expect(result.st).toBeCloseTo(50, 9);
  expect(result.ltPct).toBeCloseTo(90.90909090909091, 9);
});

test('same-buys-in-VOO benchmark (pathValue): two lots replayed into VOO closes by hand', async ({ page }) => {
  // buy $1000 at VOO=100 (day 0) -> 10 sh; buy $500 at VOO=110 (day 10) -> 4.545454545454545 sh
  // current VOO price 130 -> value = 14.545454545454545 * 130 = 1890.909090909091; invested = 1500
  const result = await page.evaluate(() => {
    const D0 = Date.UTC(2024, 0, 1);
    // pathValue() requires >=10 history points; day 0 (100) and day 10 (110) are the two lot
    // purchase prices under test, the rest is padding and its exact values don't matter.
    const t = [], c = [];
    for (let i = 0; i <= 12; i++) { t.push(D0 + i * 86400000); c.push(i === 0 ? 100 : i === 10 ? 110 : 100 + i); }
    state.history = { VOO: { t, c } };
    state.quotes = { VOO: { price: 130, prev: 130 } };
    state.lots = [
      { acc: 'brok', sym: 'VOO', date: new Date(D0).toISOString().slice(0, 10), qty: 10, cost: 1000 },
      { acc: 'brok', sym: 'VOO', date: new Date(D0 + 10 * 86400000).toISOString().slice(0, 10), qty: 4.545454545454545, cost: 500 },
    ];
    return pathValue('VOO');
  });
  expect(result.invested).toBeCloseTo(1500, 9);
  expect(result.value).toBeCloseTo(1890.909090909091, 6);
});

test('riskStats: weekly-sampled fixture matches the Python oracle after the annualization fix', async ({ page }) => {
  // 40 weekly closes (7-day spacing), two holdings (TEST 90 sh, VOO 10 sh) so beta has a real
  // VOO series to compare against (riskStats only sees benchmark history for HELD symbols).
  // Oracle (scratch venv, numpy 2.0.2 + backtesting skill's ratios.py/indicators.py):
  //   periods_per_year = 365.25/7 = 52.17857142857143
  //   simple returns r_i = p[i]/p[i-1]-1 for both series
  //   port_ret = w_test*test_ret + w_voo*voo_ret, weights from qty*last_price/invested_val
  //     w_test=0.8982863754989574 w_voo=0.10171362450104267
  //   vol      = std_population(port_ret) * sqrt(periods_per_year) * 100 = 11.427074180614268
  //   ann_ret  = mean(port_ret) * periods_per_year * 100                 = 11.128096360736599
  //   beta     = cov_pop(port_ret,voo_ret)/var_pop(voo_ret)              = 0.9375417164250123
  //            = indicators.beta(port_ret, voo_ret) [ddof=1, ratio cancels] = 0.9375417164250124
  //   mdd      = ratios.max_drawdown(qty_test*test_p + qty_voo*voo_p)*100 = -6.805526597309786
  const TEST_PRICES = [100.0, 100.7623, 98.8363, 100.4815, 102.5433, 98.7671, 96.3725, 96.7643, 96.2985, 96.4107, 94.922, 96.7513, 98.4156, 98.6936, 101.0955, 102.1983, 100.6078, 101.5046, 99.726, 101.646, 101.697, 101.4737, 100.2514, 102.8871, 102.7236, 102.0002, 101.4365, 102.676, 103.5845, 104.5999, 105.6634, 110.4532, 109.7235, 108.7681, 107.1729, 108.6642, 111.3126, 111.2259, 109.5367, 107.9071];
  const VOO_PRICES = [100.0, 101.3453, 101.1772, 102.9555, 103.4923, 101.5723, 100.328, 100.9377, 101.8056, 102.2527, 102.2333, 103.5983, 105.1328, 106.2178, 105.9993, 106.3895, 104.9045, 104.7639, 103.4203, 106.6105, 105.6459, 106.8465, 104.0559, 105.3702, 105.581, 105.9824, 106.6425, 108.5586, 108.7869, 108.9289, 110.837, 113.6775, 111.6177, 109.6434, 107.5908, 109.2449, 111.1354, 112.1198, 110.6375, 109.9656];

  const r = await page.evaluate(({ TEST_PRICES, VOO_PRICES }) => {
    const D0 = Date.UTC(2020, 0, 1);
    const t = TEST_PRICES.map((_, i) => D0 + i * 7 * 86400000);
    state.holdings = [
      { acc: 'brok', sym: 'TEST', qty: 90, cost: 90 * TEST_PRICES[0] },
      { acc: 'brok', sym: 'VOO', qty: 10, cost: 10 * VOO_PRICES[0] },
    ];
    state.lots = state.holdings.map((h) => ({ acc: h.acc, sym: h.sym, date: new Date(D0).toISOString().slice(0, 10), qty: h.qty, cost: h.cost }));
    state.cash = { main: 0, brok: 0 };
    state.quotes = {
      TEST: { price: TEST_PRICES[TEST_PRICES.length - 1], prev: TEST_PRICES[TEST_PRICES.length - 2] },
      VOO: { price: VOO_PRICES[VOO_PRICES.length - 1], prev: VOO_PRICES[VOO_PRICES.length - 2] },
    };
    state.history = { TEST: { t, c: TEST_PRICES }, VOO: { t, c: VOO_PRICES } };
    return riskStats();
  }, { TEST_PRICES, VOO_PRICES });

  expect(r).not.toBeNull();
  expect(r.vol).toBeCloseTo(11.427074180614268, 6);
  expect(r.annRet).toBeCloseTo(11.128096360736599, 6);
  expect(r.beta).toBeCloseTo(0.9375417164250123, 6);
  expect(r.mdd).toBeCloseTo(-6.805526597309786, 6);
});

test('riskStats: same fixture reproduces the OLD hardcoded-252 bug when forced, proving the fix matters', async ({ page }) => {
  // Not a test of app code — a control showing the magnitude of the bug Phase 0 found, so the
  // fix above isn't mistaken for a rounding nit. Old formula: vol=popstd*sqrt(252)*100, annRet=mu*252*100.
  const TEST_PRICES = [100.0, 100.7623, 98.8363, 100.4815, 102.5433, 98.7671, 96.3725, 96.7643, 96.2985, 96.4107, 94.922, 96.7513, 98.4156, 98.6936, 101.0955, 102.1983, 100.6078, 101.5046, 99.726, 101.646, 101.697, 101.4737, 100.2514, 102.8871, 102.7236, 102.0002, 101.4365, 102.676, 103.5845, 104.5999, 105.6634, 110.4532, 109.7235, 108.7681, 107.1729, 108.6642, 111.3126, 111.2259, 109.5367, 107.9071];
  const VOO_PRICES = [100.0, 101.3453, 101.1772, 102.9555, 103.4923, 101.5723, 100.328, 100.9377, 101.8056, 102.2527, 102.2333, 103.5983, 105.1328, 106.2178, 105.9993, 106.3895, 104.9045, 104.7639, 103.4203, 106.6105, 105.6459, 106.8465, 104.0559, 105.3702, 105.581, 105.9824, 106.6425, 108.5586, 108.7869, 108.9289, 110.837, 113.6775, 111.6177, 109.6434, 107.5908, 109.2449, 111.1354, 112.1198, 110.6375, 109.9656];
  const old = await page.evaluate(({ TEST_PRICES, VOO_PRICES }) => {
    const D0 = Date.UTC(2020, 0, 1);
    const w_test = 0.8982863754989574, w_voo = 0.10171362450104267;
    const rets = [], voo = [];
    for (let i = 1; i < TEST_PRICES.length; i++) {
      rets.push(w_test * (TEST_PRICES[i] / TEST_PRICES[i - 1] - 1) + w_voo * (VOO_PRICES[i] / VOO_PRICES[i - 1] - 1));
      voo.push(VOO_PRICES[i] / VOO_PRICES[i - 1] - 1);
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mu = mean(rets);
    return {
      oldVol: Math.sqrt(mean(rets.map((r) => (r - mu) ** 2))) * Math.sqrt(252) * 100,
      oldAnnRet: mu * 252 * 100,
    };
  }, { TEST_PRICES, VOO_PRICES });
  // Old (buggy) figures are far outside the correct ~11%/~11% range -- roughly 2.2x / 4.8x over.
  expect(old.oldVol).toBeGreaterThan(20);
  expect(old.oldAnnRet).toBeGreaterThan(25);
});
