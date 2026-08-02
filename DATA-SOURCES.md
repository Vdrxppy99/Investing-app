# DATA-SOURCES.md — free and free-tier feeds

**Assumption corrected:** holdings are **US-domiciled Vanguard funds, bought in the
USA, money held in the USA**. Owner is in Germany on a study-abroad basis only.
This changes the answer substantially from an EU/UCITS assumption — US tickers, US
tax lots, US-only free tiers are all fine, and SEC filings become usable.

Everything below was verified against each provider's own pricing or docs page.
Free tier or free-with-signup only; no paid plans.

---

## Two things about the current code

**Your stooq fallback is dead.** `stooq.com/q/d/l/` now serves a JavaScript
SHA-256 proof-of-work challenge instead of CSV, and `q/l/` 404s. It cannot be
fixed from a Worker. Remove it or replace it.

**Yahoo `v7/finance/quote` is crumb-gated and returns 401.** Only the
`v8/finance/chart` endpoint still works unauthenticated. If any code path still
hits v7, it is silently failing.

---

## Recommended stack

### 1. Yahoo `v8/finance/chart` — move it onto your Cloudflare Worker
Quotes, intraday, full history, plus dividends and splits in one call via
`?events=div,split`. No key. Not CORS-callable, which is why you currently proxy it.

**The change worth making:** stop using allorigins and corsproxy.io, and route
through your own Worker instead. You drop two third-party single points of failure,
you gain KV caching — which is the thing that actually protects you from Yahoo's IP
throttle — and you can set a stable user agent. This is the highest-value
infrastructure change available to you, and you already have the Worker deployed.

Licence caveat: unofficial, Yahoo's ToS forbids redistribution. Personal use is grey.
Fine for a private app; do not publish it as a service.

### 2. SEC EDGAR — free, no key, and now directly relevant
Since the funds are US-domiciled, they file **N-PORT** — full quarterly portfolio
holdings. This is the real data source for your "stocks you secretly own"
ETF look-through feature, replacing whatever approximation is there now. Also
gives you N-CEN, expense data, and company facts via XBRL for individual stocks.

Note: `data.sec.gov` does not support CORS (their words), so it goes through the
Worker. They require a descriptive `User-Agent` header with contact info — the
Worker is the right place to set it. Public domain, no licence issue.

### 3. Frankfurter (keep) + ECB Data Portal as failover
`api.frankfurter.dev` — no cap, no key, `ACAO: *`, 201 currencies back to 1948.
`data-api.ecb.europa.eu` is the upstream source, also keyless and CORS-open, so
failing over between them needs no reconciliation. Still relevant even with US
holdings, since you live in EUR.

### 4. Vanguard's own product API
`investor.vanguard.com` exposes fund data directly from the issuer — distributions
with exact ex-div/record/payable dates, yield, expense ratio, NAV vs market price.
Since every holding is Vanguard, this is issuer-primary and strictly better than any
aggregator for the dividend numbers your forecast and payout calendar depend on.
Undocumented, so treat the response shape as unstable and cache defensively.

*(The verified-working equivalent found during research was the UK site,
`vanguardinvestor.co.uk/api/productList` and `/api/funds/{portId}`, which returned
57 quarterly distributions for VWRL. The US site's endpoints differ — worth
30 minutes with devtools on your own holdings page to find the equivalents.)*

---

## Now usable because the holdings are US

These were disqualified under the EU assumption and are back on the table. All are
US-only on their free tiers, which no longer matters.

| Provider | Free tier | Key | Best for |
|---|---|---|---|
| **Finnhub** | 30 req/s global cap; `/quote` free for **US stocks** | Yes | Real-time-ish US quotes. Note 85 of 114 endpoints are premium — candles, dividends, splits, ETF holdings are all paid. `/company-news` is free for North American companies, which covers your news feature. |
| **Alpaca** | 200 req/min, 7y history, 15-min delayed, IEX feed | Yes (brokerage signup) | The most generous free quota here by a wide margin. Good for backfilling history. |
| **Tiingo** | 50/hr, 1,000/day, 500 unique symbols/mo, 30y history | Yes | Deep US EOD history. Licence is **"Internal Use Only"** — fine for a private app, do not publish. |
| **Twelve Data** | 800 credits/day | Yes | US + FX + crypto free. Clean API, good docs. |
| **Massive** (was Polygon) | 5 calls/min, 2y, EOD | Yes | Thin quota; keep as a tertiary fallback. |
| **Alpha Vantage** | **25 requests/day** | Yes | Only worth it for the free `DIVIDENDS` endpoint, which returns forward ex-div dates. Budget strictly. |
| **Nasdaq Data Link** | free key: 2,000/10min, 50,000/day | Yes | Huge quota but equity datasets are now premium; free content is macro. |
| **FRED** | unpublished | Yes | Macro series. Mandatory attribution string — read their terms before displaying. |

**Still not worth it:** EODHD (20 calls/day), Marketstack (100/month, commercial use
barred), marketdata.app (24h delayed), exchangerate.host (now key-gated, Frankfurter
strictly dominates), justETF (no API, ToS-hostile to scraping).

---

## Tax — the correction that matters most

Earlier guidance in `UPGRADE_PLAN.md` Phase 6 warned about **Vorabpauschale**,
**Teilfreistellung** and the **Sparerpauschbetrag**. With US-domiciled funds held in
a US account, **those are the wrong rules and should be ignored.**

What applies instead: US cost-basis and tax-lot rules, qualified vs ordinary
dividends, short vs long-term capital gains, wash sales. The
`JoelLewis/finance_skills` `wealth-management` plugin — flagged earlier as
"US-normed, ignore the tax parts" — is now the *right* fit rather than a hazard.
Its `performance-metrics` (TWR/MWR), `performance-attribution` (Brinson) and
`rebalancing` (drift monitoring) skills map directly onto your Insights tab.

```
/plugin marketplace add JoelLewis/finance_skills
/plugin install wealth-management@finance-skills --scope project
```

One thing worth checking with a professional rather than an app: living in Germany
while holding US assets can create German tax-residency questions depending on how
long you stay. That is a personal-circumstances question, not something to encode
in the app, and I am not in a position to advise on it.
