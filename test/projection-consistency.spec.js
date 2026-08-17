'use strict';
/* Session 6 rewrite (owner-specified scope change, not a bug fix): Insights'
 * projection card (#projModCard) stopped answering "will I hit my goal" and
 * now answers "what will this be worth" — a currency median + p10-p90 range
 * at a chosen horizon, no goal reference anywhere on the card. The percentage-
 * chance-of-goal framing this file used to compare across two surfaces now
 * lives ONLY on Home's own goal card (#goalBody/#goalPct, js/app.js
 * renderGoal()), which already owns the target amount/year.
 *
 * What this file still guards, updated for the new shape:
 *  1. Home's goal probability is exactly what the shared engine
 *     (projectionParams()/runProjection()) computes for the same inputs —
 *     "moved, not recomputed differently" per the owner's brief.
 *  2. The headline run excludes contributions on BOTH surfaces — Home's goal
 *     card in words, Insights' card in its sub-caption (no goal line to check
 *     anymore, and #projModGoalLine no longer exists in the DOM at all).
 *  3. #projModBig is pinned to the zero-contribution run; the what-if input's
 *     only two outputs are its own result sentence and the dashed chart
 *     overlay — unchanged principle, now measured in dollars instead of a
 *     percentage — and Home's own probability (a completely separate
 *     question now, not a shared cache key) is unmoved by it.
 *  4. NEW: switching the horizon (5/10/20/30y) re-slices the one 30-year
 *     simulation instead of triggering a fresh 10,000-path run — monte-
 *     carlo.js computes every year's percentiles from the same paths, so a
 *     shorter horizon's numbers are an exact slice, not an approximation. See
 *     js/insights.js's PROJ_MOD_YEARS/sliceFan() comment for why.
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
const money = (s) => { const m = /\$([\d,]+)/.exec(s || ''); return m ? +m[1].replace(/,/g, '') : null; };

test('Home\'s goal card shows exactly the probability the shared engine computes for the same inputs', async ({ page }) => {
  const home = pct(await page.locator('#goalBody').innerText());
  expect(home).not.toBeNull();

  const direct = await page.evaluate((g) => {
    const years = g.year - new Date().getFullYear();
    const params = projectionParams(totals('all').value, years, g.amt, 0);
    return runProjection(params).then((r) => Math.round(r.probabilityOfGoal * 100));
  }, GOAL);

  // "Same underlying computation, moved, not recomputed differently" — printed
  // for verification per the owner's brief, not just asserted.
  // eslint-disable-next-line no-console
  console.log(`Home #goalBody: ${home}% · direct runProjection(): ${direct}%`);
  expect(+home).toBe(direct);
});

test('the headline run excludes contributions on both surfaces', async ({ page }) => {
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
  // No goal line on this card anymore — the "no more deposits" statement is
  // part of the sub-caption next to the horizon control instead.
  await expect(page.locator('#projModHead .mod__sub')).toContainText('no more deposits');
  await expect(page.locator('#projModGoalLine')).toHaveCount(0);
});

// Flipped 2026-08-16 (owner, prior session). Originally asserted `after > before`:
// #projModBig moved when the what-if input was filled. That encoded the module's
// behaviour from BEFORE the owner specified this card — his requirement is that
// the primary output is growth with NO deposits, and the typed contribution is a
// secondary what-if. A headline that moves with the input has no stable "no more
// deposits" answer visible anywhere, which is exactly the failure he asked to
// avoid. The what-if's only two outputs are now #projWhatIfResult (a sentence)
// and a dashed median line drawn on the chart (js/app.js drawGoalFan()). Session
// 6: #projModBig is now a dollar figure, not a percentage — money() replaces
// the old pct() extractor for this card only.
test('#projModBig is pinned to the zero-contribution run; the what-if only adds its own result line and chart overlay', async ({ page }) => {
  const homeBefore = pct(await page.locator('#goalBody').innerText());

  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1500);
  const before = money(await page.locator('#projModBig').innerText());
  expect(before).not.toBeNull();
  const seriesBefore = await page.evaluate(() => document.getElementById('projFan')._lwcChart.panes()[0].getSeries().length);
  await expect(page.locator('#projWhatIfResult')).toBeHidden();

  await page.locator('#projWhatIfInput').fill('1500');
  await page.waitForTimeout(1600);
  const after = money(await page.locator('#projModBig').innerText());
  expect(after).toBe(before); // the headline never responds to the what-if input

  // …but its own two outputs did appear.
  await expect(page.locator('#projWhatIfResult')).toBeVisible();
  await expect(page.locator('#projWhatIfResult')).toContainText('more than with no deposits');
  const seriesAfter = await page.evaluate(() => document.getElementById('projFan')._lwcChart.panes()[0].getSeries().length);
  expect(seriesAfter).toBe(seriesBefore + 1); // the dashed what-if median line

  // Home's goal probability is a completely separate question now (Home: "%
  // chance by target year", this card: "$ at horizon") — not a shared cache
  // key the way it used to be, so it should be just as unmoved as before.
  await page.locator('.tabbar__item[data-page="home"]').click();
  await page.waitForTimeout(1200);
  expect(pct(await page.locator('#goalBody').innerText())).toBe(homeBefore);

  // Clearing the input removes both what-if outputs.
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1200);
  await page.locator('#projWhatIfInput').fill('');
  await page.waitForTimeout(1600);
  await expect(page.locator('#projWhatIfResult')).toBeHidden();
  const seriesCleared = await page.evaluate(() => document.getElementById('projFan')._lwcChart.panes()[0].getSeries().length);
  expect(seriesCleared).toBe(seriesBefore);
});

test('switching the projection horizon re-slices the cached 30-year run instead of simulating again', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => projCache.size);

  await page.locator('#projHorizonSeg button[data-y="30"]').click();
  await page.waitForTimeout(200); // no debounce on horizon clicks (unlike the what-if input)
  expect(await page.evaluate(() => projCache.size)).toBe(before);

  await page.locator('#projHorizonSeg button[data-y="5"]').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => projCache.size)).toBe(before);

  // And the numbers actually moved with the horizon (proof it re-sliced real
  // data, not that the control is inert — same reasoning as active-state.spec.js's
  // #screenSeg check).
  await page.locator('#projHorizonSeg button[data-y="30"]').click();
  await page.waitForTimeout(200);
  const big30 = money(await page.locator('#projModBig').innerText());
  await page.locator('#projHorizonSeg button[data-y="5"]').click();
  await page.waitForTimeout(200);
  const big5 = money(await page.locator('#projModBig').innerText());
  expect(big30).toBeGreaterThan(big5); // longer horizon, larger median value
});
