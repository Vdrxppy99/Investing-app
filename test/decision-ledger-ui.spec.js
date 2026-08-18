'use strict';
/* Decision Ledger — rendering tests for js/insights.js's paintDecisionLedgerMod(),
 * the DOM half of the feature. js/decision-ledger.js's own test/decision-ledger.spec.js
 * covers the pure computation in Node and never touches a page.
 *
 * Synthetic ledger objects are painted directly via paintDecisionLedgerMod() rather
 * than waiting on a real getDecisionLedger() fetch to resolve into some particular
 * shape: every historical-price host is blocked in this harness (test/helpers.js's
 * blockExternalNetwork), so a real fetch always resolves all-unresolved here, which
 * can't exercise "shows the honesty line below threshold" with a controlled sample
 * size or a resolved+unresolved mix in one pass. A hand-built object gives exact,
 * deterministic control over sampleSize/oldestDecisionAgeMonths/unresolved instead.
 */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
});

async function paintSynthetic(page, ledger) {
  await unlockDemo(page);
  await page.locator('.tabbar__item[data-page="insights"]').click();
  // The real getDecisionLedger() call (kicked off by renderInsights() on tab show)
  // also resolves in this harness — every proxy is network-blocked, but blocked via
  // instant route.abort(), not a timeout, so it settles fast and paints once for
  // real before this test's synthetic call runs. Waiting for the card here means
  // the synthetic paint below is the LAST write, not racing that real one.
  await expect(page.locator('#decisionLedgerCard')).toBeVisible({ timeout: 15000 });
  await page.evaluate((r) => paintDecisionLedgerMod(r), ledger);
}

test('shows the honesty line, not de-emphasised, when sampleSize is below the threshold', async ({ page }) => {
  await paintSynthetic(page, {
    benchmark: 'VTI',
    rows: [{ sym: 'AAPL', dateUsed: '2024-01-02', cost: 1000, actual: 1500, counterfactual: 1100, gap: 400, gapPct: 40 }],
    totals: { cost: 1000, actual: 1500, counterfactual: 1100, gap: 400, gapPct: 40 },
    unresolved: { count: 0, items: [] },
    sampleSize: 3,
    oldestDecisionAgeMonths: 20,
  });
  const honesty = page.locator('#dlHonesty');
  await expect(honesty).toBeVisible();
  await expect(honesty).toContainText('3 decisions over 20 months');
  await expect(honesty).toContainText('far too little to mean anything yet');
  // Not a footnote: .t-caption is the size every existing footnote/goalline in this
  // file uses (11.5px) — this line must be .t-body (12.5px) instead, per DESIGN-TARGET.
  await expect(honesty).toHaveClass(/t-body/);
  await expect(honesty).not.toHaveClass(/t-caption/);
});

test('drops the small-sample warning once sampleSize and age both clear the threshold', async ({ page }) => {
  await paintSynthetic(page, {
    benchmark: 'VTI',
    rows: [{ sym: 'AAPL', dateUsed: '2020-01-02', cost: 1000, actual: 1500, counterfactual: 1100, gap: 400, gapPct: 40 }],
    totals: { cost: 1000, actual: 1500, counterfactual: 1100, gap: 400, gapPct: 40 },
    unresolved: { count: 0, items: [] },
    sampleSize: 12,
    oldestDecisionAgeMonths: 48,
  });
  const honesty = page.locator('#dlHonesty');
  await expect(honesty).toContainText('12 decisions over 48 months');
  await expect(honesty).not.toContainText('far too little');
});

test('unresolved rows render outside the total, in their own labelled group, with the count stated', async ({ page }) => {
  await paintSynthetic(page, {
    benchmark: 'VTI',
    rows: [{ sym: 'AAPL', dateUsed: '2024-01-02', cost: 1000, actual: 1500, counterfactual: 1100, gap: 400, gapPct: 40 }],
    totals: { cost: 1000, actual: 1500, counterfactual: 1100, gap: 400, gapPct: 40 },
    unresolved: {
      count: 2,
      items: [
        { sym: 'ZZZZ', date: '2023-06-01', cost: 500, reason: 'no price history for ZZZZ' },
        { sym: 'YYYY', date: '2024-01-01', cost: 300, reason: 'no price history for YYYY' },
      ],
    },
    sampleSize: 3,
    oldestDecisionAgeMonths: 30,
  });
  // The headline total reflects only the resolved row (gap 400) — the 500/300 cost
  // basis of the unresolved pair must never be folded in as zero or as itself.
  await expect(page.locator('#dlBig')).toHaveText('+$400.00');
  await expect(page.locator('#dlRows .dlrow')).toHaveCount(1);

  const unwrap = page.locator('#dlUnresolvedWrap');
  await expect(unwrap).toBeVisible();
  await expect(page.locator('#dlUnresolvedLabel')).toContainText('2');
  const unrows = page.locator('#dlUnresolvedRows .dlrow-static');
  await expect(unrows).toHaveCount(2);
  await expect(unrows.nth(0)).toContainText('ZZZZ');
  await expect(unrows.nth(0)).toContainText('$500.00'); // real cost basis — not fabricated
  // No gap/percentage is ever fabricated for a row with no price on one side.
  await expect(unrows.nth(0)).not.toContainText('%');
  await expect(unrows.nth(1)).toContainText('YYYY');
});

test('empty state: no self-directed decisions is stated plainly, without implied criticism', async ({ page }) => {
  await paintSynthetic(page, {
    benchmark: 'VTI',
    rows: [],
    totals: { cost: 0, actual: 0, counterfactual: 0, gap: 0, gapPct: null },
    unresolved: { count: 0, items: [] },
    sampleSize: 0,
    oldestDecisionAgeMonths: null,
  });
  await expect(page.locator('#dlEmpty')).toBeVisible();
  await expect(page.locator('#dlEmpty')).toContainText("advisor's allocation");
  await expect(page.locator('#dlBig')).toBeHidden();
  await expect(page.locator('#dlHonesty')).toBeHidden();
  await expect(page.locator('#dlUnresolvedWrap')).toBeHidden();
});
