# UPGRADE_PLAN.md

Phased plan to take this app to the quality bar of Vanguard / Robinhood / Empower / Schwab.

**How to use this file:** run ONE phase per Claude Code session. Start a fresh
session (`/clear`) between phases. Each phase names the skills to load and the
acceptance criteria that must be met before the phase counts as done. Do not
start a phase until the previous one's criteria are all green.

---

## Context rules — read first, every session

These exist to keep token usage low and output correct.

- **Never read `repomix-output.xml`.** It is 2.7 MB — a single read burns a large
  share of a context window and contains nothing not already in the source files.
  It should be in `.gitignore`.
- **Never read `.claude/worktrees/`.** It is a full duplicate copy of the repo.
- Read `CLAUDE.md` first. It contains the architecture, the scope decisions that
  must not be reverted (News tab stays removed; `ACCOUNTS` stays at two entries),
  and the critical developer rules.
- The js files share **one global scope** and are loaded in a fixed order from
  `index.html`. There is no module system and no build step. A symbol renamed in
  `core.js` breaks every later file silently.
- `css/tokens.css` is the ONLY file permitted to contain a literal hex, px or ms
  value. `@layer` order is tokens → base → components → layout.
- Any css/js edit requires the `sw-release` checklist. It is installed as a skill.

---

## Phase 0 — Safety net

**Nothing else in this plan is safe until this exists.** The repo currently has
zero tests, and `CLAUDE.md` claims "financial figures are byte-identical to
v9.1.0" with nothing proving it.

**Skills:** `webapp-testing`, `test-driven-development`,
`verification-before-completion`

**Work:**

1. Add a `test/` directory. No build step in the app itself — tests may use
   node + Playwright as devDependencies, kept entirely out of the shipped assets.
2. Write a Playwright smoke suite that boots the app against a local static
   server and asserts, for the seed dataset:
   - the app unlocks with a known test passcode
   - all tabs render without a console error
   - total portfolio value matches an expected string
   - the hero chart canvas is non-empty at each range (1D … Max)
   - the holdings table row count matches the seed holdings count
3. Capture a **golden master**: serialise every computed financial figure the UI
   displays (total value, day change, each holding's value and gain, XIRR,
   modified Dietz, health score, volatility, beta, max drawdown, dividend
   forecast) to a JSON snapshot committed to the repo.
4. Add a single command that runs the suite and diffs against the golden master.

**Acceptance criteria:**

- [ ] `npm test` (or equivalent) runs green from a clean checkout
- [ ] the golden-master JSON is committed and diffing works
- [ ] deliberately breaking one number in `core.js` makes the suite fail
- [ ] no test artefact is added to `CORE` in `sw.js` or shipped to production

---

## Phase 1 — Prove the math

The single biggest credibility gap. Vanguard's number is never wrong and they
can prove it; yours is probably right and cannot be proven.

**Skills:** `backtesting` (as an independent oracle), `systematic-debugging`,
`verification-before-completion`

**Work:**

1. Identify every pure financial function in `js/core.js` and `js/insights.js`:
   XIRR, modified Dietz, volatility, beta, max drawdown, tax-lot matching,
   same-buys-in-VOO benchmark.
1a. **Start with the known bug.** Phase 0 verified that `riskStats()` in
   `js/insights.js:128` runs over `SEED_HISTORY`, which is sampled roughly
   weekly, but annualizes with `sqrt(252)` and `x252` as if the series were
   daily. That is why the demo Insights tab shows volatility ~29%, Sharpe ~2.8
   and annualized return ~87% — all implausible for an index portfolio.
   Fix: derive the annualization factor from the actual observed sampling
   interval rather than hardcoding a trading-day count, so the same function is
   correct for both the weekly seed data and real daily data. Write the test
   first: assert that a known weekly series produces the correct annualized
   volatility. Then check whether beta, Sharpe, Sortino and max drawdown share
   the same assumption — if they read from the same series, they are wrong too.

2. For each, build a fixture: a fixed set of cashflows / price series with a
   known-correct answer.
