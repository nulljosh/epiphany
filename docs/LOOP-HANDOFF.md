# Epiphany loop handoff (2026-10-02, evening)

## What the loop is

Overnight edge search engine running in the menu bar, looking for trading strategies that beat the market. Menu bar app backtests random trend, momentum, and inverse-vol strategies across 16 ETFs with held-out-years validation and deflated Sharpe scores. Will search weeks or months to find an edge that holds walk-forward. Paper trading continues weekdays at 12:45pm Pacific via menu bar Epiphany Live.

## Where things stand

Edge search engine live: 400 trials so far with no leads; best strategy still trails SPY held-out Sharpe by 0.1%. Fixed critical Yahoo backtest bug (range=max returned monthly OHLC bars instead of daily) that had understated volatility across all prior backtests. Confirmed Trend 2x real numbers: 16.3% CAGR (2008-2026), Sharpe 0.76, worst drop -38%, versus SPY 12.2% CAGR, 0.68 Sharpe, -52% worst drop; since 2012 Trend 2x Sharpe ties SPY but only by taking 1.4x the risk. Engine logs to ~/Library/Logs/EpiphanyEdge.log in plain English describing each strategy and its performance. Menu bar shows one plain line "Edge search: N tried, none beat the S&P" (click to open log). iOS 2.5.15 live, macOS 2.5.15 IN_REVIEW. Paper account trailing SPY slightly since Oct 1; next trade Monday 12:45pm PT.

## Next, in order

1. Let edge search run overnight (takes weeks or months to find an edge).
2. When a lead is found (strategy beating SPY Sharpe in both training and held-out years), forward-test it on paper trading for at least a week before any live trade.
3. Monitor paper trading performance Mon-Fri at close, note any new leads in menu bar.
4. Ship Mac 2.5.15 once approved by App Review.

## Restart prompt

```text
/loop
Read tradingview/edge-state.json (current trial count, leads), ~/Library/Logs/EpiphanyEdge.log (last entries), and this handoff. Run 100 more edge search trials, note any new leads, report trial count and whether any strategy beats SPY on held-out years. If a lead is found, read scripts/edge-search.py and plan a forward-test (never go live without Joshua). Watch Monday 12:45pm PT paper trade.
```
