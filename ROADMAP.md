# Where this app stands against the real ones

Written after walking every screen and exercising every control, and after
checking what Empower, Vanguard, Fidelity and Schwab actually ship in 2026.

## First, the honest framing

Vanguard and Fidelity are **brokerages**; this is a **tracker**. Trading,
transfers and account opening are their product and are irrelevant here. The real
field is the dedicated trackers:

| App | What it is known for | Price |
|---|---|---|
| **Empower Personal Dashboard** | net worth, retirement planner, fee analyzer | free |
| **Delta** | breadth — stocks, crypto, 100s of broker links, widgets, alerts | freemium |
| **Kubera** | total wealth — property, private investments, collectibles | paid |
| **Sharesight** | tax reporting accuracy, per-country capital-gains reports | freemium |
| **Stock Events** | dividend income visualisation, yield-on-cost, great widgets | freemium |
| **Snowball Analytics** | target-allocation rebalancing, dividend forecast, goals | freemium |

Measured against that field this app is already competitive, and in three places
nothing on the list matches it.

## What you already beat them on

| | Yours | The field |
|---|---|---|
| **Look-through holdings** — the actual companies inside your funds, in dollars | yes | **none of them** |
| **Crash test** — replays 2008/2020/2022 on your real positions, with recovery times | yes | **none of them** |
| **Privacy** — no bank credentials, encrypted on device, nothing linked | yes | Empower, Delta, Kubera all require linking |
| AI assistant answering over your own numbers | yes | **none of them** |
| Health score from your real data | yes | Empower only |
| Dividend forecast by month | yes | Stock Events, Snowball |
| Push alerts on ATH / breakouts / movers | yes | Delta |
| Cost — forever | **$0** | most gate the good parts |

Those first four are a genuine moat. Look-through in particular does not exist
anywhere in this list — it is the most interesting thing in the app and it is
currently buried at the bottom of Insights.

## The real gaps, ranked by what a professional app would fix first

### 1. Net worth — the biggest structural gap
Empower's whole identity is one number: assets minus liabilities. This app only
knows investments. A user with a mortgage, cash savings and a car loan sees a
portfolio, not a financial position.

**Do:** add manual "other assets" and "liabilities" (cash, property, loans) and a
net-worth line above or beside the portfolio total. Manual entry is fine — it is
the same tradeoff you already accept for holdings, and it avoids bank linking
entirely.

### 2. Fee analyzer with alternatives
Empower's Investment Checkup names your expensive funds and proposes cheaper
equivalents. You compute an average fee inside the health score but never act on
it.

**Do:** a "Fees" card — cost in dollars per year, the worst offender named, and a
cheaper same-exposure fund suggested from the data you already hold.

### 3. Tax-loss harvesting surface
Fidelity and Schwab both ship this. You already have per-lot cost basis, which is
the hard part — you just never surface the conclusion.

**Do:** flag lots currently at a loss, show the harvestable amount, and warn on the
30-day wash-sale window. Everything needed is already computed.

### 4. Rebalancing as an action, not an observation
You show target mix and drift. A professional app says **"buy $2,400 of VXUS"**.

**Do:** turn the target-mix card into a trade list — the exact dollar amounts that
would restore the target, newest-money-first so it can be done with a deposit
rather than a sale.

### 5. Retirement planner with events
Empower models Social Security, pensions, one-off expenses. Your projection
compounds today's money at a fixed rate, which you deliberately chose — but it
cannot answer "what if I retire at 55".

**Do:** let a target age, an expected income event and a one-off expense be added
to the projection. Keep the no-future-contributions default, since that was a
deliberate call.

