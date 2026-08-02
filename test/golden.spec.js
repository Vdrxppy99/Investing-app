'use strict';
const { test, expect } = require('@playwright/test');
const golden = require('./golden/golden-master.json');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo, collectFigures } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

test('every computed financial figure matches the golden master', async ({ page }) => {
  await unlockDemo(page);
  const figures = await collectFigures(page);

  const { _comment, ...expected } = golden;
  expect(figures).toEqual(expected);
});
