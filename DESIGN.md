# Design system — My Portfolio

The artifact the app was missing. Previous UI passes drifted because there was
nothing to drift *from*: 178 hand-named classes and no value derived from any
other value (see `redesign/AUDIT.md`). This file is the source of truth. If the
code and this document disagree, one of them is a bug — fix both, never let them
diverge silently.

**Rule that makes the rest work:** every literal value lives in `css/tokens.css`.
A hex code, a px size or a duration appearing anywhere else is a defect.

---

## 1. Positioning

A personal brokerage app for one person's real money. The register is **calm,
dense, trustworthy** — Vanguard, Empower, Fidelity, Schwab. The data is the
interest; the interface's job is to get out of its way and be legible at a glance
on a phone held one-handed.

It is explicitly **not** a crypto tracker, not a trading terminal, and not
gamified. No glow, no grain, no neon, no confetti, no streak pressure. Where the
old app reached for decoration — a radial green glow, an SVG noise overlay,
staggered per-child entrance animations, glassmorphism — the new one reaches for
hierarchy instead. Those moves are what people do when the layout isn't working.

Dark is the default and the design target. Light is a **separately designed
theme**, not an inversion.

---

## 2. Colour

The single most important change: **the brand colour and the profit colour are
now different things.** The old app had `--brand: #26d07c` and
`--green: #26d07c` — byte-identical, in both themes. Emerald was the chrome *and*
the gain indicator *and* the accent *and* the focus ring, so nothing read as
meaningful. Now blue carries interaction and green means only one thing: money up.

The dark neutrals are **blue-black, not green-black** (`#0F1217`, not `#0b0f0d`).
That change alone moves the app out of the crypto register.

### Brand and semantic

| Role | Token | Dark | Light | Used for |
|---|---|---|---|---|
| Primary — brand & interaction | `--primary` | `#4C82F7` | `#1F5FE0` | active nav, links, selected segment, focus ring, main chart series |
| Primary fill | `--primary-fill` | `#2B5FD9` | `#1F5FE0` | filled button faces; white text on this |
| Primary edge | `--primary-edge` | `#1E48A8` | `#17499E` | the signature pressed edge (§5) |
| Primary tint | `--primary-tint` | `rgba(76,130,247,.14)` | `rgba(31,95,224,.10)` | selected pills, chart area fill |
| Secondary — attention | `--secondary` | `#E0AE4A` | `#8A6110` | goals, targets off-track, needs-action, warnings |
| Secondary tint | `--secondary-tint` | `rgba(224,174,74,.14)` | `rgba(138,97,16,.10)` | warning banners, goal ring track |
| Gain — numbers only | `--gain` | `#2FBE7A` | `#0A7F58` | positive deltas, up sparklines |
| Loss — numbers only | `--loss` | `#F26B75` | `#D02D40` | negative deltas, down sparklines |

Warning deliberately shares `--secondary` rather than introducing a fourth hue —
one fewer colour to justify, and brass is the conventional caution colour in
finance.

### Neutrals

These carry the whole app. Get them right and the accents barely have to work.

| Token | Dark | Light |
|---|---|---|
| `--canvas` | `#0F1217` | `#F6F7F9` |
| `--surface` | `#171B22` | `#FFFFFF` |
| `--surface-2` | `#1F242D` | `#F1F3F6` |
| `--surface-3` | `#262C36` | `#E9ECF1` |
| `--line` | `#2A313C` | `#E2E6EC` |
| `--line-strong` | `#3A424F` | `#CBD2DC` |
| `--border-control` | `#686E78` | `#878D97` |
| `--text` | `#EDF0F5` | `#10151D` |
| `--text-muted` | `#9BA5B4` | `#566072` |
| `--text-faint` | `#858F9E` | `#6B7280` |

#### Decision recorded: why `--border-control` exists

