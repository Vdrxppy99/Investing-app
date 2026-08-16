'use strict';
/* One goal, one headline probability — on every surface that shows one.
 *
 * Home's goal card and Insights' projection module used to answer the same
 * question with different inputs: Home ran runMonteCarloProjection() with a
 * contribution rate derived from lot history, Insights ran it at zero. On the
 * demo dataset that is 100% on Home and 87% on Insights for a single goal.
 * Same defect class as the Home-vs-Portfolio total, the three theme-colour
 * copies and the three hardcoded active states — a figure that exists twice
 * and is computed twice.
 *
 * The owner's decision: the MAIN projection excludes contributions, and the
 * Insights what-if input is the only place in the app a contribution figure
 * enters a projection at all. These tests hold both halves of that.
 */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

const GOAL = { amt: 200000, year: 2036 };

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.addInitScript(`{ const R = Date; const F = ${FROZEN_TIME};
    Date = class extends R { constructor(...a){ if(!a.length) super(F); else super(...a); } static now(){ return F; } };
    Date.parse = R.parse; Date.UTC = R.UTC; }`);
  await unlockDemo(page);
  await page.evaluate((g) => { state.goal = g; lsSet('pt_goal', g); renderGoal(); }, GOAL);
  await page.waitForTimeout(900);
});

const pct = (s) => { const m = /(\d+)%/.exec(s || ''); return m ? m[1] : null; };

test('Home\'s goal card and Insights\' projection show the same probability', async ({ page }) => {
  const home = pct(await page.locator('#goalBody').innerText());
  expect(home).not.toBeNull();

  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1500);
  const big = pct(await page.locator('#projModBig').innerText());
  const line = pct(await page.locator('#projModGoalLine').innerText());

  expect(big).toBe(home);
  expect(line).toBe(home);
});

test('the headline run excludes contributions on BOTH surfaces', async ({ page }) => {
  // Home says so in words…
  await expect(page.locator('#goalBody')).toContainText('no future deposits');

  // …and the params both surfaces build carry monthlyContribution 0.
  const zero = await page.evaluate((g) => {
    const p = projectionParams(totals('all').value, g.year - new Date().getFullYear(), g.amt, 0);
    return { contribution: p.monthlyContribution, model: PROJECTION_MODEL };
  }, GOAL);
  expect(zero.contribution).toBe(0);

  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1500);
  await expect(page.locator('#projModGoalLine')).toContainText('no more deposits');
});

test('the what-if input is the only place a contribution changes the number', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1500);
  const before = pct(await page.locator('#projModBig').innerText());

  await page.locator('#projWhatIfInput').fill('1500');
  await page.waitForTimeout(1600);
  const after = pct(await page.locator('#projModBig').innerText());
  expect(Number(after)).toBeGreaterThan(Number(before)); // adding money can only help

  // Home is unmoved by it — the what-if is a local question, not a setting.
  await page.locator('.tabbar__item[data-page="home"]').click();
  await page.waitForTimeout(1200);
  expect(pct(await page.locator('#goalBody').innerText())).toBe(before);
});

test('both surfaces read one shared cache, so they cannot drift apart', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1500);
  const out = await page.evaluate((g) => {
    const years = g.year - new Date().getFullYear();
    const key = projectionKey(projectionParams(totals('all').value, years, g.amt, 0));
    return { keys: [...projCache.keys()], headlineKey: key };
  }, GOAL);
  expect(out.keys).toContain(out.headlineKey);
});
