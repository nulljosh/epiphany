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

### 1. The rule: Trend 2x

Every trade follows one rule, the one that cleared our bar in section 5 on years
it was not picked on. If the S&P 500 (SPY) closes above its 200 day average,
hold SSO, a fund that moves twice as much as the S&P 500. If it closes below,
hold BIL, a fund of T-bills. Check once a day, and trade only when the side
changes. Nothing else decides a trade. The code is `trend2x()` in
`src/utils/indicators.js` (server) and `scripts/ibkr-trend.py` (Mac).

Double 7s, the rule we used before, buys a fund at a 10 day low inside an
uptrend and sells it at a 10 day high. It is still in the code (`double7s()`)
and still runs on the Mac's 16 funds (`decide()` in `scripts/ibkr-run.py`), but
it no longer drives Autopilot.

The app still shows a Monte Carlo bull probability (500 random price paths over
30 days) and a Buy/Hold/Sell badge from RSI, MACD and moving averages. Those
are there to read, not to trade on. The original strategy built on them,
Epiphany Kelly, lost money in testing (section 5) and was retired.

### 2. Sizing

Each position is a fixed slice: 10% of the strategy's money on the Mac runner,
a per-trade dollar cap on the server. Whole shares only for stocks and funds.
At most 10 positions at once on the Double 7s runner. Trend 2x holds one fund at a
time, and its only leverage is the 2x fund itself.

### 3. Two places it runs

- **Autopilot (server, Premium).** A user links a brokerage through SnapTrade,
  turns Autopilot on and sets a per-trade cap (`server/api/broker/autopilot.js`).
  A weekday cron (`server/api/broker/morning-run.js`) reads SPY against its 200
  day average and moves every enrolled user toward SSO or BIL. Paper by default:
  the trades are simulated and logged, no order leaves. Live mode is opt in,
  places real orders through SnapTrade, is capped at $50 a trade and 20 fills,
  then flips the user back to paper on its own.
- **Epiphany Live (Mac).** `scripts/ibkr-live.py` runs Trend 2x as a $100k
  sleeve (`scripts/ibkr-trend.py`) once a day between 3:45 and 4pm New York,
  so the orders fill before the close, through a local IB Gateway on an
  Interactive Brokers practice account. It refuses real accounts and only sells
  shares its own state file says it owns. The old rule, Double 7s on 16 index
  and sector funds, still runs beside it on the same account from the same
  script at 3:45pm. The menu bar app (`scripts/menubar.py`) runs both, keeps
  them alive, and scores Trend 2x against the S&P 500 and the rest against the
  S&P 500, the 16 funds held equally, the Nasdaq, Dow, Russell 2000, TSX, gold
  and Bitcoin.

  The momentum sleeve that was once built to run beside it was dropped: the
  momentum lead failed the survivorship test in section 5.

  A third sleeve, Quality, is a test of a tilt, not an edge. `scripts/ibkr-quality.py`
  buys $50,000 of QUAL once, the iShares fund nearest the most profitable tenth
  in section 5, and holds it. No timing, no rebalance, no sells. It runs once,
  in the same 3:45 to 4pm window, and stops the moment its state file
  (`tradingview/ibkr-quality.json`) has a start date. The menu bar scores it
  against the S&P 500 from that day. On real prices since 2013 QUAL trails SPY
  by 0.4 point a year, so a tie is the likely answer. A year of paper results
  will say.

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
9.5%). It dodged the 1987 crash by luck, not design: the S&P closed half a point
under its average two days before, and one day is faster than any average. The 10 month version, the one most people quote, failed the bar on
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

**What to hold when it is out.** The paper sleeve parks in T-bills (BIL) while
the S&P sits under its average, so we asked whether something else earns more
there (`century.py --out`, raw output in `tradingview/results-out-asset.txt`).
Same fixed rule, same 0.1% fee, same 0.8% fund gap off. We tried 10 year
Treasuries (IEF), 20 year Treasuries (TLT), gold (GLD), half bills and half
gold, and 2x bonds, each plain and held only while its own price is above its
own 200 day average (else bills). Picked on 1929 to 1975, graded on 1976 to now,
against Trend 2x with bills at 14.4% / 44%. Plain Treasuries add return but also
a bigger drop, because 2022 is the year the bonds and the stocks fell together:
the rule's 2022 was -31% with bills, but -41% with 10 year and -47% with 20 year
Treasuries (the 2008 side paid, +19% and +32% against +1%). Holding them only
above their own average fixes that: 2022 stays -31%, 2008 stays +19% and +31%.
That version made 15.6% with a 45% drop for 10 year and 16.8% with a 45% drop
for 20 year, won 5 of 6 decades, and beat nearly all of 500 random bond in and out
schedules. It still fails our bar by 0.6 of a point on the drop (44.6% against
44.0%), and one day late it keeps its lead (13.5% and 14.6% against 12.3%) but
the drop is 63% against 62%. Two rows do pass on the model, gold above
its own average (15.5% / 41%) and half bills, half gold the same way (14.8% /
42%), but neither survives the real GLD since 2006 (drop 45% and 44% against
41%), and gold's train half is a fixed price that private owners were banned
from holding, so that edge is not tradable history. The real funds are the sober
part: from 2006 on, bills gave 12.5% / 41%, IEF with its own filter 12.8% / 42%
and TLT with its own filter 12.5% / 40%. Most of the model's gain is the long
fall in bond yields from 1981 to 2020, which will not repeat from 5%. 2x bonds
earned the most on the model (17.0% to 19.3%) but fail the drop by about a point
and made only 12.2% to 13.2% on real fund returns. Verdict: nothing replaces BIL
yet. The one worth running on paper beside it is IEF held only above its own 200
day average, BIL otherwise.

**Scaling the 2x by volatility.** The crashes above hit Trend 2x while it was
still at full size (-20% in March 2020, -31% in 2022), so we tried sizing it by
how choppy the market is (`century.py --voltarget`, raw output in
`tradingview/results-voltarget.txt`). Same rule, same fund model and fees, but
while the S&P is above its 200 day average the sleeve holds min(2x, target vol
divided by the trailing realised vol), anywhere from 0 to 2x, as a mix of SSO,
SPY and bills, and only trades when the exposure has drifted more than 0.25 off
target. We tried targets of 10%, 15% and 20% on a 20 or 60 day vol (6 combos),
plus one cousin with no knob: 2x when the 20 day vol is under its own one year
median, else 1x. That is 7 in all. Picked on 1929 to 1975 only, the winner was a
20% target on 60 days. On the blind half it made 11.3% with a 29% worst drop,
against 14.4% / 44% for Trend 2x and 12.1% / 55% for holding, and won 1 of 6
decades against Trend 2x and 2 of 6 against holding. The calm 2x cousin made
10.3% / 38% and won 2 of 6. Both fail. What they do buy is a gentler ride: 2022
was -20% instead of -31% (holding lost 18%), 1987 was -19% and -12% instead of
-27%, and the March 2020 drop shrank to 22% and 13%. But no variant of the six
reached Trend 2x on return, the best being 11.8%, and the price is average size:
the 20%/60 pick sits at 1.56x while in against 2x. A plain fixed 1.56x trend,
with no vol read, made 12.7% / 36% on the same days, so the vol timing lost to
simply using less leverage. Against 300 random shuffles of its own holding runs
the pick beat 74% on return (about a 1 in 4 chance of luck), which is not an
edge. One day late it made 10.1% / 43%. Turnover is higher than Trend 2x, 7.9
dollars traded per dollar held a year for the pick and 24 for the calm cousin
against 6.7. On real funds from 2006 (SSO, SPY and BIL) Trend 2x made 12.5% / 43%,
the pick 9.6% / 27% and the cousin 8.9% / 36%, holding 11.3% / 55%. Verdict:
vol targeting is a lower risk Trend 2x, not a better one. Nothing changes.

