'use strict';
/* Regression guard for the hero chart's cold-load sizing bug (shipped twice: once as the
   tab-switch case, fixed with an opacity veil in v9.7.x; then again as this cold-load case,
   since the veil only ever covered showPage()'s tab-switch path). js/portfolio.js's
   drawHeroChart() used to create the Lightweight Charts instance with autoSize:true against
   whatever size #mainChart had at that exact moment — including the very first call, which
   happens from the unconditional renderAll() at boot while Portfolio (not the landing tab)
   is still display:none, i.e. against a 0×0 container. Recovering from that 0×0 start is the
   vendor bundle's own internal autoSize/ResizeObserver timing, not ours to control, and it
   produced a canvas bitmap whose two axes disagreed by close to a full devicePixelRatio
   factor (e.g. width caught up to the container's real size while height was still scaled
   against a stale, near-zero reading) — a real, visible line distortion. The fix (this
   session) is to never create the chart against a 0×0 box: defer creation until the
   container's own ResizeObserver reports a real size, then size and resize explicitly
   rather than relying on autoSize's own internal recovery at all.

   What this test can and can't assert: an isolated Lightweight Charts example with no app
   code around it (same vendor bundle, same headless Chromium) never reaches a canvas bitmap
   that's an exact devicePixelRatio multiple of its CSS size, even fully settled — this
   environment's ResizeObserver doesn't report the devicePixelContentBoxSize entries the
   library's own DPR-detection depends on, so it permanently falls back to an unscaled bitmap.
   That's a headless-Chromium/library characteristic, not an app bug, and asserting literal
   bitmap == CSS × devicePixelRatio would fail identically before and after this fix, even on
   a trivial no-app-code page — so this test does not assert that.
   It also does not assert "the two axes always match exactly": every full teardown+recreate
   of the chart (a range click, a theme toggle, and — even after this fix — the tab open
   itself) passes through one harmless frame where the price-scale axis hasn't settled its
   final width yet, which reads as a mild (~10-25%) skew between axes; that happens on
   already-accepted operations too and is not perceptible.
   What IS the bug's actual signature, verified by sampling canvas.width/height against the
   canvas's own getBoundingClientRect() every animation frame: one axis reporting a bitmap
   scaled by close to a full extra factor of devicePixelRatio relative to the other axis
   (ratioX and ratioY differing by 1.5x or more) — that is what "a 3x disagreement on one
   axis" looks like, and it only ever happens when the chart was created or resized against
   a momentarily-zero container. That is exactly what this test checks for. */
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

// Anything past this is the "one axis at close to devicePixelRatio, the other not" defect;
// the harmless axis-width-settling wobble common to every chart redraw stays under ~1.3x
// (verified: ratioX/ratioY ~1.14-1.25 on an ordinary redraw vs ~2-3x on the 0×0-creation bug).
const MAX_ACCEPTABLE_AXIS_SKEW = 1.5;

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
  // Installed before unlockDemo's own page.goto, so it's present from the first navigation —
  // sampling starts recording before Portfolio is ever opened.
  await page.addInitScript((maxSkew) => {
    window.__ratioViolations = [];
    let armed = false;
    window.__armHeroRatioSampling = () => { armed = true; window.__ratioViolations = []; };
    (function loop() {
      if (armed) {
        const el = document.getElementById('mainChart');
        if (el) {
          for (const c of el.querySelectorAll('canvas')) {
            if (c.width <= 60) continue; // skip icon-sized decoration canvases
            const rect = c.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const ratioX = c.width / rect.width, ratioY = c.height / rect.height;
              const skew = ratioX > ratioY ? ratioX / ratioY : ratioY / ratioX;
              if (skew > maxSkew) window.__ratioViolations.push({ cw: c.width, ch: c.height, rw: rect.width, rh: rect.height, ratioX, ratioY, skew });
            }
          }
        }
      }
      requestAnimationFrame(loop);
    })();
  }, MAX_ACCEPTABLE_AXIS_SKEW);
});

test('the hero chart bitmap never scales asymmetrically on cold first load into Portfolio', async ({ page }) => {
  await unlockDemo(page); // lands on Home; Portfolio (#mainChart's page) starts display:none
  await page.evaluate(() => window.__armHeroRatioSampling());
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await expect(page.locator('#page-portfolio')).toBeVisible();
  await page.waitForTimeout(1500); // let every redraw this tab-open triggers finish settling

  const violations = await page.evaluate(() => window.__ratioViolations);
  expect(violations, `hero chart canvas bitmap scaled asymmetrically on cold load:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
});

test('the hero chart bitmap never scales asymmetrically when switching away from and back to Portfolio', async ({ page }) => {
  await unlockDemo(page);
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await page.waitForTimeout(1000); // let the cold-load draw finish, unmeasured
  await page.locator('.tabbar__item[data-page="home"]').click();
  await page.waitForTimeout(300);

  await page.evaluate(() => window.__armHeroRatioSampling());
  await page.locator('.tabbar__item[data-page="portfolio"]').click();
  await expect(page.locator('#page-portfolio')).toBeVisible();
  await page.waitForTimeout(1500);

  const violations = await page.evaluate(() => window.__ratioViolations);
  expect(violations, `hero chart canvas bitmap scaled asymmetrically on tab revisit:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
});
