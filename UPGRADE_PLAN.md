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

**Skills:** `modern-web-guidance`, `test-driven-development`,
`lightweight-charts`

*(An earlier draft named a `finance-assistant` skill. It was never installed —
do not try to load it. The model it would have supplied is specified inline
below instead.)*

**The model, specified so no external skill is needed:**

- 10,000 paths. Annual real return drawn from a normal distribution, mean 7%,
  standard deviation 12%. Inflation mean 2%, standard deviation 0.8%.
- Seed the generator deterministically so the same inputs give the same fan
  every run. A projection that changes when you reopen the tab is not credible.
- Inputs: current portfolio value, the existing goal amount and target date,
  and the user's actual contribution rate derived from deposit history.
- Outputs: probability of reaching the goal by the target date, and the 10th,
  50th and 90th percentile paths for the fan chart.
- These are US-domiciled holdings in a US account. Do not implement German
  investment tax. Ship the projection pre-tax and say so in the UI.

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

- [x] Monte Carlo runs in a Worker; main thread never blocks > 50 ms — measured
      0.5ms synchronous dispatch (`postMessage` call itself) and zero Long Tasks
      on the main thread for the full 10,000-path run (`PerformanceObserver`,
      `type:'longtask'`, browser-verified, not assumed)
- [x] assumptions visible in the UI — Home goal card states real return, inflation,
      derived (or absent) contribution rate, and pre-tax, inline under the fan chart
- [x] US tax lot / qualified-dividend treatment correct, or projection is
      explicitly pre-tax with a note saying so — pre-tax, stated in the UI
- [x] Phase 0 suite green — 37/37, `npx playwright test`

---

## Backlog — found during phases, deliberately not fixed

Not part of any phase. Pick these off when convenient.

### Phase 5 vault audit findings

- **TP-1 — `exportBackup()` exported the raw cloud key.** [js/portfolio.js:1120](js/portfolio.js:1120)
  The export object included `bk: lsGet('pt_bk')`. `pt_bk` is `{k, tag, salt}`: `k`
  is the raw AES-256-GCM cloud-backup key (`crypto.subtle.exportKey('raw', key)`,
  see [js/vault.js:185](js/vault.js:185)) and `tag` is the PBKDF2-310k passcode
  verifier the Cloudflare Worker accepts as the *sole* authenticator for
  `/restore` ([worker/src/index.js:138-143](worker/src/index.js:138)). Exporting
  holdings in the clear is a deliberate feature (this phase's acceptance
  criterion 3 is about *personal data* plaintext, not key material); exporting a
  key that lets anyone holding the file impersonate this device to the cloud
  and pull (and, with a guessed passcode, decrypt) the live backup is not.
  **Fixed this session** — `bk` removed from the export object entirely; see the
  fix log below for the import-side decision.

- **TP-2 — plaintext PII can survive a partial setup/restore failure.**
  [js/vault.js:76-91](js/vault.js:76) `doSetup()` — used directly on first setup
  and by `cloudRestore()` after it seeds plaintext keys at
  [js/vault.js:199-203](js/vault.js:199) — writes every `PRIVATE_KEYS` value to
  `localStorage` unencrypted, then calls `saveVaultNow()`/`loadVaultData()`, and
  only deletes the plaintext copies afterward at
  [js/vault.js:90](js/vault.js:90). If `wrapKey`/`encrypt`/`decrypt`/the LS write
  throws anywhere in between (quota, a WebCrypto error, a killed page), `doSetup`
  rejects and the cleanup loop never runs. Both call sites swallow this into a UI
  alert with no cleanup in the `catch` ([js/vault.js:483](js/vault.js:483) for
  setup, [js/vault.js:462-465](js/vault.js:462) for restore). Full
  holdings/lots/cash/goal data then sits unencrypted in `localStorage`, readable
  by anyone with the device, until a later successful setup happens to overwrite
  it. **Not fixed this session** — out of the three items scoped; needs a
  `try/finally` around the plaintext window in `doSetup`. Accepted risk until then.

- **TP-3 — the passcode minimum was weak and UI-only.** [js/vault.js:477](js/vault.js:477)
  `if(a.length<6){ err('Use at least 6 characters.'); return; }` was the *only*
  passcode-strength check anywhere: 6 characters, digits-only allowed (`123456`
  passed), enforced in `boot()`'s setup handler, not in the crypto layer.
  `window.vaultChangePass` ([js/vault.js:152-164](js/vault.js:152)) had no
  strength check at all — it would happily rewrap the master key under a
  1-character passcode. Combined with C-2 below, a weak passcode is the one
  thing standing between an attacker with the KV backup ciphertext and an
  offline-equivalent guessing attack. **Fixed this session** — minimum raised to
  8 characters and digits-only rejected, enforced once in `js/vault.js` (a
  shared `passcodeError()`) and called from both the setup handler and
  `vaultChangePass`. The 310,000 PBKDF2 iteration count is untouched — changing
  it would invalidate every existing wrap.