**Calendar overlays.** Seasonality is the most picked-over corner of finance, so
this test gives it no room to be tuned (`century.py --seasonal`, raw output in
`tradingview/results-seasonal.txt`). Four windows, each fixed from the paper it
comes from: the turn of the month (the last trading day and the first 3,
Lakonishok and Smidt 1988), sell in May (in November to April only, Bouman and
Jacobsen 2002), the day before a holiday (Ariel 1990, found as the day before any
gap of two or more weekdays in the price series) and skipping Mondays. Each runs
two ways, alone on 1x S&P against holding (12.1% / 55%), and on top of Trend 2x
against Trend 2x (14.4% / 44%), where the window decides 2x or 1x (bills on
Mondays) and the 200 day rule stays on. Eight variants, nothing picked among
them, same fund model and 0.1% fee on every dollar traded, graded on 1976 to now.
All eight fail. Alone: turn of the month 5.9% / 21%, sell in May 10.0% / 36%,
pre-holiday 3.5% / 16%, skip Mondays 1.9% / 71%, each winning at most 2 of 6
decades. Stacked: 8.5% / 30%, 13.8% / 41%, 8.5% / 24% and 3.6% / 74%. The closest
is sell in May on Trend 2x: smaller drop, 4 of 6 decades, but 0.6 of a point short
on return, and it is short before fees too (14.9% against 15.1%). The effects are
not noise. Against 300 random calendar masks with the same days in the market and
the same number of switches, the windows beat 90% to 100% of them in 7 of 8
variants (sell in May on Trend 2x beat 99%, turn of the month alone beat all
300). They are just small. A window that is in the market a fifth of the time
gives up too much of the market's gain: turn of the month alone made 8.4% before
fees against 12.1% for holding. And the fee bill eats what is left. Turn of the
month switches 24 times a year (41 dollars traded per dollar held on the stack)
and loses 2.6 points to fees alone, 4.6 on the stack, pre-holiday 1.8 and 3.5,
and skipping Mondays switches 95 times a year and pays 10 points, which turns
the Monday effect (12.1% before fees, the same as holding) into 1.9%. Fee
sensitivity, 0.05% / 0.1% / 0.25% a dollar traded: turn of the month alone 7.1%
/ 5.9% / 2.1%, sell in May alone 10.1% / 10.0% / 9.7%, sell in May on Trend 2x
14.3% / 13.8% / 12.2% (Trend 2x itself 14.8% / 14.4% / 13.2%), skipping Mondays
6.8% / 1.9% / -11.7%. Nothing passes at any of the three, and sell in May stays
0.5 to 1.0 points behind. Turn of the month on Trend 2x also loses to using
less leverage: a plain 1.19x trend, the same average size, made 11.1% / 27%
against its 8.5% / 30%. One day late changes little for sell in May (13.1% /
37% on the stack) and hurts the short windows (turn of the month alone 5.2%,
pre-holiday alone 2.5%, skipping Mondays alone -1.0%). On real funds from 2006
(SSO, SPY, BIL) holding made 11.3% / 55% and Trend 2x 12.5% / 43%, and the
overlays made 1.3%, 7.0%, 0.8% and -0.2% alone, and 4.0%, 10.7%, 5.8% and -1.5%
stacked. Pre-holiday is only about 9 days a year in the data, too few to carry
a fund. Verdict: the calendar is real and small, and costs more to trade than it
pays. Nothing changes.

**Dual momentum, with a trend filter and leverage.** The century run left one
loose end: dual momentum made 13.5% with a 27% drop, but only because of gold in
the 1970s. So we stacked it with the trend rule (`century.py --dual`, raw output
in `tradingview/results-dual.txt`). Each month hold whichever of stocks, 10 year
Treasuries and gold rose most over 12 months, if it beat bills, and only if it
also sits above its own 10 month average, else bills. Four variants, settings
fixed from the literature and nothing tuned: (1) that rule, (2) the same with 2x
on stocks when stocks win (daily-reset fund model, gap off), (3) variant 1 with
gold removed, (4) variant 2 with gold removed. Signal at month end, trade the
next day's close, 0.1% a switch, daily since 1929, graded on 1976 to now.
Against holding at 12.1% / 55% and Trend 2x with bills at 14.4% / 44%:

| Variant | Blind return / worst drop | Decades beat hold / Trend 2x | 2022 | Real funds from 2006 |
|---|---|---|---|---|
| 1 Dual plus own trend | 12.3% / 33% | 2 of 6 / 2 of 6 | -20% | 7.0% / 30% |
| 2 Same, 2x stocks | 12.3% / 61% | 2 of 6 / 2 of 6 | -35% | 7.6% / 49% |
| 3 Variant 1, no gold | 9.4% / 33% | 1 of 6 / 2 of 6 | -16% | 6.6% / 22% |
| 4 Variant 2, no gold | 10.1% / 59% | 1 of 6 / 2 of 6 | -31% | 8.6% / 44% |

None clears the bar. Variant 1 beats holding by 0.2 of a point with a drop of 33%
against 55%, and 2008 was +17% against -37%, but it wins only 2 of 6 decades and
it is 2.1 points behind Trend 2x. Its 1970s were 36.8% a year, the gold decade, and
without gold that decade is 7.2%, so the lead was gold again. The trend filter
did not help the plain rule (12.8% without it), and 2x on top of it did not add
return, only a 61% drop, because the signal reads one month end and a leveraged
reversal gets a month to run. Variant 1 beat 84% of 300 random orders of its own
holding periods and none matched it on both return and drop, so the timing is
real, just too small. One month late it makes 11.7% / 35%. On the real funds from
July 2006 (SPY, SSO, IEF, GLD, BIL) every variant makes 6.6% to 8.6%, against
11.3% / 55% for SPY and 13.0% / 43% for Trend 2x on the same funds. Verdict: out.
It is a smoother ride than holding, not more money, and Trend 2x stays the only
rule we paper trade.

