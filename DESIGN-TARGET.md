# DESIGN-TARGET.md

The visual specification for the app. `design/target/five-tabs.html` is the
rendered reference — **open it in a browser before implementing anything**. It is
the source of truth. This file explains the rules behind it.

Approved by the owner. Do not substitute your own judgement for it.

---

## Positioning

Delta by eToro is the acknowledged inspiration for the *feature set* and the
*information architecture*. It is deliberately NOT the visual reference. The app
must read as inspired-by, not copied-from, because it goes on the owner's CV.

Concretely, these are the divergences from Delta and they are not negotiable:

| | Delta | This app |
|---|---|---|
| Brand accent | green | **indigo `#7C6CFF`** |
| Asset tiles | circles | **squircles, radius 13 on 40px** |
| Cards | solid raised fill | **hairline border `#1B212C` + 3.5% white fill** |
| Allocation | donut | **horizontal segmented strip** |
| Signature feature | — | **ETF look-through, given its own tab** |

Green and red appear ONLY on gain/loss figures. They are never used for chrome,
navigation, active states, focus rings, or progress fills. That single rule is
most of what separates this from the current build, where the brand colour and
the profit colour were the same value.

---

## Tokens

All of these live in `css/tokens.css` and nowhere else.

```
--canvas      #0B0F17     already correct, unchanged
--surface     rgba(255,255,255,.035)   card fill
--line        #1B212C     card border
--divider     #151A23     row separator
--brand       #7C6CFF     indigo — replaces the old green brand
--brand-soft  rgba(124,108,255,.14)    chip / pill background
--gain        #2FD08A
--loss        #FF5D6B
--text        #F2F4F8
--text-mut    #6E7789
--text-faint  #525A6A
```

Asset palette, assigned by position order and stable per symbol:

```
#7C6CFF  #5B8DEF  #F97316  #EAB308  #3ABEC7  #E36A9A  #2F6BE0  #B45309
```

**Corrected after R1.** The original 4th entry was `#2FD08A`, byte-identical to
`--gain` — which contradicted this document's own rule that green and red appear
only on gain/loss. R1 implemented it literally as instructed and correctly
flagged the contradiction. Position 3 shifted amber to orange to keep 3 and 4
distinguishable. No categorical colour may equal `--gain` or `--loss`.

**Contrast note.** `--text-muted` and `--text-faint` as originally specified
(`#6E7789` / `#525A6A`) measured 4.26:1 and 2.77:1 against the canvas, below the
4.5:1 floor this document requires. R1 lightened both to clear it, same hue
family. **The values now in `css/tokens.css` are canonical, not the hexes
above.** `redesign/contrast-check.mjs --strict` is the arbiter.

### Type scale — 7 steps, no others

```
34-40px / 660   hero total          (40 portfolio, 33 home card)
25px   / 660    screen title
21-22px / 660   module stat value
17px   / 660    asset detail title
14-15px / 640   row primary
12.5px / 550    body, secondary
11-11.5px / 650 row secondary, labels
10-10.5px / 700 section label, letter-spacing .06-.09em, uppercase
```

Every number uses `font-variant-numeric: tabular-nums lining-nums` and
`letter-spacing: -.02em`. (`lining` alone is not a valid keyword — the parser
drops the whole declaration. Corrected 2026-08-16 after it silently dropped
tabular-nums from every number in the app; see CHANGELOG.)

### Shape and space

```
radius   16 cards · 13 tiles(40px) · 10 tiles(32px) · 11 segmented · 8 seg items
gutter   20px screen padding
rows     10px vertical padding, 11px gap, 1px divider
```

### Section label

Every section is introduced by the same component: a 3x11px indigo rule, then a
10.5px 700-weight uppercase label at `.09em` tracking, with an optional right-
aligned value in 12px/650 text colour. Never a bare `<h4>`.

---

## The five tabs

`Home · Markets · Portfolio · Insights · Following`

This replaces the current three-tab structure. The current Explore tab is doing
two unrelated jobs — market browsing and the personal watchlist — and splitting
it is the point.

### 1. Home — new screen

Greeting and market-open countdown. One portfolio card: label, total, today's
delta, a 62px-tall sparkline, and the allocation strip. Then three sections —
**Today's movers** (attribution, "drove 41% of today's move"), **Coming up**
(dividend ex-dates with a day-count chip), **Goal** (progress bar, target date).

