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

Every number uses `font-variant-numeric: tabular-nums lining` and
`letter-spacing: -.02em`.

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
