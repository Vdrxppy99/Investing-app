'use strict';
/* Phase 6 — Monte Carlo projection engine. Pure function: params in, distribution out.
 * No page/browser fixture used anywhere in this file — the engine must be testable
 * (and is tested here) as plain Node code, since it also has to run unmodified inside
 * a Web Worker (js/monte-carlo-worker.js just importScripts() this same file).
 */
const { test, expect } = require('@playwright/test');
const { runMonteCarloProjection, mulberry32 } = require('../js/monte-carlo.js');

test('zero volatility: every path (so the median too) matches simple compound growth exactly', () => {
  const v0 = 10000, years = 10, meanReal = 0.07, meanInfl = 0.02;
  const result = runMonteCarloProjection({
    v0, years, monthlyContribution: 0, goal: null,
    meanReal, sdReal: 0, meanInfl, sdInfl: 0,
    paths: 50, seed: 1,
  });
  const expected = v0 * Math.pow(1 + meanReal, years);
  // relative tolerance, not toBeCloseTo's fixed-decimal-place check — these are
  // dollar-scale numbers put through ~20 multiply/divide steps of float math.
  for (const v of [result.fan.p10[years], result.fan.p50[years], result.fan.p90[years]]) {
    expect(Math.abs(v - expected) / expected).toBeLessThan(1e-9);
  }
});

test('zero volatility with contributions matches a hand-computed annuity-with-inflation-decay sum', () => {
  const v0 = 5000, years = 6, meanReal = 0.07, meanInfl = 0.02, monthlyContribution = 200;
  const result = runMonteCarloProjection({
    v0, years, monthlyContribution, goal: null,
    meanReal, sdReal: 0, meanInfl, sdInfl: 0,
    paths: 10, seed: 7,
  });
  // Independent derivation: contributions are fixed in NOMINAL dollars (not inflation-
  // indexed), added at each year-end, then the whole nominal path is deflated by the
  // realized cumulative inflation to land in today's (real) dollars. With inflation and
  // real return both constant, that closed-form sum is:
  //   FV_real = V0*(1+real)^T + sum_{t=1..T} C*(1+real)^(T-t) / (1+infl)^t
  const contribAnnual = monthlyContribution * 12;
  let expected = v0 * Math.pow(1 + meanReal, years);
  for (let t = 1; t <= years; t++) {
    expected += contribAnnual * Math.pow(1 + meanReal, years - t) / Math.pow(1 + meanInfl, t);
  }
  const actual = result.fan.p50[years];
  expect(Math.abs(actual - expected) / expected).toBeLessThan(1e-9);
});

test('seeded generator produces identical output across repeated runs', () => {
  const params = {
    v0: 25000, years: 15, monthlyContribution: 400, goal: 100000,
    meanReal: 0.07, sdReal: 0.12, meanInfl: 0.02, sdInfl: 0.008,
    paths: 2000, seed: 12345,
  };
  const a = runMonteCarloProjection(params);
  const b = runMonteCarloProjection(params);
  expect(a).toEqual(b);
});

test('mulberry32 itself is a pure deterministic function of its seed', () => {
  const seq1 = []; const rand1 = mulberry32(42);
  for (let i = 0; i < 5; i++) seq1.push(rand1());
  const seq2 = []; const rand2 = mulberry32(42);
  for (let i = 0; i < 5; i++) seq2.push(rand2());
  expect(seq1).toEqual(seq2);
  // and every draw is a valid uniform(0,1) sample
  for (const v of seq1) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});

test('percentiles are ordered p10 <= p50 <= p90 at every year, with real volatility', () => {
  const result = runMonteCarloProjection({
    v0: 20000, years: 20, monthlyContribution: 300, goal: null,
    meanReal: 0.07, sdReal: 0.12, meanInfl: 0.02, sdInfl: 0.008,
    paths: 5000, seed: 99,
  });
  for (let y = 0; y <= 20; y++) {
    expect(result.fan.p10[y]).toBeLessThanOrEqual(result.fan.p50[y]);
    expect(result.fan.p50[y]).toBeLessThanOrEqual(result.fan.p90[y]);
  }
});

test('probability of reaching the goal is null with no goal, and a fraction in [0,1] with one', () => {
  const base = {
    v0: 20000, years: 20, monthlyContribution: 300,
    meanReal: 0.07, sdReal: 0.12, meanInfl: 0.02, sdInfl: 0.008,
    paths: 3000, seed: 5,
  };
  const noGoal = runMonteCarloProjection({ ...base, goal: null });
  expect(noGoal.probabilityOfGoal).toBeNull();

  const withGoal = runMonteCarloProjection({ ...base, goal: 60000 });
  expect(withGoal.probabilityOfGoal).toBeGreaterThanOrEqual(0);
  expect(withGoal.probabilityOfGoal).toBeLessThanOrEqual(1);
});

test('fan arrays span every year from 0 (today) through the target year, inclusive', () => {
  const result = runMonteCarloProjection({
    v0: 1000, years: 7, monthlyContribution: 0, goal: null,
    meanReal: 0.07, sdReal: 0.12, meanInfl: 0.02, sdInfl: 0.008,
    paths: 200, seed: 3,
  });
  expect(result.fan.years).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(result.fan.p10.length).toBe(8);
  expect(result.fan.p50.length).toBe(8);
  expect(result.fan.p90.length).toBe(8);
  expect(result.fan.p50[0]).toBe(1000); // year 0 is today's value, unsimulated
});
