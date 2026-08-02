'use strict';
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

// The News tab was deliberately removed (owner decision, see CLAUDE.md) — the
// tabbar has exactly these three.
const TABS = ['portfolio', 'explore', 'insights'];
// 1D has no offline fallback (js/portfolio.js renderChart): it needs a live intraday
// fetch, which this suite deliberately blocks, so it shows "Loading today's prices…"
// rather than a painted line.
// 1W/2W fall inside a single gap of the baked SEED_HISTORY (js/seed.js), which is
// sampled roughly weekly — sliceRange() returns only 1 data point for both windows,
// too few for Chart.js to draw a line. Verified via state history inspection, not a
// bug: online, live daily history makes both ranges normal. 1M is the shortest range
// with 2+ baked points, so it's the first one this suite can assert a painted canvas for.
const OFFLINE_EMPTY_RANGE = '1D';
const PAINTED_RANGES = ['1M', '6M', 'YTD', '1Y', '5Y', 'MAX'];
const ALL_RANGES = ['1D', '1W', '2W', ...PAINTED_RANGES];

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

test('unlocks with the demo passcode and every tab renders without a console error', async ({ page }) => {
  const errors = [];
  // "Failed to load resource: net::ERR_FAILED" is Chromium's own log line for every request
  // this suite deliberately aborts (blockExternalNetwork) — expected noise, not an app bug.
  page.on('console', (msg) => { if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await unlockDemo(page);

  for (const tabName of TABS) {
    await page.locator(`.tabbar__item[data-page="${tabName}"]`).click();
    await expect(page.locator(`#page-${tabName}`)).toBeVisible();
  }

  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  for (const range of ALL_RANGES) {
    await page.locator(`#rangeSeg button[data-r="${range}"]`).click();
  }

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('total portfolio value matches the expected demo-dataset string', async ({ page }) => {
  await unlockDemo(page);
  await expect(page.locator('#tvNum')).toHaveText('$148,041.36');
});

test('the holdings table row count matches the demo holdings count', async ({ page }) => {
  await unlockDemo(page);
  await expect(page.locator('#holdList > [data-sym]')).toHaveCount(6);
});

test('the hero chart canvas is non-empty at every range with offline data', async ({ page }) => {
  await unlockDemo(page);
  // #mainChart is a plain div since Phase 2 (Lightweight Charts owns the canvas(es) it
  // creates inside it, one per rendering layer) — check every canvas LWC has mounted there.
  const host = page.locator('#mainChart');

  const isPainted = () => host.evaluate((el) => {
    const canvases = [...el.querySelectorAll('canvas')];
    return canvases.some((c) => {
      const { width, height } = c;
      if (!width || !height) return false;
      const data = c.getContext('2d').getImageData(0, 0, width, height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true; // any non-transparent pixel
      return false;
    });
  });

  for (const range of PAINTED_RANGES) {
    await page.locator(`#rangeSeg button[data-r="${range}"]`).click();
    await expect.poll(isPainted, `range ${range} never painted the canvas`).toBe(true);
  }
});

test('1D range shows the offline placeholder instead of a stale chart', async ({ page }) => {
  await unlockDemo(page);
  await page.locator(`#rangeSeg button[data-r="${OFFLINE_EMPTY_RANGE}"]`).click();
  await expect(page.locator('#chartMsg')).toHaveText('Loading today’s prices…');
});
