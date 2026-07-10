# Changelog

History condensed to version notes on 2026-07-10 (repository history was rewritten to remove personal data).

- **2026-07-02** · Add files via upload
- **2026-07-04** · Add files via upload
- **2026-07-04** · Add files via upload
- **2026-07-04** · Make Markets and Insights tap-through; remove rebalance, fees, trade stats
- **2026-07-08** · Fix profit chart glitch: live price ticks used the old deposits-based profit formula, spiking the last chart point above the lots-based line (W/V shapes)
- **2026-07-08** · **v3.1**: fix W/V chart glitch at the source — never overwrite fresh quotes with 15-min-delayed stooq prices, reject implausible ticks (>25%), poll 10s instead of 3s, visible ver
- **2026-07-08** · **v4.0**: full visual redesign — Inter typography, cobalt design system, dark/light themes, validated chart palette, micro-animations
- **2026-07-09** · **v4.1**: hero balance card; right chart for each data type — stacked bars for asset location/exchanges, ranked bars for sectors, center-labeled allocation donut
- **2026-07-09** · **v5.0**: brand identity — emerald-on-black theme, real app icon + PWA manifest, greeting header, Today's-mover card
- **2026-07-09** · **v6.0**: paid-app interactions — chart scrubbing (drag to see any date's value in the header), axis-less hero chart with glow + min/max labels, gradient stroke, film-grain depth
- **2026-07-09** · **v7.0**: guidance features that paid apps charge for — savings Goal tracker (progress ring + projected finish date from real return + contribution pace) and Portfolio Health Sco
- **2026-07-09** · **v7.1**: UI polish + universal clickability — SVG line-icon header (theme/currency/gear/refresh), tappable stat chips and P/E/Risk/Health cards that open explainer sheets, progr
- **2026-07-09** · **v7.2**: stock search (Markets), pull-to-refresh, service worker (offline + instant load, network-first HTML so updates always land, never caches live price data)
- **2026-07-09** · **v7.3**: Performance section (deposit-adjusted period returns, same-buys-in-S&P benchmark, money-weighted return), remove Wealth Projector + Exchanges, balanced Insights grid, .no
- **2026-07-10** · **v7.4**: restore code accidentally deleted in v7.3 (Markets search, stat-chip explainers, stock sheets) + add Watchlist (star stocks from any stock sheet, live prices on Markets, 
- **2026-07-10** · **v8.0**: full makeover — Portfolio · News · Explore · Insights
- **2026-07-10** · **v8.1**: ranked news + chart y-axis + holdings sort
- **2026-07-10** · **v8.2**: wealth-manager pass — benchmark scoreboard, drawdown chart, day attribution, deep holding stats, narrative Insights
- **2026-07-10** · **v8.3**: fair benchmarks, dividend calendar, CSV export, swipe-to-dismiss sheets
- **2026-07-10** · **v8.4**: live search prices, 52-week range bar, tappable performance rows, cumulative contributions line
- **2026-07-10** · **v8.5**: privacy mode (eye toggle) + per-holding news feeds
- **2026-07-10** · **v9.0**: vault — passcode + Face ID lock, AES-256 encryption, personal data removed from public source
