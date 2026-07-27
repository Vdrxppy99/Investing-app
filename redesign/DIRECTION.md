# Direction — structural change, before any of it is built

Wireframes only. Read `DESIGN.md` for the tokens and components. The point of this
file is that the redesign is **structural, not cosmetic** — if you only recoloured
the current screens they would still read as a prototype, because the problem is
that nothing on them is prioritised.

Legend: `▣` icon · `═` primary emphasis · `─` divider · `▲▼` delta · `░` skeleton

---

## Portfolio

### Now (375px) — the problem

Four stacked bordered boxes of equal weight, then a chart, then holdings as
individual bordered cards, then five more bordered boxes. Every element is a
`1px solid --line` card, so nothing is the hero and the eye has nowhere to land.

```
┌ total ───────────┐   ← card
┌ day change ──────┐   ← card, same weight
┌ stats ───────────┐   ← card, same weight
┌ chart ───────────┐   ← card, same weight
┌ VTI ─────────────┐   ← card per row
┌ VXUS ────────────┐   ← card per row
┌ allocation ──────┐
┌ goal ────────────┐
┌ dividends ───────┐
┌ movers ──────────┐   ← 10 boxes, one scroll, no hierarchy
```

### New (375px)

```
┌─────────────────────────────────┐
│ Portfolio            ▣ ⚙        │  title + icon actions
│                                 │
│  $146,984.16                    │  ═══ hero, clamp(38,10vw,48)
│  ▲ $1,804.62  1.29%  today      │  delta, --gain, tabular
│  Cost $100,977 · Gain 45.56%    │  caption, one line not a card
│                                 │  ← hero is ONE unit, no border
│ ┌─────────────────────────────┐ │
│ │                        ╱    │ │  chart card, level 1
│ │              ╱╲    ╱╲╱      │ │  1.75px --primary + tint fill
│ │        ╱╲╱╲╱    ╲╱          │ │  horizontal gridlines only
│ │   ╱╲╱                       │ │
│ │  ┌───┬───┬───┬───┬───┬───┐  │ │
│ │  │ 1D│ 1W│ 1M│ 3M│ 1Y│ALL│  │ │  segmented control
│ │  └───┴───┴───┴───┴───┴───┘  │ │
│ └─────────────────────────────┘ │
│                                 │
│ HOLDINGS                        │  --t-micro eyebrow
│ ─────────────────────────────── │
│ ▣ VTI    Total Stock            │  divided list rows,
│          ╱╲╱  $82,875  ▲0.83%   │  NOT a card each
│ ─────────────────────────────── │
│ ▣ VXUS   Total Intl             │
│          ╲╱╲  $23,461  ▼0.14%   │
│ ─────────────────────────────── │
│ ▣ BND    Total Bond             │
│          ╱╲╱  $16,067  ▲0.10%   │
│ ─────────────────────────────── │
│                                 │
│ ▸ Allocation                    │  demoted to disclosure rows
│ ▸ Goal · 59% of $250,000        │
│ ▸ Dividends · $2,776 / yr       │
├─────────────────────────────────┤
│  ▣      ▣      ▣                │  tab bar, opaque level 3
│ Port  Explore Insights          │
└─────────────────────────────────┘
```

The hero loses its border entirely. That is the single biggest change: a number
that large does not need a box around it, and boxing it made it peer with the
day-change box next to it.

### New (≥1024px) — app shell

```
┌──────────┬──────────────────────────────────┬──────────────┐
│  ▣ Port  │ Portfolio                        │ ┌──────────┐ │
│  ◈ Explr │                                  │ │ALLOCATION│ │
│  ◍ Insig │  $146,984.16                     │ │   ◕      │ │
│          │  ▲ $1,804.62  1.29%  today       │ │ VTI  56% │ │
│          │  ┌────────────────────────────┐  │ │ VXUS 16% │ │
│          │  │                      ╱     │  │ └──────────┘ │
│          │  │           ╱╲   ╱╲╱         │  │ ┌──────────┐ │
│          │  │      ╱╲╱╲╱  ╲╱             │  │ │ GOAL     │ │
│          │  │  1D 1W 1M 3M 1Y ALL        │  │ │  ◕ 59%   │ │
│          │  └────────────────────────────┘  │ │ $250,000 │ │
│          │  HOLDINGS                        │ └──────────┘ │
│          │  ── VTI  ╱╲╱ $82,875 ▲0.83%      │ ┌──────────┐ │
│          │  ── VXUS ╲╱╲ $23,461 ▼0.14%      │ │DIVIDENDS │ │
│          │  ── BND  ╱╲╱ $16,067 ▲0.10%      │ │ $2,776/yr│ │
│  ⚙ Set   │                                  │ └──────────┘ │
└──────────┴──────────────────────────────────┴──────────────┘
  240 rail        main, max 1080                 320 (360@1440)
```

The demoted modules stop being disclosure rows and become the right column. Same
components, different slot — that is what a layout system buys you.

