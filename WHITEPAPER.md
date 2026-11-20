# Epiphany whitepaper

Your world on one screen: the map, the markets and your money. Live at [epiphany.jaybulb.com](https://epiphany.jaybulb.com), with apps for iPhone, Mac and Apple Watch.

This is the short version. Every test, table and failed idea is in [docs/reference/whitepaper-full.md](docs/reference/whitepaper-full.md).

## Why a map

The tools that put geodata, markets and news into one picture are built for governments and funds. A map is the one screen that can hold unrelated feeds (quakes, flights, incidents, prices) side by side without forcing them into one shape first. Epiphany adds your money to it, and a trading rule that has to prove itself before it touches real money.

## The trading rule: Trend 2x

If the S&P 500 (SPY) closes above its 200 day average, hold SSO, a fund that moves twice as much as the S&P. If it closes below, hold BIL, short T-bills. Check once a day and trade only when the side changes. Nothing else decides a trade.

Code: `trend2x()` in `src/utils/indicators.js` (server) and `scripts/ibkr-trend.py` (Mac). The Buy/Hold/Sell badges and the Monte Carlo bull odds in the app are there to read, not to trade on.

### Does it work?

Every idea was tuned on old years and graded on years it never saw, with a trade the morning after its signal and fees on both sides. The bar is three things at once: more yearly return than holding, no bigger worst drop, and a win in most unseen decades.

| Rule | Unseen years | Return a year / worst drop | Holding the S&P | Result |
|---|---|---|---|---|
| Trend 2x on the S&P | 1976 to now | 14.4% / 44% | 12.1% / 55% | passes, 5 of 6 decades |
| Trend 2x on real SSO and BIL | 2008 to now | 16.1% a year | 12.0% | beats it 59% of single years, 69% of 5 year runs |
| Double 7s (buy a 10 day low in an uptrend) | 2020 to now | 2.7% / 35% | 15.1% / 34% | fails: wins 70% of trades but trails holding |
| Epiphany Kelly (the original strategy) | 2020 to now | -2.0% a typical year | 9.1% | fails, retired |

About 84 ideas were scored (momentum, value, dual momentum, crypto trend, other countries, bond and gold swaps). Two passed: Trend 2x and a quality-stock tilt.

**The honest part.** After 148 tries, luck alone clears the bar a few percent of the time. Trend 2x beats holding by 3.4 points a year over 51 years and halves the crash, but its t-stat is 1.6 against a 3.6 bar for that many tries, so it cannot be told apart from a lucky draw. It holds up with higher costs and late signals. Treat it as the best lead, not a proven edge.

## Where it runs

- **Autopilot (server, Pro).** A weekday cron reads SPY against its 200 day average and moves each enrolled user toward SSO or BIL. Paper by default. Live is opt in through SnapTrade, capped at $50 a trade and 20 fills, then it returns to paper on its own.
- **Crypto paper (server, daily).** Hold Bitcoin above its 100 day average, cash below. Paper only.
- **Epiphany Live (Mac).** `scripts/ibkr-live.py` runs Trend 2x as a $100k sleeve at 3:45pm New York through a local IB Gateway on an Interactive Brokers practice account. It refuses real accounts and only sells what its own state file says it owns. The menu bar app (`scripts/menubar.py`) keeps it running and scores it against the S&P 500.

### Guardrails

- Paper first. Real money is a separate opt in, never the default.
- Hard caps per trade and per run, whatever the user sets.
- One kill switch: Autopilot off, unlink the brokerage, or Pause in the menu bar.
- Every trade is logged with time, side, size and fill.
- Nothing goes live until it beats the market on paper, forward in time.

The rules also exist as Pine Script in `tradingview/`, so they can be checked against TradingView's full history.

## Brokers

One adapter interface (`connect`, `placeOrder`, `getPositions`, `getBalance`) in `src/utils/broker.js`, so a new broker is one file. SnapTrade syncs Wealthsimple, Questrade and US brokers read only; the synced balance is the portfolio of record. Interactive Brokers is the path to real trades in Canada (Alpaca does not take Canadians).

## Data

| Layer | Source |
|---|---|
| Quakes | USGS |
| Flights | adsb.lol |
| Incidents | OpenStreetMap, city open data, GDELT |
| Weather and wildfires | NWS, Environment Canada, NASA |
| News | GDELT and publisher feeds |
| Markets | Yahoo Finance, SEC EDGAR (Pilots) |
| Macro | BLS, FRED |

Feeds load in parallel and pause when the tab is hidden. Each has its own error boundary, so one dead feed leaves one empty layer, not a blank map. Markers only draw at real coordinates; there is no placeholder data.

## Case: ANT (Anthropic), November 2026

One share held. IPO priced at $83 on Nov 18 (above the $70 to $78 range), opened at $111.50, closed day one at $97.17, then gave it all back on day two to a low of $83.05. The rule can't read it yet: Trend 2x needs 200 days of history.

**Hold.** Sell on two closes in a row under $83, the IPO floor. Buy more on a close above $97.17 on heavy volume, or a week holding between $83 and $90. `scripts/close-alert.py ANT --below 83 --above 97.17 --base-high 90` sends a Mac notification when one hits (`--install` runs it every weekday after the close). Not financial advice.

## Under the hood

- **Web:** React and MapLibre GL on Cloudflare Workers, with Upstash Redis for sessions and cache.
- **Apps:** SwiftUI for iPhone, Mac and Watch, all on the same API.
- **Money:** free, with Pro at $1.99 a month or $14.99 a year through Stripe and the App Store.

Apache 2.0, 2026, Joshua Trommel.