**Does it work on other indexes, with dividends?** The earlier other-markets
check left dividends out, so we reran it with them in (`century.py --indexes`,
raw output in `tradingview/results-trend-indexes.txt`). Same rule, nothing
tuned, same 0.1% fee, same 0.8% fund gap off the top, and each series graded
on its own second half by date. Real dividends come from the funds' adjusted
closes (QQQ, XIU.TO, EWJ, EWG, DIA, EWU). Where the fund is younger than the
index we also ran the index price plus a flat yield measured off that fund:
0.6% for the Nasdaq 100 (QQQ), 2.4% for the TSX (XIU), 1.5% for the Nikkei
(EWJ), 2.1% for the Dow (DIA) and 3.8% for the FTSE (EWU). The DAX is a total
return index already, so its earlier row had dividends all along. The bar is
the old one: more return than holding, no bigger worst drop, and a win in most
blind decades. Against the real 2x funds the model runs 0.7% a year too kind
for QLD (Nasdaq 100) and for DDM (Dow), the same as SSO over the same years, so
the 0.8% we take off is about right. The TSX fund, HXU.TO, is gone from Yahoo,
so the TSX model has no real fund to check against.

- **Nasdaq 100: passes on the long test, fails on the real one.** On the index
  plus yield from 2006, the rule made 20.3% a year against 15.8% for holding,
  with a 41% worst drop against 53%. It won 2 of 3 decades and 13 of 19 years,
  beat 70% of random schedules, and no random schedule matched it on both
  return and drop. One day late it still made 19.3%, with a 52% drop. But on
  QQQ's own real dividends from 2012 it made 27.8% against 20.1% and fell 42%
  against 35%, so it misses the drop bar. The honest read is a lead, not a pass.
- **TSX: fails.** From 2003 it made 9.4% against 10.1%, with a 43% drop against
  49%. On XIU from 2013 it made 11.4% against 11.2% with the same 34% drop and
  won only 1 of 2 decades. It beat about half of random schedules, a coin flip.
- **Nikkei: fails.** From 1995 it made 6.0% against 5.8% but fell 68% against
  63%. On EWJ (dollars, from 2011) it lost outright, 3.2% against 7.8%.
- **DAX: fails.** From 2007 it made 5.0% against 6.4%. Its earlier win came
  from the whole history since 1988, not the second half. On EWG it made 3.6%
  against 5.5%.
- **Dow: fails.** From 2009 it made 9.8% against 13.4%, and beat only 2% of
  random schedules, so a random in and out did better. DIA says the same, 10.1%
  against 12.6%.
- **FTSE: fails.** From 2005 it lost money, -0.3% a year with a 68% drop, while
  holding made 7.6% with a 45% drop. EWU says the same, -1.4% against 6.0%.

So the S&P result is not general. One index clears the long test, none clears
both, and the strongest case is the Nasdaq 100, the one index the rule shares
a lot with the S&P. If we paper trade a second sleeve it is QLD (2x Nasdaq 100,
US listed), on paper only. There is no TSX sleeve to run.

Last, a check on momentum that cannot have survivorship bias: Ken French's
monthly returns for all US stocks sorted into tenths by their past year,
since 1927, value weighted, no trend filter. The top tenth beat the market by
3.6 points a year from 1976 on if trading costs 0.1%, but fell 52% against 50%,
so it misses the bar on the drop. The French data does not show turnover, so we
assumed half the portfolio changes every month. At 0.5% a trade, closer to what
costs were before 2000, it loses to the market outright. Momentum in stocks is
real but most of it goes to trading costs. Leveraged trend on the index is the
rule we would run, sized so a 44% drop is survivable, with eyes open about 1987.

**Factor tilts, long only.** One more place to look, again on Ken French's
monthly returns (all US stocks, value weighted, survivorship free), now sorted
on other traits: cheapest tenth on book to market, smallest tenth by size, most
profitable tenth, the tenth that grows its assets least, and the momentum tenth
from above (`century.py --factors`, raw output in
`tradingview/results-factors.txt`). Five fixed bets, nothing tuned. The first
four rebalance once a year in the French build, so we assumed 30% of the
portfolio turns over a year and charged 0.1% a side, which comes to 0.06% a
year. Momentum keeps its 50% a month. Graded 1976 to now against the market's
12.3% a year and 50% worst drop: value 15.8% with a 70% drop, size 12.3% with
62%, profitability 13.6% with 41%, investment 14.5% with 56%. Only
profitability clears the bar: more than holding, a smaller drop, 4 of 6
decades. Value and investment paid more but fell further, and the smallest tenth
(micro caps, which nobody could buy at those weights) paid nothing extra.

Then the stack: hold each tenth at 2x only while the market is above its 10
month average, else T-bills, with the 0.9% fund cost and the 0.8% real-fund gap
taken off. It runs month by month, so it is coarser than a daily fund and its
worst drops read kinder than they would live. On that footing Trend 2x on the
market made 14.3% with a 51% drop, a point worse than holding on the drop and
only 3 of 6 decades, so even the base rule just misses the bar in this model.
Stacked on a factor, everything but size beat it on return (value 20.9%,
momentum 17.4%, investment 15.8%, profitability 14.6%, size 13.6%) and every row
fell further (71%, 59%, 61%, 56% and 83% against 51%). Against 300 random in and
out schedules of the same length, value beat 92% and the rest 38% to 74%, so the
timing added little to most of them. None passes either bar.

Tradability: the cash funds are VTV or IWD for value (milder than the top
tenth), QUAL for profitability, MTUM for momentum, and IWC for micro caps (IWM
and VB are small caps, not the same thing). Investment has no clean fund. A 2x
fund exists only for small caps (UWM, 2x the Russell 2000, not the tenth we
tested); the rest would be 2x by margin or not at all. Fund names are from
memory, not checked against live listings. We did test QUAL against the real
fund: from its first day in July 2013 it made 13.6% a year with a 34% worst drop
and SPY made 14.0% with 34%, so the fund trails by 0.4 point and wins 6 of 14
calendar years, and most of the tenth's edge did not survive the fund. These factors were well known by 1976, so the blind half is blind to
us, not to the idea. Verdict: nothing beats Trend 2x, which stays the one rule
we paper trade. Profitability at 1x through QUAL is the only new thing that
clears the bar, and only against holding, so at most a small paper only sleeve
beside Trend 2x, not a replacement.

