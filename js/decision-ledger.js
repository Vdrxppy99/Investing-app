'use strict';
/* ============ THE DECISION LEDGER — data layer + computation ============
   The owner makes very few discretionary investment decisions — most of his money
   goes into a Vanguard advised account that allocates for him (js/seed.js's
   ACCOUNT_KIND). This scores the decisions he DOES make against the alternative
   of having bought a plain broad index fund (default VTI) with the same money on
   the same day. Stock picking and market timing rarely add value; rather than
   ship a feature that pretends otherwise, this measures whether his own choices
   did — honestly, including saying so when the sample is too small to mean much
   (sampleSize/oldestDecisionAgeMonths exist for exactly that).

   No UI in this file. It is the data layer + computation only — pure enough to
   run in Node (this file's own tests, test/decision-ledger.spec.js) or the
   browser, same dual-environment export pattern js/monte-carlo.js already uses.
   Not yet wired into js/vault.js's APP_SCRIPTS (the array that actually loads
   files into the running app) — that's UI-adjacent wiring for the next session
   that builds the visible module; this file is precached in sw.js's CORE ahead
   of that, same as any other core JS asset, but nothing calls it live yet.

   ── Why ADJUSTED close, on BOTH sides, is the one thing this file cannot get
      wrong ──
   actual      = C × (adjClose_today(S) / adjClose_D(S))
   counterfact = C × (adjClose_today(B) / adjClose_D(B))
   gap         = actual − counterfact

   Adjusted close bakes in reinvested dividends, so both sides are total-return
   and comparable. The wrong version of this — qty×price for the actual side,
   total return for the benchmark side — double-counts dividends on the actual
   side only, because the real position's dividends were already reinvested into
   EXTRA SHARES that exist as separate `div:true` lots (js/core.js's XIRR
   filtering treats them the same way: internal, not new money). Mixing a real
   market value (which already reflects those extra shares) with a total-return
   benchmark figure would silently inflate the actual side beyond what its own
   cost basis alone did. Using adjusted close on both sides sidesteps this
   entirely — the ratio is a pure total-return multiple, symmetric between the
   two sides, and does not care how many literal shares exist. See
   parseYahooAdjClose()'s own comment for what "adjusted close" means in the
   Yahoo response and how it was confirmed.

   Cache: historical closes never change (VTI's 2024-02-15 adjusted close is
   fixed forever) — cached permanently. Only the most recent point ("today")
   needs refreshing. Stored in plain (non-vault) localStorage, same as
   pt_history/pt_bench — js/core.js's PRIVATE_KEYS is untouched, since this is
   derived/reconstructible market data, not personal financial data, and this
   file never touches js/vault.js.

   Never fabricates a price: a row whose close cannot be resolved on either side
   is excluded from every total and reported in `unresolved`, never defaulted
   to zero or to cost basis. */