Not in the brief. The brief specified `--line-strong` for input borders, but it
measures **1.70:1** against `--surface` and WCAG 1.4.11 holds a control boundary
to 3:1. The options were to drag `--line-strong` up to 3:1 — which would make
every divider in the app that heavy and destroy the calm register — or to split
the two jobs. Split wins: `--line-strong` stays a **structural hairline**
(decorative, no minimum), `--border-control` is the **form-control boundary** and
was solved numerically to clear 3:1 against `--canvas`, `--surface` *and*
`--surface-2` simultaneously, since inputs are filled with `--surface-2`.

### Rules

- Exactly two brand hues. A third accent hue anywhere is a bug.
- `--gain` / `--loss` may colour **text, sparklines, chart marks and small delta
  pills only.** Never a button, nav item, card, border, focus ring, or a progress
  bar that isn't representing P&L.
- Category colours come from the one declared ramp below — never ad-hoc hexes in
  JS, never hue-shifted brand colour.

### Categorical ramp — 8 steps

For the allocation donut and sector bars. Constraint: no step may read as gain or
loss, so greens and reds are excluded; the ramp leans blue / violet / teal /
amber / rose / slate. Every step clears 3:1 against `--surface` in both themes.

| Step | Dark | Light |
|---|---|---|
| 1 | `#5B8DEF` | `#2E63C8` |
| 2 | `#9B7BEA` | `#6D4BC4` |
| 3 | `#3FB6C4` | `#1B7F8C` |
| 4 | `#E0AE4A` | `#8A6110` |
| 5 | `#D9789B` | `#A83C67` |
| 6 | `#6FA8DC` | `#3C6FA8` |
| 7 | `#8A93A6` | `#5A6478` |
| 8 | `#B98E5A` | `#7A5A2E` |

The heatmap uses a **sequential** ramp instead — `--primary` at varying alpha for
positive months, `--loss` at varying alpha for negative — never ad-hoc opacity on
an arbitrary colour, which is what the old app did.

### Measured contrast

Produced by `redesign/contrast-check.mjs`, not eyeballed. Regenerate with
`node redesign/contrast-check.mjs --md`. **All 33 pairs × 2 themes pass.**

#### Dark (default)

| Foreground | Background | Ratio | Min | Verdict | Role |
|---|---|---|---:|---:|---|
| `--text` | `--canvas` | **16.43** | 4.5 | pass | body copy on the app background |
| `--text` | `--surface` | **15.11** | 4.5 | pass | body copy on a card |
| `--text` | `--surface-2` | **13.63** | 4.5 | pass | body copy on a nested surface |
| `--text` | `--surface-3` | **12.29** | 4.5 | pass | body copy on a pressed surface |
| `--text-muted` | `--canvas` | **7.54** | 4.5 | pass | secondary metadata on background |
| `--text-muted` | `--surface` | **6.93** | 4.5 | pass | secondary metadata on a card |
| `--text-muted` | `--surface-2` | **6.25** | 4.5 | pass | secondary metadata on a nested surface |
| `--text-faint` | `--canvas` | **5.74** | 4.5 | pass | captions and footnotes |
| `--text-faint` | `--surface` | **5.28** | 4.5 | pass | captions on a card |
| `--primary` | `--canvas` | **5.22** | 4.5 | pass | links and active nav |
| `--primary` | `--surface` | **4.80** | 4.5 | pass | links on a card |
| `--primary` | `--surface-2` | **4.33** | 3.0 | pass | selected segment label |
| `--on-primary` | `--primary-fill` | **5.61** | 4.5 | pass | label on a filled primary button |
| `--secondary` | `--canvas` | **9.22** | 4.5 | pass | goal and warning text |
| `--secondary` | `--surface` | **8.49** | 4.5 | pass | warning text on a card |
| `--gain` | `--canvas` | **7.83** | 4.5 | pass | positive delta |
| `--gain` | `--surface` | **7.21** | 4.5 | pass | positive delta on a card |
| `--gain` | `--surface-2` | **6.50** | 4.5 | pass | positive delta in a pill |
| `--loss` | `--canvas` | **6.38** | 4.5 | pass | negative delta |
| `--loss` | `--surface` | **5.87** | 4.5 | pass | negative delta on a card |
| `--loss` | `--surface-2` | **5.29** | 4.5 | pass | negative delta in a pill |
| `--line` | `--canvas` | **1.43** | 1.0 | pass | hairline divider (decorative, no minimum) |
| `--line-strong` | `--canvas` | **1.85** | 1.0 | pass | structural hairline (decorative, no minimum) |
| `--line-strong` | `--surface` | **1.70** | 1.0 | pass | structural hairline on a card |
| `--border-control` | `--canvas` | **3.65** | 3.0 | pass | form-control boundary — WCAG 1.4.11 applies |
| `--border-control` | `--surface` | **3.36** | 3.0 | pass | form-control boundary on a card |
| `--border-control` | `--surface-2` | **3.03** | 3.0 | pass | form-control boundary on an input fill |
| `--primary` | `--surface-3` | **3.91** | 3.0 | pass | focus ring against a pressed surface |
| `--ramp-1 (#5B8DEF)` | `--surface` | **5.35** | 3.0 | pass | categorical data mark |
| `--ramp-2 (#9B7BEA)` | `--surface` | **5.27** | 3.0 | pass | categorical data mark |
| `--ramp-3 (#3FB6C4)` | `--surface` | **7.15** | 3.0 | pass | categorical data mark |
| `--ramp-4 (#E0AE4A)` | `--surface` | **8.49** | 3.0 | pass | categorical data mark |
| `--ramp-5 (#D9789B)` | `--surface` | **5.85** | 3.0 | pass | categorical data mark |
| `--ramp-6 (#6FA8DC)` | `--surface` | **6.83** | 3.0 | pass | categorical data mark |
| `--ramp-7 (#8A93A6)` | `--surface` | **5.59** | 3.0 | pass | categorical data mark |
| `--ramp-8 (#B98E5A)` | `--surface` | **5.82** | 3.0 | pass | categorical data mark |

