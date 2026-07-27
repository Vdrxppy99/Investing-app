# Investing App — Front-End Overhaul Prompt

> **How to use this (Isaac, read this bit — the rest is for the AI):**
> Paste this whole file into Claude Code as your first message in a fresh session, from inside
> the `Investing-app` folder. It has 9 phases (0–8) with hard STOP gates. Claude will stop and wait
> for you at the end of each phase — reply `approved, continue` (or give notes) to move on.
> **Phase 2 is the important gate:** you'll see a component gallery there and can judge the new
> look *before* any real screen is touched. If it doesn't look like a real app at that point,
> reject it there rather than after 6 more phases of work.
> **Phase 3 is the Face ID change** — opening straight into Face ID instead of the passcode field.
> Test that one on your actual phone through the `native/` wrapper, not just in the browser.
> Start a new session for each phase if the context gets long; each phase re-states what it needs.

---

## 0. THE BRIEF

You are redesigning the front end of an existing, working personal investing PWA
(`index.html`, `css/app.css`, `js/*.js`, wrapped in a `WKWebView` iOS shell under `native/`).

**The functionality is finished and correct. The visual design is not.** The app currently reads
as an unfinished prototype. The owner wants it to look and feel like a shipped, App-Store-quality
brokerage app — the register of Vanguard, Empower, Fidelity, Schwab — not like a hobby project.

**This is a replacement, not an improvement.** A previous attempt at "fix the UI" produced
incremental tweaks to the existing stylesheet, which is exactly the failure mode to avoid. The
existing visual language is not a foundation to build on. It is being deleted and replaced with a
designed system. If at the end of this work someone can look at a screenshot and recognise the old
app, you have failed.

### Why it currently reads as a prototype — the actual diagnosis

Do not skip this. These are the specific defects, verified in the source. Your redesign must
eliminate every one of them, and Phase 0 will make you prove you understand them.

1. **The stylesheet is archaeology, not a system.** `css/app.css` is 624 lines of accreted patches
   with version-stamped sections in the comments — `v5`, `/* v6 finish */`, `/* v9.3 polish */`,
   `/* v9.4 */`, `/* v3.1 */`, `/* v3.2 */`. Later sections override earlier ones. Selectors are
   declared twice (`.hdr-actions button:hover` appears twice with different properties;
   `#miniBar{cursor:pointer}` appears twice). Every "UI improvement" has been another layer on top.
   There is no single source of truth for any value.

2. **The brand colour and the profit colour are literally the same value.** `--brand:#26d07c` and
   `--green:#26d07c`. Emerald is the app chrome *and* the gain indicator *and* the accent *and* the
   focus ring *and* the tab-bar active state *and* the progress fills. The result is that nothing
   reads as meaningful, because everything is the same green. On a near-black background with a
   radial green glow behind the body, this lands as "crypto tracker," not "brokerage."

3. **There is no type scale.** Font sizes in use include 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13,
   13.5, 14, 14.5, 15, 15.5, 16, 16.5, 19, 21, 22, 24, 26, 28px. Half-pixel sizes are being used to
   nudge individual elements. A designed product has 6–8 type steps and never deviates.

4. **Radius and spacing tokens exist but are ignored.** `--r-xl/-lg/-md/-sm` are defined, then
   overridden inline all over the file with hardcoded 7, 8, 9, 10, 11, 12, 13, 14, 19px. Spacing
   uses 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 26px arbitrarily.

5. **Inline styles in the markup.** `index.html` carries dozens, including full rule sets like
   `style="border:1px solid var(--brand);border-radius:14px;padding:14px;margin-bottom:16px;..."`.
   This is the single loudest "unfinished" signal in the entire codebase.

6. **Emoji are being used as interface iconography.** `💬` for the assistant FAB, `☁️` on the restore
   button, `👀` on the demo link, `➤` as the send button, `✕` as close, `☆` as watchlist,
   `⚙︎` in body copy, `▲`/`▼` injected via `::before` on the day pill. These sit next to hand-rolled
   SVG paths, so the iconography is visibly inconsistent. No shipped finance app does this.

7. **Every box has the same weight.** `.card`, `.icard`, `.stat`, `.chip`, `.buybox`, `.searchbar`,
   `.idx-card` are all `1px solid var(--line)` + a radius + the same shadow. When everything is a
   bordered card, nothing is prioritised, and the screen reads as a debug dump of available data.

8. **Elevation is physically invisible.** `--shadow-lift:0 2px 5px rgba(0,0,0,.3), 0 18px 44px
   rgba(0,0,0,.42)` is applied over a `#0b0f0d` background. Black shadows on near-black do nothing.
   The app is paying for shadows it cannot render.

9. **Decoration is standing in for design.** A full-screen SVG noise/grain overlay at 0.028 opacity,
   a radial brand glow behind `body`, `nth-child`-staggered entrance animations on every page child,
   and backdrop-blur glassmorphism on the tab bar and mini bar. These are the moves people make when
   the underlying layout isn't working. Serious finance UIs are restrained; the data is the interest.

10. **There is no layout system.** `.wrap{max-width:600px}` and nothing else. On a laptop the app is
    a phone-width column stranded in the middle of an empty page. The Insights page is a
    two-column grid of ~20 stacked cards in one endless scroll with no grouping or disclosure.

