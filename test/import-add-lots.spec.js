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

/* ---- sales: an add-lots file's optional `sells` array (js/portfolio.js applySell) ----
   A sale is a negative lot {qty:-n, cost:-basis, sell:true, proceeds}. Made-up figures.
   Hand-derived FIFO below: two lots of ZZSELL — 10 sh/$1000 (Jan) and 5 sh/$600 (Mar).
   Selling 12 sh consumes all of lot 1 ($1000) and 2 of lot 2's 5 shares ($600*2/5 = $240),
   so basis relieved = $1240, leaving 3 sh with $360 cost. */
const BUYS = { app: 'portfolio-tracker', kind: 'add-lots', lots: [
  { acc: 'brok', sym: 'ZZSELL', date: '2026-01-02', qty: 10, cost: 1000 },
  { acc: 'brok', sym: 'ZZSELL', date: '2026-03-02', qty: 5, cost: 600 },
] };
const SELL12 = { app: 'portfolio-tracker', kind: 'add-lots', sells: [
  { acc: 'brok', sym: 'ZZSELL', date: '2026-06-01', qty: 12, proceeds: 1500 },
] };
const zz = (page) => page.evaluate(() => ({
  h: state.holdings.find((x) => x.sym === 'ZZSELL' && x.acc === 'brok') || null,
  open: openLots().filter((l) => l.sym === 'ZZSELL').map((l) => ({ date: l.date, qty: l.qty, cost: l.cost })),
  sells: state.lots.filter((l) => l.sell && l.sym === 'ZZSELL'),
  lots: state.lots.length, deposits: +state.deposits || 0,
}));

test('a sale relieves FIFO basis, shrinks the holding, and leaves deposits alone', async ({ page }) => {
  await unlockDemo(page);
  await importFile(page, BUYS);
  const before = await zz(page);
  expect(before.h).toEqual({ acc: 'brok', sym: 'ZZSELL', qty: 15, cost: 1600 });

  await importFile(page, SELL12);
  const after = await zz(page);
  expect(after.h.qty).toBeCloseTo(3, 9);
  expect(after.h.cost).toBeCloseTo(360, 9);
  expect(after.sells).toEqual([{ acc: 'brok', sym: 'ZZSELL', date: '2026-06-01', qty: -12, cost: -1240, sell: true, proceeds: 1500 }]);
  expect(after.open).toHaveLength(1);
  expect(after.open[0].date).toBe('2026-03-02');
  expect(after.open[0].qty).toBeCloseTo(3, 9);
  expect(after.open[0].cost).toBeCloseTo(360, 9);
  expect(after.deposits).toBe(before.deposits); // proceeds are not new money

  // the money-flow view uses proceeds (cash that left the position), the running totals use basis
  const f = await page.evaluate(() => { const s = state.lots.find((l) => l.sell && l.sym === 'ZZSELL'); return { flow: lotFlow(s), cost: s.cost }; });
  expect(f).toEqual({ flow: -1500, cost: -1240 });

  // idempotent: the same file again changes nothing
  await importFile(page, SELL12);
  expect(await zz(page)).toEqual(after);
});

test('selling the whole position removes the holding row and leaves no dust', async ({ page }) => {
  await unlockDemo(page);
  await importFile(page, BUYS);
  await importFile(page, { app: 'portfolio-tracker', kind: 'add-lots', sells: [
    { acc: 'brok', sym: 'ZZSELL', date: '2026-06-01', qty: 15.0002, proceeds: 1900 }, // within the 0.0005 rounding slack
  ] });
  const a = await zz(page);
  expect(a.h).toBeNull();
  expect(a.open).toEqual([]);
  expect(a.sells[0].qty).toBe(-15);   // snapped to the exact shares held
  expect(a.sells[0].cost).toBe(-1600); // and the exact remaining cost
});