(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const DAYS_PER_MONTH = 365.2425 / 12; // average Gregorian month length — same convention as XIRR's day-count elsewhere in this app

  // 'YYYY-MM-DD' from an epoch-ms timestamp (UTC) — duplicated from js/core.js's
  // own dayStr(), not imported: this file must also run standalone in Node
  // (test/decision-ledger.spec.js) before core.js's globals ever exist, exactly
  // the reason js/monte-carlo.js doesn't reach for any other file's helpers either.
  function dayStr(ms) { return new Date(ms).toISOString().slice(0, 10); }

  /* ============ Date-indexed close lookups ============
     `hist` is {t:[ms...], c:[close...]}, sorted ascending by t — the same shape
     state.history[sym] already uses (and Yahoo's own chart response is already
     chronological, so a fetched series never needs re-sorting). Binary search on
     the DAY STRING (not raw ms) so "which calendar day is this bar" is
     unambiguous regardless of what time-of-day Yahoo timestamps a daily bar at. */
  function closeOnOrAfter(hist, targetDate) { // ceiling: smallest recorded day >= targetDate
    if (!hist || !hist.t || !hist.t.length) return null;
    const days = hist.t.map(dayStr);
    let lo = 0, hi = days.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (days[m] >= targetDate) { ans = m; hi = m - 1; } else lo = m + 1;
    }
    return ans < 0 ? null : { date: days[ans], close: hist.c[ans] };
  }
  function closeOnOrBefore(hist, targetDate) { // floor: largest recorded day <= targetDate
    if (!hist || !hist.t || !hist.t.length) return null;
    const days = hist.t.map(dayStr);
    let lo = 0, hi = days.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (days[m] <= targetDate) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans < 0 ? null : { date: days[ans], close: hist.c[ans] };
  }

  function monthsBetween(fromMs, toMs) { return (toMs - fromMs) / DAY_MS / DAYS_PER_MONTH; }

  /* ============ THE COMPUTATION — pure: no network, no ambient globals ============
     params:
       lots         state.lots-shaped array: {acc, sym, date:'YYYY-MM-DD', qty, cost, div?}
       accountKind  e.g. js/seed.js's ACCOUNT_KIND — {accId: 'advised'|'self'}
       priceHistory {SYM: {t:[ms...], c:[adjClose...]}} — MUST already be adjusted close;
                    this function has no way to tell plain close from adjusted close, so
                    that guarantee lives entirely in what the caller passes in (see
                    parseYahooAdjClose()/getDecisionLedger() below for the real path).
       benchmark    symbol string, e.g. 'VTI'
       asOfMs       "today", as an epoch ms timestamp — explicit, not Date.now(), so this
                    stays a pure function of its inputs and is exactly reproducible in tests. */
  function computeDecisionLedger(params) {
    const lots = params.lots || [];
    const accountKind = params.accountKind || {};
    const priceHistory = params.priceHistory || {};
    const benchmark = params.benchmark;
    const asOfMs = params.asOfMs;
    const asOfDate = dayStr(asOfMs);
    const benchHist = priceHistory[benchmark];

    // A decision: a lot in a SELF-directed account, not a dividend reinvestment.
    // The advisor's own allocation (accountKind[acc]==='advised') isn't the
    // owner's choice to score at all.
    const decisions = lots.filter(l => !l.div && accountKind[l.acc] === 'self');

    const rows = [];
    const unresolvedItems = [];
    for (const l of decisions) {
      const symHist = priceHistory[l.sym];
      const boughtS = closeOnOrAfter(symHist, l.date);
      const todayS = closeOnOrBefore(symHist, asOfDate);
      const boughtB = closeOnOrAfter(benchHist, l.date);
      const todayB = closeOnOrBefore(benchHist, asOfDate);
      if (!boughtS || !todayS || !boughtB || !todayB) {
        const reason = !symHist ? `no price history for ${l.sym}`
          : (!boughtS || !todayS) ? `missing adjusted close for ${l.sym} around ${l.date}`
          : `missing adjusted close for benchmark ${benchmark} around ${l.date}`;
        unresolvedItems.push({ sym: l.sym, date: l.date, cost: l.cost, reason });
        continue; // never fabricated — this decision simply doesn't enter any total
      }
      const actual = l.cost * (todayS.close / boughtS.close);
      const counterfactual = l.cost * (todayB.close / boughtB.close);
      const gap = actual - counterfactual;
      rows.push({
        sym: l.sym,
        dateUsed: boughtS.date, // the trading day actually priced at — may differ from l.date
        cost: l.cost,
        actual, counterfactual, gap,
        // Percentage points of excess return on the dollar actually invested (cost),
        // not on the counterfactual's ending value — matches this app's existing
        // convention of denominating returns against capital deployed (periodReturns(),
        // modified Dietz), and stays well-defined even for a near-zero counterfactual.
        gapPct: (gap / l.cost) * 100,
        ageMonths: monthsBetween(Date.parse(l.date + 'T00:00:00Z'), asOfMs),
      });
    }

    const totals = rows.reduce((a, r) => ({
      cost: a.cost + r.cost,
      actual: a.actual + r.actual,
      counterfactual: a.counterfactual + r.counterfactual,
      gap: a.gap + r.gap,
    }), { cost: 0, actual: 0, counterfactual: 0, gap: 0 });
    // Aggregate percentage from SUMMED dollars, never an average of per-row
    // percentages (averaging percentages with different-sized denominators is
    // the standard way this kind of figure quietly goes wrong).
    totals.gapPct = totals.cost > 0 ? (totals.gap / totals.cost) * 100 : null;

    // sampleSize/oldestDecisionAgeMonths cover EVERY identified decision, resolved
    // or not — a decision's age and its membership in "the sample" don't depend on
    // whether a price happened to resolve; the honesty this exists for ("a handful
    // of decisions over a couple of years is noise") is about how many choices were
    // made, not how many were priceable.
    const decisionDatesMs = decisions.map(l => Date.parse(l.date + 'T00:00:00Z'));
    const oldestMs = decisionDatesMs.length ? Math.min(...decisionDatesMs) : null;

    return {
      benchmark,
      rows,
      totals,
      unresolved: { count: unresolvedItems.length, items: unresolvedItems },
      sampleSize: decisions.length,
      oldestDecisionAgeMonths: oldestMs == null ? null : monthsBetween(oldestMs, asOfMs),
    };
  }

  /* ============ Yahoo v8/finance/chart — ADJUSTED close parsing ============
     js/api.js's own parseYahoo() deliberately reads ONLY
     indicators.quote[0].close (split-adjusted, NOT dividend-adjusted) — see its
     own comment and js/insights.js's pathValue()/spPathValue() ("Price-only...
     deliberate"). This feature needs the opposite on BOTH sides of the
     comparison. Yahoo's v8/finance/chart response carries dividend+split
     adjusted close as a SEPARATE, parallel array —
     chart.result[0].indicators.adjclose[0].adjclose — alongside (not instead
     of) indicators.quote[0].close, for any daily-or-coarser interval, with no
     extra query parameter required. This is long-standing, widely relied-upon
     (the yfinance Python library reads the identical field) but UNOFFICIAL/
     undocumented behavior of an unofficial endpoint, and DATA-SOURCES.md
     records that this sandbox is IP-blocked by Yahoo — it could not be
     confirmed against a live response this session. Tested instead against
     test/fixtures/yahoo-chart-adjclose.json, built to match that long-
     documented shape.

     If that assumption is ever wrong in practice, this function fails CLOSED:
     it returns null rather than ever falling back to indicators.quote[0].close
     (which would silently reintroduce the exact dividend double-counting bug
     this whole file exists to avoid). A null result becomes an unresolved row
     upstream, never a wrong number. */
  function parseYahooAdjClose(json) {
    const res = json && json.chart && json.chart.result && json.chart.result[0];
    if (!res) return null;
    const ts = (res.timestamp || []).map(t => t * 1000);
    const ac = res.indicators && res.indicators.adjclose && res.indicators.adjclose[0] && res.indicators.adjclose[0].adjclose;
    if (!ac || !ac.length) return null; // no adjclose in the response — fail closed, never fall back to .close
    const valid = ac.map((c, i) => [ts[i], c]).filter(x => x[0] != null && x[1] != null);
    if (!valid.length) return null;
    return { t: valid.map(x => x[0]), c: valid.map(x => x[1]) };
  }

  /* ============ Fetch + permanent cache (browser; dependency-injected for tests) ============
     Mirrors js/api.js's fetchHistory()/ensureBenchHistory() — same Worker-proxied
     v8/finance/chart URL, same 10y range — but into its OWN cache, never
     state.history/pt_history: those are deliberately plain close (see the header
     above), and merging an adjusted series into them would corrupt every other
     feature that reads state.history expecting plain close (hero chart,
     drawdown, etc.). `fetchImpl` defaults to the app's real `tryFetch` (js/api.js)
     when available, and is injectable so this is testable without real network —
     the test suite always injects a stub that resolves a saved fixture. */
  const LEDGER_HIST_TTL = 12 * 3600 * 1000; // matches js/api.js's HIST_TTL

  async function ensureLedgerHistory(sym, cache, fetchImpl, nowMs) {
    const h = cache[sym];
    if (h && h.t && h.t.length > 5 && h.ts && (nowMs - h.ts) < LEDGER_HIST_TTL) return true;
    try {
      const json = await fetchImpl(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`, true);
      const d = parseYahooAdjClose(json);
      if (!d || d.t.length < 5) return false;
      // Historical points are cached forever by construction: Yahoo's own series
      // is re-derived fresh on every call and this simply replaces the cached
      // entry outright, trusting the fresh fetch over the stale cache for the
      // whole range — a dividend paid since the last fetch revises EVERY earlier
      // adjusted close too, which is the entire reason adjusted close is used at
      // all, so "merge" here correctly means "replace", not "append only the tail".
      cache[sym] = { t: d.t, c: d.c, ts: nowMs };
      return true;
    } catch (e) { return false; }
  }

  const DEFAULT_BENCHMARK = 'VTI';

  function decisionLotSymbols(lots, accountKind) {
    const syms = new Set();
    for (const l of (lots || [])) if (!l.div && accountKind[l.acc] === 'self') syms.add(l.sym);
    return [...syms];
  }

  // The one function that returns the whole-portfolio ledger for real use. Every
  // dependency is overridable (lots/accountKind/benchmark/fetchImpl/cache/nowMs)
  // so it is exactly as testable as computeDecisionLedger() itself — the test
  // suite injects a fetchImpl stub and a throwaway cache object rather than
  // touching the network or localStorage. With no overrides, it reads the live
  // app's globals (state.lots, js/seed.js's ACCOUNT_KIND, js/api.js's tryFetch,
  // core.js's lsGet/lsSet against a NEW non-vault key, pt_ledgerHistory).
  async function getDecisionLedger(opts) {
    opts = opts || {};
    const lots = opts.lots || (typeof state !== 'undefined' ? state.lots : []);
    const accountKind = opts.accountKind || (typeof ACCOUNT_KIND !== 'undefined' ? ACCOUNT_KIND : {});
    const benchmark = opts.benchmark
      || (typeof lsGet === 'function' && lsGet('pt_ledgerBench'))
      || DEFAULT_BENCHMARK;
    const fetchImpl = opts.fetchImpl || (typeof tryFetch === 'function' ? tryFetch : null);
    const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
    const cache = opts.cache || (typeof lsGet === 'function' ? (lsGet('pt_ledgerHistory') || {}) : {});

    if (!fetchImpl) throw new Error('getDecisionLedger: no fetch implementation available (pass opts.fetchImpl or load js/api.js first)');

    const syms = decisionLotSymbols(lots, accountKind);
    if (benchmark && !syms.includes(benchmark)) syms.push(benchmark);

    await Promise.allSettled(syms.map(sym => ensureLedgerHistory(sym, cache, fetchImpl, nowMs)));
    if (typeof lsSet === 'function' && !opts.cache) lsSet('pt_ledgerHistory', cache);

    return computeDecisionLedger({ lots, accountKind, priceHistory: cache, benchmark, asOfMs: nowMs });
  }

  const api = {
    computeDecisionLedger, parseYahooAdjClose, getDecisionLedger,
    ensureLedgerHistory, decisionLotSymbols,
    closeOnOrAfter, closeOnOrBefore, monthsBetween, dayStr,
    DEFAULT_BENCHMARK,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