3. Compute the same quantity with the `backtesting` skill's Python
   implementation. Diff. Investigate every disagreement beyond 1e-9 — the bug
   may be in either implementation, so establish which by hand before "fixing".
4. Document each convention explicitly in code comments: day-count basis,
   annualisation factor, whether returns are geometric or arithmetic, how
   partial periods are handled, sample vs population standard deviation.
   Most real disagreements in this space are convention mismatches, not bugs.

**Acceptance criteria:**

- [ ] every listed function has a test with an independently-derived expected value
- [ ] every disagreement is either resolved or documented as a deliberate
      convention difference, with the reason
- [ ] `CLAUDE.md`'s "byte-identical" claim is replaced with a link to the tests

---

## Phase 2 — The chart

The single most visible product upgrade available. Chart.js is a general
plotting library; every chart behaviour that reads as "brokerage" is a first-
class primitive in Lightweight Charts and a fight in Chart.js.

**Skills:** `lightweight-charts`

**Work:**

1. Add `lightweight-charts` to `vendor/` (no build step — use the standalone
   production UMD build). Register it in `CORE` in `sw.js`.
2. Rebuild the Portfolio hero chart on it, preserving every current feature:
   1D–Max ranges, value/profit toggle, benchmark overlay cycling, scrub-to-date,
   buy markers, all-time-high line.
3. Then add what Chart.js made impractical:
   - candlestick / OHLC as an option on the single-stock sheet
   - a volume histogram in a second pane
   - `series.update()` on the refresh path instead of a full `setData` rebuild
   - crosshair subscription driving the header readout
4. Read the skill's foot-gun section before writing a line. In particular:
   `UTCTimestamp` is **seconds**, not milliseconds — your existing data is
   almost certainly in ms and will silently render in 1970. `setData` resets the
   visible range; `update()` appends. There is no prepend, so backfilling older
   history means rebuild plus save/restore of the logical range.
5. Chart design constraints — apply these rather than inventing a look:
   - every colour comes from `css/tokens.css`. No literal hex in chart config.
     Read the token, pass the value. This is what keeps the theme toggle working.
   - gain/loss must not be conveyed by colour alone. Red/green is invisible to
     roughly 8% of men. Pair it with sign, arrow or position.
   - one accent colour for the portfolio series, one muted neutral for the
     benchmark overlay. The benchmark is reference, not a competing series —
     it should recede.
   - verify contrast of every line and label against the canvas in BOTH themes,
     not just dark. The light theme is where chart colours usually fail.
   - grid lines and axis labels sit below the data in visual weight. If the
     grid is as visible as the series, it is too strong.
   - no gradient fills under a line unless they carry meaning. They mostly
     read as decoration and hurt legibility at the crossover point.

5. Keep the theme toggle working — colour options must be re-applied on theme
   change, the same way the existing `CHART_TOOLTIP` accessors do.

**Acceptance criteria:**

- [ ] Phase 0 suite still green; golden master unchanged (this is a rendering
      change, no figure may move)
- [ ] every pre-existing chart feature still works, verified by screenshot
- [ ] light and dark themes both correct, including after a live toggle
- [ ] chart bundle size documented; total page weight has not regressed

---

## Phase 3 — Feel

What makes Robinhood feel expensive. Systematisable, contrary to assumption.

**Skills:** `modern-web-guidance` (View Transitions, scroll-driven animations,
`scheduler.yield`, INP), `motion-design`

**Work:**

1. Critique before you build. Walk the app at an iPhone viewport and write a
   numbered list of what is weakest, judged against: visual hierarchy (does the
   eye land on the number that matters first?), spacing rhythm, alignment,
   typographic scale, state coverage, and touch-target size. Fix the worst three
   before adding any new motion.
2. View Transitions API for tab switches and sheet presentation. This is the
   single largest "feels native" delta available to a no-framework PWA.
3. Motion pass using the `motion-design` timing and easing tables: number
   roll-up on value change, chart draw-in, sheet spring. Match the existing
   haptic calls — haptics firing without matched motion reads as broken.
