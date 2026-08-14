'use strict';
/* Regression guard + scope measurement for German coverage (bug-hunt finding: the
   post-render dictionary+pattern pass in js/i18n.js can only ever translate a string
   that (a) has a dictionary entry and (b) is emitted byte-identical every time — so it
   systematically misses static boilerplate nobody added to the dictionary, and any
   sentence built from a template literal with an interpolated figure, since the number
   makes every instance unique and unmatchable.
   This test enters DE, walks all five tabs and every reachable sheet, and checks that
   no known-English string (dictionary keys + index.html's own static text) appears
   verbatim in the rendered DOM. It is a RATCHET, not a hardcoded zero-tolerance
   assertion: MAX_KNOWN_LEAKS tracks the exact, measured leak count so it can never
   silently rise again, even though it currently sits at its floor.

   History: 23 leaks before session 1, 16 after (session 1 fixed the 9 static gaps
   the hunt named; the remaining 16 were template-literal sentences in js/insights.js/
   js/sheets.js plus a handful of static strings the hunt's list didn't happen to
   name). 0 after session 2, which wired t() into every one of those 16 — see
   js/i18n.js's "t()-migrated dynamic sentences, session 2" section and CHANGELOG.md
   for the full list. If a future change reintroduces a leak, this test fails with
   the exact string(s) and surface(s) in its output — fix it there rather than
   raising this number back up. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

const MAX_KNOWN_LEAKS = 0;

// "The static text in index.html" — extracted straight from the source file rather
// than from a rendered EN-mode DOM walk, so it also catches text that a DOM walk
// might normalize/collapse (whitespace, nested tags). Crude tag-strip, not a real
// HTML parser: good enough for "a run of letters between two tags", which is all a
// translatable phrase ever looks like in this file.
function extractStaticStrings() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const out = new Set();
  const re = />([^<>{}\n]+)</g;
  let m;
  while ((m = re.exec(html))) {
    const t = m[1].replace(/&mdash;/g, '—').replace(/&amp;/g, '&').trim();
    // Needs a run of 3+ letters to be a real phrase, not "·", "$", a bare digit, an
    // entity fragment, or a single emoji/icon glyph.
    if (t.length >= 4 && /[A-Za-z]{3,}/.test(t)) out.add(t);
  }
  return [...out];
}

// Confirmed by direct inspection (not guessed): a candidate that's a substring of a
// company/fund's proper name is a false positive, not a leak — "Vanguard Total Stock
// Market ETF" / "Vanguard Total Intl Stock ETF" (held in the demo portfolio)
// legitimately contain "Total"; "Avantis US Small Cap Value ETF" (Markets' "Ideas"
// list) legitimately contains "Value"; "Home Depot" (Following's look-through list,
// held indirectly via VYM) legitimately contains "Home". Proper nouns are never
// translated, by design — confirmed separately (manual DOM inspection, not this
// test) that the "Home" TAB LABEL itself does translate correctly on all five tabs.
// A few dictionary entries translate to themselves ("Portfolio": "Portfolio", "LIVE":
// "LIVE" — German uses the same word/initialism) — their presence in DE output is
// correct, not a leak, so they can't be leak candidates either.
const FALSE_POSITIVE_CANDIDATES = new Set(['Total', 'Value', 'Home', 'Portfolio', 'LIVE']);

// Candidate English strings that must never appear verbatim while DE is active.
// Filtered to length >= 4: shorter dictionary keys ("Yr", "All", "You") are real
// words but too short to substring-match safely against arbitrary German text.
async function englishCandidates(page) {
  const dictKeys = await page.evaluate(() => Object.keys(window.i18nDE || {}));
  const staticStrings = extractStaticStrings();
  return [...new Set([...dictKeys, ...staticStrings])]
    .filter((s) => s.length >= 4 && !FALSE_POSITIVE_CANDIDATES.has(s));
}

function findLeaks(text, candidates) {
  return candidates.filter((c) => text.includes(c));
}

// Every top-level sheet-opening function the app exposes globally (same convention
// test/dead-controls.spec.js already relies on: window.openStockSheet etc.) — called
// directly rather than reverse-engineered through click targets, so this covers sheets
// reachable from Portfolio/Insights/Markets/Following alike in one pass.
const SHEET_OPENERS = [
  ['Allocation', () => window.openAllocSheet()],
  ['Dividends', () => window.openDivSheet()],
  ['Holding detail (VOO)', () => window.openDetail('VOO')],
  ['Stock detail, not held (QQQ)', () => window.openStockSheet('QQQ', 'Invesco QQQ Trust')],
  ['Tax lots', () => window.openTaxSheet()],
  ['Sector', () => window.openSectorSheet()],
  ['Look-through', () => window.openLocSheet()],
  ['Portfolio P/E', () => window.openPESheet()],
  ['Risk', () => window.openRiskSheet()],
  ['Portfolio Health', () => window.openHealthSheet()],
  ['Performance', () => window.openPerfSheet()],
  ['Contributions', () => window.openContribSheet()],
  ['Projection/Goal', () => window.openProjSheet()],
  ['Coach / next moves', () => window.openCoachSheet()],
  ['Stocks you indirectly own', () => window.openLookSheet()],
  ['Asset worth', () => window.openWorthSheet()],
  ['Crash test', () => window.openCrashSheet()],
  ['Financial independence', () => window.openFISheet()],
  ['Settings / edit holdings', () => window.openEdit()],
];

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
  // Switch to DE before the app ever boots, so the very first render is already German
  // — no reload-mid-test needed, and demo mode (which doesn't persist across reload)
  // never has to be re-entered.
  await page.addInitScript(() => { try { localStorage.setItem('pt_lang', 'de'); } catch (e) {} });
});

test('no known-English string leaks into any tab or sheet while DE is active', async ({ page }) => {
  await unlockDemo(page);
  const candidates = await englishCandidates(page);
  expect(candidates.length).toBeGreaterThan(50); // sanity: extraction actually found real strings

  const leaks = new Set();
  const detail = {};

  const TABS = ['home', 'markets', 'portfolio', 'insights', 'following'];
  for (const tabName of TABS) {
    await page.locator(`.tabbar__item[data-page="${tabName}"]`).click();
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.body.innerText);
    const found = findLeaks(text, candidates);
    if (found.length) detail[`tab:${tabName}`] = found;
    found.forEach((f) => leaks.add(f));
  }

  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.waitForTimeout(300);
  for (const [name, openFn] of SHEET_OPENERS) {
    await page.evaluate(openFn).catch(() => {}); // a handful are async / touch the network path; offline failure is fine, still renders sheet chrome
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.body.innerText);
    const found = findLeaks(text, candidates);
    if (found.length) detail[`sheet:${name}`] = found;
    found.forEach((f) => leaks.add(f));
    await page.evaluate(() => { if (typeof closeDetail === 'function') closeDetail(); if (typeof hideOverlay === 'function') hideOverlay('editModal'); });
    await page.waitForTimeout(250);
  }

  // eslint-disable-next-line no-console
  console.log(`i18n-coverage: ${leaks.size} distinct English string(s) leaked in DE mode.`, JSON.stringify(detail, null, 2));

  expect(leaks.size, `${leaks.size} leaked (ratchet ceiling ${MAX_KNOWN_LEAKS}): ${[...leaks].join(' | ')}`).toBeLessThanOrEqual(MAX_KNOWN_LEAKS);
});
