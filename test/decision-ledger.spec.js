'use strict';
/* Decision Ledger — data layer + computation (js/decision-ledger.js).
 * Pure-Node specs, same convention as test/monte-carlo.spec.js: no `page` fixture,
 * require() the file directly, since js/decision-ledger.js is written to run
 * unmodified in Node (module.exports) or the browser (Object.assign(window,...)),
 * same dual-environment pattern as js/monte-carlo.js.
 *
 * The single sharpest check here: buying the benchmark against itself must yield
 * a gap of EXACTLY zero (not merely close to zero) — if that ever isn't bit-exact,
 * the formula is wrong somewhere, not just imprecise.
 */
const { test, expect } = require('@playwright/test');
const {
  computeDecisionLedger, parseYahooAdjClose, getDecisionLedger,
  closeOnOrAfter, closeOnOrBefore,
} = require('../js/decision-ledger.js');
const yahooFixture = require('./fixtures/yahoo-chart-adjclose.json');

const ACCOUNT_KIND = { main: 'advised', brok: 'self' };

// ── Worked example ────────────────────────────────────────────────────────────
// Fixed fixture prices, never touching the network. Two self-directed AAPL
// decisions against a VTI benchmark, "today" = 2024-06-03.
//
//   AAPL adjclose: 2024-01-02 -> 100, 2024-01-03 -> 102, 2024-06-03 (today) -> 150
//   VTI  adjclose: 2024-01-02 -> 200, 2024-01-03 -> 201, 2024-06-03 (today) -> 220
//
// Decision 1 — bought AAPL 2024-01-02 (an exact trading day), cost $1000:
//   actual      = 1000 * (150/100) = 1500
//   counterfact = 1000 * (220/200) = 1100
//   gap         = 1500 - 1100      =  400   ->  gapPct = 400/1000*100 = 40%
//
// Decision 2 — bought AAPL 2024-01-01 (New Year's Day, NOT a trading day; no bar
// exists for it), cost $500. Resolves to the NEXT trading day, 2024-01-02:
//   actual      = 500 * (150/100) = 750
//   counterfact = 500 * (220/200) = 550
//   gap         = 750 - 550       = 200   ->  gapPct = 200/500*100 = 40%
//
// Totals: cost 1500, actual 2250, counterfactual 1650, gap 600 (= 400+200),
//         gapPct = 600/1500*100 = 40%.
const priceHistory = {
  AAPL: { t: [Date.parse('2024-01-02T21:00:00Z'), Date.parse('2024-01-03T21:00:00Z'), Date.parse('2024-06-03T20:00:00Z')], c: [100, 102, 150] },
  VTI: { t: [Date.parse('2024-01-02T21:00:00Z'), Date.parse('2024-01-03T21:00:00Z'), Date.parse('2024-06-03T20:00:00Z')], c: [200, 201, 220] },
};
const ASOF_MS = Date.parse('2024-06-03T23:00:00Z');

const baseLots = [
  { acc: 'brok', sym: 'AAPL', date: '2024-01-02', qty: 5, cost: 1000 },
  { acc: 'brok', sym: 'AAPL', date: '2024-01-01', qty: 2.5, cost: 500 },
];

test('worked example: hand-computed actual/counterfactual/gap for two decisions', () => {
  const r = computeDecisionLedger({ lots: baseLots, accountKind: ACCOUNT_KIND, priceHistory, benchmark: 'VTI', asOfMs: ASOF_MS });

  expect(r.benchmark).toBe('VTI');
  expect(r.unresolved.count).toBe(0);
  expect(r.rows.length).toBe(2);

  const [row1, row2] = r.rows;
  expect(row1.cost).toBe(1000);
  expect(row1.actual).toBeCloseTo(1500, 6);
  expect(row1.counterfactual).toBeCloseTo(1100, 6);
  expect(row1.gap).toBeCloseTo(400, 6);
  expect(row1.gapPct).toBeCloseTo(40, 6);
  expect(row1.dateUsed).toBe('2024-01-02');

  expect(row2.cost).toBe(500);
  expect(row2.actual).toBeCloseTo(750, 6);
  expect(row2.counterfactual).toBeCloseTo(550, 6);
  expect(row2.gap).toBeCloseTo(200, 6);
  expect(row2.gapPct).toBeCloseTo(40, 6);

  expect(r.totals.cost).toBeCloseTo(1500, 6);
  expect(r.totals.actual).toBeCloseTo(2250, 6);
  expect(r.totals.counterfactual).toBeCloseTo(1650, 6);
  expect(r.totals.gap).toBeCloseTo(600, 6);
  expect(r.totals.gapPct).toBeCloseTo(40, 6);

  expect(r.sampleSize).toBe(2);
});