4. Respect `prefers-reduced-motion` throughout. `css/base.css` already has a
   motion policy; extend it rather than bypassing it.
5. Copy pass on the states nobody designs: fetch failure, zero holdings, market
   closed, stale price, offline, first launch. Rules: say what happened and what
   the user can do, in that order; never show a raw error code; never blame the
   user; prices that may be stale must say when they were fetched, not just show
   a number. This is a large part of what separates Schwab from a hobby project
   and it is cheap to fix.
6. All new values go in `css/tokens.css`. No literal ms or px anywhere else.

**Acceptance criteria:**

- [ ] the three weaknesses identified in step 1 are demonstrably fixed,
      with before/after screenshots
- [ ] every animation honours `prefers-reduced-motion`
- [ ] no literal timing or colour value outside `tokens.css`
- [ ] Phase 0 suite green

---

---

## Phases R1-R4 — The visual rebuild

**Spec:** `DESIGN-TARGET.md` (the rules) and `design/target/five-tabs.html`
(the rendered reference — open it in a browser first). Owner-approved. You are
implementing an existing design, not designing one.

**Superseded:** `REDESIGN_PROMPT.md` phases 4-6. That document ran already and
its diagnosis is all code-hygiene — inline styles, emoji, half-pixel font sizes.
Every one of those was fixed and the app still looked like a prototype, because
composition and information architecture were never addressed. `DESIGN-TARGET.md`
replaces it. Do not follow REDESIGN_PROMPT's screen briefs.

**The structural change:** three tabs become five —
`Home · Markets · Portfolio · Insights · Following`. The current Explore tab is
doing two unrelated jobs (market browsing and the personal watchlist); splitting
it is the point, not a side effect.

**Skills:** `modern-web-guidance`, `motion-design`, `lightweight-charts`

### R1 — Tokens and Portfolio
Retarget `css/tokens.css` to the DESIGN-TARGET palette and type scale — indigo
brand replacing the green, the 7-step scale, the shape and space values, light
theme equivalents for every token added. Build the shared row, tile, card,
section-label and segmented-control primitives in `css/components.css` and
`js/ui.js`. Then rebuild the Portfolio screen: hero with today + all-time,
full-bleed chart, allocation strip replacing the donut, holdings grouped by
asset class with subtotals, rows carrying share count, average cost, sparkline
and total return. Allocation, goal, dividends and movers leave this screen.

**Also in R1 — rebuild the sheet primitive properly.** Three separate patches
have failed to make `#editSheet` scroll (`overflow-y` on `#detailSheet` only,
then on shared `.sheet`, then `.sheet > * { flex-shrink: 0 }`). Stop patching.
`.sheet` is a flex column that receives raw `innerHTML`, with no separation
between the head and the body, so there is no element that can own the scroll.
Build the real component: a non-shrinking `.sheet__head` and a
`.sheet__body { flex: 1 1 auto; min-height: 0; overflow-y: auto;
overscroll-behavior: contain }`. `min-height: 0` is the part every patch so far
has missed — without it a flex item will not shrink below its content and the
body can never become a scroll container. The dead `.sheet__body` rule and the
uncalled `uiSheet()` helper in `js/ui.js` were written for exactly this. Route
`#detailSheet` and `#editSheet` through it, and verify by measurement —
`scrollHeight > clientHeight`, scroll to the bottom, confirm the last element
is inside the visible box. Not by screenshot.

### R2 — Insights
Restructure ~20 stacked cards into the health ring plus the module grid. No new
maths — every figure already exists in `js/insights.js`.

### R3 — Markets and Following
Split the Explore tab. Markets: search, index grid, the three screeners collapsed
into one segmented card, sector rows. Following: watchlist plus the ETF
look-through, presented as a headline feature.

### R4 — Home

**Carried into R4 from R1.** Two elements were dropped from the Portfolio hero
because DESIGN-TARGET's composition has no slot for them, and they have not been
relocated: `#homePr` (the period-return pills) and the "vs S&P 500 today"
narrative sentence. Both belong on Home — the pills as a row under the portfolio
card, the narrative as a Today's-movers lead line. Do not let them vanish.


