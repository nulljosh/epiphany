# Epiphany Technical Whitepaper

**v2.6.2 web / 2.5.5 iOS / 2.5.2 macOS** | August 2026

Everything happening in your world, on one screen.

The tools that fuse geodata, markets and news into one picture are built for
governments and hedge funds, not a person checking what's happening near them
or in their portfolio. Epiphany starts with a map, because a map is the one
interface that puts unrelated feeds (earthquakes, flights, crime, prices,
prediction markets) into a shared frame without forcing them into a single
schema first. It can also trade a portfolio on a measured signal, so the same
picture that shows what's happening can act on it. Palantir for regular
people. Live at [epiphany.heyitsmejosh.com](https://epiphany.heyitsmejosh.com),
with companion apps for iOS, macOS, and watchOS.

This paper leads with the algorithms, because the trading and prediction
pipeline is the one part of Epiphany making decisions on its own; everything
after those sections is supporting detail.

## Prediction and Trading Algorithm

The core bet is that a disciplined, sized, rules based strategy beats
discretionary trading, because discretion is where fear and excitement
override a plan. The pipeline runs signal to execution and is paper only by
default, so the strategy proves itself on real prices before it risks real
money; going live is a separate opt in step, never the default.

### 1. Price prediction (Monte Carlo)

For each symbol the engine runs a Geometric Brownian Motion simulation: 500 price
paths over a 30 day horizon. Drift and volatility come from the symbol's recent
daily returns (log returns, annualized). Each path steps daily:

```
S(t+1) = S(t) * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z)
```

where `mu` is drift, `sigma` is volatility, `dt` is one trading day, and `Z` is a
standard normal draw. The bull probability is the share of the 500 paths that close
above the current price, because a single point forecast hides how much the paths
disagree with each other; the spread across 500 runs is the actual signal. That
probability becomes the raw conviction score. This runs in the in app simulator at
60fps across the full asset universe, and in the
weekday morning cron (`server/api/broker/morning-run.js`).

### 2. Technical signal (entry filter)

A trade only triggers when the technicals agree with the prediction, because a
Monte Carlo path is a statistical opinion about drift, not proof a trade is timed
right; the composite signal (`src/utils/indicators.js`) is what stops a good long
term simulation from buying into a short term downtrend. It combines:

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
implied by the target and stop. Full Kelly is mathematically optimal but also
overbets in practice, since its inputs are estimates, not certainties, so
Epiphany uses a default 0.25 fraction of `f*` to cut variance, then caps any
single position at 10% of equity so one bad estimate cannot dominate the
account. A momentum strength and volatility gate blocks sizing into chop, since
Kelly's inputs mean little when price is not trending either way.

### 4. Execution and guardrails

- **Entry**: moving average crossover confirmed by the composite signal.
- **Exit**: fixed stop and target, plus a trailing stop once in profit.
- **Venue**: paper by default. Live routing goes through SnapTrade after a paper
  proving period.
- **Kill switch**: removing the broker keys disables all order placement.
- **Audit**: a full per symbol trade log is written on every run.

The strategy is shared with a backtestable Pine Script port
(`tradingview/epiphany-kelly-strategy.pine`) so the same rules can be validated on
years of TradingView history instead of trusted on faith from a few weeks of
paper trading.

### 5. Benchmark: does it work?

Short answer: one strategy does. Here is how we know.

**How we tested.** We replayed every strategy on real daily prices. A trade
happens the morning after its signal, never with hindsight. Every trade pays a
0.1% fee on the way in and again on the way out. Each strategy was tuned on
older years (2012 to 2019) and then graded on years it had never seen (2020 to
now). Think of it as practising on old exams, then sitting a new one. For the
watchlist, each symbol is tuned on the first half of its life and graded on the
second. The code is `tradingview/backtest.py`. Raw results are in
`tradingview/results-*.txt`.

**What counts as a real edge.** Three things at once. At least two out of three
trades make money. The average trade makes money after fees. And it still works
on the years it never saw.

**The winner: Double 7s.** When something that has been rising (above its 200
day average) has its worst close in 10 days, buy. When it has its best close in
10 days, sell. It passed everywhere we tried it:

| Tested on | Graded on | Trades that made money | Average gain per trade | Trades |
|---|---|---|---|---|
| 429 S&P 500 stocks | 2020 to now | 67% | 0.39% | 22,614 |
| 16 index funds | 2020 to now | 71% | 0.44% | 807 |
| Our TradingView watchlist, 28 symbols from their first day (S&P 500 since 1927, Dow, gold, silver, oil, copper, Bitcoin, stocks) | second half of each life | 69% | 0.62% | 3,508 |
| Bitcoin | 2020 to now | 71% | | 104 |
| Index funds, only when the VIX is spiking | 2020 to now | 73% | 0.52% | 610 |

The watchlist row reads the symbols straight off our TradingView watchlist
(`backtest.py watchlist`), so the test follows whatever is on the list.

**Nearly 100 years of the S&P 500.** The index itself, tuned on 1928 to 1977
and graded on 1977 to now, 49 years it never saw
(`backtest.py sp-century`):

| Strategy | Trades that made money | Trades | Worst drop |
|---|---|---|---|
| RSI(2) pullback | 77% | 377 | 37% |
| Cumulative RSI | 75% | 243 | 30% |
| Double 7s | 74% | 327 | 31% |
| Buy and hold | | | 57% |

Buying dips works best on the whole market, not on single stocks. It got
through the 2000s at about +3% a year while holding lost 2.5% a year. Two
things to know: this index leaves out dividends, which makes holding look a
few percent a year worse than it really was, and before 1962 the data is
closing prices only.

**TradingView's own numbers.** We also ran the strategy inside TradingView's
Strategy Tester on every symbol on our watchlist, over each symbol's full
history. That is a second, independent engine, so it checks our Python.
28 symbols, 4,733 trades, 65% made money. It puts the whole account
into every trade, which is harsher than the 10% per position we would use in
practice, and it has no unseen years, so read it as a cross-check, not a test.

| Symbol | Trades that made money | Trades | Total gain | Worst drop | Profit factor |
|---|---|---|---|---|---|
| NAS100 | 80% | 84 | 109% | 28% | 2.22 |
| PLTR | 77% | 26 | 361% | 34% | 2.29 |
| META | 76% | 96 | 717% | 33% | 2.64 |
| SHOO | 76% | 192 | 1,171% | 72% | 1.42 |
| Dow Jones | 75% | 77 | 40% | 34% | 1.71 |
| MRNA | 74% | 35 | 514% | 42% | 2.06 |
| SBUX | 74% | 205 | 1,374% | 44% | 1.97 |
| MS | 72% | 190 | 471% | 60% | 1.45 |
| GOOGL | 71% | 142 | 326% | 44% | 2.00 |
| DUOL | 71% | 17 | 58% | 36% | 1.62 |
| Bitcoin | 71% | 102 | 469% | 71% | 1.66 |
| GS | 70% | 146 | 70% | 54% | 1.27 |
| AMZN | 70% | 174 | 1,005% | 66% | 1.87 |
| IBM | 68% | 325 | 47% | 62% | 1.05 |
| T | 68% | 226 | 165% | 45% | 1.34 |
| AAPL | 68% | 271 | 65% | 93% | 1.11 |
| NVDA | 67% | 177 | 2,311% | 79% | 2.34 |
| Oil (WTI) | 67% | 30 | 17% | 43% | 1.16 |
| Copper | 67% | 123 | 94% | 59% | 1.25 |
| DBK | 67% | 183 | -13% | 81% | 0.97 |
| HOOD | 65% | 26 | 77% | 42% | 1.55 |
| JPM | 64% | 304 | 30% | 67% | 1.07 |
| US dollar index | 64% | 223 | -19% | 37% | 0.84 |
| DIS | 61% | 349 | 211% | 53% | 1.19 |
| TSLA | 61% | 77 | 60% | 69% | 1.09 |
| S&P 500 index | 57% | 250 | -11% | 14% | 0.73 |
| Gold | 53% | 372 | 292% | 28% | 1.52 |
| Silver | 51% | 311 | -48% | 88% | 0.90 |

Profit factor is total winnings divided by total losses, so above 1 means it
made money overall. NVDA's +2,311% is mostly NVDA being one of the best
stocks in history. The weak spots are worth knowing: the US dollar index, silver
and the S&P 500 index (as a CFD) lost money, and gold barely won half its trades.

**As one account, it loses to holding.** We ran Double 7s the way you would run
it for real: one account spread across the 16 index and sector funds, 10% per
position, fees both ways (`backtest.py portfolio`). From 2020 it won 71% of its
trades but grew about 2.7% a year, against 15.1% for holding SPY. It was
invested only 47% of the time, and its worst drop was 35% against SPY's 34%.
A $500 account ended near $600. The edge is real per trade, but the money
sits idle between trades, and that costs far more than the edge earns.

**Everything else we tried,** on the 429 S&P 500 stocks, 2020 to now:

| Strategy | Trades that made money | Average gain per trade | Typical yearly return |
|---|---|---|---|
| Double 7s | 67% | 0.39% | 0.7% |
| Double 7s, only when the VIX is spiking | 67% | 0.51% | 0.4% |
| RSI(2) pullback | 65% | 0.25% | 0.5% |
| IBS dip buy | 61% | 0.50% | 6.1% |
| Donchian breakout | 41% | 3.21% | 2.5% |
| Moving average crossover | 37% | 2.82% | 2.1% |
| Epiphany Kelly (our original strategy) | 30% | -0.07% | -2.0% |
| Buy and hold | | | 9.1% |

**What we learned.**

- **Buying dips works more often than chasing trends.** Trend strategies made
  money on fewer than half their trades. They softened the crashes but gave
  back most of the gains.
- **Nothing beat buying and holding on raw return.** On single stocks and the
  S&P 500 index, Double 7s had smaller worst drops than holding (Bitcoin: -53%
  at worst against -72%). As one account over index funds the drop was no
  better (35% against 34%) and the return was far lower. It is a way to win
  more often, not a way to make more money.
- **Fear helps a little.** Only buying when the VIX is well above its recent
  average lifted index funds from 71% to 73%.
- **Epiphany Kelly (the original rule) does not work yet.** Its buy signal loses money. Its bet sizing has
  a bug: one early loss before any win sets the bet to zero forever. It stays
  paper only until both are fixed.
- **80% is not there yet.** The best so far is 77%, RSI(2) on the S&P 500
  index over 49 unseen years. Stacking extra filters on
  top made things worse, not better.

**What could still be wrong.** The stock list is today's S&P 500. Companies
that crashed and got kicked out are missing, and that makes buying dips look
better than it really was. Prices are assumed to fill exactly, with no extra
slippage beyond the fee. And we haven't yet checked how often random trades
would do just as well. Until those are done, treat this as a strong lead, not
a promise.

### Broker abstraction

`src/utils/broker.js` defines one `BrokerAdapter` interface (`connect`, `placeOrder`,
`getPositions`, `getBalance`), so the strategy code never has to know which broker
it is talking to and a new broker is one adapter, not a rewrite. Adapters: Alpaca
(paper and live), SnapTrade (read only aggregator sync, HMAC signed REST, covers
Wealthsimple and Questrade in Canada plus US brokers under one connection, chosen
because Alpaca alone has no reach into Canadian brokers), cTrader (OAuth2),
TradingView (webhook), Wealthsimple (read only), IBKR (stub). Read only sync
(`server/api/broker/sync.js`) writes a holdings and cash snapshot to KV and, once
connected, becomes the portfolio value of record, since a synced real balance is
more trustworthy than a locally tracked one that can drift from reality.

## Data Sources

| Layer | Source | Auth | Notes |
|-------|--------|------|-------|
| Earthquakes | USGS | None | Global, real time |
| Flights | adsb.lol | None | Community ADS-B feed, replaced OpenSky |
| Incidents | OpenStreetMap Overpass | None | Police, fire, hospitals, cameras |
| Traffic | TomTom | API key | Free tier, key needed |
| Weather | NWS + Environment Canada | None | Alerts |
| Crime | Vancouver and Surrey open data, GDELT | None | Geo tagged |
| Local events and places | Wikipedia, OSM, Ticketmaster | Mixed | Wikipedia is the free fallback |
| Venue reviews | Yelp Fusion | API key | Ratings and review snippets on place markers |
| Wildfires | NASA EONET / FIRMS | Optional | Satellite detections |
| News | GDELT | None | Geo extraction |
| Predictions | Polymarket | None | Whale tracking, probability markets |
| Macro | FRED | API key | Fed funds, CPI, GDP, unemployment, treasuries |

All sources fetch in parallel every 120 seconds and pause when the tab is hidden
(`useVisibilityPolling`), because polling a backgrounded tab burns quota for a
picture nobody is looking at. Each source has its own error boundary, so a failure
in one feed (a rate limit, a dead endpoint) returns an empty array instead of
blocking the others: a map that goes fully blank because one of a dozen sources
hiccuped would be worse than one missing layer. Markers only render with real
coordinates. No synthetic scatter, no placeholder data, because a fake dot on a
live map is worse than no dot at all.

## Map Engine

MapLibre GL JS on a CARTO dark basemap. DOM markers with per layer CSS pulse
animations. The heatmap is computed client side from every geo tagged point.
Geolocation chain is browser GPS, then cached position (30 minute TTL), then IP
fallback, because a map with no starting location is a blank screen and a
returning visitor shouldn't have to grant permission again just to see
themselves on it. Position resolves before first render when cached, so the
map does not jump on load, since the rule from the top of this paper is a
steady map with no jumps or flashes.

## Auth and Billing

Sessions use bcrypt with tokens in Upstash Redis (KV). Billing is Stripe
Checkout, Free or $1 per week Premium. Free gets the map, ticker, and situation
monitor, because the ambient picture of what's happening is the hook; Premium
unlocks portfolio, ontology, and deep data, the parts that cost real money in
API calls and compute per user.

## Companion Apps

| Platform | Framework | Notes |
|----------|-----------|-------|
| iOS | SwiftUI | 4 tabs, MapKit, parallel preload, auto refresh markets |
| macOS | SwiftUI | 5 section nav, MapKit |
| watchOS | SwiftUI | Glance complications |

Native apps are live on the App Store (id6779522175). Portfolio, ontology, and deep
data are gated behind Pro on every platform, matching the web tiering, so a
Premium subscription means the same thing everywhere instead of being a web only
perk.
| Widgets | SwiftUI | iOS and macOS extensions |

All native apps share the API backend over URLSession with cookie persistence, so
the trading and prediction logic lives in one place instead of being reimplemented
per platform.

## Performance

Cold start about 2 seconds. Data refresh on a 120 second
poll, paused when hidden. Bundle about 1MB gzipped, mostly MapLibre GL. Test suite
runs across Vitest and Playwright.

## License

MIT 2026, Joshua Trommel
