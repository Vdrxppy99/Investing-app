'use strict';
/* Phase 4 accessibility audit — real axe-core runs (via @axe-core/playwright)
   against the demo-unlocked app, not markup review. One test per tab, plus the
   holding-detail sheet (the only overlay reachable from the demo dataset without
   further setup). Uses the same FROZEN_TIME/unlockDemo fixtures as the Phase 0
   smoke suite so results are deterministic. */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => {
    Date.now = () => t;
    // eslint-disable-next-line no-global-assign
    Date = class extends Date {
      constructor(...args) { super(...(args.length ? args : [t])); }
      static now() { return t; }
    };
  }, FROZEN_TIME);
  await blockExternalNetwork(page);
  await unlockDemo(page);
});

const TABS = ['home', 'markets', 'portfolio', 'insights', 'following'];

for (const tab of TABS) {
  test(`axe: ${tab} tab`, async ({ page }) => {
    await page.locator(`.tabbar__item[data-page="${tab}"]`).click();
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).analyze();
    await test.info().attach(`axe-${tab}.json`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test('axe: holding detail sheet', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.waitForTimeout(300);
  await page.locator('.hrow').first().click();
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page }).analyze();
  await test.info().attach('axe-detail-sheet.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/* Keyboard-path guard — axe cannot see "this div only responds to a mouse
   click," which is exactly why .hrow/.mvcol/.stat survived a zero-violation
   axe run as click-only. .focus() only lands on an element that can actually
   take focus (a plain div with no tabindex is a no-op — document.activeElement
   does not move to it), so toBeFocused() is a real proof of reachability, not
   a shortcut around it; Enter/Space firing the same effect as a click proves
   activation. */
test('keyboard: Tab-reachable holdings row opens the detail sheet on Enter', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.waitForTimeout(300);
  const row = page.locator('.hrow').first();
  await row.focus();
  await expect(row).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await expect(page.locator('#detail')).not.toHaveClass(/hidden/);
});

test('keyboard: a movers column opens the detail sheet on Space', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="home"]').click();
  await page.waitForTimeout(300);
  const col = page.locator('.mvcol').first();
  await col.focus();
  await expect(col).toBeFocused();
  await page.keyboard.press(' ');
  await page.waitForTimeout(400);
  await expect(page.locator('#detail')).not.toHaveClass(/hidden/);
});

test('keyboard: a module tile opens its Insights sheet on Enter', async ({ page }) => {
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(300);
  const tile = page.locator('#modGrid [data-mod]').first();
  await tile.focus();
  await expect(tile).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await expect(page.locator('#detail')).not.toHaveClass(/hidden/);
});
