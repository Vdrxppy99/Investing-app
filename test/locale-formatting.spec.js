'use strict';
/* Regression guard for the fix that routes every number/date formatter through ONE
   locale resolver (window.appLocale(), js/i18n.js) instead of each deriving 'de-DE'/
   'en-US' independently. Before this fix, fmtPx()/cfmt() and three Chart.js tick
   formatters derived locale from CURRENCY (state.view.ccy), and every
   toLocaleDateString()/toLocaleString() call passed [] (the browser's own locale) —
   so language (pt_lang) controlled neither. Decision (not revisited here): language
   drives separators and date order; currency only drives the symbol — the two are
   independent inputs to Intl.NumberFormat, this app just had them wired backwards for
   number formatting and not wired to language at all for dates.
   CRITICAL: golden.spec.js's snapshot was captured under EN+USD (js/demo.js's
   pt_ccy:'USD', and unlockDemo() never sets pt_lang so lang() defaults to 'en') — that
   exact combination must never change output, which is why it's asserted here too,
   not just assumed safe. */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

test('EN+USD (the golden master combination) is byte-identical to the pre-fix output', async ({ page }) => {
  await unlockDemo(page);
  const out = await page.evaluate(() => fmtPx(153959.57));
  expect(out).toBe('$153,959.57');
});

test('DE+EUR produces German separators, the date order, and a euro sign', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pt_lang', 'de'); } catch (e) {} });
  await unlockDemo(page);
  const { price, date } = await page.evaluate(() => {
    state.view.ccy = 'EUR'; state.fx.rate = 1; // pin the FX conversion out — this test is about locale, not the rate
    return {
      price: fmtPx(153959.57),
      date: new Date('2026-08-14T12:00:00Z').toLocaleDateString(appLocale(), { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  });
  // de-DE's Intl.NumberFormat puts a NO-BREAK SPACE (U+00A0), not a regular space,
  // before the currency symbol — verified via Node's own Intl output, not assumed.
  expect(price).toBe('153.959,57 €');
  expect(date).toBe('14. Aug. 2026');
});

test('DE+USD produces German separators with a dollar sign — currency ≠ language', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pt_lang', 'de'); } catch (e) {} });
  await unlockDemo(page);
  const out = await page.evaluate(() => fmtPx(153959.57)); // state.view.ccy is 'USD', the demo default
  expect(out).toBe('153.959,57 $');
});

test('EN+EUR produces English separators with a euro sign — language ≠ currency', async ({ page }) => {
  await unlockDemo(page); // pt_lang unset -> defaults to 'en'
  const out = await page.evaluate(() => { state.view.ccy = 'EUR'; state.fx.rate = 1; return fmtPx(153959.57); });
  expect(out).toBe('€153,959.57');
});

test('appLocale() itself resolves de -> de-DE and en -> en-US', async ({ page }) => {
  await unlockDemo(page);
  const en = await page.evaluate(() => appLocale());
  expect(en).toBe('en-US');
  await page.evaluate(() => localStorage.setItem('pt_lang', 'de'));
  const de = await page.evaluate(() => appLocale());
  expect(de).toBe('de-DE');
});