#### Light

| Foreground | Background | Ratio | Min | Verdict | Role |
|---|---|---|---:|---:|---|
| `--text` | `--canvas` | **17.08** | 4.5 | pass | body copy on the app background |
| `--text` | `--surface` | **18.31** | 4.5 | pass | body copy on a card |
| `--text` | `--surface-2` | **16.47** | 4.5 | pass | body copy on a nested surface |
| `--text` | `--surface-3` | **15.46** | 4.5 | pass | body copy on a pressed surface |
| `--text-muted` | `--canvas` | **5.92** | 4.5 | pass | secondary metadata on background |
| `--text-muted` | `--surface` | **6.34** | 4.5 | pass | secondary metadata on a card |
| `--text-muted` | `--surface-2` | **5.70** | 4.5 | pass | secondary metadata on a nested surface |
| `--text-faint` | `--canvas` | **4.51** | 4.5 | pass | captions and footnotes |
| `--text-faint` | `--surface` | **4.83** | 4.5 | pass | captions on a card |
| `--primary` | `--canvas` | **5.19** | 4.5 | pass | links and active nav |
| `--primary` | `--surface` | **5.57** | 4.5 | pass | links on a card |
| `--primary` | `--surface-2` | **5.01** | 3.0 | pass | selected segment label |
| `--on-primary` | `--primary-fill` | **5.57** | 4.5 | pass | label on a filled primary button |
| `--secondary` | `--canvas` | **5.16** | 4.5 | pass | goal and warning text |
| `--secondary` | `--surface` | **5.53** | 4.5 | pass | warning text on a card |
| `--gain` | `--canvas` | **4.68** | 4.5 | pass | positive delta |
| `--gain` | `--surface` | **5.01** | 4.5 | pass | positive delta on a card |
| `--gain` | `--surface-2` | **4.51** | 4.5 | pass | positive delta in a pill |
| `--loss` | `--canvas` | **4.74** | 4.5 | pass | negative delta |
| `--loss` | `--surface` | **5.08** | 4.5 | pass | negative delta on a card |
| `--loss` | `--surface-2` | **4.57** | 4.5 | pass | negative delta in a pill |
| `--line` | `--canvas` | **1.17** | 1.0 | pass | hairline divider (decorative, no minimum) |
| `--line-strong` | `--canvas` | **1.42** | 1.0 | pass | structural hairline (decorative, no minimum) |
| `--line-strong` | `--surface` | **1.52** | 1.0 | pass | structural hairline on a card |
| `--border-control` | `--canvas` | **3.12** | 3.0 | pass | form-control boundary — WCAG 1.4.11 applies |
| `--border-control` | `--surface` | **3.34** | 3.0 | pass | form-control boundary on a card |
| `--border-control` | `--surface-2` | **3.00** | 3.0 | pass | form-control boundary on an input fill |
| `--primary` | `--surface-3` | **4.70** | 3.0 | pass | focus ring against a pressed surface |
| `--ramp-1 (#2E63C8)` | `--surface` | **5.62** | 3.0 | pass | categorical data mark |
| `--ramp-2 (#6D4BC4)` | `--surface` | **6.08** | 3.0 | pass | categorical data mark |
| `--ramp-3 (#1B7F8C)` | `--surface` | **4.71** | 3.0 | pass | categorical data mark |
| `--ramp-4 (#8A6110)` | `--surface` | **5.53** | 3.0 | pass | categorical data mark |
| `--ramp-5 (#A83C67)` | `--surface` | **5.99** | 3.0 | pass | categorical data mark |
| `--ramp-6 (#3C6FA8)` | `--surface` | **5.21** | 3.0 | pass | categorical data mark |
| `--ramp-7 (#5A6478)` | `--surface` | **5.95** | 3.0 | pass | categorical data mark |
| `--ramp-8 (#7A5A2E)` | `--surface` | **6.31** | 3.0 | pass | categorical data mark |