**Upgrading quality.** Profitability was the one factor that cleared the bar,
so we tried the four upgrades the literature suggests, all fixed in advance,
nothing picked (`century.py --quality`, raw output in
`tradingview/results-quality.txt`). Same French tenths, same 1976 to now window,
same costs. One: hold the quality tenth only while the market is above its 10
month average, else bills, no leverage (Faber, 2007). Two: half quality, half
momentum, rebalanced monthly (French has no profitability by momentum file, so
this is a blend of two tenths). Three: both at once. Four: half quality, half
value (Novy-Marx, 2013). The trend filter lost: 10.9% with a 28% drop against
holding's 12.3% with 50%, 1 of 6 decades, and it beat only 33% of 300 random in
and out schedules with the same time in the market, so the timing earned
nothing (it did sidestep 2008, +1.5% against -37%, and held 2022 to -9.6%, but
it missed the rebounds). Quality plus momentum looked best: 15.0% with a 46%
drop, 5 of 6 decades, past holding and past Trend 2x on the same monthly series
(14.3% / 51%). But it makes 1.4 points more than plain quality (13.6% / 41%) with
a bigger drop, so it does not beat plain quality on the bar, and at 0.5% a side
it falls to 12.1% / 48%, a tie with holding. Both at once made 12.3% / 28%, a tie
on return and 2 of 6 decades. Quality plus value made 15.0% but fell 56%. None
beat Trend 2x's 14.4% / 44% on the drop. On the real funds from July 2013 (QUAL,
MTUM, VTV against SPY, BIL as bills) QUAL plus MTUM made 14.8% / 34.1% against
SPY's 14.0% / 33.7% and won 7 of 14 years, a tie at best, the two filtered
versions made 8.0% and 8.7%, and QUAL plus VTV made 12.6% / 35.4%. Verdict: one
model pass against holding, no real fund pass, so the paper Quality sleeve stays
plain QUAL with no filter and no momentum blend.

**Trend 2x and Quality as one portfolio.** The two edges that passed on the model
are Trend 2x (14.4% / 44% on the daily rule) and the Quality tenth (13.6% / 41%),
so we asked whether one account holding both beats either alone
(`century.py --blend`, raw output in `tradingview/results-blend.txt`). Trend 2x's
daily returns were compounded to month ends, which reads its drop kinder (40%).
Weights were fixed in advance: 50/50, 70/30 and 30/70, rebalanced monthly (0.1% on
the dollars traded) and also once a year. All six passed the bar on the blind
years 1976 to now: 14.1% to 14.5% with a 32% to 36% drop, against 12.3% / 50% for
holding, and a return to drop ratio of 0.40 to 0.45 against 0.36 for Trend 2x and
0.33 for Quality. The 50/50 monthly blend made 14.3% / 33%, won 5 of 6 decades
against holding, 4 against Trend 2x and 3 against Quality, and lost 15% in 2008
(Trend 2x alone made 1%, Quality alone lost 30%) and 22% in 2022 (Trend 2x lost
31%, Quality 13%). The two legs are not independent: their monthly returns
correlate at 0.73, so the gain is a smoother ride, not more return. Against
300 random 50/50 blends of Trend 2x with a random French tenth, the Quality blend
beat 76% on return and 92% on return to drop, so Quality is a good partner but
the benefit is mostly "two things instead of one", not Quality specifically. On the real funds from July 2013 (SSO and BIL
as Trend 2x, plus QUAL, against SPY) the 50/50 blend made 14.4% / 27% against SPY's
14.1% / 24%: a hair more return, a bigger drop, so the real-fund check fails for
every weight. Verdict: model pass, real funds fail, no weight clears the whole
bar. The paper account should not add a rebalance between the sleeves on this
evidence; the model gain is real but small and does not survive the funds.

**The low volatility anomaly.** The old complaint is that calm stocks earn as
much as wild ones, so per unit of risk they pay too well (Ang and others, 2006;
Baker, Bradley and Wurgler, 2011; Frazzini and Pedersen's betting against beta,
2014). We tried it on Ken French's tenths of all US stocks, value weighted, long
only, monthly: the calmest tenth by 60 day variance and the lowest tenth by beta
(`century.py --lowvol`, raw output in `tradingview/results-lowvol.txt`). Both
files start in 1963, so the unseen half is 1976 to now again and a tuning half
would be only 12 and a half years. Nothing is tuned: every setting is fixed, with
the usual 30% a year turnover at 0.1% a side. The variance tenth re-sorts every
month, so its real turnover is higher; at 100% a year it loses about 0.2 point
more. Held at 1x, variance made 11.5% with a 34% worst drop and beta 12.2% with
39%, against the market's 12.3% and 50%. Smaller drops, a little less return, 3 of
6 decades each, so both fail on return. The case for them is real: 2022 was -0.7%
and -0.8% against -19.9%, and return per unit of risk is better (Sharpe 0.65 and
0.69 against 0.56). They also leaned on the long fall in rates, and in the 2020s
made 8.8% and 10.1% against the market's 15.3%. With the market 10 month filter
(bills when out) they fall to 9.9% / 29% and 10.5% / 21%, 1 of 6 decades, and beat
only 64% and 65% of 300 random in and out schedules. Acting a month late made them
better, not worse (10.5% and 11.2%), which says the timing is noise. The papers'
own fix is leverage, so we ran 1.5x on margin at bills plus 1% (fixed from
Frazzini and Pedersen's logic, not tuned): variance 14.1% / 49% and beta 15.2% /
54%. The variance row beats the market on return with a drop just inside it but
wins only 3 of 6 decades; the beta row wins 4 of 6 and falls 54%. Both fail:
leverage buys back the return and gives the smaller drop away again. On real funds
from October 2011 (USMV and SPLV against SPY, BIL as bills) USMV made 11.5% / 33.1%
against SPY's 15.0% / 33.7% and SPLV 9.8% / 36.3%, each winning 5 of 16 years. USMV
with the SPY filter made 7.5% / 21%, USMV at 1.5x made 15.7% / 47.4% (0.7 point
ahead of SPY with a drop 14 points bigger) and SPLV at 1.5x made 12.9% / 51.8%. None
of the five real fund rows passes. Verdict: six fails on the model, five on real
funds, so no sleeve. USMV at 1x gives up 3.5 points a year for a worst drop that was
the same. The 1.5x version needs margin, which the paper account can do and
Autopilot cannot, and it only ties SPY on return while falling much further.

**Sector momentum, with a market trend filter.** The standard way to buy the
strongest corner of the market is Faber's relative strength rule (2010): each
month hold the top 3 sectors by trailing return, equal weight, and only while the
market is above its 10 month average, else bills. We ran it two ways with the
settings fixed from the paper, 12 and 6 month returns both reported, nothing picked
(`century.py --sectors`, raw output in `tradingview/results-sectors.txt`). First on
Ken French's 10 industries, monthly, from 1926 (tuned on nothing, 1927 to 1975 is
context, 1976 to now is blind), 0.1% a side on the turnover it actually does.
Then on the real SPDR sector funds (XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY)
from 2000, with SPY as the market and BIL as cash. The third version stacks the
Trend 2x lesson on top: the top 3 at 2x when the filter is on, which is a margin
model at bills plus 1%, because no 2x sector fund is worth using. Against holding
at 12.3% / 50%, 12 months at 1x made 12.9% / 27% (6 months 11.7% / 24%), 2008 was
+1.5% against -36.7% and 2022 was -2.2% against -19.9%. It beat all 300 random
top 3 picks run through the same filter with the same number of names changed each
month (they averaged 10.2%), so the ranking is real, but most of the safety is the
filter: all 10 industries with the same filter made 10.7% / 23%. The 12 month row
won 3 of 6 decades, which is not most, so it fails the bar, and the 6 month row won
1. At 2x the 12 month version made 18.9% / 54% and won 5 of 6 decades, but its drop
is 4 points bigger than holding's, and the 6 month version made 16.4% / 53%. On the
real funds from 2000 SPY made 8.2% with a 55% drop. The 1x rows made 7.8% / 24% and
7.3% / 22%, a smoother ride and less money, and equal weight sectors with the filter
made 7.9% / 21%. At 2x the 12 month row made 11.7% / 46%, ahead of SPY on return and
drop, in 15 of 27 years and 2 of 3 decades, a pass; the 6 month row won only 1 of 3
decades. One month late the real rows made more, not less (9.8% for 12 months at
1x), which says the timing is noisy at this speed. Verdict: nothing passes on the
model and the real funds together, since the one real pass (12 months at 2x) fails
the model on the drop and needs margin. No sector sleeve on the paper account. The
12 month 1x version is the only one that could run as nine monthly ETF trades, and
on real funds it gave up 0.4 of a point a year for a drop less than half of SPY's.