11. **Native-feel bugs.** Multiple text inputs are set below 16px (`.etable input` 13px,
    `.buyrow input` 13px, `.tgtplan input` 13.5px), which makes iOS Safari zoom the viewport on
    focus — an instant tell that this is a web page in a wrapper, not an app.

12. **Copy is written in developer voice.** "Chart history is rebuilt from your actual Vanguard
    purchase lots", "👀 View the example portfolio — no login", "DEMO · example data · tap to exit".
    Shipped products write terse product copy.

### The reference for what "finished" looks like

The owner has a second app (a German-learning PWA, `WORT`) whose UI he considers finished and
real. **The thing that makes it read as finished is not its colours — it is that it has a written
design system and obeys it.** Specifically, and this is what you are being asked to reproduce
*structurally* for the investing app:

- A `DESIGN.md` with a named token table — type scale with size/line-height/weight per step, a
  colour table with a role per token, a radius scale, a spacing scale — and the CSS implements
  exactly those tokens and nothing else.
- **One signature interaction, applied everywhere.** In `WORT` it is a solid 4px bottom edge that
  collapses on `:active` with a 4px translate — a physical press, deliberately not a blur shadow.
  Every raised control has it. Your app needs its own equivalent and must apply it with the same
  discipline.
- **A real component layer.** Buttons are 5 named variants × 3 named sizes, enumerated in one
  place. Nothing anywhere is styled ad hoc.
- **A single real icon set** (Lucide), used exclusively. No emoji in chrome.
- **A named motion vocabulary with fixed durations** (200ms screen, 250ms slide, 300ms sheet,
  400ms shake), every one of them disabled under `prefers-reduced-motion`.
- **A stated accessibility floor**, with contrast ratios computed and recorded, not assumed.
- **A real responsive strategy** — the bottom nav becomes a left sidebar at `lg`, explicitly so the
  app "stops looking like a phone screenshot pasted onto white."
- **Comments that record why**, e.g. why a permanent label under every node was removed.

Read `WORT/DESIGN.md` §8 and `WORT/src/app/globals.css` if they are accessible. Copy the *rigour*,
not the palette — that app is deliberately playful and green; this one must not be.

---

## 1. HARD RULES

**Do:**

- Delete `css/app.css` outright at the start of Phase 2 and build the new system from an empty file.
  Do not edit it, do not append to it, do not keep it around as a fallback. Git has it if needed.
- Put every value in a token. If a hex code, a px size, or a duration appears anywhere outside the
  token file, it is a bug.
- Strip **every** inline `style=` attribute from `index.html` and from every HTML string built in
  the JS. Zero remaining. This is checkable and will be checked in Phase 8.
- Write comments that explain *why* a decision was made, not what the code does.
- Keep it free forever: no paid fonts, no paid icon libraries, no paid APIs, no new services.
  Inter (SIL OFL) and Lucide (ISC) are both free — both are fine.
- Keep the no-build-step architecture. Plain HTML, plain CSS, plain JS, service worker unchanged.
  Do not introduce npm, Tailwind, Vite, React or a bundler into the web app.
- Test in both themes and at 375px, 768px, 1280px and 1600px wide after every phase.

**Never:**

- Never "improve" or "polish" the existing look. It is being replaced.
- Never add a comment section stamped with a version number. That habit is what produced the
  current mess. One coherent stylesheet, no strata.
- Never use emoji as an interface icon.
- Never use the gain/loss colours for anything that is not a number, a delta, or a data mark.
  No green buttons, no green nav, no green focus rings, no green borders.
- Never add a noise overlay, a background glow, a staggered per-child entrance animation, or
  glassmorphism as a substitute for hierarchy.
- Never let an input drop below 16px font-size.
- Never introduce a hover-only affordance — every action must be reachable and discoverable on touch.
- Never change a number the app displays. See the preservation contract.

---

## 2. PRESERVATION CONTRACT

The owner likes everything about this app except how it looks. Breaking behaviour is worse than
shipping an ugly app.

**Frozen — do not modify the logic in:**

- `js/portfolio.js` (1,015 lines) — holdings, lots, totals, allocation, goal
- `js/insights.js` (826 lines) — performance, drawdown, risk, projections, tax, health score
- `js/api.js` (410 lines) — Yahoo feed, quotes, caching
- `js/vault.js` (313 lines) — passcode, encryption, Face ID, backup/restore
- `js/core.js`, `js/sheets.js`, `js/explore.js`, `js/app.js`, `js/seed.js`, `js/demo.js`, `js/boot.js`
- `worker/**` — the Cloudflare worker. Out of scope entirely.
- `sw.js`, `manifest.webmanifest`, `native/**` — touch only if a redesign change strictly requires
  it (e.g. a new `theme-color`), and say so explicitly when you do.

**What you may change inside those JS files:** the HTML strings they build, the class names they
emit, the DOM structure they render, and the order in which they render it. You may extract render
helpers into a new file (e.g. `js/ui.js`) to hold the component builders.

**What you may not change:** any arithmetic, any date handling, any API call, any storage key, any
crypto path, any data shape, any rounding, any formatting of a currency or percentage value.