// ── Non-trading-day resolution ──────────────────────────────────────────────
test('a lot bought on a non-trading day resolves to the next trading day', () => {
  expect(closeOnOrAfter(priceHistory.AAPL, '2024-01-01')).toEqual({ date: '2024-01-02', close: 100 });
  // exact trading day resolves to itself, not the day after
  expect(closeOnOrAfter(priceHistory.AAPL, '2024-01-02')).toEqual({ date: '2024-01-02', close: 100 });
  // "today" (closeOnOrBefore) on a day past the last recorded bar floors to the last bar
  expect(closeOnOrBefore(priceHistory.AAPL, '2024-06-05')).toEqual({ date: '2024-06-03', close: 150 });

  const r = computeDecisionLedger({ lots: baseLots, accountKind: ACCOUNT_KIND, priceHistory, benchmark: 'VTI', asOfMs: ASOF_MS });
  const nonTradingDayRow = r.rows.find(row => row.cost === 500);
  expect(nonTradingDayRow.dateUsed).toBe('2024-01-02'); // not '2024-01-01', which never had a bar
});

// ── Exclusions ───────────────────────────────────────────────────────────────
test('dividend-reinvestment lots are excluded', () => {
  const lots = [
    ...baseLots,
    { acc: 'brok', sym: 'AAPL', date: '2024-01-03', qty: 1, cost: 102, div: true },
  ];
  const r = computeDecisionLedger({ lots, accountKind: ACCOUNT_KIND, priceHistory, benchmark: 'VTI', asOfMs: ASOF_MS });
  expect(r.sampleSize).toBe(2); // the div:true lot never becomes a decision at all
  expect(r.rows.length).toBe(2);
  expect(r.rows.some(row => row.cost === 102)).toBe(false);
});

test('advised-account lots are excluded', () => {
  const lots = [
    ...baseLots,
    { acc: 'main', sym: 'AAPL', date: '2024-01-03', qty: 10, cost: 1020 }, // advisor's own allocation
  ];
  const r = computeDecisionLedger({ lots, accountKind: ACCOUNT_KIND, priceHistory, benchmark: 'VTI', asOfMs: ASOF_MS });
  expect(r.sampleSize).toBe(2); // the 'main' lot never becomes a decision
  expect(r.rows.length).toBe(2);
  expect(r.rows.some(row => row.cost === 1020)).toBe(false);
});

// ── Missing price data ───────────────────────────────────────────────────────
test('a missing historical price excludes that row from the total and reports it, not zero or cost basis', () => {
  const lots = [
    ...baseLots,
    { acc: 'brok', sym: 'ZZZZ', date: '2024-01-02', qty: 1, cost: 999 }, // no priceHistory.ZZZZ at all
  ];
  const r = computeDecisionLedger({ lots, accountKind: ACCOUNT_KIND, priceHistory, benchmark: 'VTI', asOfMs: ASOF_MS });

  expect(r.sampleSize).toBe(3); // still counted as a decision the owner made
  expect(r.rows.length).toBe(2); // but not resolved into a row
  expect(r.rows.some(row => row.sym === 'ZZZZ')).toBe(false);

  expect(r.unresolved.count).toBe(1);
  expect(r.unresolved.items[0]).toMatchObject({ sym: 'ZZZZ', date: '2024-01-02', cost: 999 });
  expect(typeof r.unresolved.items[0].reason).toBe('string');
  expect(r.unresolved.items[0].reason.length).toBeGreaterThan(0);

  // the 999 cost basis must not have silently entered the total as 0 or as itself
  expect(r.totals.cost).toBeCloseTo(1500, 6); // NOT 1500+999
  expect(r.totals.actual).toBeCloseTo(2250, 6);
});

