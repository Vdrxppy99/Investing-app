'use strict';
/* Phase 4 — Chart.js lazy-load (js/boot.js ensureChartJs()). Chart.js is no
   longer a blocking <script> tag or in sw.js's CORE precache; it's injected
   on first actual use and runtime-cached from then on. Three things that
   need proving, not assuming: it stays unloaded until actually needed, it
   loads correctly when needed, and the cold-offline-first-use case (never
   fetched online, so nothing cached yet, then offline) fails gracefully
   instead of throwing. */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

test('Chart.js is not loaded until a chart-needing sheet actually opens', async ({ page }) => {
  await unlockDemo(page);
  const loadedAtUnlock = await page.evaluate(() => typeof window.Chart !== 'undefined');
  expect(loadedAtUnlock).toBe(false);
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  const loadedOnPortfolioTab = await page.evaluate(() => typeof window.Chart !== 'undefined');
  expect(loadedOnPortfolioTab).toBe(false); // hero chart is Lightweight Charts, not Chart.js
});

test('opening a holding sheet lazy-loads Chart.js and draws the chart', async ({ page }) => {
  await unlockDemo(page);
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.locator('.hrow').first().click();
  await expect.poll(() => page.evaluate(() => typeof window.Chart !== 'undefined'), {
    message: 'Chart.js never loaded after opening a holding sheet',
  }).toBe(true);
  const isPainted = () => page.evaluate(() => {
    const c = document.getElementById('detailChart');
    if (!c || !c.width || !c.height) return false;
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) return true;
    return false;
  });
  await expect.poll(isPainted, 'detail chart canvas never painted').toBe(true);
});

test('cold offline first use: Chart.js unavailable (never cached) fails gracefully, no crash', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Simulates the exact scenario the task calls out: first-ever chart open, offline,
  // nothing runtime-cached yet — block only the vendor file the lazy-loader fetches,
  // not the whole origin, so the rest of the app loads normally.
  await page.route('**/vendor/chart.umd.min.js', (route) => route.abort('internetdisconnected'));
  await unlockDemo(page);
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.locator('.hrow').first().click();
  await page.waitForTimeout(500);
  // The exact fallback text js/portfolio.js's drawChart() already shows for
  // "Chart.js unavailable" — proves the failure path is the pre-existing,
  // designed-for one, not a new unhandled state.
  await expect(page.locator('#detailMsg')).toHaveText('Connect to the internet once to load the chart library.');
  // The sheet's non-chart content (price, stats) must still work — a missing
  // chart library isn't allowed to take the rest of the sheet down with it.
  await expect(page.locator('#ssStats, .stats').first()).toBeVisible();
  expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});