**The one carve-out:** Phase 3 changes the *unlock flow* in `js/vault.js` — which screen appears
first, what gets invoked automatically, and what the fallbacks are. The **cryptography is still
frozen**: `kekFromPass`, `kekFromPrf`, `wrapMK`, `unwrapMK`, `saveVaultNow`, `loadVaultData`,
`doSetup`, PBKDF2 iterations, HKDF parameters, the PRF salt handling, and the storage keys
(`pt_v_pass`, `pt_v_prf`, `pt_vault_data`) are all untouchable. You are rewiring which door opens
first, not the locks.

**Verification requirement:** before Phase 4, capture the rendered text of every number on all
three pages in demo mode into `redesign/baseline-numbers.txt`. In Phase 8, capture it again and
diff. The diff must be empty apart from intentional copy changes. If a number moved, you broke
something.

---

## 3. THE TARGET DESIGN LANGUAGE

This is the starting specification. Phase 1 turns it into a full `DESIGN.md`; you may refine
details there with justification, but the decisions below are settled and are not up for
re-litigation.

### 3.1 Colour — a real primary and secondary

The owner's instruction: *"I want the app to have a primary and secondary colour like every real
app — the way Vanguard is red and white. I prefer dark, so dark is the default, with light
available."*

So: **dark theme is the default and the design target. Light is a first-class, separately designed
theme — not an inversion.** And critically, **the brand colours and the P&L colours are now
different things**, which fixes defect #2.

| Role | Token | Dark (default) | Light | Used for |
|---|---|---|---|---|
| **Primary — brand & interaction** | `--primary` | `#4C82F7` | `#1F5FE0` | active nav, links, selected segment, focus ring, the main chart series, primary icons |
| Primary fill (buttons) | `--primary-fill` | `#2B5FD9` | `#1F5FE0` | filled button faces; white text sits on this |
| Primary edge | `--primary-edge` | `#1E48A8` | `#17499E` | the signature pressed edge, §3.4 |
| Primary tint | `--primary-tint` | `rgba(76,130,247,.14)` | `rgba(31,95,224,.10)` | selected pill backgrounds, chart area fill |
| **Secondary — attention & milestones** | `--secondary` | `#E0AE4A` | `#8A6110` | goals, streaks, targets off-track, "needs action", warnings |
| Secondary tint | `--secondary-tint` | `rgba(224,174,74,.14)` | `rgba(138,97,16,.10)` | warning banners, goal ring track highlight |
| **Gain — numbers only** | `--gain` | `#2FBE7A` | `#0A7F58` | positive deltas, up sparklines, positive chart segments |
| **Loss — numbers only** | `--loss` | `#F26B75` | `#D02D40` | negative deltas, down sparklines |

Warning state deliberately shares the secondary token rather than introducing a fourth hue — one
fewer colour to justify, and brass is the conventional caution colour in finance UIs.

Neutrals (these carry the whole app; get them right and the accents barely need to work):

| Token | Dark | Light |
|---|---|---|
| `--canvas` (app background) | `#0F1217` | `#F6F7F9` |
| `--surface` (cards) | `#171B22` | `#FFFFFF` |
| `--surface-2` (nested, inputs, tracks) | `#1F242D` | `#F1F3F6` |
| `--surface-3` (pressed, hover) | `#262C36` | `#E9ECF1` |
| `--line` | `#2A313C` | `#E2E6EC` |
| `--line-strong` | `#3A424F` | `#CBD2DC` |
| `--text` | `#EDF0F5` | `#10151D` |
| `--text-muted` | `#9BA5B4` | `#566072` |
| `--text-faint` | `#858F9E` | `#6B7280` |

Note the dark neutrals are **blue-black, not green-black** (`#0F1217`, not `#0b0f0d` with a green
cast). That change alone moves the app out of the crypto-tracker register.

**Rules:**

- Exactly two brand hues. If a third accent hue appears anywhere, delete it.
- `--gain` / `--loss` may colour **text, sparklines, chart marks and small delta pills only**. They
  may never fill a button, a nav item, a card, a border, a focus ring, or a progress bar that isn't
  representing P&L.
- Category colours for the allocation donut and sector bars come from **one defined 8-step
  categorical ramp** declared in the token file — not from ad-hoc hexes in the JS, and not from
  hue-shifted brand green. The ramp must be distinguishable in both themes and must not include a
  hue that reads as gain or loss.
- Every text/background pair must meet **WCAG AA (4.5:1 body, 3:1 for ≥19px and for UI boundaries)**.
  Do not eyeball this — write `redesign/contrast-check.mjs`, run it over every declared pair in both
  themes, and paste the table into `DESIGN.md`. Fix anything that fails before proceeding.

### 3.2 Type

Inter is already loaded and is the right choice — keep it, load only weights 400/500/600/700/800.

Exactly seven steps. No other size may appear in the CSS. No half-pixel sizes, ever.

| Step | Size / line-height | Weight | Use |
|---|---|---|---|
| `display` | 34 / 38 | 800, `-0.03em` | the portfolio total |
| `title` | 24 / 30 | 700, `-0.02em` | page titles |
| `heading` | 19 / 24 | 700, `-0.01em` | section headings |
| `body` | 15 / 22 | 500 | default copy, list rows |
| `label` | 14 / 18 | 600 | buttons, values, table cells |
| `caption` | 12 / 16 | 500 | secondary metadata |
| `micro` | 11 / 14 | 700, `+0.08em`, uppercase | eyebrow labels only |

