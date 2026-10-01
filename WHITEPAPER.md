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

### 1. The rule: Double 7s

Every trade follows one rule, picked because it held up best in the tests in
section 5. If a fund closes above its 200 day average and at its lowest close
of the last 10 days, buy it. If we hold it and it closes at its highest close
of the last 10 days, sell it. Nothing else decides a trade. The code is
`double7s()` in `src/utils/indicators.js` (server) and `decide()` in
`scripts/ibkr-run.py` (Mac).

The app still shows a Monte Carlo bull probability (500 random price paths over
30 days) and a Buy/Hold/Sell badge from RSI, MACD and moving averages. Those
are there to read, not to trade on. The original strategy built on them,
Epiphany Kelly, lost money in testing (section 5) and was retired.

### 2. Sizing

Each position is a fixed slice: 10% of the strategy's money on the Mac runner,
a per-trade dollar cap on the server. Whole shares only for stocks and funds.
At most 10 positions at once on the Mac runner. No leverage.

### 3. Two places it runs

- **Autopilot (server, Premium).** A user links a brokerage through SnapTrade,
  turns Autopilot on and sets a per-trade cap (`server/api/broker/autopilot.js`).
  A weekday cron (`server/api/broker/morning-run.js`) runs the rule on a short
  watchlist and trades for every enrolled user. Paper by default: the trades are
  simulated and logged, no order leaves. Live mode is opt in, places real orders
  through SnapTrade, is capped at $50 a trade and 20 fills, then flips the user
  back to paper on its own.
- **Epiphany Live (Mac).** `scripts/ibkr-live.py` runs the rule on 16 index and
  sector funds once a day at 3:45pm New York through a local IB Gateway, on an
  Interactive Brokers practice account. It refuses real accounts. The menu bar
  app (`scripts/menubar.py`) runs it, keeps it alive, and scores it against the
  S&P 500, the 16 funds held equally, the Nasdaq, Dow, Russell 2000, TSX, gold
  and Bitcoin.

  A momentum sleeve (`scripts/ibkr-momentum.py`) was built to run beside it,
  then switched off before its first trade: the momentum lead failed the
  survivorship test in section 5. The script still runs by hand.

### 4. Guardrails

- **Paper first.** Both places start on practice money. Real money is a
  separate opt in, never the default.
- **Hard caps.** Live server trades are capped per trade and in count,
  whatever the user sets.
- **Kill switch.** Turning Autopilot off, unlinking the brokerage, or Pause in
  the menu bar stops all orders. Pause is a file, so it survives a restart.
- **Audit.** Every trade is logged with time, side, size and fill.

The rules also exist as Pine Script (`tradingview/`) so they can be checked on
TradingView's history, not trusted on a few weeks of paper trading.

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
- **Momentum with a market filter: the lead was survivorship bias.** Across the
  429 S&P 500 stocks (`tradingview/edge.py`), we held the 20 stocks with the best
  6 month returns (skipping the latest month), only while the whole stock basket
  was above its 200 day average, rebalanced monthly, 0.1% fee a side. On today's
  list it made 18.4% a year on 2020 to now against 15.1% for SPY, 23.4% on 2012
  to 2019, and beat SPY in 25 of 33 years
  (`tradingview/results-momentum-stress.txt`). But today's list is today's
  winners. So we rebuilt the index as it really was on each day since 1996, from
  the free fja05680/sp500 history (`tradingview/data/sp500-pit.csv.gz`), and
  reran it with every setting frozen (`edge.py --pit`,
  `tradingview/results-survivorship.txt`). The lead is gone. 2012 to 2019 it
  made 10.3% with a 28% drop, while the same members held equally made 15.3% and
  SPY 14.6%. 2020 to now it made 9.8% with a 35% drop, against 11.2% for the
  members held equally and 15.1% for SPY. 2008 to 2011 it made 4.3% against
  4.5% for the basket and minus 1.4% for SPY, so the filter still halved the
  drop (31% against 55%), but it earned nothing extra. By calendar year it beat
  SPY in 14 of 30 and the real basket in 13 of 30, a coin flip. The data has a
  hole we cannot fill for free: Yahoo has prices for 764 of the 1,209 stocks
  that were ever in the index, and Stooq now blocks scripts. The missing ones
  are mostly companies that went bust or were bought before about 2010, so
  coverage runs from 64% of member months in 2008 to 2011 up to 93% since 2020.
  Because Yahoo drops a dead stock's whole history, the two ways we price a held
  stock that disappears (sell at its last price, or count it as a total loss)
  give the same answer, since we never hold one. The gap does not save the lead,
  though. On 2020 to now, where coverage is 93%, it lost to the basket, and the
  same code on today's list makes 35% there, so the list alone was worth about
  25 points a year. Verdict: no. Momentum with a filter cuts the crash, like
  every trend rule here, but it does not beat holding. We do not trade it for
  real.
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