---

## 3. Type

Inter, weights 400/500/600/700/800 only. **Exactly seven steps.** No other size
may appear in the CSS, and no half-pixel size ever — the old app had eight
half-pixel sizes, which is the signature of nudging individual elements until they
looked right.

| Step | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `--t-display` | 34 / 38 | 800 | −0.03em | the portfolio total |
| `--t-title` | 24 / 30 | 700 | −0.02em | page titles |
| `--t-heading` | 19 / 24 | 700 | −0.01em | section headings |
| `--t-body` | 15 / 22 | 500 | 0 | default copy, list rows |
| `--t-label` | 14 / 18 | 600 | 0 | buttons, values, table cells |
| `--t-caption` | 12 / 16 | 500 | 0 | secondary metadata |
| `--t-micro` | 11 / 14 | 700 | +0.08em, uppercase | eyebrow labels only |

**One permitted exception:** the hero total is `clamp(38px, 10vw, 48px)`, weight
800, −0.035em. It is the only bespoke size in the app.

`font-variant-numeric: tabular-nums` is a **base rule on `body`**, not sprinkled
per-selector. In a finance app, digits that shift width as prices tick is the
loudest possible amateur tell.

---

## 4. Space, radius, elevation

**Spacing — 9 values:** `4 8 12 16 20 24 32 40 56`. Nothing else. Screen gutter
is 20. (Old app: 27 arbitrary values.)

**Radius — 5 values:** `8` inputs/chips · `12` buttons/tiles · `16` cards ·
`24` sheets · `999` pills. (Old app: 18 values, including a 3.5px radius.)

**Elevation — 4 levels. In dark mode elevation is surface lightness, not shadow.**

This is the fix for the defect where the old app applied
`0 18px 44px rgba(0,0,0,.42)` over a `#0b0f0d` background — black shadow on
near-black renders literally nothing, so the app was paying for shadows it could
not display.

| Level | Dark | Light |
|---|---|---|
| 0 — page | `--canvas`, no shadow | `--canvas`, no shadow |
| 1 — card | `--surface` | `--surface` + `--shadow-1` |
| 2 — nested / input | `--surface-2` + 1px `--line` | `--surface-2` + 1px `--line` |
| 3 — sheet, tab bar, toast | `--surface-2` + `--line-strong` + `--shadow-3` + a 1px top inner highlight | `--surface` + `--shadow-3` |

The top inner highlight at level 3 in dark mode is what makes an ambient shadow
legible at all — it reads as a lit edge rather than a blurred smudge.

---

## 5. The signature interaction — "the one-frame press"

