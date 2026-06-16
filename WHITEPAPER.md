# Epiphany Technical Whitepaper

**v1.10.4** | May 2026

Epiphany is a map first intelligence platform. It pulls live geospatial data,
markets, prediction markets, people, and news into one view, and it can trade a
portfolio on a quantified signal. Palantir for regular people. Live at
[epiphany.heyitsmejosh.com](https://epiphany.heyitsmejosh.com), with companion
apps for iOS, macOS, and watchOS.

This paper leads with the algorithms. Everything after the trading and prediction
sections is supporting detail.

## Prediction and Trading Algorithm

The core bet is that a disciplined, sized, rules based strategy beats discretionary
trading. The pipeline runs signal to execution and is paper only by default. Real
money is a separate opt in step.

### 1. Price prediction (Monte Carlo)

For each symbol the engine runs a Geometric Brownian Motion simulation: 500 price
paths over a 30 day horizon. Drift and volatility come from the symbol's recent
daily returns (log returns, annualized). Each path steps daily:

```
S(t+1) = S(t) * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z)
```

where `mu` is drift, `sigma` is volatility, `dt` is one trading day, and `Z` is a
standard normal draw. The bull probability is the share of the 500 paths that close
above the current price. That probability becomes the raw conviction score. This
runs in the in app simulator at 60fps (`src/utils/simBenchmark.js`) across the full
asset universe, and in the weekday morning cron (`server/api/broker/morning-run.js`).

### 2. Technical signal (entry filter)

A trade only triggers when the technicals agree with the prediction. The composite
signal (`src/utils/indicators.js`) combines:

- **RSI (14)**: Wilder's smoothing. Above 55 reads as strength, below 45 as weakness.
- **MACD (12/26/9)**: histogram above zero is bullish momentum, below zero bearish.
- **Moving average trend**: 50 period versus 200 period (or the longest available).
  Fast above slow is an uptrend.

Each component contributes plus or minus one to a score. Score of plus two or more
is Buy, minus two or less is Sell, otherwise Hold. The same score drives the
Buy/Hold/Sell badge shown on every stock.

### 3. Position sizing (Kelly)

Size comes from the fractional Kelly criterion. Full Kelly fraction is:

```
f* = (p * b - (1 - p)) / b
```

where `p` is the bull probability from step 1 and `b` is the reward to risk ratio
implied by the target and stop. Epiphany uses a default 0.25 fraction of `f*` to cut
variance, then caps any single position at 10% of equity. A momentum strength and
volatility gate blocks sizing into chop.

### 4. Execution and guardrails

- **Entry**: moving average crossover confirmed by the composite signal.
- **Exit**: fixed stop and target, plus a trailing stop once in profit.
- **Venue**: paper by default. Live routing goes through SnapTrade after a paper
  proving period.
- **Kill switch**: removing the broker keys disables all order placement.
- **Audit**: a full per symbol trade log is written on every run.

The strategy is shared with a backtestable Pine Script port
(`tradingview/monica-kelly-strategy.pine`) so the same rules can be validated on
TradingView history.

### Broker abstraction

`src/utils/broker.js` defines one `BrokerAdapter` interface (`connect`, `placeOrder`,
`getPositions`, `getBalance`). Adapters: Alpaca (paper and live), SnapTrade (read
only aggregator sync, HMAC signed REST, covers Wealthsimple and Questrade in Canada
plus US brokers under one connection), cTrader (OAuth2), TradingView (webhook),
Wealthsimple (read only), IBKR (stub). Read only sync
(`server/api/broker/sync.js`) writes a holdings and cash snapshot to KV and, once
connected, becomes the portfolio value of record.

## Data Sources

| Layer | Source | Auth | Notes |
|-------|--------|------|-------|
| Earthquakes | USGS | None | Global, real time |
| Flights | OpenSky Network | Optional | Throttled when unauthenticated |
| Incidents | OpenStreetMap Overpass | None | Police, fire, hospitals, cameras |
| Traffic | TomTom | API key | Free tier, key needed |
| Weather | NWS + Environment Canada | None | Alerts |
| Crime | Vancouver and Surrey open data, GDELT | None | Geo tagged |
| Local events and places | Wikipedia, OSM, Ticketmaster | Mixed | Wikipedia is the free fallback |
| Wildfires | NASA EONET / FIRMS | Optional | Satellite detections |
| News | GDELT | None | Geo extraction |
| Predictions | Polymarket | None | Whale tracking, probability markets |
| Macro | FRED | API key | Fed funds, CPI, GDP, unemployment, treasuries |

All sources fetch in parallel every 120 seconds and pause when the tab is hidden
(`useVisibilityPolling`). Each source has its own error boundary, so a failure
returns an empty array instead of blocking the others. Markers only render with real
coordinates. No synthetic scatter, no placeholder data.

## Map Engine

MapLibre GL JS on a CARTO dark basemap. DOM markers with per layer CSS pulse
animations. The heatmap is computed client side from every geo tagged point.
Geolocation chain is browser GPS, then cached position (30 minute TTL), then IP
fallback. Position resolves before first render when cached, so the map does not
jump on load.

## Auth and Billing

Sessions use bcrypt with tokens in Vercel KV (Upstash Redis). Billing is Stripe
Checkout, Free or $1 per week Premium. Free gets the map, ticker, and situation
monitor. Premium unlocks portfolio, ontology, and deep data.

## Companion Apps

| Platform | Framework | Notes |
|----------|-----------|-------|
| iOS | SwiftUI | 4 tabs, MapKit, parallel preload, auto refresh markets |
| macOS | SwiftUI | 5 section nav, MapKit |
| watchOS | SwiftUI | Glance complications |
| Widgets | SwiftUI | iOS and macOS extensions |

All native apps share the API backend over URLSession with cookie persistence.

## Performance

Cold start about 2 seconds on Vercel Fluid Compute. Data refresh on a 120 second
poll, paused when hidden. Bundle about 1MB gzipped, mostly MapLibre GL. Test suite
runs across Vitest and Playwright.

## License

MIT 2026, Joshua Trommel
