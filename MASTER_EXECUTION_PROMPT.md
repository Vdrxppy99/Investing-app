# MASTER EXECUTION PROMPT — Investing-app UI/UX Single-Pass Refactor

Paste the fenced block below into Claude Code from the repo root.

---

```
ROLE: Principal Frontend Architect executing a single-pass UI/UX refactor of this repository. Headless mode.

REPO: vanilla HTML/CSS/JS PWA. NO build step, NO transpiler, NO package manager, NO new dependencies.

HARD CONSTRAINTS (violating any of these fails the task):
1. ZERO-COST: do not add paid libraries, commercial charting (Highcharts/AG Grid Enterprise), or any API requiring a credit card. Native Web APIs, CSS Grid/Flexbox, and the already-vendored vendor/chart.umd.min.js only.
2. NO LOGIC CHANGES: do not alter math, state, encryption, or API code in js/core.js, js/vault.js, js/api.js, js/seed.js. Financial figures rendered must be byte-identical before and after.
3. TOKEN DISCIPLINE: css/tokens.css is the ONLY file permitted to contain a literal hex, px, or ms value. Any literal introduced elsewhere is a defect. Reuse existing tokens; add new ones to tokens.css only.
4. SERVICE WORKER: bump `V` in sw.js to 'pt-v9.2.0' as the final step. Add any new file to the CORE array.
5. Preserve the @layer order: tokens, base, components, layout.

FILES YOU MAY EDIT (exhaustive — touch nothing else):
  css/tokens.css
  css/base.css
  css/components.css
  css/layout.css
  js/insights.js       (markup strings + Chart.js options only)
  js/portfolio.js      (markup strings + Chart.js options only)
  js/i18n.js
  index.html           (font loading + head only)
  sw.js                (version bump only)
  CLAUDE.md            (status log only, final step)

EXECUTE THE FOUR PHASES IN ORDER. Do not reorder.

═══════════════════════════════════════════════════════════════════════
PHASE 1 — css/tokens.css + css/base.css : DESIGN SYSTEM FOUNDATION
═══════════════════════════════════════════════════════════════════════

1.1 Retarget the dark canvas ramp to the specified values. In the
    `:root, :root[data-theme="dark"]` block:
      --canvas:    #0f1217  ->  #0B0F17
      --surface:   #171b22  ->  #161B22
    Then re-derive the dependent gradient tokens in the DEPTH block so the
    surface gradient still resolves from the new --surface:
      --surface-grad: linear-gradient(180deg, #1A2029 0%, #161B22 100%);
    Leave --surface-2 / --surface-3 / --line / --text unchanged (they already
    clear 3:1 against the darker canvas; do not recompute them).

1.2 Add these tokens to the :root block in tokens.css (new structural
    dimensions, needed by Phases 2 and 3):
      --fab-size: var(--s-9);
      --fab-gap: var(--s-4);
      --tabbar-h: var(--s-9);
      /* Total bottom keep-out: tab bar + FAB + gaps + home indicator.
         Every fixed bottom element and every scroll container derives its
         offset from this ONE value so they can never drift apart again. */
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --bottom-clear: calc(var(--tabbar-h) + var(--fab-size) + var(--fab-gap) + var(--s-5) + var(--safe-bottom));
      --heat-cell-min: 20px;

1.3 In css/base.css, harden the numeral rendering. The `font-variant-numeric:
    tabular-nums` on body is correct but is defeated during font swap because
    Inter is fetched remotely with no metric-compatible fallback. Add,
    immediately after the existing `font-feature-settings` declaration on body:
      font-variant-numeric: tabular-nums lining;
    and add a new rule so every numeric surface re-asserts it explicitly rather
    than relying on inheritance through elements that reset font shorthand:
      .hval, .hpl, .hinfo, .mval, .table td, .table th, .gtable td, .gtable th,
      .heatmap td, .heatmap th, .hero__total, .stat__value, .row__value,
      .big-n, .sub-n, .pctpill, .prpill, .daypill, .krow > span:last-child {
        font-variant-numeric: tabular-nums lining;
        font-feature-settings: "tnum" 1, "lnum" 1;
      }

1.4 In index.html, add `&display=swap` is already present — instead append a
    metric fallback so digits do not reflow on font swap. Add to the Inter
    <link> line a preconnect pair immediately above it:
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    Do not self-host, do not add a build step.

═══════════════════════════════════════════════════════════════════════
PHASE 2 — css/components.css + css/layout.css : PRIMITIVE LAYOUTS
═══════════════════════════════════════════════════════════════════════

2.1 TABLE HEADER WORD-BREAKING (bug: "DIVIDE-NDEN", "UNREAL-ISIERT").
    ROOT CAUSE: the "NO HORIZONTAL SCROLLING" override at css/components.css
    ~line 1972-1982 applies `white-space: normal; overflow-wrap: anywhere;`
    to `.table th` while `table-layout: fixed` with `th:first-child{width:34%}`
    leaves ~22% (~69px) per remaining column. German header words are ~100px at
    --t-micro + --tr-micro letter-spacing, so `anywhere` breaks mid-word.
    FIX, in that same override block:
      - Split the `th`/`td` rule. Keep `overflow-wrap: anywhere` on `td` ONLY.
      - For `th`: use `overflow-wrap: normal; word-break: keep-all; hyphens: manual;`
      - Drop the uppercase letter-spacing pressure at narrow widths: inside
        `@media (max-width: 420px)` set `.table th, .gtable th { letter-spacing: 0; text-transform: none; font-size: var(--t-micro); }`
      - Rebalance columns so headers fit: `.table th:first-child, .gtable th:first-child { width: 28%; }`
        and let the rest auto-distribute.
      - Add `.table th, .gtable th { vertical-align: bottom; }` so a header that
        does wrap to two lines still baselines with its neighbours.

2.2 HOLDINGS ROW COLLAPSE ("Positionen" list, .hrow).
    ROOT CAUSE: `.hinfo` (css/components.css ~1056) is `white-space: nowrap`
    with NO `overflow: hidden`, so the price + delta + share-count line escapes
    its `.hmid` box and paints across `.hspark` and `.hright`. German strings
    are longer, which is why it surfaces there first.
    FIX:
      - `.hinfo { overflow: hidden; text-overflow: ellipsis; min-width: 0; }`
      - Convert `.hrow` from flex to an explicit grid so columns can never
        negotiate themselves into overlap:
          .hrow { display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; column-gap: var(--s-3); }
        Keep `position: relative`, `min-height`, padding, border and the
        `.wbar` absolute child exactly as they are.
      - `.hmid { min-width: 0; }` (grid track already handles the flex basis)
      - `.hright { justify-self: end; text-align: right; max-width: none; }`
        (remove the `max-width: 45%` at ~line 1799 — with a grid track it is
        the cause of the squeeze, not the cure)
      - Keep the existing `@media (max-width: 400px) { .hspark { display: none } }`
        and add `@media (max-width: 400px) { .hrow { grid-template-columns: auto minmax(0,1fr) auto; } }`

2.3 FLOATING ACTION BUTTON OVERLAP.
    ROOT CAUSE: `.fab` (components.css ~870) occupies
    56px + calc(--s-9 + inset + --s-4) = up to ~128px above the viewport
    bottom, while `.wrap` (layout.css ~24) only reserves
    calc(--s-9 + --s-8 + inset) = ~96px. A ~32px band of the last card and of
    every chart's x-axis sits underneath it.
    FIX:
      - layout.css `.wrap`: `padding-bottom: var(--bottom-clear);`
      - components.css `.fab`: `bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--fab-gap));`
      - components.css `.aipanel`: `inset: auto var(--s-5) calc(var(--tabbar-h) + var(--safe-bottom) + var(--fab-gap)) var(--s-5);`
      - components.css line ~1473 (`.toast`/anchored element with the same
        hardcoded arithmetic) and line ~873: replace both with the same
        `calc(var(--tabbar-h) + var(--safe-bottom) + var(--fab-gap))` expression.
      - Every remaining `calc(var(--s-9) + env(safe-area-inset-bottom) + ...)`
        in components.css must be rewritten to derive from --tabbar-h and
        --safe-bottom. Grep for `--s-9) + env(safe-area-inset-bottom` and
        convert all of them.

2.4 SAFE-AREA INSETS.
      - layout.css `.shell`: add `padding-bottom: var(--safe-bottom);`
      - components.css `.sheet`: `padding-bottom: max(var(--s-3), var(--safe-bottom));`
        (replace the bare `padding-bottom: env(safe-area-inset-bottom)` at ~320)
      - Replace every remaining bare `env(safe-area-inset-bottom)` with
        `var(--safe-bottom)` so the 0px fallback applies uniformly on desktop.

═══════════════════════════════════════════════════════════════════════
PHASE 3 — MACRO VIEWS: HEATMAP + LOCALIZATION
═══════════════════════════════════════════════════════════════════════

3.1 MONTHLY RETURNS HEATMAP COMPRESSION ("Monatliche Renditen").
    ROOT CAUSE — this is a CLASS NAME COLLISION, not a sizing bug.
    js/insights.js line ~624 renders `<table class="hm">`. The selector
    `.hm, .hmet, .mname, .msub, .sub-n` at css/components.css ~1068 is the
    holding-row META TEXT rule and applies
    `overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
     font-size: var(--t-caption)` to the entire heatmap table. There is no
    dedicated heatmap CSS anywhere in the codebase.
    FIX:
      a) In js/insights.js `renderHeatmap()`, rename the class:
         `<table class="hm">` -> `<table class="heatmap">`
         Wrap the output in `<div class="heatmap-wrap">…</div>`.
         Wrap the header row in `<thead>` and the year rows in `<tbody>`.
         Add `scope="col"` to month headers and `scope="row"` to `.y` cells.
         Change nothing about the return math, the `cvar()` colour calls, or
         the inline background rgba() — those stay exactly as written.
      b) Add a new component block to css/components.css:
         .heatmap-wrap { width: 100%; }
         .heatmap {
           width: 100%;
           table-layout: fixed;
           border-collapse: separate;
           border-spacing: var(--s-1);
           font-variant-numeric: tabular-nums lining;
         }
         .heatmap th {
           font-size: var(--t-micro);
           line-height: var(--lh-micro);
           font-weight: var(--w-semibold);
           color: var(--text-faint);
           text-align: center;
           padding: 0;
           letter-spacing: 0;
           text-transform: none;
         }
         .heatmap td {
           height: var(--heat-cell-min);
           min-width: var(--heat-cell-min);
           padding: var(--s-1) 0;
           border-radius: var(--r-input);
           font-size: var(--t-micro);
           line-height: var(--lh-micro);
           text-align: center;
           color: var(--text);
           white-space: nowrap;
           overflow: visible;
         }
         .heatmap td.y {
           color: var(--text-faint);
           font-weight: var(--w-semibold);
           text-align: left;
         }
         .heatmap th:first-child, .heatmap td:first-child { width: 12%; }
         .heatmap th:last-child,  .heatmap td:last-child  { width: 10%; }
      c) 14 columns cannot show a signed decimal on a 390px viewport. Add:
         @media (max-width: 480px) {
           .heatmap { border-spacing: 1px; }
           .heatmap td { font-size: var(--t-micro); letter-spacing: -0.02em; }
         }
         and in renderHeatmap(), render `ret[k].toFixed(0)` instead of
         `.toFixed(1)` when `window.matchMedia('(max-width: 480px)').matches`.
         Keep the year column at `.toFixed(1)`.
      d) Do NOT reintroduce horizontal scrolling. The owner's standing rule is
         that everything fits the width.

3.2 MIXED GERMAN / ENGLISH STRINGS.
    ROOT CAUSE — two defects in js/i18n.js `translateStr()`:
      (i)  `if (/\d/.test(trimmed)) return null;` silently refuses to translate
           ANY string containing a digit. Every coach item body, every stat
           caption and every table figure label contains a number, so they all
           stay English while their dictionary-matched titles turn German.
           This is why "Ausgezeichnet" (i18n.js:145) and "Nächste Schritte"
           (i18n.js:125) sit above "Know your risk" (js/insights.js:703).
      (ii) Only whole-string exact matches are attempted, so interpolated
           bodies can never match a key.
    FIX — do NOT remove the digit guard wholesale (it exists to protect
    currency and ticker rendering, and removing it will corrupt figures).
    Instead:
      a) Replace the guard with a targeted one that protects only strings that
         are PREDOMINANTLY numeric:
           const NUMERIC_ONLY = /^[\s\d.,%+\-–—$€£/·:()]*$/;
           if (!trimmed || trimmed.length > 220 || NUMERIC_ONLY.test(trimmed)) return null;
      b) Add a second, PATTERN pass that runs only when the exact-match pass
         misses. Define `const DE_PATTERNS = [ [regex, replacement], ... ]`
         where every regex uses capture groups for the numeric parts and the
         replacement re-inserts them verbatim ($1, $2 …). Populate it for the
         coach-item bodies actually emitted by js/insights.js `coachItems()` —
         read that function and cover every `title`, `detail`, `t` and `b`
         string it produces. Numbers, currency symbols, percentages and tickers
         must pass through the capture groups untouched.
      c) Add the missing plain keys to the DE dictionary for every hardcoded
         English string in js/insights.js `coachItems()` and js/portfolio.js
         holding/empty-state markup, including at minimum:
           "Know your risk", "Deploy idle cash", "Put idle cash to work",
           "Feed the laggard", "Rebalance with new money", "Trim a big bet",
           "No holdings yet", "Open settings", "Asset", "Owned",
           "Dividends", "Unrealized", "Total", "Period", "You", "Yr"
      d) Shorten the German table headers so they cannot force a break at any
         viewport width (this is the localization half of fix 2.1):
           "Dividends": "Divid."   -> NO. Use "Dividende" (singular, 9 chars).
           "Unrealized": "Nicht real."   (with a real period, 11 chars)
         Add both to the dictionary. Do not use soft hyphens.
      e) CLAUDE.md claims Spanish (ES) support. There is NO Spanish dictionary
         in js/i18n.js — only DE. Do NOT build one in this pass. Instead correct
         the claim in CLAUDE.md in Phase 4.

═══════════════════════════════════════════════════════════════════════
PHASE 4 — JS STATE & CHARTING
═══════════════════════════════════════════════════════════════════════

4.1 Curve smoothing. Tension values currently drift across three files
    (.28 in js/portfolio.js:547-548, .25 in js/insights.js:109/185/656,
    .15 in js/insights.js:770/772/773). Standardise:
      - Portfolio hero + benchmark (portfolio.js 547, 548): `tension: 0.35`
      - All insights time-series (insights.js 109, 185, 656): `tension: 0.35`
      - Projection scenario lines (insights.js 770, 772, 773): `tension: 0.2`
        (these are modelled, not observed — a flatter curve signals that)
    Add `cubicInterpolationMode: 'monotone'` to every line dataset listed
    above. Monotone prevents the bezier from overshooting below a local
    minimum, which on a portfolio chart draws a loss that never happened.
    This is a correctness fix, not a cosmetic one.

4.2 Tooltips. Every Chart.js `tooltip` config in js/insights.js and
    js/portfolio.js must carry the same object. Extract it once as a
    module-level const in js/portfolio.js (loaded before insights.js) named
    `CHART_TOOLTIP` and reference it from every chart:
      const CHART_TOOLTIP = { backgroundColor: cvar('--card2'), borderColor: cvar('--line'),
        borderWidth: 1, titleColor: cvar('--mut'), bodyColor: cvar('--tx'),
        displayColors: false, padding: 10, cornerRadius: 8, caretSize: 5,
        titleFont: { weight: 600 }, bodyFont: { weight: 500 } };
    Per-chart `callbacks` stay per-chart — spread the shared object and add
    callbacks locally: `tooltip: { ...CHART_TOOLTIP, callbacks: { … } }`.
    Do not change any callback body. Do not change any dataset data.

4.3 Verify no state mutation occurred. `git diff` must show ZERO changes to
    js/core.js, js/vault.js, js/api.js, js/seed.js, js/app.js.

═══════════════════════════════════════════════════════════════════════
FINAL STEPS
═══════════════════════════════════════════════════════════════════════
F1. sw.js: set `const V = 'pt-v9.2.0';`. Confirm CORE lists every css/ and js/
    file that exists on disk (compare against `ls css/ js/`). js/demo.js and
    js/i18n.js must be present.
F2. CLAUDE.md: update "Latest Version" to v9.2.0, append a Dual Assistant Sync
    Log entry dated 2026-07-30 summarising the four phases in one line each,
    correct the stale "css/app.css" reference to the four-file layered
    stylesheet, and correct the false Spanish (ES) support claim to "EN/DE".
F3. Self-check before finishing:
      grep -rn "env(safe-area-inset-bottom" css/   # must all be inside tokens.css
      grep -rn "class=\"hm\"" js/                  # must return nothing
      grep -rn "#0f1217\|#171b22" css/             # must return nothing
      grep -rnE "[0-9]+px" css/components.css css/layout.css css/base.css
        # every hit must be a pre-existing exception; introduce no new ones

TOKEN OPTIMIZATION DIRECTIVE: You are running in a headless execution environment. Do not output conversational filler, explanations, or summaries. Output only the exact file modifications, diffs, or commands required to complete this refactor in a single run.
```