`font-variant-numeric: tabular-nums` on every element that renders a number — this is
non-negotiable in a finance app, and it must be a base rule, not sprinkled per-selector.

The hero total gets one bespoke treatment: `clamp(38px, 10vw, 48px)`, weight 800, `-0.035em`.
That is the only exception permitted to the scale.

### 3.3 Space, radius, elevation

- **Spacing scale:** `4, 8, 12, 16, 20, 24, 32, 40, 56`. Nothing else. Screen gutter is 20.
- **Radius scale:** `8` (inputs, chips) · `12` (buttons, tiles) · `16` (cards) · `24` (sheets) ·
  `999` (pills). Five values. Nothing else.
- **Elevation — 4 levels, and in dark mode elevation is expressed by surface lightness, not shadow.**
  This is the fix for defect #8. A `0 18px 44px rgba(0,0,0,.42)` shadow over `#0F1217` renders
  nothing. In dark: level 0 = `--canvas`, level 1 = `--surface`, level 2 = `--surface-2` + 1px
  `--line`, level 3 (sheets, the tab bar, toasts) = `--surface-2` + `--line-strong` + a genuine
  ambient shadow that is visible because it also carries a subtle top inner highlight. In light,
  the same four levels are expressed with real shadows.

### 3.4 The signature interaction

Pick one and apply it to every interactive surface without exception. The recommended choice,
because it suits a finance app better than the playful bottom-edge press:

**A 1-frame press with a colour-shift underlay.** On `:active`, the control scales to `0.97` over
90ms with `transform-origin` centre, and its background steps one surface level darker
(`--surface` → `--surface-2`). No transition on the *down* stroke — it must land within one frame —
and a 140ms ease-out on release. Filled buttons instead drop their `--primary-edge` 2px bottom
border to 0 and translate down 2px, so the primary CTA has a physicality nothing else has.

Whatever you choose: name it in `DESIGN.md`, implement it once as a utility class, and apply it to
buttons, list rows, chips, tiles, segments, nav items and cards that navigate. Consistency here is
most of what "feels like a real app" actually means.

### 3.5 Iconography

- One set: **Lucide** (ISC licensed, free). Inline the needed glyphs as a single `<symbol>` sprite
  in `index.html`, referenced with `<svg><use href="#i-refresh"/></svg>`. No CDN, no build step, no
  runtime fetch — this must work offline in the service worker cache.
- 24px grid, 1.75px stroke, `round` caps and joins, `currentColor`.
- Every icon-only control carries an `aria-label`.
- Zero emoji anywhere in the interface chrome. Emoji may survive only inside user-authored content,
  of which there is currently none.

### 3.6 Layout & responsive

This fixes defect #10 and is the difference between "web page" and "app."

- **≤ 600px** — single column, 20px gutter, bottom tab bar.
- **601–1023px** — single column, max 640px, centred, 32px gutters, bottom tab bar.
- **≥ 1024px** — **app shell**: a persistent 240px left navigation rail replaces the bottom tab bar,
  content area max 1080px. The Insights grid goes 3-up. The Portfolio page splits: chart + holdings
  in the main column, allocation + goal + dividends in a 320px right column.
- **≥ 1440px** — content max 1200px, right column 360px.

The phone-column-on-a-desktop look must be gone.

### 3.7 Density and hierarchy

Each screen must state, in `DESIGN.md`, its information hierarchy: **one hero, one primary object,
then everything else earns its place or moves behind disclosure.**

- **Portfolio:** hero total + day change → chart → holdings list. Allocation, goal, dividends and
  movers move into the desktop side column and into collapsed/secondary treatments on mobile.
- **Explore:** search is the hero and belongs at the top, always visible. Indices and sectors are
  horizontal rails. Screener lists (Most Active / Gainers / Losers) become **one card with a
  segmented control**, not three stacked cards.
- **Insights:** currently ~20 cards in one scroll. Restructure into 4 labelled groups with the group
  summary visible and the detail behind a tap. A brokerage app shows you a health score and three
  numbers; it does not show you every metric it can compute, all at once, forever.

### 3.8 Charts

- Strip Chart.js defaults completely; configure everything explicitly.
- Grid: horizontal only, `--line` at 40% opacity, no vertical gridlines, no axis borders.
- Main series: 1.75px `--primary`, no point markers, area fill from `--primary-tint` to transparent.
- Benchmark comparison: 1.5px dashed `--text-faint`. Never a second bright hue.
- Gain/loss colouring applies to the *delta readout and the sparkline*, not to the main line.
- Crosshair scrub: a 1px `--line-strong` vertical rule, a filled dot on the series, and a readout
  that updates above the chart. No tooltip bubbles.
- Sparklines: 1.5px, no fill, no axis, coloured by period direction.
- Donut: 12px ring, 4px gaps, categorical ramp from §3.1, centre shows the total.
- Every chart needs a designed **empty**, **loading** (skeleton, not a spinner) and **error** state.

### 3.9 Motion

Four durations, and no others: `120ms` micro-interaction · `200ms` enter/exit ·
`280ms` sheet, `cubic-bezier(.32,.72,.28,1)` · `400ms` data transitions (bar/ring/chart fills).

One page transition, applied to the page container as a whole — an 8px rise and fade over 200ms.
The current per-child `nth-child` stagger is deleted. All motion disabled under
`prefers-reduced-motion: reduce`.

