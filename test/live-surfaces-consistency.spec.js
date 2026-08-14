'use strict';
const { test, expect } = require('@playwright/test');
const { FROZEN_TIME, blockExternalNetwork, unlockDemo } = require('./helpers');

// Regression guard for the bug the hunt session found and live-reproduced: Home's
// hero card (#homeTotal/#homeToday) is painted only by renderAll(), which runs once
// at boot and on manual refresh. The 10-60s market-hours poll (refreshQuotesOnly(),
// js/api.js) paints Portfolio's header and the pinned mini-bar on every tick, but
// never touched Home — so a user parked on Home watches Portfolio's numbers move
// (invisibly, off-tab) while Home's own total sits frozen at its last full render.
//
// This test drives the REAL production fetch pipeline (fetchQuote -> tryFetch ->
// parseYahoo -> setQuote), not a hand-rolled stand-in for it, by mocking only the
// network response for VOO's quote request. That way it exercises the exact code
// path a live poll tick takes, not a reimplementation of it.
test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.clock.setFixedTime(FROZEN_TIME);
  // #tvNum's roll-up tween (rollUpTvNum(), js/app.js) repaints the FIRST frame of its
  // animation synchronously at the old value before handing off to requestAnimationFrame
  // — unrelated to this test's bug, but it would make a same-tick DOM read racy.
  // rollUpTvNum() itself skips the animation under reduced motion (unchanged behavior).
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('every surface showing the portfolio total (and day change) agrees after a live poll tick', async ({ page }) => {
  await unlockDemo(page);

  // Pin the mini-bar visible, same state a scrolled-down Home/Insights/Markets view
  // is in — paintMiniBar() only runs inside renderHeader() when this class is set.
  await page.evaluate(() => document.getElementById('miniBar').classList.add('show'));

  const before = await page.evaluate(() => ({
    total: document.getElementById('homeTotal').textContent,
    price: state.quotes.VOO.price,
    prev: state.quotes.VOO.prev,
  }));
  const newPrice = +(before.price * 1.08).toFixed(2); // +8%: real move, safely under setQuote()'s 25% implausible-tick guard

  // Mock ONLY VOO's quote response, on every host fetchQuote/tryFetch might reach
  // (our Worker proxy is tried first, direct Yahoo is the fallback) — every other
  // symbol's request still falls through to blockExternalNetwork's abort-everything,
  // exactly like a real world where one quote arrives and the rest time out.
  await page.route(
    (url) => /VOO/i.test(url.href) && (/finance\.yahoo\.com$/.test(url.hostname) || url.hostname === 'portfolio-push.portfolio-push.workers.dev'),
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        chart: { result: [{
          meta: { regularMarketPrice: newPrice, regularMarketPreviousClose: before.prev },
          timestamp: [Math.floor(Date.now() / 1000)],
          indicators: { quote: [{ close: [newPrice] }] },
        }] },
      }),
    })
  );

  const after = await page.evaluate(async () => {
    await refreshQuotesOnly(); // the real 10-60s market-hours poll function, unmodified
    return {
      total: {
        home: document.getElementById('homeTotal').textContent,
        portfolio: document.getElementById('tvNum').textContent,
        miniBar: document.getElementById('mbVal').textContent,
      },
      day: {
        home: document.getElementById('homeToday').querySelector('span').textContent,
        portfolio: document.getElementById('todayLine').querySelector('span').textContent,
        miniBar: document.getElementById('mbDay').textContent,
      },
    };
  });

  // Prove the tick actually did something — a no-op fix would make everything
  // "agree" by staying frozen, which must not count as passing.
  expect(after.total.home, 'Home total did not move after the live poll tick').not.toBe(before.total);

  expect(after.total.portfolio).toBe(after.total.home);
  expect(after.total.miniBar).toBe(after.total.home);

  // Portfolio's and Home's day-change spans share the exact same markup (arrow + sign + pct);
  // the mini-bar's is the same figure without the leading arrow glyph.
  expect(after.day.portfolio).toBe(after.day.home);
  expect(after.day.miniBar).toBe(after.day.home.replace(/^[▲▼]\s*/, ''));
});
