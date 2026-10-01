# Epiphany Kelly TradingView Indicators

Pine Script v6 indicators ported from Epiphany's trading simulator.

## Files

- `epiphany-kelly.pine` -- Indicator overlay. Shows Kelly position sizing, entry/exit signals, info table.
- `epiphany-kelly-strategy.pine` -- Strategy version. Same logic but backtestable via TradingView Strategy Tester.

## How to Use

### Indicator (epiphany-kelly.pine)

1. Open TradingView chart
2. Pine Editor > Open > paste `epiphany-kelly.pine`
3. Add to Chart
4. Configure inputs:
   - **Account Equity**: your account size (default $10,000)
   - **Kelly Fraction**: portion of full Kelly to use (default 25%)
   - **Estimated Win Rate**: your historical win rate (default 55%)
   - **Reward/Risk Ratio**: derived from 5% target / 1.7% stop = 2.94

The info table (top-right) shows recommended position size in dollars and shares.

### Strategy (epiphany-kelly-strategy.pine)

1. Pine Editor > Open > paste `epiphany-kelly-strategy.pine`
2. Add to Chart
3. Open Strategy Tester tab to see:
   - Equity curve
   - Trade list with entry/exit prices
   - Win rate, profit factor, max drawdown
   - Kelly fraction adapts dynamically from backtest results after 10+ trades

## Entry Logic (from simBenchmark.js)

All conditions must be true simultaneously:

1. **Momentum**: `(close - SMA10) / SMA10 >= 0.01`
2. **Prior bar momentum**: previous bar also above SMA10
3. **Volatility filter**: `stdev(10) / SMA10 < 0.025`
4. **Rising bars**: at least 5 of last 10 bars closed higher than prior bar
5. **Trend**: close above SMA20
6. **Kelly positive**: Kelly formula produces a positive bet size

## Exit Logic

- **Stop loss**: entry price * 0.983 (1.7% below entry)
- **Take profit**: entry price * 1.05 (5% above entry)
- **Trailing stop**: activates when unrealized profit exceeds 2%, trails at 3% below current price

## Kelly Criterion

```
f = (b * p - q) / b
```

- `b` = reward/risk ratio (default 2.94)
- `p` = win probability
- `q` = 1 - p
- Result multiplied by fraction (default 25%) and capped at 10% of equity

The strategy version computes win rate and R:R dynamically from backtest results once enough trades accumulate (>10).

## Simulator Balance Scaling (Reference)

The Epiphany simulator uses balance-dependent Kelly fractions:

| Balance      | Kelly Fraction |
|-------------|---------------|
| < $10       | 65%           |
| < $100      | 50%           |
| < $10,000   | 35%           |
| < $1,000,000 | 25%          |
| < $100M     | 15%           |
| Default     | 10%           |

The TradingView versions use a single configurable fraction (default 25%) since account equity is static per session.

## Epiphany (epiphany.pine)

The five strategies from agents.surf that run on a single chart: Single MA, Two MA, Three MA, Donchian breakout and IBS mean reversion. Pick one from the Strategy input. Long only. The other 96 need options chains, cross-sections or bond curves, so they don't fit one chart.

To trade it, launch TradingView with `--remote-debugging-port=9222`, add the strategy, then:

```
node scripts/tv-signal-agent.js --study Epiphany --dry-run
```

The agent fires only on labels that appear after it starts. Drop `--dry-run` to hit the Alpaca paper endpoint.

## IBKR (Interactive Brokers) hookup

Alpaca does not take Canadian residents for live accounts, so IBKR Canada is the broker. The bot talks to IB Gateway running on this Mac, so no key ever leaves the machine.

One time, by you:
1. Open an account at ibkr.ca (ID check, funding is optional for paper). Then Settings, Paper Trading Account, create one.
2. Install IB Gateway (stable), log in with the paper username.
3. In Gateway: Configure, Settings, API. Tick Enable ActiveX and Socket Clients, port 4002, untick Read-Only API, add 127.0.0.1 as trusted.

Then, with Gateway logged in:

```
node scripts/tv-signal-agent.js --study Epiphany --broker ibkr --dry-run   # watches the chart, connects, sends nothing
node scripts/tv-signal-agent.js --study Epiphany --broker ibkr             # paper orders
```

`scripts/ibkr-order.py` only trades demo and paper accounts (IDs starting with D) unless you pass `--live`. Stocks and ETFs only. Whole shares: SPY is about $760 a share, so a sleeve under that needs a cheaper ETF or IBKR's fractional orders.

## Running it daily on IBKR

`scripts/ibkr-run.py` runs Double 7s on 16 index and sector ETFs through IB Gateway. It does not need TradingView or the MCP, only the Gateway logged in and an internet connection.

```
uv run --with ib_async python3 scripts/ibkr-run.py        # show the plan and the account, send nothing
uv run --with ib_async python3 scripts/ibkr-run.py --go   # send today's orders
```

Run it once per trading day. It does not schedule itself. Each position is 10% of `--sleeve` (default $10,000), whole shares only, demo and paper accounts only unless you pass `--live`. It prints your account value and how much it has changed since the first run, and keeps a local log in `tradingview/ibkr-state.json`.

### All day, for weeks, with no Claude usage

`scripts/ibkr-live.py` is one foreground script. Start it once in a terminal tab:

```
caffeinate -i uv run --with ib_async python3 scripts/ibkr-live.py
```

It watches the account during US market hours and sends a Mac notification when the positions move another 1% or the account moves another 20. It runs the daily trade once after the close, tells you if the Gateway logs out, and logs to `~/Library/Logs/EpiphanyIBKR.log`. Ctrl-C stops it. The strategy decides once a day on the closing prices, so orders placed after the close fill at the next open in the live market.