### 3.10 Native feel

The app runs in a `WKWebView`. It must not feel like a website.

- Safe-area insets respected on all four edges, including landscape.
- `touch-action: manipulation` on all controls; no double-tap zoom.
- `user-select: none` on chrome, `user-select: text` restored on numbers and names.
- `overscroll-behavior: none` on `body`, `contain` on internal scrollers.
- **All inputs ≥16px** so iOS never zooms on focus. This is currently broken in three places.
- `:active` feedback within one frame. No `transition-delay` on the press.
- Sheets support drag-to-dismiss with a velocity threshold and rubber-banding at the top.
- Scroll position preserved per tab when switching tabs and returning.
- Skeletons on first paint, never a bare spinner on a blank screen.
- `theme-color` meta updated on theme switch so the status bar matches.

### 3.11 Copy

Terse, product voice, sentence case. No exclamation marks, no emoji, no explanations of
implementation. Rewrite the footers, the demo badge, the lock-screen copy, the empty states and the
disclaimers. "Not financial advice" stays — it's short and it should. "Chart history is rebuilt
from your actual Vanguard purchase lots" becomes "Built from your purchase history" or moves into
an info sheet.

---

## 4. THE PHASES

Complete them in order. **At the end of each phase, stop and wait for approval.** Do not begin the
next phase in the same turn. Each phase ends with a written report of what changed and what the
owner should look at.

---

### PHASE 0 — Audit *(read-only, no code changes)*

**Goal:** prove you understand the current app before touching it, and build the baseline that
Phase 8 checks against.

1. Read `index.html`, `css/app.css`, and every file in `js/`. Read `README.md` and `CHANGELOG.md`.
2. Run the app locally (`python3 -m http.server`) and enter demo mode. Screenshot all three tabs in
   both themes at 375px and 1280px — 12 screenshots — into `redesign/before/`.
3. Produce `redesign/AUDIT.md` containing:
   - A component inventory: every distinct UI element across the app, where it's defined, and which
     screens use it.
   - A value census: every distinct font-size, colour, radius, spacing value and shadow currently in
     use, with a count of occurrences. This is the evidence for how unsystematic it is.
   - A list of every inline `style=` attribute in `index.html` and every inline style emitted from
     the JS, with file and line.
   - A list of every emoji used as an interface icon, with location.
   - Confirmation of the defects listed in §0 — and any additional ones you find.
4. Produce `redesign/baseline-numbers.txt`: the rendered text of every numeric value on all three
   pages in demo mode. Script it; don't transcribe by hand.

**Deliverable:** `redesign/AUDIT.md`, `redesign/before/*.png`, `redesign/baseline-numbers.txt`.
**Changed in the app:** nothing.

**STOP. Report and wait for approval.**

---

### PHASE 1 — The design system, written down *(documentation only, no app code)*

**Goal:** the specification, agreed before any pixel moves. This is the artifact the current app is
missing and the reason previous UI attempts drifted.

Write `DESIGN.md` at the repo root, modelled on the rigour of `WORT/DESIGN.md`. It must contain:

1. **Positioning** — one paragraph. What this app is, whose it is, what register it belongs to
   (personal brokerage, calm, dense, trustworthy), and what it explicitly is not.
2. **Colour** — the full table from §3.1, both themes, every token with its role stated, plus the
   8-step categorical ramp. Include the computed contrast table from `redesign/contrast-check.mjs`
   with actual ratios. Any failing pair must be fixed here, not deferred.
3. **Type** — the seven-step table from §3.2, with the rules on tabular numerals.
4. **Space, radius, elevation** — §3.3, including the dark-mode-elevation-is-lightness rationale.
5. **The signature interaction** — §3.4, named, with its exact implementation.
6. **Component specification** — for each of: button (variants × sizes × states), icon button,
   segmented control, chip/pill, list row, card, stat tile, input, search field, sheet, modal,
   toast, tab bar / nav rail, progress bar, ring, skeleton, empty state, error state, banner,
   badge/logo tile, chart container, table. For each: anatomy, sizes, every state
   (default/hover/active/focus/disabled/loading/selected), and both themes.
7. **Layout** — §3.6 breakpoints with an ASCII diagram of the desktop app shell.
8. **Screen specifications** — for Portfolio, Explore, Insights, the lock screen, and the sheet
   family: the information hierarchy, what's promoted, what's demoted, what moves behind disclosure.
9. **Data visualisation rules** — §3.8.
10. **Motion** — §3.9, the four durations, what uses which.
11. **Native-feel checklist** — §3.10, as a checklist Phase 7 can tick off.
12. **Voice & copy rules** — §3.11, with a before/after table for the worst offenders.
13. **Accessibility floor** — AA contrast (proven), 44px minimum targets, visible focus, full
    keyboard operation, `aria-live` for price updates, reduced-motion support.

Then produce `redesign/DIRECTION.md`: for each of the three main screens, an ASCII wireframe of the
new layout at mobile and desktop, so the owner can see the structural change before it's built.

**Deliverable:** `DESIGN.md`, `redesign/DIRECTION.md`, `redesign/contrast-check.mjs`.
**Changed in the app:** nothing.

**STOP. Report and wait for approval. Do not write app CSS until this spec is approved.**

---

### PHASE 2 — Foundation: tokens, primitives, and a component gallery