The new glance screen. Portfolio card, today's movers with attribution, upcoming
dividends with day-count chips, goal progress. Built last, because it summarises
pieces that must exist first.

**Acceptance criteria, each of R1-R4:**

- [ ] Phase 0 suite green, golden master unchanged — composition, not maths
- [ ] side-by-side screenshot against the matching frame in `five-tabs.html`,
      iPhone viewport, both themes
- [ ] zero JS-emitted inline styles, emoji-as-icons, or colour/size literals
      outside `tokens.css` in files touched
- [ ] gain/loss never conveyed by colour alone
- [ ] no text input below 16px
- [ ] `redesign/contrast-check.mjs` passes

## Phase 4 — Quality floor

*Runs LAST, after R1-R4. Auditing markup that is about to be replaced is
wasted work. The one exception is the Chart.js lazy-load item below, which is
pure performance and survives the rebuild — do it whenever convenient.*

The bar regulated financial apps must legally clear. Currently unmeasured.

**Skills:** `modern-web-guidance` (performance and accessibility guides)

**Work:**

1. Baseline Lighthouse and Core Web Vitals. Record the numbers in the repo
   before changing anything.
2. **Known item, flagged twice already:** `drawChart()` in `js/portfolio.js` —
   the Chart.js path used by every non-hero chart (holding detail, drawdown,
   worth, contributions, dividend calendar) — still colours the line green or
   red by direction and applies a decorative stroke gradient. Phase 2 fixed this
   on the hero chart only. Apply the same treatment here: single accent colour,
   gain/loss carried by sign and position, gradient removed unless it encodes
   something.

3. WCAG 2.2 AA audit. Expect the weak points to be: chart canvases with no text
   alternative, colour-only encoding of gain/loss (a red/green problem for the
   ~8% of men with deuteranopia — this is a real issue in every investing app),
   focus management when bottom sheets open and close, and touch target sizes.
4. **Both chart libraries now ship on first load** — Chart.js (200 KB) plus
   Lightweight Charts (196 KB), a 28.8% total page weight increase from Phase 2.
   Chart.js is only needed once a detail sheet or the Insights tab opens, so
   lazy-load it on first use instead of in the initial script block. That
   recovers the regression without removing anything.
5. INP and CLS are the likely failing metrics — five hand-rolled chart surfaces
   plus an Inter font swap. `scheduler.yield` for the long tasks.
6. Service worker review, using the modern-web-guidance performance guides.

**Acceptance criteria:**

- [ ] Lighthouse accessibility ≥ 95
- [ ] no WCAG 2.2 AA violation from the axe run
- [ ] gain/loss conveyed by more than colour alone
- [ ] CLS < 0.1, INP < 200 ms on a mid-tier mobile profile
- [ ] before/after numbers committed

---

## Phase 5 — Vault audit

*Runs NEXT, before the visual rebuild. It is pure backend and shares no files
with R1-R4, so it is the last foundation work outstanding.*

Do this before any real money data lives in the app on a device you would mind
losing.

**Skills:** Trail of Bits (`insecure-defaults`, `sharp-edges`,
`differential-review`), `cloudflare/security-audit-skill`,
`modern-web-guidance` (passkey guides)

**Work:**

1. Audit `js/vault.js` and the crypto path in `js/core.js`. Two independent
   unwrap paths reach one master key — passcode (PBKDF2 310k) and WebAuthn PRF.
   Specifically check: IV/nonce uniqueness per encryption, AAD binding,
   behaviour when PRF is unsupported (must fail closed, never fall back to
   plaintext or a weaker path), key material zeroisation, and whether the
   export/backup path ever writes plaintext.
2. Note the known gap: no skill covers `crypto.subtle` key wrapping. The
   passkey guides cover the WebAuthn ceremony only. The key-wrapping half needs
   human review, so treat agent output here as a lead, not a verdict.
3. Run `security-audit-skill` for its adversarial validation phase — it makes
   agents try to disprove their own findings, which is what keeps a security
   pass from being a list of plausible-sounding non-issues.