Nothing here is new maths. Attribution exists in the current Portfolio tab as
"today's drivers"; the dividend calendar and goal tracker already exist.

### 2. Markets — half of the current Explore tab

Search field. Indices as a 2x2 grid of small cards. **The three screener lists
(most active / gainers / losers) collapse into ONE card with a segmented
control** — this is the fix `REDESIGN_PROMPT.md` phase 5 specified and never
delivered. Sector performance as a plain row list.

### 3. Portfolio

Hero: label, total at 37px, then today's delta AND all-time return on one line.
Chart directly beneath, full-bleed, no card. Range segmented control. Then the
allocation strip — **not a donut**. Then holdings **grouped by asset class with a
subtotal per group** (`ETFs · 5 — $129,051.24`).

Each row: squircle tile, name, `62.057 sh · avg $512.30`, a 38x20 sparkline,
value, and **total return %** — not today's move. Today's move belongs on Home.

Allocation, goal, dividend calendar and movers all leave this screen. They live
on Home or behind the holding sheet.

### 4. Insights

Screen title, then a health card: 62px indigo progress ring with the letter
grade, and one sentence naming the single thing holding the grade down. Then a
2-column module grid: XIRR, vs-VOO, volatility, beta, max drawdown, portfolio
P/E as small cards; monthly-return heatmap and sector exposure as full-width.

Every figure already exists in `js/insights.js`. This is presentation only —
including the corrected 13.39% volatility from Phase 1.

### 5. Following

Watchlist rows (symbol, when added, sparkline, price, day change), then
**Stocks you already own** — the ETF look-through, with the dollar value and
portfolio percentage held indirectly through each fund, and which funds it comes
through.

This tab is the app's differentiator and the reason it is not a Delta clone.
Delta has a watchlist; Delta does not tell you that you already hold $4,293 of
Microsoft without knowing it. Treat it as a headline feature, not a footnote.

---

## Rules that apply to every screen

1. No literal colour, size, radius or duration outside `css/tokens.css`.
2. No emoji as iconography. `js/icons.js` exists.
3. No inline `style=` emitted from JS. `js/ui.js` exists.
4. Gain/loss is never conveyed by colour alone — always paired with a sign or
   arrow.
5. Every chart colour is read live from a token so the theme toggle keeps working.
6. A light theme equivalent must be derived for every token added. The app ships
   both themes and light mode is unforgiving about spacing.
7. Text inputs are never below 16px — iOS Safari zooms the viewport otherwise,
   which is an instant "this is a web page in a wrapper" tell.

---

# Home v2 — owner brief, August 2026

Supersedes the Home section above. Frame 1 of `five-tabs.html` remains valid for
type, colour and spacing; this changes what is on the screen and in what order.

Screen order, top to bottom:

1. Daily Movers (bar chart)
2. Upcoming — dividends AND earnings
3. Your Portfolio — value, delta, sparkline, allocation strip
4. Price highlights
5. Portfolio insights
6. Goal

## 1. Daily Movers — replaces the current text-row movers

A bar chart, not a list. Reference: the owner's Delta screenshot.

- Section label `STAY ON TOP` above a title `Your Daily Movers`, per the
  established `.sec` component.
- Top-right: a two-state segmented toggle, gainers ↗ / losers ↙. Both states
  must work — the current build shows gainers only.
- One card. Inside it, up to five vertical bars sharing a common baseline.
- Each column, top to bottom: signed percentage label, the bar, a circular
  logo, the ticker.
- Bar height is proportional to the largest absolute move in the visible set,
  so the leader always fills the column and the rest scale against it. A bar
  with a near-zero move still renders a visible sliver plus its label.
- Fill: a vertical gradient from the semantic colour at the top fading downward,
  rounded top corners only.
- Colour: `--gain` for the gainers view, `--loss` for losers. The sign is always
  printed, so colour is never the sole carrier.
- Built with divs and CSS. Do not add a chart library for this.

## 2. Upcoming — dividends and earnings

The current section shows dividend ex-dates only. Earnings move a price far more
than a distribution does, so both belong here, merged into one date-sorted list.

