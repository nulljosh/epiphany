# Quant methods to test against Trend 2x

Baseline: SPY above its 200 day average, hold SSO, otherwise BIL (scripts/ibkr-trend.py). Everything below is a
candidate to beat that baseline after costs, or a tool to check whether a win is real.

## Validation tools (use these before believing any backtest)

- Deflated Sharpe Ratio (Bailey, Lopez de Prado). Discounts a Sharpe for how many variants were tried and for
  fat tails. We tested 85 rules across 148 settings, so any new winner must clear a deflated bar, not a raw one.
- Probability of Backtest Overfitting (PBO). How often the in-sample best variant ranks below median out of sample.
- Combinatorial Purged Cross-Validation. Purges and embargoes data around each test fold, then scores every
  train/test combination. Reported to beat plain walk-forward at limiting overfitting.

## Strategy candidates

1. Time series momentum with volatility targeting: sign of trailing 1, 3, 12 month return, position scaled to a
   fixed volatility. The 12 month signal lags in fast reversals, so blend horizons.
2. Multi-average blend instead of one 200 day line (for example 50, 100, 200 vote). Less whipsaw at the threshold.
3. Volatility-scaled leverage on the bull side: hold SSO only when realized vol is below a cap, otherwise SPY.
4. Cash-overlay crash brake: partial move to BIL on a fast drawdown even while above the 200 day.

## Rules for the loop

- Research and backtests only. No live orders, no changes to the Autopilot server, no edits to ibkr-trend.py.
- Every result reports: net of costs, deflated Sharpe, PBO, and the number of variants tried so far (running total).
- A candidate is only promoted to a note for Joshua when it beats Trend 2x on both deflated Sharpe and max drawdown.

Sources: SSRN 2460551 (Deflated Sharpe Ratio), Wikipedia "Purged cross-validation", eslazarev/purged-cross-validation on GitHub.

## Results log

2008-2026, daily, SSO and BIL real closes, 5 bps per switch, trial count 149 (script bug fixed: Yahoo range=max returns monthly bars, use period1/period2).

| Strategy | CAGR | Sharpe | Max drawdown | Deflated Sharpe |
|---|---|---|---|---|
| Trend 2x (SPY above 200 day, SSO else BIL) | 16.3% | 0.76 | -37.9% | 0.71 |
| 3-average vote (50/100/200) | 15.9% | 0.76 | -38.6% | 0.71 |
| SSO buy and hold | 17.6% | 0.61 | -81.0% | n/a |

Read: Trend 2x gives up about 1 point of return to cut the worst drop from -81% to -38%. The vote variant adds nothing. Next: vol cap on the SSO side, cash-overlay brake.

Vol cap (SSO only while 20 day SPY vol is under the cap, SPY 1x above the 200 day when vol is higher, BIL below), trial count 152:

| Cap | CAGR | Sharpe | Max drawdown | Deflated Sharpe |
|---|---|---|---|---|
| 20% | 15.6% | 0.77 | -33.2% | 0.71 |
| 25% | 17.9% | 0.84 | -35.4% | 0.80 |
| 30% | 16.8% | 0.79 | -36.7% | 0.74 |

Read: 25% edges Trend 2x on return, Sharpe and drawdown, but it is the best of three tuned caps on one 18 year sample, so treat it as a lead, not a win. Next: walk-forward the cap (pick it on past data only), then the cash-overlay brake.

## Walk-forward and the real benchmark (trial count 156)

Crash brake (cash when more than 8, 10 or 15 percent under the 60 day high, even above the 200 day): no help. 8%: 14.4% CAGR, deflated Sharpe 0.61. 10 and 15%: same as Trend 2x. Dropped.

Walk-forward vol cap (each year pick the best config by Sharpe on all earlier data, 2012 on): it picked cap 25% every single year. Result 20.8% CAGR, Sharpe 0.94, vs Trend 2x 20.7%, Sharpe 0.92 over the same days. Gain is 0.1 point. The cap is not an edge.

Against SPY itself (dividends in), same days:

| | CAGR | Sharpe | Max drawdown |
|---|---|---|---|
| SPY buy and hold, 2008 on | 12.2% | 0.68 | -51.5% |
| Trend 2x, 2008 on | 16.3% | 0.76 | -37.9% |
| SPY, 2012 on | 15.2% | 0.94 | -33.7% |
| Trend 2x, 2012 on | 20.7% | 0.92 | -36.7% |

Read: Trend 2x makes more money than SPY, but only by taking about 1.4x the risk. Sharpe is a tie since 2012. That is leverage, not skill, and it is why paper looks like "matching the market" on quiet days and wins big on up days. A real edge needs a return stream that does not come from SPY beta. Next: cross-asset trend (SPY, EFA, TLT, GLD, DBC), dual momentum, then a blend with Trend 2x.