**Acceptance criteria:**

- [ ] every finding is either fixed or documented with an explicit accepted-risk note
- [ ] PRF-unsupported path verified to fail closed
- [ ] no plaintext personal data on any code path, including export and error handling

---

## Phase 6 — Projection

The Empower feature. Turns the app from reporting into planning, and it is the
one feature gap that is purely a matter of doing the work — no licence, no
paid data feed.

**Skills:** `finance-assistant` (Monte Carlo FIRE, Scenario Lab)

**Work:**

1. Port the Monte Carlo engine: 10,000 paths, configurable return and inflation
   volatility. Run it in a Web Worker — 10k paths on the main thread will
   destroy the INP number won in Phase 4.
2. Replace the deterministic goal tracker with a probabilistic one: "82% chance
   of reaching €X by 2045", with a fan chart of the 10th/50th/90th percentiles.
3. Scenario comparison: named, saved, side-by-side paths.
4. Be honest in the UI about what the model assumes. Empower's planner is
   trusted because it shows its assumptions; a black-box percentage is worse
   than no percentage.

**US tax, not German — corrected:** holdings are US-domiciled Vanguard funds
held in a US account. Vorabpauschale, Teilfreistellung and the
Sparerpauschbetrag do NOT apply and must not be implemented. The relevant
rules are US cost basis and tax lots, qualified vs ordinary dividends,
short vs long-term capital gains, and wash sales. See DATA-SOURCES.md.
The `JoelLewis/finance_skills` `wealth-management` plugin is US-normed and is
therefore the right fit here.

**Acceptance criteria:**

- [ ] Monte Carlo runs in a Worker; main thread never blocks > 50 ms
- [ ] assumptions visible in the UI
- [ ] US tax lot / qualified-dividend treatment correct, or projection is
      explicitly pre-tax with a note saying so
- [ ] Phase 0 suite green

---

## Backlog — found during phases, deliberately not fixed

Not part of any phase. Pick these off when convenient.

- **Phase 2 regression: period high/low labels lost.** The old Chart.js hero had
  a `heroFx` plugin drawing the range's high and low as text on the chart
  (`lab(ma,true); lab(mi,false)`). `drawHeroChart()` has no equivalent — no
  price lines, no min/max labels. Missed because the acceptance criteria listed
  six features and this was not among them. `createPriceLine()` is the
  Lightweight Charts equivalent. The all-time-high line (`#athLine`) is separate
  and unaffected.
- **`rollUpTvNum()` never cancels an in-flight animation.** No
  `cancelAnimationFrame`; two price ticks close together start two rAF loops
  writing to `#tvNum` simultaneously. Cosmetic only.
- **`TAB_ORDER` in `js/app.js` is hardcoded to three tabs.** Must be updated to
  the five-tab order during R3/R4 or the view-transition direction will be wrong.
- **Settings sheet cannot scroll.** Structural, pre-dates Phase 3.
  `css/components.css:352` defines `.sheet__body { overflow-y:auto;
  overscroll-behavior:contain }` but no element in `index.html` carries that
  class, and only `#detailSheet` got an explicit override (line 1999). Every
  JS-built sheet therefore has no scroll container. Affects Settings and likely
  any other dynamically-created sheet. Settings is an overlay, not a tab, so
  R1-R4 will not rebuild it — this needs its own fix.
- `index.html` footer still shows v9.1.0 while `sw.js` and `CLAUDE.md` say
  v9.2.x. Pre-existing version-string drift. `scripts/sync-version.sh` exists.
- `riskStats()` silently defaults beta to 1 when the user holds no VOO — there
  is no separate benchmark-history fetch path. Real gap: beta reads as 1.00 and
  looks like a computed value rather than a fallback. Either fetch the
  benchmark series independently or surface it as unavailable.
- 1D/1W/2W chart ranges cannot paint under the baked offline demo data (1D has
  no intraday points; 1W/2W fall inside a single weekly-sample gap). Real online
  use is unaffected. Revisit if the seed snapshot is ever regenerated.