- Each row: logo, `SYMBOL · event`, the date, and a day-count chip.
- Dividend row: "Dividend · ex-div 18 Sep", estimated amount as the subtitle.
- Earnings row: "Q3 2026 earnings · 2 Sep".
- ETFs have no earnings. A portfolio that is mostly ETFs will show mostly
  dividends, and that is correct — do not invent earnings rows to fill space.
- If no free earnings source proves workable, ship the dividend half and say so
  plainly. Never display a fabricated or guessed date.

## 3-6

- **Your Portfolio** — unchanged from Home v1.
- **Price highlights** — the Empower pattern: the holdings currently performing
  best. Top three by total return, each with logo, ticker, name, return %.
  Label it so it reads as observation, not recommendation.
- **Portfolio insights** — three compact tiles pulled from the Insights tab:
  health grade, XIRR, and vs-VOO. Tapping any of them opens the Insights tab.
  No new maths.
- **Goal** — unchanged from Home v1.

## Logos

Every asset surface — movers, upcoming, holdings rows, price highlights, asset
detail — uses the real company or fund logo, with the ticker monogram as
fallback only. A monogram where a logo should be is the single strongest
"unfinished" signal left in the app.

`badgeHtml()` in `js/core.js` already fetches logos. The bug is that the
fallback monogram is not hidden once the real logo loads, so both render
stacked. Fix the mechanism, then apply it everywhere.

Logos must be cached, and their absence must never break a row — the app is
offline-first and the logo host is third-party.

---

# Home v3 — section order

Supersedes the ordering in Home v2. Content of each section is unchanged; only
the sequence moves.

The problem with v2: Daily Movers sat above the portfolio value. The total is
the reason the app gets opened — it is the headline, and everything else is
commentary on it.

The order below zooms out in time as you scroll: where you stand now, why it
moved today, what has done well, how you are doing overall, what is coming,
where you are headed.

1. **Your Portfolio** — total, today's delta, sparkline, allocation strip.
2. **Daily Movers** — the bar chart. It explains the number directly above it,
   which is why it belongs second rather than first.
3. **Price highlights** — best performers. Same holdings, longer horizon.
4. **Portfolio insights** — health grade, XIRR, vs-VOO, with the
   "Ahead of / Behind the S&P 500" narrative as the lead line.
5. **Upcoming** — dividends and earnings. The first forward-looking section.
6. **Goal** — the Monte Carlo projection. Longest horizon, so it closes.

Section content, components and copy stay exactly as built. This is a reorder.

---

# Insights v2 — show the data, don't file it

Owner brief, August 2026. Supersedes the Insights section of Home v2.

## The problem, stated precisely

Two separate failures, and they compound.

**One: the app files information instead of showing it.** R2 collapsed ~20
stacked cards into a health card, six stat tiles and a "More" list. That fixed
an endless scroll and created a discovery problem — fourteen features now sit
behind a tap, so the app's best work is invisible.

**Two, and worse: the modules that ARE visible show numbers in boxes.** A number
with a caption is not a visualization. Even a surfaced feature reads as a fact in
a list rather than something you look at.

## The pattern to adopt, from Delta

Delta's Portfolio Insights modules are, without exception, **a chart plus the
specific holdings driving it**. Their Risk module is a comparative chart plus a
"riskiest assets" list. Their P/E module is a comparative chart plus a "top P/E
assets" list. Asset Worth is a line chart highlighting the top four holdings.

They never print a lone number. They show a shape, then name names.

Our beta module says `0.93 — vs S&P 500`. It should show where the portfolio sits
against the benchmark, and which holdings pull it up and down.

**Rule: every Insights module carries a mark and at least one holding name.**
If a module can only be a number, it is a stat tile on Home, not an Insights
module.

## The personal flair — what makes this not a Delta clone

Delta generalises because its users hold fifty assets across ten exchanges. It
must show "top 4" because it cannot show forty.

**This portfolio holds six positions. It can always name all of them.** Every
module shows the complete picture rather than a truncated leaderboard — every
holding's contribution to beta, to sector exposure, to drawdown, to yield. That
is a capability Delta structurally cannot offer, and it comes from the owner's
situation rather than from copying anyone.

Second differentiator, already built and under-used: the app knows every purchase
lot with its date. Per-lot outcomes belong in Insights, not just on the asset
sheet.