// ── The sharpest check: benchmark against itself ────────────────────────────
test('buying the benchmark itself yields a gap of EXACTLY zero, on any date', () => {
  const lots = [
    { acc: 'brok', sym: 'VTI', date: '2024-01-02', qty: 5, cost: 1000 },
    { acc: 'brok', sym: 'VTI', date: '2024-01-01', qty: 2.5, cost: 500 }, // non-trading-day purchase too
  ];
  const r = computeDecisionLedger({ lots, accountKind: ACCOUNT_KIND, priceHistory, benchmark: 'VTI', asOfMs: ASOF_MS });
  expect(r.unresolved.count).toBe(0);
  for (const row of r.rows) {
    expect(row.actual).toBe(row.counterfactual); // bit-identical, not merely close
    expect(row.gap).toBe(0); // exact, not toBeCloseTo
  }
  expect(r.totals.gap).toBe(0);
});

// ── Sample size / oldest-decision framing ───────────────────────────────────
test('sample size and oldest-decision age count every identified decision, resolved or not', () => {
  const lots = [
    ...baseLots,
    { acc: 'brok', sym: 'ZZZZ', date: '2023-06-01', qty: 1, cost: 50 }, // older, unresolved
  ];
  const r = computeDecisionLedger({ lots, accountKind: ACCOUNT_KIND, priceHistory, benchmark: 'VTI', asOfMs: ASOF_MS });
  expect(r.sampleSize).toBe(3);
  // oldest decision is the 2023-06-01 ZZZZ lot, ~12 months before asOf (2024-06-03)
  expect(r.oldestDecisionAgeMonths).toBeGreaterThan(11.5);
  expect(r.oldestDecisionAgeMonths).toBeLessThan(12.5);
});

// ── Yahoo v8/finance/chart adjusted-close parsing, against a saved fixture ──
// This sandbox is IP-blocked by Yahoo (DATA-SOURCES.md) — parsing is tested
// against test/fixtures/yahoo-chart-adjclose.json, a response shaped to match
// the documented structure, rather than a live call.
test('parseYahooAdjClose reads indicators.adjclose, not indicators.quote[0].close', () => {
  const d = parseYahooAdjClose(yahooFixture);
  expect(d).not.toBeNull();
  expect(d.c).toEqual([200, 201, 201.5, 208.8, 214.6, 220]); // the fixture's adjclose values
  expect(d.c).not.toEqual([199.8, 200.9, 201.4, 208.2, 214.0, 219.5]); // NOT the fixture's (deliberately different) close values
  expect(d.t.length).toBe(6);
});

test('parseYahooAdjClose fails closed (returns null) when adjclose is absent, never falls back to close', () => {
  const stripped = JSON.parse(JSON.stringify(yahooFixture));
  delete stripped.chart.result[0].indicators.adjclose;
  expect(parseYahooAdjClose(stripped)).toBeNull();
});

// ── End-to-end: fetch (injected) -> parse -> compute, via the saved fixture ─
test('getDecisionLedger resolves an injected fetch through the real parser into the real computation', async () => {
  const cache = {};
  const fetchImpl = async () => yahooFixture; // stands in for tryFetch(): always resolves the saved fixture
  const lots = [{ acc: 'brok', sym: 'VTI', date: '2024-01-02', qty: 5, cost: 1000 }];
  const nowMs = Date.parse('2024-06-03T23:00:00Z');

  const r = await getDecisionLedger({ lots, accountKind: ACCOUNT_KIND, benchmark: 'VTI', fetchImpl, cache, nowMs });

  expect(r.unresolved.count).toBe(0);
  expect(r.rows.length).toBe(1);
  // decision symbol === benchmark, fetched through the real pipeline: still exactly zero
  expect(r.rows[0].gap).toBe(0);
  // and the actual dollar figure came from adjclose (200->220), not close (199.8->219.5)
  expect(r.rows[0].actual).toBeCloseTo(1000 * (220 / 200), 6);
  expect(cache.VTI).toBeTruthy(); // the fetched series was cached
});