**A century across asset classes.** We wanted one rule a robot could run for
a hundred years and beat holding the S&P 500. So we went monthly and went back
to 1871 (`tradingview/century.py`, raw output in
`tradingview/results-century.txt`). US stocks with dividends come from
Shiller's data, then the S&P 500 index, then SPY. Ten year Treasuries are
priced from their yields. Gold goes back to 1833, though it sat pegged until
1971. The wider mix joins as each series begins: long Treasuries (1986),
emerging and international stocks (1994, 1996), REITs (1996), oil, silver and
copper futures (2000), commodities (2006), the dollar (2007), Bitcoin (2011)
and Ethereum (2017). Cash earns the T-bill rate from 1934 and nothing before.
Fees are 0.1% a side. Every setting was picked on 1872 to 1948 and graded on
1949 to now, 77 years it never saw. We tried 24 settings in all, plus 4 for the
stock momentum lead.

| Rule | Blind yearly return | Worst drop | Decades it beat the S&P |
|---|---|---|---|
| Hold the S&P 500 | 11.7% | 51% | |
| 60/40 stocks and bonds | 9.3% | 29% | 3 of 16 |
| Risk parity, stocks, bonds, gold | 5.9% | 16% | 3 of 16 |
| S&P only above its 12 month average | 11.4% | 23% | 8 of 16 |
| Each asset only above its 12 month average | 9.0% | 10% | 3 of 16 |
| Dual momentum: best of stocks, bonds, gold | 13.5% | 27% | 7 of 16 |
| Dual momentum, every asset including crypto | 23.7% | 80% | 9 of 16 |
| Stock momentum from edge.py (2007 on only) | 21.2% | 34% | SPY made 11.1%, fell 55% |

Our bar was three things at once: more money than holding on the unseen
years, a smaller worst drop, and a win in most decades. Nothing clears it.
Dual momentum on stocks, bonds and gold comes closest. Each month it holds
whichever of the three rose most over the past year, if that beat T-bills.
It made more than holding with about half the worst drop. But it beat the
S&P in only 7 of 16 decades and 2 of the 8 unseen ones. Most of its lead is
one decade, the 1970s, when it rode gold to 32% a year. Adding crypto turns it
into a Bitcoin bet: 79% a year in the 2010s and an 80% drop. Without crypto
the same rule falls to 11.2% with a 63% drop, because a one-asset bet on oil
or silver futures hurts. Trend rules do what they did on SPY: they cut the
crash, not the return gap. The stock momentum lead passed on its own unseen
half, 2007 to now, but only on today's stock list. On the real list as it stood
each day it falls behind both SPY and the same members held equally, so it is
out.
Monthly closes also hide the worst days, so every drop here was deeper in real
life. The honest answer: no autopilot rule we can find beats holding stocks
across a century. Trend rules buy a smaller crash at a small cost in return,
and that is the trade we would choose on purpose. Every asset above trades on
IBKR as a US ETF: SPY, IEF and TLT, GLD, VEU, EEM, VNQ, DBC, USO, SLV, CPER,
UUP, IBIT and ETHA.