### 6. Dividend depth — where Stock Events wins
Stock Events built a following purely on dividend visualisation: yield-on-cost,
income timeline, per-holding contribution. You have the forecast and the monthly
bars; you are missing **yield-on-cost** (income against what you actually paid,
not today's price), which is the number long-term holders care most about and
which you can compute from lots you already store.

### 7. Tax reporting export — where Sharesight wins
Sharesight's whole business is per-country capital-gains reports. You already hold
every lot with dates and cost basis, which is the hard part.

**Do:** CSV export of lots and realised gains. It is an afternoon of work against
data you already have, and it is the difference between "a nice app" and something
usable at tax time.

### 8. Real-time quotes
Vanguard moved off 15-minute delay in 2026. You are on the Yahoo free feed.
**Reality check:** for a buy-and-hold index portfolio this changes nothing, and
real-time data costs money. Not worth it. Worth *labelling* clearly instead — a
"delayed" marker reads as honest, not cheap.

### 9. Widgets and a Watch complication
Every serious finance app has a home-screen widget. Neither is possible in web —
this is native work, and the Worker already stores the snapshot they would read.

## Polish gaps I saw in the walkthrough

- **No search or filter on Holdings.** Fine at 7 positions, poor at 30.
- **Empty states are inconsistent** — some sections render nothing rather than
  saying why.
- **No CSV export of lots or gains.** Every real app has it, and tax season needs it.
- **No "what changed since you last opened"** — a daily digest on open. You already
  compute everything for the push alerts.
- **Insights information architecture** — still the weakest screen. Twenty metrics
  in a flat scroll; the fix is grouping by decision ("am I on track / am I taking
  too much risk / what do I owe"), not by metric type.

## Suggested order

**Stage 1 — close the credibility gap (all free, all from data you already hold)**
1. **Net worth** — manual assets and liabilities. Closes the Empower/Kubera gap.
2. **Yield-on-cost** — closes the Stock Events gap. One formula over existing lots.
3. **CSV export** of lots and realised gains. Closes the Sharesight gap.

**Stage 2 — turn observations into actions**
4. **Rebalance as a dollar trade list** — closes the Snowball gap.
5. **Fee analyzer** naming your worst fund and a cheaper equivalent.
6. **Tax-loss harvest surface**, with the wash-sale window flagged.
7. Daily "what changed since you last opened" digest.

**Stage 3 — the native layer (where web cannot follow)**
8. Home-screen **widget** — portfolio value and day change. Table stakes: Delta and
   Stock Events both ship one and it is the most-seen surface either has.
9. **Watch complication.**
10. Search and filter on Holdings.

**Stage 4 — pull ahead rather than catch up**
11. **Promote look-through** out of the Insights basement to its own tab or a
    Portfolio card. It is the one thing no competitor has; hiding it is the single
    biggest missed opportunity in the product.
12. Retirement planner with income events and a target age.
13. Insights restructured around decisions, not metric types.

## What NOT to do

- **Do not add bank aggregation.** It is the main thing Empower does that you
  don't, and it is also the reason Empower needs your credentials. Manual entry is
  a feature here, not a limitation. Say so in the app.
- **Do not chase real-time quotes.** Costs money, changes nothing for index
  investing.
- **Do not add trading.** That requires being a broker.
- **Do not chase Kubera's breadth** — property, collectibles, private equity. That
  is a different product for a different person, and it is why Kubera charges.
- **Do not build a budgeting module.** Empower and Monarch own that, it needs bank
  linking, and it has nothing to do with why you open this app.

## The honest verdict

On **analysis depth** you are already at or above the paid tier — look-through,
crash test and the health score beat everything on that list, and the AI assistant
has no equivalent anywhere.

Where you are behind is **completeness** (no net worth), **actionability** (you
report, they instruct) and **surfaces** (no widget). None of those need money to
fix, and all three are computed from data the app already holds.

Sources: [Best portfolio trackers 2026](https://portfoliogenius.ai/blog/best-portfolio-trackers-2026) ·
[Tracker comparison](https://www.mycapitally.com/blog/best-portfolio-tracker-for-the-modern-diy-investor) ·
[Empower tools](https://www.empower.com/tools) ·
[Empower Dashboard review](https://robberger.com/empower-review/) ·
[Vanguard mobile app](https://investor.vanguard.com/client-benefits/mobile-apps) ·
[Vanguard app review](https://wealthvieu.com/investing/vanguard/mobile-app/) ·
[Fidelity tax-loss harvesting](https://www.fidelity.com/viewpoints/personal-finance/tax-loss-harvesting) ·
[Schwab tax-efficient investing](https://www.schwab.com/invest-with-us/tax-efficient-investing)