**Goal:** build the new design system as real code and let the owner judge it *before* any screen
is rebuilt. This is the decisive gate.

1. **Delete `css/app.css`.** Not archive it, not comment it out — delete it. Git has the history.
2. Build a new, layered stylesheet architecture:
   - `css/tokens.css` — `@layer tokens`. Every colour, size, radius, space, duration, shadow, both
     themes. The only place a literal value may appear in the entire codebase.
   - `css/base.css` — `@layer base`. Reset, typography defaults, tabular numerals, focus-visible,
     scroll and overscroll behaviour, safe areas, reduced-motion.
   - `css/components.css` — `@layer components`. Every component from `DESIGN.md` §6, in the order
     they are documented, each with a comment block naming it and stating its states.
   - `css/layout.css` — `@layer layout`. The app shell, breakpoints, grids, the nav rail.
   Load in that order. Use real `@layer` so specificity is structural rather than a race.
3. Build the Lucide `<symbol>` sprite and inline it in `index.html`. Delete every emoji icon.
4. Build `js/ui.js` — small functions that return the HTML for each component
   (`uiButton()`, `uiListRow()`, `uiStat()`, `uiChip()`, `uiSkeleton()`, …). Every future screen
   renders through these. Nothing anywhere composes markup by hand after this phase.
5. Build `dev/components.html` — a gallery page rendering **every component in every state, in both
   themes, side by side**, with a theme toggle and a viewport-width readout. This is the artifact
   the owner reviews.

**Acceptance for this phase:**
- The gallery renders every documented component and state.
- No literal colour, size, radius or duration appears outside `tokens.css`.
- No emoji anywhere.
- The main app will be visually broken at this point — that is expected and correct. Do not patch
  it to keep it working; Phases 3–6 rebuild it properly.

**Deliverable:** the four CSS files, the sprite, `js/ui.js`, `dev/components.html`, and screenshots
of the gallery in both themes.

**STOP. This is the important gate. Report, show the gallery, and wait.**
**If the owner says it still looks like the old app, do not proceed — revise the foundation.**

---

### PHASE 3 — Face ID-first unlock, and the lock screen

**Goal:** the app opens with a face, the way Vanguard does. Right now it opens with a password
field, and that is both the worst first impression in the app and the loudest "this is a web page"
signal it has.

**The good news: the hard part is already built and working.** `js/vault.js` already implements a
WebAuthn platform passkey with the PRF extension, whose derived key wraps the same AES-256-GCM
master key the passcode wraps (`pt_v_prf` alongside `pt_v_pass`). Face ID unlock is fully
functional. **The defect is purely flow:** when a vault exists, `boot()` shows `#lockEnter` — the
passcode field — as the default view, and Face ID is a secondary `#faceBtn` the user has to
find and tap. During setup, "Enable Face ID" and "Not now" are rendered as equal-weight buttons.
So the app has Vanguard-grade unlock and presents it like an afterthought.

**Target behaviour:**

1. **Auto-invoke on launch.** On boot, if a vault exists *and* `pt_v_prf` exists *and*
   `vaultFaceAvailable()` resolves true, immediately call `unlockWithFace()`. The system Face ID
   sheet should be the first thing the user sees — no tap, no passcode field, no intermediate
   screen. On success, go straight into the app.

2. **Handle the user-gesture problem — this is the detail that will bite you.** Safari and
   `WKWebView` frequently reject `navigator.credentials.get()` when it is not called from a user
   gesture, throwing `NotAllowedError`. A naive auto-invoke on `DOMContentLoaded` will fail silently
   on real devices even though it works in a desktop browser. So implement **both** paths:
   - Attempt the auto-invoke.
   - If it throws `NotAllowedError` *without the user having cancelled* (distinguish these — a
     gesture rejection is near-instant, a real cancel is not; measure elapsed time and treat sub-
     ~300ms rejections as gesture failures), fall back to a lock screen whose **single, large,
     primary control is "Unlock with Face ID"** — one tap, nothing else competing with it.
   - Either way, the user never sees a passcode field first.
   Verify the behaviour in the actual `native/` wrapper on device, not just in desktop Safari.

3. **The fallback ladder, in this order:** Face ID → *(cancelled or failed)* → a quiet
   "Use passcode instead" text link → the passcode field → *(forgotten)* → restore from backup or
   erase. The passcode is a fallback, never the front door. It only becomes the default view when
   no passkey is enrolled on this device.

4. **Promote enrolment.** After first setup, "Enable Face ID" becomes the full-width primary CTA
   with an explanation of what it does; "Not now" becomes a quiet text link, not a peer button. Also
   offer enrolment on a later launch to anyone who skipped it and hasn't been asked recently — once,
   politely, dismissible for good.

5. **Add a re-lock policy**, which the app currently lacks — it only locks when the page is
   destroyed. Lock on backgrounding after a configurable idle period (default 5 minutes), via
   `visibilitychange` / `pagehide`, and re-authenticate with Face ID on resume. Offer
   *Immediately / 1 min / 5 min / 15 min / Never* in settings. **The master key must still live only
   in memory** — locking means discarding it and re-running the unlock flow, never persisting it.

6. **Settings surface** — a proper security section in the ⚙︎ sheet: Face ID toggle with its current
   state, "Require unlock after…", change passcode, and an honest one-line explanation of what Face
   ID does and does not protect. Use `vaultEnableFace()` / `vaultDisableFace()` /
   `vaultFaceEnabled()`, which already exist.

