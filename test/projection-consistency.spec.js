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

// Flipped 2026-08-16 (owner, this session). Originally asserted `after > before`:
// #projModBig moved when the what-if input was filled. That encoded the module's
// behaviour from BEFORE the owner specified this card — his requirement is that
// the primary output is growth with NO deposits, and the typed contribution is a
// secondary what-if. A headline that moves with the input has no stable "no more
// deposits" answer visible anywhere, which is exactly the failure he asked to
// avoid. The what-if's only two outputs are now #projWhatIfResult (a sentence)
// and a dashed median line drawn on the chart (js/app.js drawGoalFan()).
test('#projModBig is pinned to the zero-contribution run; the what-if only adds its own result line and chart overlay', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1500);
  const before = pct(await page.locator('#projModBig').innerText());
  const seriesBefore = await page.evaluate(() => document.getElementById('projFan')._lwcChart.panes()[0].getSeries().length);
  await expect(page.locator('#projWhatIfResult')).toBeHidden();

  await page.locator('#projWhatIfInput').fill('1500');
  await page.waitForTimeout(1600);
  const after = pct(await page.locator('#projModBig').innerText());
  expect(after).toBe(before); // the headline never responds to the what-if input

  // …but its own two outputs did appear.
  await expect(page.locator('#projWhatIfResult')).toBeVisible();
  await expect(page.locator('#projWhatIfResult')).toContainText('more than with no deposits');
  const seriesAfter = await page.evaluate(() => document.getElementById('projFan')._lwcChart.panes()[0].getSeries().length);
  expect(seriesAfter).toBe(seriesBefore + 1); // the dashed what-if median line

  // Home is unmoved by it — the what-if is a local question, not a setting.
  await page.locator('.tabbar__item[data-page="home"]').click();
  await page.waitForTimeout(1200);
  expect(pct(await page.locator('#goalBody').innerText())).toBe(before);

  // Clearing the input removes both what-if outputs.
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1200);
  await page.locator('#projWhatIfInput').fill('');
  await page.waitForTimeout(1600);
  await expect(page.locator('#projWhatIfResult')).toBeHidden();
  const seriesCleared = await page.evaluate(() => document.getElementById('projFan')._lwcChart.panes()[0].getSeries().length);
  expect(seriesCleared).toBe(seriesBefore);
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