test('an oversell rejects the whole file and rolls back, buys included', async ({ page }) => {
  await unlockDemo(page);
  await importFile(page, BUYS);
  const before = await zz(page);
  await openEditSheet(page);
  await page.locator('#importFile').setInputFiles({
    name: 'oversell.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ kind: 'add-lots',
      lots: [{ acc: 'brok', sym: 'ZZNEW', date: '2026-07-01', qty: 1, cost: 10 }],
      sells: [{ acc: 'brok', sym: 'ZZSELL', date: '2026-07-02', qty: 99, proceeds: 5000 }] })),
  });
  await expect(page.locator('#toast.bad')).toHaveText(/sells 99 ZZSELL but Brokerage holds 15/); // names the mismatch
  expect(await zz(page)).toEqual(before);
  expect(await page.evaluate(() => state.lots.some((l) => l.sym === 'ZZNEW'))).toBe(false);
});

test('a switch (sell A, buy B at the same value) is neutral for money-weighted return flows', async ({ page }) => {
  await unlockDemo(page);
  const r = await page.evaluate(() => {
    state.holdings = []; state.lots = []; state.cash = { main: 0, brok: 0 }; state.deposits = 0;
    applyLot({ acc: 'main', sym: 'AAA', date: '2026-01-02', qty: 10, cost: 1000 });
    const flowsBefore = state.lots.reduce((a, l) => a + lotFlow(l), 0);
    applyLot({ acc: 'main', sym: 'BBB', date: '2026-06-01', qty: 5, cost: 1100 });
    applySell({ acc: 'main', sym: 'AAA', date: '2026-06-01', qty: 10, proceeds: 1100, basis: 0 });
    return { flowsBefore, net: state.lots.reduce((a, l) => a + lotFlow(l), 0),
      holdings: state.holdings.map((h) => h.sym + ':' + h.qty + ':' + h.cost) };
  });
  expect(r.flowsBefore).toBe(1000);
  expect(r.net).toBe(1000);                  // +1100 in (BBB) −1100 out (AAA proceeds)
  expect(r.holdings).toEqual(['BBB:5:1100']); // AAA closed out entirely
});

test('personalReturn counts a sale at its PROCEEDS: buy $1000, sell all for $1100 150 days later -> 1.1^(365.25/150) - 1', async ({ page }) => {
  await unlockDemo(page);
  const r = await page.evaluate(() => {
    state.holdings = []; state.lots = []; state.cash = { main: 0, brok: 0 }; state.deposits = 0;
    applyLot({ acc: 'main', sym: 'AAA', date: '2026-01-02', qty: 10, cost: 1000 });
    applySell({ acc: 'main', sym: 'AAA', date: '2026-06-01', qty: 10, proceeds: 1100, basis: 0 });
    return personalReturn('all');
  });
  const days = (Date.UTC(2026, 5, 1, 16) - Date.UTC(2026, 0, 2, 16)) / 86400000; // both flows stamped 16:00Z
  expect(days).toBe(150);
  expect(r).toBeCloseTo(Math.pow(1.1, 365.25 / 150) - 1, 6);
});

test('holding sheet lists the sale with its realized gain; tax lots show only what is still held', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await unlockDemo(page);
  await importFile(page, BUYS);
  await importFile(page, SELL12);
  await page.evaluate(() => { state.quotes.ZZSELL = { price: 130, prev: 130 }; renderAll(); openDetail('ZZSELL'); });
  const body = await page.locator('#detailSheet').innerText();
  expect(body).toMatch(/Your purchases \(1\)/);              // 1 lot still open (the 12 sold shares are not "purchases")
  expect(body).toMatch(/sold/);
  expect(body).toMatch(/\$260\.00/);                         // realized: 1500 proceeds − 1240 basis
  await page.evaluate(() => { document.querySelector('#detailX').click(); openTaxSheet(); });
  const tax = await page.locator('#detailSheet').innerText();
  expect(tax).toMatch(/ZZSELL/);
  expect(tax).not.toMatch(/ZZSELL[\s\S]*ZZSELL/);            // one open lot, not two
  expect(errs).toEqual([]);
});

test('pasting the file text imports the same as picking the file', async ({ page }) => {
  await unlockDemo(page);
  await openEditSheet(page);
  await page.locator('#editModal summary').click(); // the paste box is collapsed by default
  await page.locator('#importText').evaluate((el, v) => { el.value = v; }, JSON.stringify(BUYS));
  await page.locator('#importPasteBtn').click();
  await expect(page.locator('#editModal')).toBeHidden();
  expect((await zz(page)).h).toEqual({ acc: 'brok', sym: 'ZZSELL', qty: 15, cost: 1600 });
});