7. **Design every failure state properly**, with honest copy and a working way forward: PRF
   unsupported on this browser, passkey deleted from iCloud Keychain, biometrics locked out after
   failed attempts, no vault on this device, demo mode (which must never touch the real vault),
   and `pt_v_prf` present but the credential no longer resolvable. Each needs a designed state, not
   an error string dumped into `#lockErr`.

8. **Security invariants that must survive this phase:** the passcode wrap always remains as the
   recovery path (never make Face ID the only key); the passcode is never stored anywhere; the
   master key is never written to `localStorage`, `sessionStorage`, IndexedDB or a cookie; the demo
   passcode path never derives a real key; and `enrollFace` still requires
   `userVerification: 'required'`. Confirm each one explicitly in your phase report.

9. **Verify the passkey origin.** `enrollFace` binds the credential to `rp.id = location.hostname`.
   Check what origin the `native/` wrapper actually serves from — if it differs from the web
   origin, a passkey enrolled in one will not resolve in the other. Report what you find; do not
   change the origin without saying so.

**Then rebuild the lock screen visually.** It is the first thing anyone sees and currently carries
the heaviest concentration of inline styles and emoji in the app (`☁️`, `👀`, a full inline rule set
on `#restoreFirst`). Rebuild completely: proper logo treatment, real type hierarchy, a Face ID
state that feels intentional rather than like a permission prompt, inputs at 16px, designed error
states, restrained restore and demo entry points, rewritten copy.

**Also kill the native dialogs.** `vault.js` uses `prompt()` for the backup passcode and `confirm()`
for the erase confirmation. These are browser chrome and instantly break the illusion of a native
app — replace both with the designed sheet/modal components from Phase 2.

**Acceptance:** launching the app with Face ID enrolled shows the biometric prompt and nothing else;
the passcode field is never the first thing on screen; every failure path is designed; zero inline
styles and zero emoji remain in the lock screen; no `prompt()` or `confirm()` anywhere; the security
invariants above are confirmed in writing; tested on device in the `native/` wrapper.

**STOP. Report and wait.**

---

### PHASE 4 — Rebuild: Portfolio

**Goal:** the main screen, rebuilt on the new foundation.

1. **Portfolio page** — rebuild `index.html`'s portfolio section and every render function in
   `js/portfolio.js` that emits markup, using `js/ui.js`.
   - Hero: total, day change, sub-stats — one composed unit, not four stacked divs.
   - Chart card: new Chart.js config per §3.8, redesigned range/metric segments, benchmark toggle,
     scrub readout.
   - Holdings list: rebuilt row — logo tile, symbol, name, sparkline, value, delta pill. Flat
     divided list, not a bordered card per row.
   - Allocation, goal, dividends, movers: rebuilt per the `DESIGN.md` hierarchy, demoted on mobile,
     moved to the side column at ≥1024px.
   - Real skeleton loading, real empty state, real error state.
2. Apply the app shell: bottom tab bar on mobile, left nav rail at ≥1024px.

**Acceptance:** zero inline styles in this section; every value from tokens; both themes correct at
all four widths; numbers identical to `baseline-numbers.txt`.

**Deliverable:** the rebuilt screen + before/after screenshots at 375px and 1280px, both themes.

**STOP. Report and wait.**

---

### PHASE 5 — Rebuild: Explore and Insights

1. **Explore** — search as the persistent hero. Index and sector rails redesigned as proper tiles
   with sparklines. **The three screener lists collapse into one card with a segmented control.**
   Watchlist gets a real empty state. Ideas list rebuilt with a clear "why this" treatment.
2. **Insights** — the big structural fix. Restructure ~20 cards into 4 labelled groups per
   `DESIGN.md` §8, with summary-visible / detail-on-tap. Rebuild the health score, drawdown, monthly
   heatmap, risk, P/E, crash test, projection, FI, look-through, sectors, gains table and tax lots
   onto the new component set. Every chart re-configured per §3.8. The heatmap gets a proper
   sequential ramp from the categorical/sequential rules, not ad-hoc opacity.
3. Both pages get the desktop grid treatment — Insights goes 3-up at ≥1024px.

**Acceptance:** as Phase 4. Insights must be scannable in ten seconds; if it still reads as an
endless card dump, the restructuring is not done.

**STOP. Report and wait.**

---

### PHASE 6 — Overlays, sheets, and the assistant

1. **Sheet system** — one component, used by every detail sheet (holding, tax, sector, location,
   crash test, FI, info sheets). Drag handle, drag-to-dismiss with velocity, safe-area padding,
   scroll containment, focus trap, `Escape` to close, backdrop that isn't a blur crutch. Desktop:
   centred modal with a max width.
2. **Edit / holdings modal** — currently a raw table of unstyled inputs and the roughest surface in
   the app. Rebuild as a proper form: labelled fields, 16px inputs, real number inputs with correct
   `inputmode`, validation states, a destructive-action confirm, sticky save bar.
3. **The AI assistant** — rebuild the FAB and panel as designed components: real icon, proper
   message bubbles with a defined tail treatment, a real typing indicator, suggestion chips as the
   standard chip component, an input row that doesn't collide with the safe area, and a designed
   empty state that suggests what to ask. The assistant is explicitly in scope for improvement:
   tighten its suggested prompts and its answer formatting (structure, number formatting, source
   line) — but do not change what data it reads or how it computes anything.