**A 24/7 sleeve: trend on crypto.** Joshua wants something that runs around the
clock, and crypto is the obvious candidate, so we ran the same kind of test on
Bitcoin (`century.py --crypto`, raw output in `tradingview/results-crypto.txt`).
Daily prices from July 2010 (Coin Metrics, free; it matches Bitstamp on Bitcoin
and Yahoo on Ethereum to a tenth of a point). Four rules: price above its 50, 100
or 200 day average, or the 12 week return above zero. Signal at one close, trade
the next, 0.25% a side, T-bills when out, no leverage (a 2x crypto fund resets
daily and decays too much in choppy years). We picked on the first half of
Bitcoin's life, 2011 to 2018, and the 50 day average won. Then the second half,
December 2018 to now, which the pick never saw. Bitcoin: 53.8% a year with a 60%
worst drop, against 46.7% and 77% for holding. That clears the first two parts of
the bar. It misses the third: it beat holding in only 4 of 8 calendar years, a
tie, not most. It wins the bear years (2022: -53% against -64%) and loses the big
bull years, because it sits out about 46% of the days and switches 19 times a
year. Against 500 random in and out schedules with the same time in the market and
the same switches it beat 98%, and only 6 matched it on both return and drop. One
day late it still made 49.1% with a 58% drop. The frozen rule on Ethereum did the
same thing: 58.5% and a 61% drop against 49.2% and 79%, again 4 of 8 years, and it
fell to 41.7% a year when traded a day late. An equal weight basket of ten coins
(today's survivors, so flattering) did worse: 75.7% against 77.7% for holding,
with a smaller drop, 53% against 77%. One honest wrinkle: the 100 day average made
the same 53.9% a year on the blind half with only a 46% drop, but we would not have
picked it.

Sized small, it barely matters which Bitcoin rule you use. On the same blind
dates, with the rest in Trend 2x S&P, rebalanced monthly: the S&P sleeve alone made
17.1% with a 41% worst drop; 5% in Bitcoin held made 19.5% with a 41% drop; 5% in
Bitcoin trend made 19.4% with a 41% drop. The 5% adds about 2.4 points a year
either way and does not change the worst drop. The filter earns its keep on a big
Bitcoin position, where it cuts the 77% drop to 60%, not on a 5% slice. On IBKR,
spot Bitcoin and Ethereum trade 24/7 through Paxos or Zero Hash for 0.12% to 0.18%
a trade for eligible Canadian clients (not Quebec); a paper account mirrors the
live account's permissions, and we could not confirm that it fills crypto. The
IBIT and ETHA funds trade only in US market hours. Verdict: a coin flip on the
years, a real cut in the crash, not worth more than a small sleeve.

**Trend on the other assets, one at a time.** Everything above keeps the S&P in the
box. The other question is whether the same plain rule works on assets that are
not stocks, each as its own sleeve (`century.py --assets`, raw output in
`tradingview/results-assets.txt`). The rule is Faber's (2007) and nothing is
tuned: hold the asset while it closes above its 10 month average (200 day on
daily funds), else T-bills, 1x, 0.1% a switch. On the century series, 10 and 20
year Treasuries priced off yields and gold, from 1976 to now, it looks good.
10 year: 6.4% a year with a 12% worst drop against holding's 6.2% and 25%, 4 of 6
decades. 20 year: 7.6% and 18% against 6.3% and 44%. Gold: 10.3% and 24% against
6.6% and 65%. Each beat at least 95% of 300 random in and out schedules with the
same time in the market, and in 2022 the Treasuries lost 1% and 3% against 15%
and 27% for holding. Then the real funds from 2002 (IEF, TLT) and 2004 (GLD), where
all three fail: IEF 1.7% / 15% against 3.0% / 24%, TLT 1.1% / 44% against 2.6% /
48%, GLD 7.5% / 37% against 10.8% / 46%, each 1 of 3 decades. The 200 day rule
switches 7 to 11 times a year and those years were mostly a bond and gold bull
market, so the trend sat out rallies it paid for. The century result leans on
the 1980s and 1990s (gold fell, bonds paid) and does not repeat on the funds.
Bond trend is also gone a month late (5.6% and 5.7% against 6.2% and 6.3%).
Commodities have no long fund history. DBC from 2006 passes alone: 5.0% / 40%
against 2.7% / 76%, 2 of 3 decades, beating 98% of random schedules, and 2008 was
+16% against -32%. But the longer S&P GSCI index from 1984 (plus bills) fails
(5.1% / 42% against 6.6% / 73%, 1 of 5 decades), and so do GSG, USO (crude), SLV
(silver) and CPER (copper), and so do the front month crude, silver and copper
series, which are not roll adjusted and only indicative. One fund passing against
four others and an index failing is a coincidence of one 20 year window, not an edge.
The 80/20 question: put 20% in the best passing trend sleeve and keep 80% in
Trend 2x. From the month-end series every blend gives up return. DBC: 11.6% / 28%
against Trend 2x alone at 12.7% / 36% from 2006. Gold trend from 1976: 14.2% /
33% against 14.4% / 40%. The control tells the story: 20% in plain bills gives
12.8% / 32%, so most of the smaller drop is just less leverage, and the sleeves
add 0.5 to 1.4 points over bills, not enough to beat Trend 2x. Verdict: no non
stock sleeve. If one ever runs it would be GLD or TLT behind the trend rule, but
both fail on the real fund today.

**Overnight only.** The old claim is that nearly all of the stock market's gain
comes while it is closed (Cooper, Cliff and Gulen 2008; Lou, Polk and Skouras
2019), so buy at the close, sell at the open and skip the trading day
(`century.py --overnight`, raw output in `tradingview/results-overnight.txt`).
The test uses SPY from 1993 with real opens. The index's own opens are useless,
because Yahoo gives the prior close as the open on 60% of days before 2014. The
split is real. Holding SPY grew 31.7x, the nights alone 25.2x and the trading
days alone 1.26x, which is 10.1% a year against 0.7%, and nights won 23 of 33
full years. The money is where it breaks. Blind on 2010 to now, holding made
14.2% / 34%. Overnight only made 9.3% / 29% at zero fee, intraday only 6.0% /
24%, and overnight only above the 200 day average 8.2% / 16%, with bills for
the hours out. None beat holding even for free, so there is no break-even fee
against holding. Two trades a day is 503 a year, and the average night earns
3.6 hundredths of a percent, so costs eat it fast: overnight only makes 6.6%
at 0.005% a side, 3.9% at 0.01%, loses 15% a year at 0.05% and 34% at 0.1%. With
IBKR Pro ($1 minimum a side, $503 a year on a $100k sleeve at today's price,
$1,080 across the blind years) plus half the spread at 0.01% a side, it makes
2.8% against 1.5% for plain bills, and it stops beating bills at 0.015% a side.
The trend filter buys a smooth ride (2008 +1.0%, March 2020 -8.2%, 2022 -4.7%,
against -37%, -13% and -18% for holding) but beat only 55% of 300 random sets of
the same number of nights on return: the smaller drop is just sitting in bills.
Verdict: the overnight effect is real and unusable. Nothing changes.

**What could still be wrong.** The stock list is today's S&P 500. Companies
that crashed and got kicked out are missing, and that makes buying dips look
better than it really was. Prices are assumed to fill exactly, with no extra
slippage beyond the fee. And we haven't yet checked how often random trades
would do just as well. Until those are done, treat this as a strong lead, not
a promise.

#### Scoreboard

Every edge we have tried, graded blind, against holding over the same years.
The bar is three things at once: more yearly return than holding, no bigger
worst drop, and a win in most blind decades. The numbers come from the results
files named above.

| Edge | Blind years | Blind return / worst drop | Holding | Pass |
|---|---|---|---|---|
| Double 7s, one account over 16 index funds | 2020 to now | 2.7% / 35% | SPY 15.1% / 34% | fail |
| Epiphany Kelly on 429 stocks | 2020 to now | -2.0% typical year | 9.1% | fail |
| Trend only, S&P above its 12 month average | 1949 to now | 11.4% / 23% | 11.7% / 51% | fail (less return) |
| Dual momentum, stocks, bonds, gold | 1949 to now | 13.5% / 27% | 11.7% / 51% | fail (2 of 8 unseen decades) |
| Stock momentum, point in time S&P 500 | 2020 to now | 9.8% / 35% | SPY 15.1% / 34% | fail |
| French momentum top tenth, 0.1% costs | 1976 to now | 15.9% / 52% | 12.3% / 50% | fail (bigger drop) |
| Trend 2x S&P, 2x fund above 200 day average | 1976 to now | 14.4% / 44% | 12.1% / 55% | pass (5 of 6 decades) |
| Trend 2x Nasdaq 100, index plus yield | 2006 to now | 20.3% / 41% | 15.8% / 53% | pass (2 of 3 decades) |
| Trend 2x Nasdaq 100, QQQ real dividends | 2012 to now | 27.8% / 42% | 20.1% / 35% | fail (bigger drop) |
| Trend 2x TSX, index plus yield | 2003 to now | 9.4% / 43% | 10.1% / 49% | fail (less return) |
| Trend 2x TSX, XIU real dividends | 2013 to now | 11.4% / 34% | 11.2% / 35% | fail (1 of 2 decades) |
| Trend 2x Nikkei, index plus yield | 1995 to now | 6.0% / 68% | 5.8% / 63% | fail (bigger drop) |
| Trend 2x Japan, EWJ real dividends | 2011 to now | 3.2% / 49% | 7.8% / 33% | fail |
| Trend 2x DAX, total return index | 2007 to now | 5.0% / 54% | 6.4% / 55% | fail (less return) |
| Trend 2x Germany, EWG real dividends | 2011 to now | 3.6% / 48% | 5.5% / 47% | fail |
| Trend 2x Dow, index plus yield | 2009 to now | 9.8% / 38% | 13.4% / 37% | fail |
| Trend 2x Dow, DIA real dividends | 2012 to now | 10.1% / 38% | 12.6% / 37% | fail |
| Trend 2x FTSE 100, index plus yield | 2005 to now | -0.3% / 68% | 7.6% / 45% | fail |
| Trend 2x UK, EWU real dividends | 2011 to now | -1.4% / 49% | 6.0% / 43% | fail |
| Trend 1x Bitcoin, 50 day average, 0.25% a side | 2018 to now | 53.8% / 60% | 46.7% / 77% | fail (4 of 8 years) |
| Trend 1x Ethereum, same frozen rule | 2018 to now | 58.5% / 61% | 49.2% / 79% | fail (4 of 8 years) |
| Trend 1x top 10 coin basket, same frozen rule | 2018 to now | 75.7% / 53% | 77.7% / 77% | fail (less return) |
| Trend 2x S&P, 10y Treasuries when out | 1976 to now | 15.0% / 50% | Trend 2x, bills 14.4% / 44% | fail (bigger drop, 3 of 6 decades) |
| Same, 10y only above its own 200 day average | 1976 to now | 15.6% / 45% | 14.4% / 44% | fail (drop 0.6 point bigger) |
| Trend 2x S&P, 20y Treasuries when out | 1976 to now | 15.6% / 55% | 14.4% / 44% | fail (bigger drop, 3 of 6 decades) |
| Same, 20y only above its own 200 day average | 1976 to now | 16.8% / 45% | 14.4% / 44% | fail (drop 0.6 point bigger) |
| Trend 2x S&P, gold when out | 1976 to now | 14.1% / 52% | 14.4% / 44% | fail (less return, bigger drop) |
| Same, gold only above its own 200 day average | 1976 to now | 15.5% / 41% | 14.4% / 44% | pass on the model (4 of 6), fails on real GLD from 2006 |
| Trend 2x S&P, half bills half gold when out | 1976 to now | 14.3% / 43% | 14.4% / 44% | fail (less return) |
| Same, gold half only above its own 200 day average | 1976 to now | 14.8% / 42% | 14.4% / 44% | pass on the model (4 of 6), fails on real GLD from 2006 |
| Trend 2x S&P, 2x 10y Treasuries in a bond uptrend, else bills | 1976 to now | 17.0% / 45% | 14.4% / 44% | fail (0.8 point bigger drop) |
| Trend 2x S&P, 2x 20y Treasuries in a bond uptrend, else bills | 1976 to now | 19.3% / 45% | 14.4% / 44% | fail (1.0 point bigger drop) |
| Dual momentum + own 10 month trend, stocks, bonds, gold | 1976 to now | 12.3% / 33% | 12.1% / 55% | fail (2 of 6 decades; also 2.1 points behind Trend 2x) |
| Same, 2x stocks when stocks win | 1976 to now | 12.3% / 61% | 12.1% / 55% | fail (bigger drop, 2 of 6 decades) |
| Dual + own trend, no gold | 1976 to now | 9.4% / 33% | 12.1% / 55% | fail (less return, 1 of 6 decades) |
| Same, 2x stocks, no gold | 1976 to now | 10.1% / 59% | 12.1% / 55% | fail (less return, bigger drop, 1 of 6 decades) |
| Long only value, top book-to-market tenth, 0.06% a year costs | 1976 to now | 15.8% / 70% | 12.3% / 50% | fail (bigger drop) |
| Long only size, smallest tenth | 1976 to now | 12.3% / 62% | 12.3% / 50% | fail (bigger drop, 2 of 6 decades) |
| Long only profitability, top tenth | 1976 to now | 13.6% / 41% | 12.3% / 50% | pass vs holding (4 of 6 decades); fails vs Trend 2x on return |
| Long only investment, lowest asset growth tenth | 1976 to now | 14.5% / 56% | 12.3% / 50% | fail (bigger drop) |
| Trend 2x on the French market, 10 month average, monthly model | 1976 to now | 14.3% / 51% | 12.3% / 50% | fail (1 point bigger drop, 3 of 6 decades) |
| Same, on the value tenth | 1976 to now | 20.9% / 71% | Trend 2x market 14.3% / 51% | fail (bigger drop) |
| Same, on the size tenth | 1976 to now | 13.6% / 83% | 14.3% / 51% | fail (less return, bigger drop) |
| Same, on the profitability tenth | 1976 to now | 14.6% / 56% | 14.3% / 51% | fail (bigger drop) |
| Same, on the investment tenth | 1976 to now | 15.8% / 61% | 14.3% / 51% | fail (bigger drop) |
| Same, on the momentum tenth | 1976 to now | 17.4% / 59% | 14.3% / 51% | fail (bigger drop) |
| Quality tenth only while the market is above its 10 month average, bills else, 1x | 1976 to now | 10.9% / 28% | 12.3% / 50% | fail (1.4 points less return, 1 of 6 decades; beats 33% of random schedules; real QUAL from 2013 8.0% / 26% against SPY 14.0% / 34%) |
| Quality plus momentum tenths, 50/50 monthly | 1976 to now | 15.0% / 46% | 12.3% / 50% | pass on the model (5 of 6 decades, past Trend 2x 14.3% / 51% too), not past plain quality (drop 46% against 41%), 12.1% / 48% at 0.5% a side, fails on real QUAL plus MTUM from 2013 (14.8% / 34.1% against SPY 14.0% / 33.7%, 7 of 14 years) |
| Same, with the market 10 month filter | 1976 to now | 12.3% / 28% | 12.3% / 50% | fail (no more return, 2 of 6 decades; real 8.7% / 30% against SPY 14.0% / 34%) |
| Quality plus value tenths, 50/50 monthly | 1976 to now | 15.0% / 56% | 12.3% / 50% | fail (bigger drop; real QUAL plus VTV 12.6% / 35% against SPY 14.0% / 34%) |
| Trend 2x + Quality tenth, 50/50 monthly rebalance (70/30 and 30/70 alike) | 1976 to now | 14.3% / 33% | 12.3% / 50% | pass on the model (5 of 6 decades, 14.1% to 14.5% across weights, return to drop 0.43 against 0.36 and 0.33 for the legs); real SSO/BIL plus QUAL from 2013 14.4% / 27% against SPY 14.1% / 24%, fail (bigger drop) |
| Trend 2x S&P, exposure scaled to 20% target vol on 60 days (picked of 6 on 1929 to 1975) | 1976 to now | 11.3% / 29% | Trend 2x 14.4% / 44% | fail (less return, 1 of 6 decades; also behind holding's 12.1%) |
| Trend 2x S&P, 2x only when 20 day vol is under its 1 year median, else 1x | 1976 to now | 10.3% / 38% | 14.4% / 44% | fail (less return, 2 of 6 decades) |
| Turn of the month, 1x S&P on the last and first 3 days, bills else, 0.1% fee | 1976 to now | 5.9% / 21% | 12.1% / 55% | fail (less return, 2 of 6 decades; beats 100% of random masks, loses 2.6 points a year to fees) |
| Sell in May, 1x S&P November to April, bills else | 1976 to now | 10.0% / 36% | 12.1% / 55% | fail (less return, 2 of 6 decades; beats 98% of random masks) |
| Pre-holiday, 1x S&P the day before holiday gaps, bills else | 1976 to now | 3.5% / 16% | 12.1% / 55% | fail (less return, 1 of 6 decades) |
| Skip Mondays, 1x S&P, bills Friday close to Monday close | 1976 to now | 1.9% / 71% | 12.1% / 55% | fail (less return, bigger drop, 0 of 6 decades; 95 switches a year) |
| Trend 2x S&P, 2x on the turn of the month, else Trend 1x | 1976 to now | 8.5% / 30% | 14.4% / 44% | fail (less return, 1 of 6 decades; a plain 1.19x trend made 11.1% / 27%) |
| Trend 2x S&P, 2x November to April, else Trend 1x | 1976 to now | 13.8% / 41% | 14.4% / 44% | fail (0.6 point less return, smaller drop, 4 of 6 decades; behind at every fee and on real funds, 10.7% / 43% against 12.5% / 43%) |
| Trend 2x S&P, 2x on pre-holiday days, else Trend 1x | 1976 to now | 8.5% / 24% | 14.4% / 44% | fail (less return, 1 of 6 decades) |
| Trend 2x S&P, bills on Mondays | 1976 to now | 3.6% / 74% | 14.4% / 44% | fail (less return, bigger drop, 0 of 6 decades) |
| Low variance tenth, 1x | 1976 to now | 11.5% / 34% | 12.3% / 50% | fail (0.9 point less return, 3 of 6 decades; Sharpe 0.65 against 0.56, 2022 -0.7%; real USMV from 2011 11.5% / 33% against SPY 15.0% / 34%) |
| Low beta tenth, 1x | 1976 to now | 12.2% / 39% | 12.3% / 50% | fail (0.1 point less return, 3 of 6 decades; 2022 -0.8%; no low beta fund) |
| Low variance tenth only while the market is above its 10 month average, bills else, 1x | 1976 to now | 9.9% / 29% | 12.3% / 50% | fail (2.4 points less return, 1 of 6 decades; beats 64% of random schedules, better a month late; real USMV with the SPY filter 7.5% / 21% against SPY 15.0% / 34%) |
| Low beta tenth with the same filter, 1x | 1976 to now | 10.5% / 21% | 12.3% / 50% | fail (1.9 points less return, 1 of 6 decades; beats 65% of random schedules, better a month late) |
| Low variance tenth at 1.5x, margin at bills + 1% | 1976 to now | 14.1% / 49% | 12.3% / 50% | fail (3 of 6 decades; real USMV at 1.5x 15.7% / 47% against SPY 15.0% / 34%, SPLV at 1.5x 12.9% / 52%) |
| Low beta tenth at 1.5x, margin at bills + 1% | 1976 to now | 15.2% / 54% | 12.3% / 50% | fail (bigger drop; 4 of 6 decades) |
| Top 3 of 10 French industries by 12 month return, only while the market is above its 10 month average, 1x | 1976 to now | 12.9% / 27% | 12.3% / 50% | fail (3 of 6 decades; ranking beats 100% of 300 random picks; 2008 +1.5%, 2022 -2.2%; real SPDR sectors from 2000 7.8% / 24% against SPY 8.2% / 55%, fail on return) |
| Same, 6 month return | 1976 to now | 11.7% / 24% | 12.3% / 50% | fail (less return, 1 of 6 decades; real 7.3% / 22%, fail) |
| Same, 12 month return, 2x on margin at bills + 1% | 1976 to now | 18.9% / 54% | 12.3% / 50% | fail on the model (4 points bigger drop, 5 of 6 decades); passes on real SPDR sectors from 2000 (11.7% / 46% against SPY 8.2% / 55%, 15 of 27 years, 2 of 3 decades); needs margin |
| Same, 6 month return, 2x on margin | 1976 to now | 16.4% / 53% | 12.3% / 50% | fail (bigger drop, 4 of 6 decades; real 10.7% / 43%, 1 of 3 decades) |
| Trend 1x 10y Treasuries, 10 month average, bills else, 0.1% a switch | 1976 to now | 6.4% / 12% | 6.2% / 25% | pass on the model (4 of 6 decades), fails on real IEF from 2002 (1.7% / 15% against 3.0% / 24%, 1 of 3 decades; beats 95% of random schedules, loses to holding a month late) |
| Trend 1x 20y Treasuries, same rule | 1976 to now | 7.6% / 18% | 6.3% / 44% | pass on the model (4 of 6), fails on real TLT from 2002 (1.1% / 44% against 2.6% / 48%, 1 of 3 decades; 2022 -3% against -27%) |
| Trend 1x gold, same rule | 1976 to now | 10.3% / 24% | 6.6% / 65% | pass on the model (4 of 6), fails on real GLD from 2004 (7.5% / 37% against 10.8% / 46%, 1 of 3 decades; beats 100% of random schedules) |
| Trend 1x DBC broad commodities, 200 day average | 2006 to now | 5.0% / 40% | 2.7% / 76% | pass on the one fund (2 of 3 decades, beats 98% of random schedules, 2008 +16% against -32%); the S&P GSCI index from 1984 fails (5.1% / 42% against 6.6% / 73%, 1 of 5 decades), so a one window result |
| Trend 1x GSG broad commodities | 2007 to now | 1.9% / 67% | -0.6% / 90% | fail (1 of 2 decades) |
| Trend 1x USO crude oil | 2007 to now | -0.3% / 80% | -4.5% / 98% | fail (1 of 2 decades; front month crude 1.6% / 74% against 6.5% / 93%, 0 of 3) |
| Trend 1x SLV silver | 2007 to now | 3.3% / 64% | 7.2% / 76% | fail (less return, 1 of 2 decades; front month silver 5.5% / 68% against 12.9% / 74%) |
| Trend 1x CPER copper | 2012 to now | -1.0% / 47% | 3.5% / 55% | fail (less return, 0 of 2 decades; front month copper 8.5% / 58% against 11.1% / 69%) |
| 80% Trend 2x S&P + 20% DBC trend, monthly | 2006 to now | 11.6% / 28% | Trend 2x alone 12.7% / 36% | fail (less return, 1 of 3 decades; 20% in bills gives 10.8% / 29%) |
| 80% Trend 2x S&P + 20% gold trend, monthly | 1976 to now | 14.2% / 33% | Trend 2x alone 14.4% / 40% | fail (0.2 point less return, 3 of 6 decades; 20% in bills gives 12.8% / 32%; gold fails on real GLD anyway) |
| Overnight only, SPY close to open, bills in the session, zero fee | 2010 to now | 9.3% / 29% | SPY 14.2% / 34% | fail (less return, 5 of 16 years; no break-even fee against holding; 2.8% / 30% at IBKR Pro plus half spread, 1.5% for bills) |
| Intraday only, SPY open to close, bills overnight, zero fee | 2010 to now | 6.0% / 24% | 14.2% / 34% | fail (less return, 2 of 16 years; 0.8% at 0.01% a side) |
| Overnight only while SPY is above its 200 day average, zero fee | 2010 to now | 8.2% / 16% | 14.2% / 34% | fail (less return, 4 of 16 years; beats 55% of random nights; 2.8% / 20% at IBKR Pro plus half spread; loses 12.5% a year at 0.05% a side) |

The 2x rows take the 0.8% fund gap off. Index rows add a flat yield measured
off the matching fund. The crypto rows count calendar years instead of decades. The Epiphany Kelly row has no drop figure and holding is
the 429 stocks, so it is a different yardstick from the others. Two of the first 22 rows
pass, and they are the same bet twice: trend at 2x on the S&P and the
Nasdaq 100. The ten out-asset rows at the bottom swap what
sits in the box when the rule is out and are graded against Trend 2x with bills,
not the S&P, so they are variations on the first bet, not new edges. The four dual momentum rows at the very bottom are graded against holding the S&P, and none of them beats Trend 2x either. The ten factor rows at the very bottom use French's tenths: the first four are graded against holding the market, the stacked ones against Trend 2x on the same monthly French series (the momentum row is above). Only profitability at 1x passes, and only against holding. The four quality upgrade rows after them are graded against holding the market on the same French series: one passes on the model and none passes on the real funds. The two vol rows after those are graded against Trend 2x and both fail on return. The eight calendar rows at the very bottom use windows fixed from the literature, nothing tuned: the first four are graded against holding the S&P, the four stacked ones against Trend 2x, and all eight fail. The six low volatility rows after those are graded against holding the market on the French series, and all six fail on the model and on the real funds. The four sector momentum rows at the very bottom are graded against holding the market on the French industries and against SPY on the real SPDR funds; none passes on both. The eight single asset trend rows after those are graded against holding that asset: the three century rows pass on the model and fail on the real fund, DBC passes alone and nothing else in commodities does. The two blend rows are graded against Trend 2x alone, and both fail on return. The three overnight rows at the very bottom are graded against holding SPY from 2010 on real opens, years instead of decades, and all three fail at every fee from zero to 0.1% a side. The only rule we paper trade is the first. The Nasdaq 100 stays a
lead until its real-dividend half stops falling further than holding.


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