**Spending the smaller crash on leverage.** Trend rules cut the worst drop
roughly in half, so the next idea was to spend that safety on borrowed money
(Gayed and Bilello, "Leverage for the Long Run", 2016). Hold the S&P 500 at L
times while it sits above its average, and T-bills or 10 year Treasuries when it
does not (`century.py --leverage`, raw output in
`tradingview/results-leverage.txt`). Daily since 1929, using the index close plus
Shiller's dividend yield spread across the days. Two ways to pay for the
leverage: borrow at the T-bill rate plus 1%, or hold a 2x fund that resets daily
and charges 0.9% a year. The signal is read at one close and traded at the next,
with a 0.1% fee on every dollar moved. We tried 32 settings (L of 1, 1.25, 1.5 or
2, a 200 day or 10 month average, bills or Treasuries, two cost models), picked
on 1929 to 1975 only, and graded on 1976 to now.

| Rule, picked blind | Yearly return 1976 to now | Worst drop | Decades it beat the S&P |
|---|---|---|---|
| Hold the S&P 500, dividends in | 12.1% | 55% | |
| 2x borrowed, above 200 day average, else T-bills | 14.3% | 44% | 4 of 6 |
| 2x fund, above 200 day average, else T-bills | 15.1% | 44% | 5 of 6 |
| Top momentum tenth of all US stocks, 0.1% costs | 15.9% | 52% | 5 of 6 |
| Same, 0.5% costs | 10.5% | 63% | 2 of 6 |

This is the first rule that clears our bar: more money than holding, a smaller
worst drop, and a win in most unseen decades. The catches are real. 2x was the
top of the range we tried, so the pick sat at the edge. The one decade it lost
was 1976 to 1979, when choppy markets kept tripping the signal (4.1% against
9.5%), and the 1987 crash still landed at full 2x because one day is faster than
any average. The 10 month version, the one most people quote, failed the bar on
the blind half. And the paper was written with this same history in view, so
the blind half is blind to us, not to the idea.

To check the fund model we ran it against the real SSO (2x) and UPRO (3x) since
2010. It came out 0.8% a year too kind for SSO and 1.7% for UPRO, because real
funds pay more than T-bills to borrow. Take that 0.8% off the 2x fund row and it
still beats holding, at about 14.3%, the same as borrowing.

**Does it survive a hard look?** (`century.py --robust`, raw output in
`tradingview/results-leverage-robust.txt`, settings untouched.) Mostly, with
two warnings. Against 1,000 random in and out schedules with the same time in
the market and the same 338 switches, the rule's 15.1% beat 93% of them, so
about a 7% chance by luck, and not one random schedule matched it on both
return and worst drop (randoms fell 68% to 92% at the worst). Speed matters:
trading one day late drops it to 13.0% with a 62% worst drop, worse than
holding on the drop, and trading at the next open instead of the close gives
14.4% with a 51% drop. A 0.25% fee per switch leaves 13.9%, 0.5% leaves
12.0%, barely above the 12.1% of holding, and the borrowed version falls to
8.1% there. With the 0.8% fund gap off the top the base case is 14.4%, still
ahead. On other markets, price only and with T-bills as cash, it beat its own
hold with no bigger drop in 5 of 8 (S&P, Nasdaq 100, Toronto, Nikkei, DAX), and
lost badly on the Dow and the FTSE; the Nasdaq Composite earned more but fell
further. In the crashes it was lucky as much as smart: 2008 it sat out flat
(+1% against -37%), but in 1987 it was out by a hair (the S&P closed at 298.1
under its 298.6 average on Oct 15, four days before the crash), and in March 2020
and in 2022 it lost more than holding (-20% against -13%, and -31% against
-18%) because it was still at 2x when the drops came. The worst single day was
-13.7% against -20.5% for holding. Verdict: worth paper trading, not real money,
and only with next-close trades and fees under 0.25%.

Last, a check on momentum that cannot have survivorship bias: Ken French's
monthly returns for all US stocks sorted into tenths by their past year,
since 1927, value weighted, no trend filter. The top tenth beat the market by
3.6 points a year from 1976 on if trading costs 0.1%, but fell 52% against 50%,
so it misses the bar on the drop. The French data does not show turnover, so we
assumed half the portfolio changes every month. At 0.5% a trade, closer to what
costs were before 2000, it loses to the market outright. Momentum in stocks is
real but most of it goes to trading costs. Leveraged trend on the index is the
rule we would run, sized so a 44% drop is survivable, with eyes open about 1987.

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
