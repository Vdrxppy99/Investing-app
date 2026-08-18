'use strict';
const fs = require('fs');
const path = require('path');
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

  await page.locator('.tabbar__item[data-page="insights"]').click();
  await page.waitForTimeout(300); // projModCard render (renderInsights -> renderProjMod)
  await assertOneLitPerClick(page, '#projHorizonSeg button', 'Insights projection horizon toggle');
  // Real-effect check, same reasoning as #screenSeg below: the lit-count sweep
  // above would still pass with the control completely unwired to renderProjMod
  // (a click that does nothing never goes double-lit either). Confirm the
  // sub-caption's own year count actually tracks the clicked horizon.
  await page.locator('#projHorizonSeg button[data-y="30"]').click();
  await expect(page.locator('#projModHead .mod__sub')).toContainText('30');
  await page.locator('#projHorizonSeg button[data-y="5"]').click();
  await expect(page.locator('#projModHead .mod__sub')).toContainText('5');

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

// ── The three duplicated Home/Portfolio appbar controls (priv/theme/ccy) ────
// Coverage for the trap this repo has shipped three times: a hardcoded-and-
// never-cleared active state (see the block comment above). These controls are
// a fourth instance of the underlying risk — TWO markup copies of the same
// state, painted from one function (paintAct(), js/app.js) — so they get their
// own tests rather than being folded into assertOneLitPerClick, which only
// understands single-group "exactly one lit" selection, not a boolean toggle
// mirrored across two DOM locations.
const VIEW_CONTROLS = ['priv', 'theme', 'ccy'];

test('the priv/theme/ccy buttons carry no hardcoded pressed/label state in markup', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const buttonRe = /<button[^>]*data-act="(priv|theme|ccy)"[^>]*>/g;
  let m, count = 0;
  while ((m = buttonRe.exec(html))) {
    count++;
    // aria-pressed is written only at runtime by paintAct() — a value baked into
    // the markup is exactly the "hardcoded, never cleared" failure mode this test
    // exists to catch, even if it happens to match the true default on first paint.
    expect(m[0], `${m[1]} button must not hardcode aria-pressed in markup: ${m[0]}`).not.toMatch(/aria-pressed=/);
  }
  expect(count, 'expected 3 controls x 2 appbars (Home, Portfolio)').toBe(6);
});

test('on load, the priv/theme/ccy controls reflect the app\'s actual state on both appbars', async ({ page }) => {
  await unlockDemo(page);
  const actual = await page.evaluate(() => ({
    priv: state.view.priv,
    dark: document.documentElement.dataset.theme === 'dark',
    usd: state.view.ccy === 'USD',
  }));
  for (const pageId of ['page-home', 'page-portfolio']) {
    const priv = page.locator(`#${pageId} [data-act="priv"]`);
    await expect(priv, `${pageId} priv aria-pressed`).toHaveAttribute('aria-pressed', String(actual.priv));
    await expect(priv.locator('use'), `${pageId} priv icon`).toHaveAttribute('href', actual.priv ? '#i-eye-off' : '#i-eye');

    const theme = page.locator(`#${pageId} [data-act="theme"]`);
    await expect(theme, `${pageId} theme aria-pressed`).toHaveAttribute('aria-pressed', String(actual.dark));
    await expect(theme.locator('use'), `${pageId} theme icon`).toHaveAttribute('href', actual.dark ? '#i-moon' : '#i-sun');

    const ccy = page.locator(`#${pageId} [data-act="ccy"]`);
    await expect(ccy, `${pageId} ccy label`).toHaveAttribute('aria-label', actual.usd ? 'Switch to euros' : 'Switch to dollars');
    await expect(ccy.locator('use'), `${pageId} ccy icon`).toHaveAttribute('href', actual.usd ? '#i-dollar' : '#i-euro');
  }
});