One interaction, applied to **every** interactive surface without exception. This
is most of what "feels like a real app" actually means; the old app had no
consistent press feedback at all.

Named `.press`, implemented once as a utility class.

- On `:active`, the control scales to **`0.97`** with `transform-origin: center`.
- **No transition on the down stroke** — it must land within one frame. A
  `transition` here is exactly why web apps feel laggy.
- Background steps one surface level darker (`--surface` → `--surface-2`).
- **140ms ease-out on release only** (`transition` declared on the non-active
  state).
- **Filled primary buttons get a physicality nothing else has:** they carry a 2px
  `--primary-edge` bottom border which collapses to 0 and the button translates
  down 2px. That's the press the CTA gets, and only the CTA.

Applied to: buttons, list rows, chips, tiles, segments, nav items, and any card
that navigates. Not applied to static cards — if it presses, it must do something.

Disabled entirely under `prefers-reduced-motion: reduce` (the scale, not the
colour change — the feedback must survive, only the movement goes).

---

## 6. Components

Everything is built from this set. Nothing is styled ad hoc. Each lives in
`css/components.css` under a comment block naming it and its states, in this
order, and is emitted by a builder in `js/ui.js`.

### 6.1 Button
5 variants × 3 sizes. Variants: `primary` (filled, edge press), `secondary`
(`--surface-2` fill, `--line` border), `ghost` (no fill, text `--primary`),
`danger` (`--loss` text on `--surface-2`; never a filled red button — too loud for
an app about someone's savings), `icon` (square, 44×44 minimum).
Sizes: `sm` 36px / `--t-label` · `md` 44px / `--t-label` · `lg` 52px / `--t-body`.
States: default, `:active` (§5), `:focus-visible` (2px `--primary` ring, 2px
offset), `disabled` (50% opacity, no press), `loading` (spinner replaces label,
**width preserved** so the row doesn't reflow).

### 6.2 Icon button
44×44 minimum regardless of the glyph's 24px box. Always carries `aria-label`.
`--text-muted` at rest, `--text` on press.

### 6.3 Segmented control
Track `--surface-2`, radius 999. Selected segment: `--primary-tint` fill,
`--primary` label, weight 600. Unselected: `--text-muted`. The selection indicator
slides over 200ms. Replaces both the range picker and — new in this redesign — the
three stacked screener cards on Explore.

### 6.4 Chip / pill
Radius 999, `--t-caption`, `--surface-2` fill. Delta variant: `--gain` / `--loss`
text on the matching tint. Selectable variant takes the press.

### 6.5 List row
The workhorse: 64px minimum height, 20px gutters, **divided by a 1px `--line`
bottom border — not a bordered card per row.** That's the fix for "every box has
the same weight". Anatomy: leading slot (logo tile / icon) · title + subtitle
stack · optional sparkline · trailing value + delta stack · optional chevron.

### 6.6 Card
`--surface`, radius 16, padding 20. **No border in dark mode** — the surface
lightness is the elevation. Optional header with `--t-heading` title and a
trailing action.

### 6.7 Stat tile
`--surface-2`, radius 12, padding 16. `--t-micro` eyebrow, `--t-heading` value,
optional `--t-caption` delta. Used in 2-up and 3-up grids.

### 6.8 Input
Fill `--surface-2`, 1px `--border-control`, radius 8, height 44,
**`font-size: 16px` minimum — non-negotiable**, or iOS zooms the viewport on
focus. Three inputs currently violate this. Always has a visible `<label>`, never
placeholder-as-label. States: default, focus (`--primary` border + ring), invalid
(`--loss` border + message), disabled.

### 6.9 Search field
Input with a leading search glyph and a trailing clear button that only appears
when non-empty. On Explore it is `position: sticky` at the top — search is the
hero of that screen and must never scroll away.

### 6.10 Sheet
Level 3. Radius 24 top corners only, 4px × 36px drag handle, safe-area bottom
padding, `overscroll-behavior: contain`, focus trap, `Escape` closes, backdrop
`rgba(0,0,0,.5)` — **a real scrim, not a backdrop-blur crutch.** Enters over 280ms
`cubic-bezier(.32,.72,.28,1)`. Drag-to-dismiss with a velocity threshold and
rubber-banding at the top. At ≥1024px it becomes a centred modal, max 520px.

### 6.11 Modal
Centred, radius 16, max 520px, same scrim and trap. Used for destructive
confirmations — which replaces every `confirm()` in the codebase.

### 6.12 Toast
Level 3, bottom-anchored above the tab bar, auto-dismiss 4s, `aria-live="polite"`.
Variants: neutral, warning (`--secondary`), error (`--loss` text only).

### 6.13 Tab bar / nav rail
≤1023px: fixed bottom bar, level 3, safe-area padding, 5 items, active item
`--primary` icon + label. **No backdrop blur** — an opaque level-3 surface.
≥1024px: becomes a persistent 240px left rail with the same items as rows.

### 6.14 Progress bar
Track `--surface-2`, radius 999, height 8. Fill `--primary`, or `--secondary` when
representing a goal that is off-track. Animates over 400ms.

### 6.15 Ring
The goal ring. 12px stroke, track `--surface-2`, `--primary` progress,
`--secondary` when off-track. Centre holds the percentage at `--t-heading`.

### 6.16 Skeleton
`--surface-2` with a 1.4s shimmer sweep. Variants: line, row, tile, badge.
**Every first paint uses these — never a bare spinner on a blank screen.**

### 6.17 Empty state
Centred: 32px muted icon, `--t-heading` title, `--t-caption` explanation, optional
single primary action. Written as product copy, not an apology.

### 6.18 Error state
Same anatomy, `--secondary` icon, and always a working way forward (Retry).

### 6.19 Banner
Inline, radius 12, `--secondary-tint` fill with `--secondary` left rule 3px. Used
for the stale-data notice. Dismissible where non-critical.

### 6.20 Badge / logo tile
40×40, radius 12, `--surface-2`, holds a ticker's 1–2 letter monogram at
`--t-label` weight 700 when no logo image is available.

### 6.21 Chart container
Card with a header row: title, current readout, and the range segmented control.
Fixed aspect ratio to prevent layout shift on load. Owns its own loading, empty
and error states.

### 6.22 Table
Only for genuinely tabular data (tax lots, gains). Header row `--t-micro`
`--text-faint`, body `--t-label`, right-aligned numerics, 1px `--line` row
dividers, no vertical rules, no zebra striping. Horizontally scrollable inside its
own container so the page body never scrolls sideways.

---

## 7. Layout

The fix for "a phone-width column stranded in the middle of an empty page" — the
old app's entire layout strategy was `.wrap{max-width:600px}`.

| Breakpoint | Layout |
|---|---|
| ≤600px | single column, 20px gutter, bottom tab bar |
| 601–1023px | single column, max 640px, centred, 32px gutters, bottom tab bar |
| ≥1024px | **app shell** — persistent 240px left rail, content max 1080px |
| ≥1440px | content max 1200px, right column 360px |

```
≥1024px — the app shell
┌──────────┬────────────────────────────────┬──────────────┐
│          │  Portfolio                     │              │
│  ▣ Port  │  ┌──────────────────────────┐  │ ┌──────────┐ │
│  ◈ Explr │  │ $146,984.16   ▲ 1.29%    │  │ │Allocation│ │
│  ◍ Insig │  │ ╭──────────────────────╮ │  │ │  donut   │ │
│          │  │ │      chart           │ │  │ └──────────┘ │
│  240px   │  │ ╰──────────────────────╯ │  │ ┌──────────┐ │
│  rail    │  │  1D 1W 1M 3M 1Y ALL      │  │ │  Goal    │ │
│          │  └──────────────────────────┘  │ └──────────┘ │
│          │  Holdings                      │ ┌──────────┐ │
│          │  ── VTI ······ $82,875 ▲0.83% │ │Dividends │ │
│          │  ── VXUS ····· $23,461 ▼0.14% │ └──────────┘ │
│  ⚙ Set   │  ── BND ······ $16,067 ▲0.10% │              │
└──────────┴────────────────────────────────┴──────────────┘
             main column, max 1080          320px (360 @1440)
```

---

## 8. Screen specifications

The governing rule: **one hero, one primary object, then everything else earns
its place or moves behind disclosure.**

### Portfolio
- **Hero:** total + day change + sub-stats as *one composed unit*, not four
  stacked divs.
- **Primary object:** the chart, then the holdings list.
- **Demoted:** allocation, goal, dividends, movers — collapsed or secondary on
  mobile, moved to the right column at ≥1024px.

### Explore
- **Hero:** search, sticky, always visible.
- Indices and sectors become horizontal rails of tiles with sparklines.
- **The three screener cards (Most Active / Gainers / Losers) collapse into ONE
  card with a segmented control.** Three stacked lists of the same shape is a
  layout that never decided what mattered.
- Watchlist gets a real empty state.

### Insights — the big structural fix
Currently ~20 cards in one endless scroll. **Four labelled groups, summary
visible, detail on tap:**

1. **Performance** — health score, returns vs benchmark, monthly heatmap, drawdown
2. **Risk** — volatility, concentration, crash test, P/E
3. **Income & tax** — dividends, yield, tax lots, realised gains
4. **Future** — projections, FI number, goal trajectory

Each group shows its headline number and at most three supporting figures. A
brokerage app shows a health score and three numbers; it does not show every
metric it can compute, all at once, forever. 3-up grid at ≥1024px.

### Lock screen
Logo, app name, and **one large primary control: Unlock with Face ID.** Passcode
is a quiet text link beneath, never the front door. Restore and demo entry are
restrained tertiary links. Full spec in §14.

---

## 9. Data visualisation

Chart.js defaults are stripped; everything configured explicitly.

- **Grid:** horizontal only, `--line` at 40% opacity. No vertical gridlines, no
  axis borders.
- **Main series:** 1.75px `--primary`, no point markers, area fill
  `--primary-tint` → transparent. **Never gain/loss coloured** — the line is
  interaction-coloured; the *delta readout* carries the P&L colour.
- **Benchmark:** 1.5px dashed `--text-faint`. Never a second bright hue.
- **Crosshair scrub:** 1px `--line-strong` vertical rule, a filled dot on the
  series, and a readout that updates **above** the chart. No tooltip bubbles.
- **Sparklines:** 1.5px, no fill, no axis, coloured by period direction.
- **Donut:** 12px ring, 4px gaps, categorical ramp (§2), centre shows the total.
- Every chart has a designed **empty**, **loading** (skeleton, not a spinner) and
  **error** state.

---

## 10. Motion

Four durations. Any other duration in the CSS is a bug.

| Token | Duration | Easing | Used for |
|---|---|---|---|
| `--dur-micro` | 120ms | ease-out | press release, hover, chip selection |
| `--dur-enter` | 200ms | ease-out | page transition, segment slide, toast |
| `--dur-sheet` | 280ms | `cubic-bezier(.32,.72,.28,1)` | sheets, modals |
| `--dur-data` | 400ms | ease-out | bar, ring and chart fills |

**One page transition**, applied to the page container as a whole: an 8px rise and
fade over `--dur-enter`. The old app's `nth-child`-staggered per-child entrance is
deleted — staggering every child is a decoration that draws attention to the fact
that nothing on screen is prioritised.

All motion disabled under `prefers-reduced-motion: reduce`.

---

## 11. Native-feel checklist

Phase 7 ticks these with evidence in `redesign/NATIVE-CHECKLIST.md`.

- [ ] Safe-area insets on all four edges, portrait and landscape
- [ ] `touch-action: manipulation` on all controls; no double-tap zoom
- [ ] `user-select: none` on chrome, `text` restored on numbers and names
- [ ] `overscroll-behavior: none` on body, `contain` on internal scrollers
- [ ] **Every input ≥16px** — verified by script, not by reading
- [ ] **Every tap target ≥44×44** — verified by script over the rendered DOM
- [ ] `:active` feedback within one frame; no `transition-delay` on press
- [ ] Sheets drag-to-dismiss with velocity threshold and top rubber-banding
- [ ] Scroll position preserved per tab
- [ ] Skeletons on first paint; no bare spinner on a blank screen
- [ ] `theme-color` meta updated on theme switch
- [ ] 60fps on scroll and theme switch
- [ ] Full keyboard operation, visible focus everywhere
- [ ] `aria-live` on price updates
- [ ] Works fully offline — **including Chart.js, which must be vendored locally
      (currently loaded from a CDN, so charts cannot render offline at all)**

---

## 12. Voice and copy

Terse, product voice, sentence case. No exclamation marks, no emoji, no
explanations of implementation.

| Before | After |
|---|---|
| `👀 View the example portfolio — no login` | `See an example portfolio` |
| `DEMO · example data · tap to exit` | `Example data` + Exit action |
| `Chart history is rebuilt from your actual Vanguard purchase lots` | `Built from your purchase history` |
| `☁️ Restore from backup` | `Restore from backup` |
| `Notifications aren't part of the example portfolio.` | `Not available in the example.` |
| `Tap the ⚙︎ to turn on reports` | `Turn on reports in Settings` |

"Not financial advice" stays exactly as it is — it is short and it should be there.

---

## 13. Accessibility floor

- **WCAG AA, proven not assumed** — 4.5:1 body text, 3:1 for ≥19px text and for
  UI boundaries. `redesign/contrast-check.mjs`, both themes, all pass. Re-run it
  in CI of the mind before shipping any token change.
- 44×44 minimum tap target, verified by script.
- Visible `:focus-visible` ring on every interactive element: 2px `--primary`,
  2px offset. Never `outline: none` without a replacement.
- Full keyboard operation, including sheets (trap + `Escape`).
- `aria-live="polite"` on the price readout so a screen reader announces ticks
  without interrupting.
- `prefers-reduced-motion: reduce` genuinely disables motion — tested, not assumed.
- Every icon-only control has an `aria-label`.

---

## 14. The unlock flow (Phase 3)

The app already has Vanguard-grade unlock and presents it like an afterthought:
`js/vault.js` implements a WebAuthn platform passkey with the PRF extension whose
derived key wraps the same AES-256-GCM master key the passcode wraps. It works.
The defect is purely **flow** — `boot()` shows the passcode field first and Face
ID is a secondary button the user must find.

**Target:** on launch, if a vault exists *and* `pt_v_prf` exists *and*
`vaultFaceAvailable()` resolves true, call `unlockWithFace()` immediately. The
system Face ID sheet is the first thing on screen.

**The gesture problem.** Safari and `WKWebView` reject
`navigator.credentials.get()` outside a user gesture with `NotAllowedError`. A
naive auto-invoke works on desktop and fails silently on device. So: attempt the
auto-invoke, **measure elapsed time**, and treat a sub-300ms `NotAllowedError` as
a gesture rejection rather than a user cancellation — falling back to a lock
screen whose single large primary control is *Unlock with Face ID*. Either way the
user never sees a passcode field first.

**Fallback ladder:** Face ID → *cancelled or failed* → quiet "Use passcode"
link → passcode field → *forgotten* → restore from backup, or erase.

**Re-lock policy** (the app currently has none — it only locks when the page is
destroyed): lock on backgrounding after an idle period, default 5 minutes, via
`visibilitychange` / `pagehide`. Options: Immediately / 1 / 5 / 15 min / Never.

**Frozen regardless:** `kekFromPass`, `kekFromPrf`, `wrapMK`, `unwrapMK`,
`saveVaultNow`, `loadVaultData`, `doSetup`, the PBKDF2 iterations, the HKDF
parameters, the PRF salt handling, and the keys `pt_v_pass`, `pt_v_prf`,
`pt_vault_data`. This phase rewires **which door opens first, not the locks.**

**Invariants:** the passcode wrap always remains as recovery (Face ID is never the
only key); the passcode is never stored; the master key lives **only in memory**
and is never written to `localStorage`, `sessionStorage`, IndexedDB or a cookie;
the demo passcode never derives a real key; `enrollFace` keeps
`userVerification: 'required'`.
