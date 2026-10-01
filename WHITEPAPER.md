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
- **The high win rate is mostly the market going up.** To check, we parked the
  idle cash in SPY instead of cash and only rotated into a dip when Double 7s
  fired (`backtest.py portfolio`, parked). That lifted the account from 2.7% to
  8.8% a year, but still well under SPY's 15.1%. So the dips we bought did
  worse than just staying in SPY. Winning two of three trades is mostly what any
  long position does in an uptrend, so a high win rate is not the same as
  beating the market. Bigger positions did not help either: 25%, 50% and 100%
  per position all earned less.
- **Trend timing halves the crashes, not the return.** We held SPY only while it
  closed above its 200 day average, and sat in cash otherwise
  (`backtest.py trend-spy`, cash earning nothing, fees included). Since 1993 that
  made 8.2% a year against 10.8% for holding, but the worst drop fell from 55% to
  25%. With 1.5x borrowed money it made 9.7% with a 36% drop. Over the S&P 500
  index since 1928 (prices only, no dividends) the 1.5x version did earn more than
  holding, 7.1% against 6.2%, with a smaller worst drop (72% against 86%). But
  that win comes from the 1930s crash. Since 2000 and since 2020 holding earned
  more. So it is a way to sleep better, not a way to beat the market.
- **One real lead, not a win yet: momentum with a market filter.** Across the 429
  S&P 500 stocks (`tradingview/edge.py`), we held the 20 stocks with the best
  6 month returns (skipping the latest month), only while the whole stock basket
  was above its 200 day average, rebalanced monthly, 0.1% fees. Settings were
  picked on 2012 to 2019 and graded on 2020 to now: 19.6% a year with a 31% worst
  drop, against 15.1% and 34% for SPY and 14.7% and 38% for an equal-weight
  basket. That clears our bar (more return, no bigger drop). Do not trust it
  yet: the stock list is today's winners (survivorship bias flatters momentum
  most), it is one blind period that was friendly to momentum, it holds only 20
  names, and it trades about 10 times a year. Next tests: other years, higher
  fees, and stocks that were delisted. Mixed asset classes are still untested.
  A daily dip-buying version looked even better (36% a year) but it fills at the
  same close it reads, which real orders cannot always do, so we do not count it.
- **Many small trades a day lose.** We simulated the busiest idea we could: buy
  a quick dip on 5 minute prices across 16 index funds, sell on the bounce or
  by the close (`tradingview/intraday.py`, 60 days, the most Yahoo gives).
  That makes about 127 trades a day. They win 40 to 43% of the time and earn
  about nothing before costs. Interactive Brokers charges at least $1 an order,
  plus the gap between buy and sell prices, so each round trip cost about $3.90
  and the account lost around $480 a day on $10,000 per trade. There is no speed
  edge here, and the costs are certain. We do not trade it.
- **Fear helps a little.** Only buying when the VIX is well above its recent
  average lifted index funds from 71% to 73%.
- **Our original strategy, Epiphany Kelly, does not work.** Its buy signal wins
  30% of the time and loses money on average. It also had a bug: after one early
  loss with no wins, its bet size dropped to zero and it never traded again. That
  is fixed (it now learns only after 10 trades and always bets at least 1%), and
  the corrected version just proves the point. It trades 43,701 times on the
  S&P 500 stocks and earns about nothing, because it learns the signal is bad
  and shrinks its bets. Double 7s replaced it as the autopilot rule.
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
