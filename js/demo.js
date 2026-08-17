'use strict';
/* ============ DEMO / EXAMPLE PORTFOLIO ============
   A completely fictional portfolio shown behind the PUBLIC demo passcode ("demo") and the
   lock-screen "View the example portfolio" link. Every number here is invented — safe to be
   public. It NEVER touches the real encrypted vault: in demo mode, core.js's lsGet/lsSet read
   and write ONLY window.DEMO_STORE, an in-memory sandbox that resets on reload. Nothing is
   persisted to localStorage, the vault, or the Worker while in demo mode.

   It deliberately reuses the baked SEED_HISTORY (public 2023+ market data) and the same six
   tickers the whole app is instrumented for, so EVERY screen — hero chart, holdings, allocation,
   dividends, goal, and all Insights cards (health, performance, drawdown, heatmap, risk, P/E,
   crash test, projection, FI, look-through, tax lots) — renders instantly, offline, and richly. */
function buildDemoStore(){
  const H = (typeof SEED_HISTORY !== 'undefined') ? SEED_HISTORY : {};
  // closing price at-or-before a timestamp, from the baked weekly history
  const priceAt = (sym, ms) => { const h = H[sym]; if (!h || !h.t) return 0; let px = h.c[0] || 0;
    for (let i = 0; i < h.t.length; i++){ if (h.t[i] <= ms) px = h.c[i]; else break; } return px; };
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  const D = (y, m, d) => Date.UTC(y, m - 1, d, 16, 0, 0);

  // fictional purchase lots — a mature, diversified index portfolio built up over ~3 years.
  // costs are computed from the real historical price on each date, so gains look authentic.
  // Every lot used to be acc:'brok', which — now that js/seed.js's ACCOUNT_KIND marks
  // 'brok' as the self-directed account — would have made the demo 100% discretionary
  // and had the Decision Ledger score every single lot, misrepresenting the feature (the
  // owner's real portfolio is mostly advisor-allocated). Reassigned per lot below: broad
  // index funds (VOO/VTI/VXUS/VXF) go to 'main' (advised — a believable allocator's
  // picks), leaving VYM/BRK-B in 'brok' (self — the more selective, non-market-cap-
  // weighted choices) as the demo's few genuine decisions. No symbol is split across both
  // accounts, so the aggregation below needs no restructuring beyond reading `acc` off
  // each lot instead of hardcoding it. ONLY `acc` changed here — sym/qty/cost/date are
  // exactly as before (verified: test/golden/golden-master.json does not move, since
  // rows('all')/totals('all') sum by symbol across every account regardless of `acc`).
  const lotDefs = [
    ['VOO', D(2023, 2, 14), 34, 'main'], ['VOO', D(2023, 8, 15), 22, 'main'], ['VOO', D(2024, 2, 20), 18, 'main'],
    ['VOO', D(2024, 9, 10), 20, 'main'], ['VOO', D(2025, 3, 17), 16, 'main'], ['VOO', D(2025, 11, 4), 12, 'main'],
    ['VTI', D(2023, 4, 11), 26, 'main'], ['VTI', D(2024, 6, 4), 18, 'main'],
    ['VXUS', D(2023, 3, 21), 120, 'main'], ['VXUS', D(2024, 8, 13), 90, 'main'], ['VXUS', D(2025, 5, 6), 70, 'main'],
    ['VYM', D(2023, 7, 11), 34, 'brok'], ['VYM', D(2025, 1, 14), 28, 'brok'],
    ['VXF', D(2024, 1, 23), 22, 'main'],
    ['BRK-B', D(2023, 5, 9), 9, 'brok'], ['BRK-B', D(2024, 10, 15), 6, 'brok']
  ];
  const lots = lotDefs.map(([sym, ms, qty, acc]) => {
    const px = priceAt(sym, ms);
    return { acc, sym, date: iso(ms), qty, cost: +(qty * px).toFixed(2) };
  });

  // aggregate lots into positions
  const hmap = {};
  for (const l of lots){
    const h = hmap[l.sym] || (hmap[l.sym] = { acc: l.acc, sym: l.sym, qty: 0, cost: 0 });
    h.qty = +(h.qty + l.qty).toFixed(6); h.cost = +(h.cost + l.cost).toFixed(2);
  }
  const holdings = Object.values(hmap);
  const invested = lots.reduce((a, l) => a + l.cost, 0);

  // believable quarterly dividend history for the payers, so the Dividends card is full
  const DIV = { VOO: [1.5, 1.75], VTI: [0.88, 1.05], VXUS: [0.34, 0.45], VYM: [0.78, 0.95], VXF: [0.42, 0.58] };
  const divs = {};
  for (const sym of Object.keys(DIV)){
    const [lo, hi] = DIV[sym]; const list = [];
    for (let y = 2023; y <= 2026; y++) for (const m of [3, 6, 9, 12]){
      const ms = D(y, m, 18); if (ms > Date.now()) continue;
      const amt = +(lo + (hi - lo) * (((y * 4 + m) % 7) / 6)).toFixed(3); // deterministic wiggle
      list.push([ms, amt]);
    }
    divs[sym] = { list, ts: Date.now() };
  }

  return {
    pt_holdings: holdings,
    pt_lots: lots,
    pt_cash: { main: 0, brok: 1804.62 },
    pt_deposits: Math.round(invested) + 1800,           // contributions ≈ invested cost + a little idle cash
    pt_confirmed: iso(Date.now()),
    pt_goal: { amt: 250000 },                           // aspirational target → progress ring ~60%
    pt_targets: { VOO: 45, VTI: 15, VXUS: 20, VYM: 10, VXF: 5, 'BRK-B': 5 },
    pt_history: H,                                       // reuse the baked history — instant, offline charts
    pt_quotes: (typeof SEED_QUOTES !== 'undefined') ? JSON.parse(JSON.stringify(SEED_QUOTES)) : {},
    pt_divs: divs,
    pt_watch: [ { sym: 'QQQ', name: 'Invesco QQQ Trust' }, { sym: 'SCHD', name: 'Schwab US Dividend Equity ETF' }, { sym: 'NVDA', name: 'NVIDIA' } ],
    pt_ccy: 'USD',
    pt_metric: 'profit'
  };
}
// only build the (relatively heavy) fixture when actually entering demo mode
if (window.DEMO_MODE && !window.DEMO_STORE) window.DEMO_STORE = buildDemoStore();