- **C-1 — the passcode persists in the live DOM for the whole session
  (CONDITIONAL — gated on an XSS primitive).** [js/vault.js:523-540](js/vault.js:523)
  `tryUnlock()` reads the typed passcode from `$id('unlockPass').value`. The
  failure path clears it (`$id('unlockPass').value=''` at
  [js/vault.js:540](js/vault.js:540)), but the success path does not — it calls
  `startApp()` ([js/vault.js:330-340](js/vault.js:330)), which only toggles the
  `.locked`/`.unlocking` classes on `document.body`. The lock screen is hidden
  purely by `body:not(.locked) .lock { display:none }`
  ([css/components.css:742](css/components.css:742)); the `#unlockPass` node
  stays attached to the DOM with the plaintext passcode still in its `.value`
  for the rest of the tab's life. Not exploitable on its own — it requires an
  existing script-execution primitive (XSS) to read — but once that
  precondition holds, it turns a moment-of-typing exposure into a
  standing one: any XSS payload can pull the passcode (and, from it, redo the
  PBKDF2-310k unwrap) for as long as the tab stays open, not just at entry
  time. **Fixed this session** — `#unlockPass` now clears on the success path
  too (mirroring the existing failure-path clear), and the same gap was found
  and closed in `#setPass1`/`#setPass2` (setup) and `#restorePass` (cloud
  restore), which had the identical bug: cleared on failure, left holding the
  plaintext on success. Verified empirically against a real (non-demo) unlock
  and a real setup flow, not by reading the code.
  *(This finding was dropped from the Backlog when it was first written up —
  the slot below had taken its "C-1" label for a different, also-real finding.
  Renumbered that one to C-2 and restored this one here; no code changed by
  this reconciliation.)*