## Form per module — pick by the data's job, not by habit

Read `.claude/skills/dataviz` before writing any of these. The form heuristic
and the mark specs are not optional, and the palette validator is runnable.

- **Health** — single headline → ring. Already correct. Keep.
- **XIRR vs benchmark** — comparison of two magnitudes → paired bars, not two
  separate tiles printing two numbers.
- **Risk** — position on a scale → the portfolio's beta marked against the
  benchmark on a single axis, with each holding's beta plotted on the same
  axis. One picture answers "how risky, and because of what".
- **Drawdown** — change over time → the actual drawdown curve, not the number
  `-9.81%`.
- **Sector and geography** — part-to-whole → the existing bar strip. Keep.
- **Monthly returns** — magnitude over a time grid → heatmap. Keep.
- **Portfolio P/E** — comparison plus contributors → bar against SPY, holdings
  ranked beneath.
- **Tax lots** — categorical split → short-term versus long-term as a bar, with
  the lots listed by holding.
- **Contributions** — change over time → bars by period.

## Structural rule

The "More" list stops being the default destination. A feature goes behind a tap
only if its full form genuinely needs a full screen. Everything else gets a small
mark on the tab itself — a sparkline, a strip, a two-bar comparison — with the
tap opening the detailed version.

## Palette — currently failing validation, must be fixed first

`node .claude/skills/dataviz/scripts/validate_palette.js` on the current
`--cat-1..8` fails in dark mode on three checks:

- **Lightness band** — four slots sit outside the legal `L 0.48-0.67`.
- **CVD separation** — `--cat-1` and `--cat-2` measure ΔE 5.7 under deuteranopia.
- **Normal-vision floor** — that same pair measures ΔE 9.0 for full-colour
  vision, a hard fail. Below 15 means nobody can reliably tell them apart.

In practice: in the allocation strip, `--cat-1` and `--cat-2` are the two largest
holdings, sitting adjacent, and they look like the same colour.

Root cause: the eight slots do not contain eight distinct hues. `--cat-2`/`--cat-7`
are both blue and `--cat-3`/`--cat-8` are both orange; they read as different only
because of lightness, which the legal band forbids. **Six validated slots beat
eight that collide** — and six matches the number of positions actually held.

Re-derive with the validator, in both modes, against surfaces `#0B0F17` and
`#FBFBFC`. Keep `--brand` as slot 1. `--gain` and `--loss` are status colours and
must never appear as a categorical slot.

## The rendered spec

`design/target/insights-v2.html` — open it in a browser. It is the approved
target for this work, the same way `five-tabs.html` was for the five-tab
rebuild. Six modules are built there; the pattern generalises to the rest.

Three things it establishes:

**1. Form.** Risk is an axis with every holding plotted and the portfolio marked
on it, not the number 0.93. Deepest drop is the actual curve with the trough
dated, not the number −9.81%. Return-vs-benchmark is paired bars, not two tiles.
Contributions are bars. Sector is a **sequential single-hue ramp ordered by
magnitude**, not six categorical colours — ordered magnitude is a sequential job,
and treating it categorically was a form error.

**2. Names.** Every module that can name a holding does. Deepest drop names which
fell hardest and which held up. Risk plots all six on the axis. This is only
possible because the portfolio has six positions — Delta shows "top 4" because
its users hold fifty and it cannot show forty. Showing all of them is a
capability that comes from the owner's situation, not from copying anyone.

**3. The goal line.** Every card ends with one sentence, marked by an indigo
rule, translating the module into the goal:

> A 20% market drop costs you **$27,536** — and pushes your goal from
> **Nov 2028** to **Jul 2029**.

> Cost **$14,517** at the low. You were back to even in **4 months** — you kept
> buying through it.

> At **$850**/month you arrive **11 months early**. Adding $100 more makes it 18.

This is the part a consumer tracker structurally cannot write, because it does
not know the owner's target or date. It is the difference between an app that
shows you data and an app that is yours. Where a module has no honest goal-
relative statement, omit the line rather than inventing one — a filler sentence
is worse than none.

**Colour note:** every module in the rendered spec uses brand plus gain/loss
only. None of these forms needs the categorical palette, which is why the
palette fix and this work can proceed independently. Only the allocation strip
still needs categorical slots.