test('toggling priv/theme/ccy from Home stays in sync with Portfolio, and vice versa', async ({ page }) => {
  await unlockDemo(page);

  async function readInstance(pageId, act) {
    const btn = page.locator(`#${pageId} [data-act="${act}"]`);
    return {
      pressed: await btn.getAttribute('aria-pressed'),
      label: await btn.getAttribute('aria-label'),
      href: await btn.locator('use').getAttribute('href'),
    };
  }

  // Home -> Portfolio: Home is already the landing tab, so click straight away.
  for (const act of VIEW_CONTROLS) {
    await page.locator(`#page-home [data-act="${act}"]`).click();
    const home = await readInstance('page-home', act);
    await page.locator('.tabbar__item[data-page="portfolio"]').click();
    const pf = await readInstance('page-portfolio', act);
    expect(pf, `${act}: Portfolio out of sync with Home after toggling from Home`).toEqual(home);
    await page.locator('.tabbar__item[data-page="home"]').click();
  }

  // Portfolio -> Home: toggle each control back from the Portfolio instance.
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  for (const act of VIEW_CONTROLS) {
    await page.locator(`#page-portfolio [data-act="${act}"]`).click();
    const pf = await readInstance('page-portfolio', act);
    await page.locator('.tabbar__item[data-page="home"]').click();
    const home = await readInstance('page-home', act);
    expect(home, `${act}: Home out of sync with Portfolio after toggling from Portfolio`).toEqual(pf);
    await page.locator('.tabbar__item[data-page="portfolio"]').click();
  }
});

// Regression guard for the bug just fixed: privBtn/themeBtn/ccyBtn used to have
// their innerHTML overwritten at runtime with hand-rolled <svg> strings (or, for
// ccy, a bare "$"/"€" text glyph) carrying no aria-hidden — which is exactly the
// attribute css/base.css's `svg[aria-hidden="true"] { fill:none; stroke:currentColor }`
// rule keys on, so the icons rendered as solid black UA-default shapes. Nothing
// should write icon markup via innerHTML again; only <use href> may change.
test('priv/theme/ccy icons are sprite <svg aria-hidden="true"> with fill:none and a real stroke, on both instances', async ({ page }) => {
  await unlockDemo(page);
  for (const pageId of ['page-home', 'page-portfolio']) {
    for (const act of VIEW_CONTROLS) {
      const svg = page.locator(`#${pageId} [data-act="${act}"] > svg`);
      await expect(svg, `${pageId} ${act} svg count`).toHaveCount(1);
      await expect(svg, `${pageId} ${act} aria-hidden`).toHaveAttribute('aria-hidden', 'true');
      const style = await svg.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { fill: cs.fill, stroke: cs.stroke };
      });
      expect(style.fill, `${pageId} ${act} fill`).toBe('none');
      expect(style.stroke, `${pageId} ${act} stroke`).not.toBe('none');
    }
  }
});

// ── Decision Ledger row disclosure (js/insights.js paintDecisionLedgerMod()) ────
// Not a "one lit per group" selection control like the rest of this file — each
// row's aria-expanded is independent, more than one can be open at once. The
// standing risk this file guards against still applies in a different shape here:
// aria-expanded is written fresh by dlRowHtml() on every render rather than baked
// into static markup, so this is the regression guard for that staying true —
// toggling one row must never touch a sibling's state, and a second click must
// return the SAME row to closed, not leave it stuck lit.
test('Decision Ledger rows: aria-expanded starts false, toggling one row never touches a sibling, and a second click closes it again', async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
  await unlockDemo(page);
  await page.locator('.tabbar__item[data-page="insights"]').click();
  await expect(page.locator('#decisionLedgerCard')).toBeVisible({ timeout: 15000 });

  // Two resolved rows, painted directly (same technique test/decision-ledger-ui.spec.js
  // uses) — every price host is network-blocked in this harness, so the real fetch
  // resolves all-unresolved and never produces a resolved .dlrow to click.
  await page.evaluate(() => paintDecisionLedgerMod({
    benchmark: 'VTI',
    rows: [
      { sym: 'AAPL', dateUsed: '2024-01-02', cost: 1000, actual: 1500, counterfactual: 1100, gap: 400, gapPct: 40 },
      { sym: 'MSFT', dateUsed: '2024-02-01', cost: 800, actual: 900, counterfactual: 950, gap: -50, gapPct: -6.25 },
    ],
    totals: { cost: 1800, actual: 2400, counterfactual: 2050, gap: 350, gapPct: 19.44 },
    unresolved: { count: 0, items: [] },
    sampleSize: 2,
    oldestDecisionAgeMonths: 20,
  }));

  const rows = page.locator('#dlRows .dlrow');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(rows.nth(1)).toHaveAttribute('aria-expanded', 'false');

  await rows.nth(0).click();
  await expect(rows.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(rows.nth(1), 'sibling row must stay closed').toHaveAttribute('aria-expanded', 'false');
  const detail0 = page.locator('#' + (await rows.nth(0).getAttribute('aria-controls')));
  await expect(detail0).toBeVisible();

  await rows.nth(0).click();
  await expect(rows.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(detail0).toBeHidden();
});