- **C-2 — the `/restore` brute-force brake is per-isolate memory, not durable.**
  [worker/src/index.js:99-100](worker/src/index.js:99)
  `let rlN = 0, rlT = 0` are module-scope variables — one counter per Worker
  isolate. The comment reasons about the legitimate owner ("fine for a
  single-user API"), not an attacker: Cloudflare spins up a new isolate per PoP,
  and under concurrent load within a PoP, so a distributed or merely parallel
  requester gets a fresh 20-tries/hour budget per isolate, not 20/hour globally.
  `/restore`'s only authentication is `tag`, a PBKDF2-310k value derived from the
  passcode alone ([js/vault.js:169-174](js/vault.js:169)) — before TP-3's fix,
  the (non-global) rate limit was the *only* real brake on an online guessing
  attack against the KV-stored backup ciphertext. Should move to a KV- or
  Durable-Object-backed counter keyed by IP or a fixed window. **Not fixed this
  session** — `worker/` is a separately deployed Cloudflare Worker, outside the
  three client-side fixes scoped for this session; partially mitigated in the
  interim by TP-3 raising the passcode floor.

- **Sharp edge — `vaultChangePass` strength validation lived in the UI layer.**
  The length check lived in `js/portfolio.js:962`
  (`if(n.length<6){ alert('Too short...'); return; }`, a `prompt()`-based flow),
  not in `js/vault.js`, and it never ran for `vaultChangePass` at all — only for
  the *initial* setup form at [js/vault.js:477](js/vault.js:477). Any other
  future caller of `window.vaultChangePass` (it's a global) would silently skip
  the invariant the crypto layer depends on. **Fixed this session** as part of
  TP-3: the check now lives in `js/vault.js` next to `kekFromPass`, and
  `js/portfolio.js`'s prompt flow just relays whatever error `vaultChangePass`
  throws.

- **Sharp edge — `pt_v_prf` goes stale after a cloud restore.**
  [js/vault.js:188-206](js/vault.js:188) `cloudRestore()` calls `doSetup(pass)`
  at line 204, which always generates a brand-new master key
  ([js/vault.js:77](js/vault.js:77)) and writes a fresh `pt_v_pass`, but never
  touches `pt_v_prf`. If this device already had Face ID enrolled (e.g. a second
  restore, or restoring onto a device that previously held a different vault),
  the old `pt_v_prf` still wraps the *previous* master key.
  `window.vaultFaceEnabled()` ([js/vault.js:142](js/vault.js:142)) keeps
  reporting Face ID as available, but `unlockWithFace()` will unwrap a key that
  cannot decrypt the newly-restored vault data — `loadVaultData()`'s
  `crypto.subtle.decrypt` throws a raw `OperationError` instead of falling back
  to the passcode field the way every other Face ID failure mode in
  `attemptFace()` does. **Not fixed this session** — out of the three items
  scoped. Fix is for `cloudRestore()` to `LS.removeItem('pt_v_prf')` before
  calling `doSetup`, so the device falls back to "no passkey enrolled" instead
  of a broken one.

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
- ~~**`TAB_ORDER` in `js/app.js` is hardcoded to three tabs.**~~ **RETIRED
  2026-08-15** — [js/app.js:77](js/app.js:77) is the five-tab order
  (`home, markets, portfolio, insights, following`). Verified by reading the
  line, not the note.
- ~~**Settings sheet cannot scroll.**~~ **RETIRED 2026-08-15** — measured, not
  re-read: [index.html:638](index.html:638) carries `class="sheet__body"`, and
  with the sheet open `#editSheetBody` computes `overflow-y: auto` with a
  1297px `scrollHeight` in a 519px box. It scrolls. The note described the
  markup as it was before `.sheet__body` was wired in.
- ~~`index.html` footer version drift.~~ **RETIRED 2026-08-15** — `index.html`,
  `sw.js` and `native/project.yml` all read the same version string.
- `riskStats()` silently defaults beta to 1 when the user holds no VOO — there
  is no separate benchmark-history fetch path. Real gap: beta reads as 1.00 and
  looks like a computed value rather than a fallback. Either fetch the
  benchmark series independently or surface it as unavailable.
- 1D/1W/2W chart ranges cannot paint under the baked offline demo data (1D has
  no intraday points; 1W/2W fall inside a single weekly-sample gap). Real online
  use is unaffected. Revisit if the seed snapshot is ever regenerated.

### Found in the 2026-08-15 end-to-end verification pass, reproduced but NOT fixed

- **The eleven Insights module cards cannot be opened from a keyboard.**
  [index.html:482](index.html:482)-[index.html:594](index.html:594) — every
  `<section class="card press mod">` (`#xirrModCard` … `#projModCard`) carries a
  JS `onclick` that opens its sheet, and none carries `tabindex` or a `role`.
  Verified live: `tabindex` and `role` are both `null` on all eleven. The
  `#modGrid [data-mod]` tiles that `test/a11y.spec.js` covers ARE buttons, which
  is why this never failed a test. Ten of the eleven pre-date this session.
  **Not fixed:** `#projModCard` contains a live `<input>` (the what-if field), so
  turning these into buttons or `tabindex="0"` targets needs a form-control
  escape rule and one aria decision applied to all eleven at once — a design
  call that wants its own verification pass, not the last hour of a session.
- **Section labels render with nothing underneath on an empty portfolio.**
  [index.html:591](index.html:591) — `<h2 class="section__label">Future</h2>` is
  static markup while `#projModCard` is hidden by
  [js/insights.js:1041](js/insights.js:1041) when `totals('all').value` is 0.
  Verified by emptying `state.holdings`/`state.lots`: the tab renders
  `RISK`/`INCOME & TAX`/`FUTURE` as bare headings. Pre-existing for the other
  four sections; "Future" just joins them. Cosmetic, and the honest fix is one
  rule for all five labels, not a special case for this one.
- **`#projModAsOf` does not tick.** [js/insights.js:1033](js/insights.js:1033)
  `projAsOfText()` is evaluated at render time only, so "Computed just now"
  stays on screen until the next render rather than ageing to "2 min ago".
  Needs a timer, which is a small ongoing cost for a caption; deferred rather
  than added blind.
- **The theme, privacy, currency, edit and refresh controls live only in the
  Portfolio tab's appbar** ([index.html:303](index.html:303)-
  [index.html:309](index.html:309)) — they are unreachable from Home, Markets,
  Insights and Following. Confirmed by a click that timed out on every other
  tab. Recorded as an observation, not a defect: this reads as a deliberate
  five-tab-redesign placement, and moving global chrome is the owner's call.
- **`test/i18n-coverage.spec.js` never checks whether JS-emitted strings are
  translated at all — this is bigger than a missed edge case, it is a blind
  spot in the whole checker's design.** Confirmed by reading
  `englishCandidates()` ([test/i18n-coverage.spec.js:64](test/i18n-coverage.spec.js:64)):
  its candidate list is built ONLY from existing `window.i18nDE` dictionary
  keys, plus static text scraped from `index.html`
  ([test/i18n-coverage.spec.js:34](test/i18n-coverage.spec.js:34)
  `extractStaticStrings()`) — it never parses `.js` source at all. A candidate
  can only exist if it is ALREADY a dictionary key or already sits in
  `index.html` as static markup, so a hardcoded English sentence living only
  inside a `.js` template literal, with no dictionary entry, is structurally
  invisible to it — not a coverage gap in the usual sense, but a category the
  checker was never built to see. Every "i18n-coverage: 0 leaks" this suite has
  ever reported is evidence about dictionary-registered strings and static
  HTML text ONLY; it says nothing about the JS layer. This is exactly how
  `js/app.js` `renderGoal()`'s "chance by ⟨year⟩" shipped several sessions
  reporting "0 leaks" while sitting untranslated in production (root cause: a
  `t` shadowing bug, fixed 2026-08-17 — see CHANGELOG.md's v2.6.161 entry).
  Closing this gap needs a real scan of `.js` source for template literals or
  hardcoded strings, not a rendered-DOM diff against a dictionary-derived
  candidate list; not attempted this session or the one before it.

