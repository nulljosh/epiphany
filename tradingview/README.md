# Opticon TradingView Indicators

Pine Script v6 indicators ported from Opticon's trading simulator.

## Files

- `opticon-kelly.pine` -- Indicator overlay. Shows Kelly position sizing, entry/exit signals, info table.
- `opticon-kelly-strategy.pine` -- Strategy version. Same logic but backtestable via TradingView Strategy Tester.

## How to Use

### Indicator (opticon-kelly.pine)

1. Open TradingView chart
2. Pine Editor > Open > paste `opticon-kelly.pine`
3. Add to Chart
4. Configure inputs:
   - **Account Equity**: your account size (default $10,000)
   - **Kelly Fraction**: portion of full Kelly to use (default 25%)
   - **Estimated Win Rate**: your historical win rate (default 55%)
   - **Reward/Risk Ratio**: derived from 5% target / 1.7% stop = 2.94

The info table (top-right) shows recommended position size in dollars and shares.

### Strategy (opticon-kelly-strategy.pine)

1. Pine Editor > Open > paste `opticon-kelly-strategy.pine`
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

The Opticon simulator uses balance-dependent Kelly fractions:

| Balance      | Kelly Fraction |
|-------------|---------------|
| < $10       | 65%           |
| < $100      | 50%           |
| < $10,000   | 35%           |
| < $1,000,000 | 25%          |
| < $100M     | 15%           |
| Default     | 10%           |

The TradingView versions use a single configurable fraction (default 25%) since account equity is static per session.
