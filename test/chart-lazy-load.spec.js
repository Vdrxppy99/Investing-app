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

test('holding sheet draws a Lightweight Charts chart (same engine as the hero) without loading Chart.js', async ({ page }) => {
  await unlockDemo(page);
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.locator('.hrow').first().click();
  const painted = () => page.evaluate(() => {
    const c = document.querySelector('#detailChart canvas');
    return !!(c && c.width && c.height);
  });
  await expect.poll(painted, 'detail chart never rendered').toBe(true);
  expect(await page.evaluate(() => typeof window.Chart !== 'undefined')).toBe(false);
});

test('holding sheet chart does not depend on Chart.js being reachable offline, and scrubbing updates the readout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/vendor/chart.umd.min.js', (route) => route.abort('internetdisconnected'));
  await unlockDemo(page);
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.locator('.hrow').first().click();
  await expect(page.locator('#detailChart canvas').first()).toBeVisible();
  const ro = page.locator('#detailRO');
  await expect(ro).toContainText('1M');
  const hint = await ro.textContent();
  const box = await page.locator('#detailChart').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
  await expect(ro).not.toHaveText(hint); // scrubbing swaps the range label for the hovered date
  await page.mouse.up();
  await expect(ro).toHaveText(hint);
  await page.locator('#detailRange button[data-r="1Y"]').click();
  await expect(page.locator('#detailRange button[data-r="1Y"]')).toHaveAttribute('aria-selected','true');
  await expect(ro).toContainText('1Y');
  await expect(page.locator('.stats').first()).toBeVisible();
  expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('dragging a finger across the holding chart scrubs it and does not move the sheet', async ({ page }) => {
    await unlockDemo(page);
    await page.locator('.tabbar__item[data-page="portfolio"]').click();
    await page.locator('.hrow').first().click();
    const chart = page.locator('#detailChart canvas').first();
    await expect(chart).toBeVisible();
    const ro = page.locator('#detailRO');
    const hint = await ro.textContent();
    const b = await page.locator('#detailChart').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const pt = (x, y) => [{ x, y, id: 1 }];
    const y0 = b.y + b.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(b.x + 60, y0) });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(b.x + 60 + i * 30, y0 + i * 4) });
    await expect(ro).not.toHaveText(hint);
    const moved = await page.evaluate(() => document.querySelector('#detail .sheet').style.transform || '');
    expect(moved, 'sheet must not follow a chart scrub').toBe('');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(ro).toHaveText(hint);
  });
});