4. **Toasts, banners, the stale-data banner, the demo badge, the mini bar** — all rebuilt as
   components. The demo badge in particular should look like a designed product affordance, not a
   construction sign.

**STOP. Report and wait.**

---

### PHASE 7 — Native feel and motion

Work through the `DESIGN.md` §11 native-feel checklist and tick every item, with evidence.

- Safe areas on all four edges, portrait and landscape, notch and home indicator.
- Every input ≥16px — verify with a script, not by reading.
- Every tap target ≥44×44 — verify with a script over the rendered DOM.
- Press feedback within one frame on every interactive surface.
- Scroll: momentum, containment, no body bounce, per-tab position restoration.
- The four motion durations applied consistently; verify no other duration exists in the CSS.
- `prefers-reduced-motion` genuinely disables all of it — test it.
- Skeletons on every first paint; no bare spinner on a blank screen anywhere.
- `theme-color` updates on theme change.
- 60fps on scroll and on theme switch — profile it, fix anything that drops frames. Watch for
  layout thrash in the price-tick animation and in chart redraws.
- Full keyboard operation and visible focus on every control.
- Service worker updated to cache the new asset list; verify the app still works fully offline.

**Deliverable:** `redesign/NATIVE-CHECKLIST.md` with every item ticked and its evidence.

**STOP. Report and wait.**

---

### PHASE 8 — Final: verification and ship

**This phase produces the finished app.** No new design decisions here — this is proving the work
is complete and correct.

1. **Regression:** regenerate `redesign/after-numbers.txt` and diff against
   `redesign/baseline-numbers.txt`. Any difference that is not an intentional copy change is a bug —
   fix it, don't explain it.
2. **Purity checks**, scripted, each of which must return zero results:
   - inline `style=` attributes in `index.html`
   - inline styles emitted from any JS file
   - hex colours, `rgb(`/`rgba(` literals, `px` font-sizes, `px` radii or shadow definitions
     anywhere outside `css/tokens.css`
   - emoji anywhere in `index.html` or in JS-emitted markup
   - any class name surviving from the old stylesheet that is no longer defined
   - any `transition`/`animation` duration not in the four-value set
   - any call to `prompt(`, `confirm(` or `alert(`
3. **Contrast:** re-run `redesign/contrast-check.mjs` over the final tokens, both themes. All pass.
4. **Full screenshot sweep:** all three tabs, the lock screen, and every sheet, in both themes, at
   375 / 768 / 1280 / 1600px, into `redesign/after/`. Build `redesign/COMPARISON.md` placing every
   before/after pair side by side.
5. **Device check:** run in the `native/` iOS wrapper. Verify safe areas, keyboard behaviour, no
   zoom on input focus, sheet gestures, and that the status bar matches the theme.
6. **Offline check:** airplane mode, cold start, all three tabs render from cache.
7. **Docs:** update `README.md` and `CHANGELOG.md`. Ensure `DESIGN.md` matches what was actually
   built — where implementation diverged from spec, update the spec and note why.
8. **Cleanup:** delete `redesign/before/` intermediates you no longer need, remove any scaffolding,
   confirm `dev/components.html` still renders correctly against the final tokens (it is the living
   style guide and should be kept and maintained).

**Definition of done — every one of these must be true:**

- [ ] `css/app.css` no longer exists; the four layered files replace it.
- [ ] Zero inline styles, zero emoji icons, zero literal values outside `tokens.css`.
- [ ] The app opens with Face ID. A passcode field is never the first thing on screen when a
      passkey is enrolled, and the security invariants of Phase 3 are confirmed in writing.
- [ ] No `prompt()`, `confirm()` or `alert()` anywhere in the codebase.
- [ ] Dark is the default; light is a separately designed theme, not an inversion; both pass AA.
- [ ] The primary and secondary brand colours are distinct from gain/loss, and gain/loss appear only
      on numbers and data marks.
- [ ] Seven type steps, five radii, nine spacing values, four durations. No exceptions in the code.
- [ ] The signature interaction is applied to every interactive surface.
- [ ] A desktop app shell exists at ≥1024px; the phone-column-on-desktop look is gone.
- [ ] Insights is grouped and progressively disclosed, not a card dump.
- [ ] Every screen has designed loading, empty and error states.
- [ ] The native-feel checklist is fully ticked with evidence.
- [ ] `after-numbers.txt` matches `baseline-numbers.txt`.
- [ ] Someone shown a screenshot of the old and new app would not guess they were the same product.

**Deliverable:** the finished app, `redesign/COMPARISON.md`, and a short written summary of what
changed and why it now reads as a shipped product.

---

## 5. IF YOU GET STUCK

- If a phase is too large for one context window, split it, but never skip the STOP gate.
- If something in `DESIGN.md` turns out to be wrong once built, change `DESIGN.md` and say so — the
  spec is the source of truth and must stay accurate. Never let the code and the spec diverge
  silently; that is how the current mess began.
- If a redesign decision would require changing calculation logic, stop and ask. Do not change it.
- If you find yourself writing a CSS rule that overrides an earlier one in the same file, stop. That
  is the old failure mode returning. Fix the component instead.
