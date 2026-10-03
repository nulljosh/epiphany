# Epiphany loop handoff (2026-10-03, evening)

## What the loop is

Hourly edge search loop stopped per Joshua 2026-10-03 evening. Goal stays: beat both the S&P 500 and BTC on walk-forward backtests. Menu bar edge search engine ran 400+ trials on stocks with --crypto flag searching 20-200 day crossovers and multi-timeframe ensembles. Menu bar runs three paper sleeves: BTC trend (100 day), BTC funding-carry (~11%/yr backtest, 16% to 7% decay), BTC/SPY/GLD inverse-vol blend (28 day rebalance, started 17% BTC, 58% SPY, 26% GLD). Stress test shows blend beats SPY on Sharpe across all eras and parameter settings but return edge is Bitcoin only. Paper trading on Autopilot: Joshua's account at 10% of virtual $10k; real live stays capped at $50 per trade. IB Gateway on-demand weekdays 3:30-4:15pm ET.

## Where things stand

- Edge search 400+ trials on stocks: no leads beat S&P yet. --crypto flag added; nothing beats both yet.
- Menu bar now has three paper sleeves (BTC trend, funding-carry, inverse-vol blend).
- Blend stress test: beats SPY on Sharpe all 3 eras and 9 parameter settings (1.17-1.39 vs 0.68); worst drop 23% vs SPY's 34%; without BTC made 8%/yr, capped 15% made 10.5%, both under SPY 13.8%.
- Haiku research reviewed 7 crypto methods: funding carry and BTC trend credible but modest, others flagged decaying/backtest-only.
- Joshua's autopilot on paper; Trend 2x at 10% of virtual $10k (was buying zero at $1 cap).
- iOS 2.5.15 waiting for review; Mac 2.5.15 in review.
- Docs updated (README, WHITEPAPER, API, ARCHITECTURE); carry and blend not yet in WHITEPAPER.

## Next, in order

1. Forward-test paper results; better risk without return edge.
2. Run edge search on crypto months/years on paper, watch for a lead beating both.
3. If no lead: keep blend as risk management or pivot to stocks.
4. Once strategy beats both S&P and BTC on 12+ months paper: unlock live trading.
5. iOS/Mac release: unhide Autopilot screen, native sync, live status.

## Restart prompt

```
/loop until we're beating both the S&P and BTC (Epiphany 2026-10-03). Loop stopped, goal stays. Menu bar: BTC trend (100 day), funding-carry (~11%/yr, 16-7% decay), inverse-vol blend (28 day rebalance, beats SPY on Sharpe all eras/params but return is Bitcoin only). Edge search 400+ trials on stocks/crypto --crypto flag, multi-timeframe ensembles, nothing beats both yet. Paper sleeves daily, stress tested. Paper trading: Joshua at 10% of $10k virtual (Trend 2x). Live capped $50/trade. Research: carry/trend credible, others flagged decaying. IB Gateway weekdays 3:30-4:15pm ET, ibkr-live.py reports and kill-switches on Autopilot toggle. iOS 2.5.15 waiting review, Mac in review. Docs updated (carry/blend not yet in WHITEPAPER). Next: forward-test paper, months/years to beat both, release unlock. Single agent if any, no fan-out, stop above 90 percent usage.
```
