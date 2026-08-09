'use strict';
/* Phase 4 — two "looks interactive, isn't" bugs found while measuring CWV.
   Both are regression guards: a control silently losing its handler again
   should fail a test, not wait for someone to notice by hand (the fourth
   time this exact bug class has shown up in this codebase). */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

test('#sectorRow .krow rows open a stock sheet on click (were dead: data-sym with no handler)', async ({ page }) => {
  await unlockDemo(page);
  // SEED_QUOTES (js/seed.js) has no sector ETF entries — this offline/seeded test
  // environment never gets real sector data, so #sectorRow renders nothing to click
  // without this. Injecting one quote mirrors what a real online session has.
  await page.evaluate(() => { state.quotes['XLK'] = { price: 250, prev: 245 }; });
  await page.locator('.tabbar__item[data-page="markets"]').click();
  await page.waitForTimeout(500);
  const row = page.locator('#sectorRow .krow').first();
  await expect(row).toHaveCount(1);
  const sym = await row.getAttribute('data-sym');
  await row.click();
  await page.waitForTimeout(400);
  await expect(page.locator('#detail')).not.toHaveClass(/hidden/);
  await expect(page.locator('.sheet__title')).toContainText(sym.replace('-', '.'));
});

test('opening a Markets/Following row calls openStockSheet exactly once, not twice', async ({ page }) => {
  await unlockDemo(page);
  await page.evaluate(() => {
    window.__openStockSheetCalls = 0;
    const orig = window.openStockSheet;
    window.openStockSheet = function (...args) { window.__openStockSheetCalls++; return orig.apply(this, args); };
  });
  await page.locator('.tabbar__item[data-page="markets"]').click();
  await page.waitForTimeout(500);
  const idea = page.locator('#ideaList .mrow').first();
  if (await idea.count()) {
    await idea.click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__openStockSheetCalls)).toBe(1);
  }
});
