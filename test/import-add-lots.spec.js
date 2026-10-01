'use strict';
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

// An "add-lots" file (js/portfolio.js importAddLots) appends purchases instead of
// replacing state like a full backup does. Made-up figures — never real holdings.
const FILE = {
  app: 'portfolio-tracker', kind: 'add-lots', deposits: 300,
  lots: [
    { acc: 'main', sym: 'VTI', date: '2026-09-30', qty: 1.5, cost: 250 },
    { acc: 'brok', sym: 'NEWT', date: '2026-09-30', qty: 2, cost: 50 },
    { acc: 'brok', sym: 'VYM', date: '2026-09-22', qty: 0.01, cost: 1.5, div: true },
  ],
};

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

async function openEditSheet(page) {
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.locator('#editBtn').click();
}

async function importFile(page, obj) {
  await openEditSheet(page);
  await page.locator('#importFile').setInputFiles({
    name: 'add.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)),
  });
  await expect(page.locator('#editModal')).toBeHidden();
}

const snap = (page) => page.evaluate(() => ({
  lots: state.lots.length,
  deposits: +state.deposits || 0,
  vti: state.holdings.find((h) => h.acc === 'main' && h.sym === 'VTI') || null,
  newt: state.holdings.find((h) => h.acc === 'brok' && h.sym === 'NEWT') || null,
  holdings: state.holdings.length,
}));

test('add-lots import appends lots, updates holdings and deposits, and is idempotent', async ({ page }) => {
  await unlockDemo(page);
  const before = await snap(page);

  await importFile(page, FILE);
  const after = await snap(page);
  expect(after.lots).toBe(before.lots + 3);
  expect(after.holdings).toBe(before.holdings + 1); // NEWT is a brand-new position
  expect(after.newt).toEqual({ acc: 'brok', sym: 'NEWT', qty: 2, cost: 50 });
  if (before.vti) {
    expect(after.vti.qty).toBeCloseTo(before.vti.qty + 1.5, 6);
    expect(after.vti.cost).toBeCloseTo(before.vti.cost + 250, 6);
  } else {
    expect(after.vti).toEqual({ acc: 'main', sym: 'VTI', qty: 1.5, cost: 250 });
  }
  expect(after.deposits).toBeCloseTo(before.deposits + 300, 6);

  // Same file again: every lot is already there, so nothing changes — no double count.
  await importFile(page, FILE);
  expect(await snap(page)).toEqual(after);
});

test('a malformed add-lots file changes nothing', async ({ page }) => {
  await unlockDemo(page);
  const before = await snap(page);
  await openEditSheet(page);
  await page.locator('#importFile').setInputFiles({
    name: 'bad.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ kind: 'add-lots', lots: [{ acc: 'nope', sym: 'X', date: '2026-01-01', qty: 1, cost: 1 }] })),
  });
  await expect(page.locator('#toast.bad')).toHaveText(/not a valid portfolio backup/);
  expect(await snap(page)).toEqual(before);
});
