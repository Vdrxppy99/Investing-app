'use strict';
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo, collectFigures } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

// The only significant path with no other coverage — a bug here loses the user's whole
// portfolio. Also the TP-1 regression guard (UPGRADE_PLAN.md Backlog): exportBackup() used
// to include pt_bk, the raw cloud-backup key + passcode verifier; nothing but this assertion
// stops a future change from silently reintroducing that leak into the export file.
test('export/import round-trip restores every figure, and the export never contains the cloud key', async ({ page }) => {
  await unlockDemo(page);
  const before = await collectFigures(page);

  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.locator('#editBtn').click();
  await expect(page.locator('#exportBtn')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportBtn').click(),
  ]);
  const backupPath = await download.path();
  expect(backupPath, 'export did not produce a downloaded file').not.toBeNull();
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  expect(backup.holdings.length).toBeGreaterThan(0);
  expect(backup).not.toHaveProperty('bk'); // TP-1 regression guard

  // Deliberately corrupt in-memory state before importing, so a no-op import would fail
  // this assertion — restoring the untouched demo seed alone would prove nothing.
  await page.evaluate(() => {
    state.holdings = [];
    state.lots = [];
    state.cash = { main: 0, brok: 0 };
    state.deposits = 0;
  });

  await page.locator('#importFile').setInputFiles(backupPath);
  await expect(page.locator('#toast')).toContainText('Backup restored');

  const after = await collectFigures(page);
  expect(after).toEqual(before);
});
