'use strict';
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

// Regression guard for the bug class fixed three times now: an active-state
// selector hardcoded in markup that the click handler never clears, so the
// markup's hardcoded default and whichever one the user actually picked both
// render lit at once. Fixed for rail-nav in commit 1b374e9, for #metricSeg/
// #rangeSeg via js/app.js's syncSel (see its comment), and the Daily Movers
// toggle (js/app.js) is built with the same syncSel from the start — this test
// is what stops a fourth instance. "Lit" means EITHER the .on class OR the
// aria-current/aria-selected attribute, since syncSel's own comment says the
// two mechanisms are meant to be interchangeable — a regression could hide in
// either one alone.
async function litCount(page, selector) {
  return page.$$eval(selector, (els) => els.filter((el) =>
    el.classList.contains('on')
    || el.getAttribute('aria-current') === 'page'
    || el.getAttribute('aria-selected') === 'true'
  ).length);
}

async function assertOneLitPerClick(page, selector, groupName) {
  const buttons = await page.locator(selector).all();
  expect(buttons.length, `${groupName}: no buttons found for ${selector}`).toBeGreaterThan(0);
  for (let i = 0; i < buttons.length; i++) {
    await buttons[i].click();
    const n = await litCount(page, selector);
    expect(n, `${groupName}: expected exactly one lit element after clicking button ${i}`).toBe(1);
  }
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

test('exactly one control is lit in every selection group after every possible click', async ({ page }) => {
  await unlockDemo(page);

  // Mobile viewport (this suite's default, see playwright.config.js) — the
  // bottom tabbar is the active nav here, .rail-nav is display:none.
  await assertOneLitPerClick(page, '.tabbar__item', 'tabbar');

  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await assertOneLitPerClick(page, '#rangeSeg button', '#rangeSeg');
  await assertOneLitPerClick(page, '#metricSeg button', '#metricSeg');

  await page.locator('.tabbar__item[data-page="home"]').click();
  await assertOneLitPerClick(page, '#moverToggle button', 'Daily Movers toggle');

  await page.locator('.tabbar__item[data-page="markets"]').click();
  await assertOneLitPerClick(page, '#screenSeg button', 'Markets screener toggle');
  // The lit-count check above would still pass with #screenSeg completely unwired
  // (the hardcoded "Active" default stays the only lit button through every click,
  // so nothing ever goes double-lit) — it doesn't prove clicking does anything. The
  // three screener lists it switches between (data-screen-panel) are the real proof.
  await page.locator('#screenSeg button[data-screen="gain"]').click();
  await expect(page.locator('[data-screen-panel="gain"]')).toBeVisible();
  await expect(page.locator('[data-screen-panel="active"]')).toBeHidden();
  await expect(page.locator('[data-screen-panel="lose"]')).toBeHidden();
  await page.locator('#screenSeg button[data-screen="lose"]').click();
  await expect(page.locator('[data-screen-panel="lose"]')).toBeVisible();
  await expect(page.locator('[data-screen-panel="gain"]')).toBeHidden();

  // Desktop rail nav replaces the tabbar at >=1024px (css/layout.css) — the
  // tabbar is display:none up here, so this is the only viewport it can be
  // driven from.
  await page.setViewportSize({ width: 1280, height: 900 });
  await assertOneLitPerClick(page, '.rail-nav__item', 'rail nav');
});