---

## Explore

### Now — three identical stacked lists

Most Active, Gainers and Losers are three separate bordered cards containing the
same row shape. That is a layout that never decided what mattered.

### New (375px)

```
┌─────────────────────────────────┐
│ Explore                         │
│ ┌─────────────────────────────┐ │
│ │ ▣ Search stocks & funds   ✕ │ │  ═══ HERO, sticky, never
│ └─────────────────────────────┘ │      scrolls away
│                                 │
│ INDICES                         │
│ ┌──────┐┌──────┐┌──────┐┌────── │  horizontal rail →
│ │S&P500││NASDAQ││ DOW  ││ VIX   │  tiles w/ sparklines
│ │ ╱╲╱  ││ ╲╱╲  ││ ╱╲╱  ││ ╲╱    │
│ │▲0.90%││▼0.14%││▲0.24%││▼1.2%  │
│ └──────┘└──────┘└──────┘└────── │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ┌────────┬────────┬───────┐ │ │  ← THE FIX: one card,
│ │ │ Active │Gainers │Losers │ │ │    segmented control
│ │ └────────┴────────┴───────┘ │ │    instead of 3 cards
│ │ ─────────────────────────── │ │
│ │ ▣ NVDA  Nvidia   $122 ▲2.1% │ │
│ │ ─────────────────────────── │ │
│ │ ▣ TSLA  Tesla    $280 ▼1.4% │ │
│ └─────────────────────────────┘ │
│                                 │
│ WATCHLIST                       │
│      ▣  Nothing here yet        │  designed empty state,
│   Search above to add a fund    │  not a blank div
└─────────────────────────────────┘
```

---

## Insights — the structural fix

### Now — ~20 cards, one endless scroll

Health score, returns, benchmark, drawdown, heatmap, volatility, concentration,
crash test, P/E, dividends, yield, tax lots, realised gains, projections, FI
number, look-through, sectors, goal trajectory … all expanded, all at once,
forever. A brokerage app shows a health score and three numbers.

### New (375px) — four groups, summary visible, detail on tap

```
┌─────────────────────────────────┐
│ Insights                        │
│                                 │
│  82  Portfolio health           │  ═══ hero: one number
│  Good · diversified, low fees   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ PERFORMANCE               ▸ │ │  group 1 — headline +
│ │ ▲ 16.25%  vs S&P ▲ 12.1%    │ │  3 supporting figures
│ │ Max drawdown ▼ 13.0%        │ │  detail behind the ▸
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ RISK                      ▸ │ │  group 2
│ │ Volatility 8.26% · Conc 56% │ │
│ │ Crash test ▼ $19,530        │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ INCOME & TAX              ▸ │ │  group 3
│ │ $2,776 / yr · 1.29% yield   │ │
│ │ Unrealised $46,007          │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ FUTURE                    ▸ │ │  group 4
│ │ $289,140 by 2036            │ │
│ │ FI at $1.3M · 59% of goal   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

Tapping a group opens the sheet with that group's full detail — the ~20 metrics
all still exist and none are deleted. They stop being the *default* view.

### New (≥1024px) — 3-up

```
┌──────────┬────────────────────────────────────────────────┐
│  ▣ Port  │ Insights      82 Portfolio health              │
│  ◈ Explr │ ┌──────────┐┌──────────┐┌──────────┐           │
│  ◍ Insig │ │PERFORM. ▸││RISK     ▸││INCOME   ▸│           │
│          │ │▲16.25%   ││Vol 8.26% ││$2,776/yr │           │
│          │ │vs ▲12.1% ││Conc 56%  ││1.29%     │           │
│          │ └──────────┘└──────────┘└──────────┘           │
│          │ ┌──────────┐                                   │
│          │ │FUTURE   ▸│                                   │
│          │ │$289,140  │                                   │
│          │ └──────────┘                                   │
└──────────┴────────────────────────────────────────────────┘
```

---

## Lock screen

### Now — the worst first impression in the app

Opens on a **passcode field**. Face ID is a secondary button the user has to find.
Carries the heaviest concentration of inline styles and emoji anywhere (`☁️`, `👀`,
and a full inline rule set on `#restoreFirst`).

### New

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│              ▣                  │  logo, 56px
│         My Portfolio            │  --t-title
│                                 │
│   ┌─────────────────────────┐   │
│   │  ▣  Unlock with Face ID │   │  ═══ ONE large primary
│   └─────────────────────────┘   │      control. Nothing
│                                 │      competes with it.
│         Use passcode            │  quiet text link
│                                 │
│                                 │
│   Restore from backup           │  tertiary
│   See an example portfolio      │  tertiary, no emoji
└─────────────────────────────────┘
```

On launch with a passkey enrolled, the system Face ID sheet appears over this
before the user does anything. This screen is what they see only if the automatic
attempt was rejected for lack of a user gesture — hence the single big button.
