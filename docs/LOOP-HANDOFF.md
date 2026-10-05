# Epiphany loop handoff (2026-10-04, evening)

## What the loop is

QA loop for iOS map search fixes and supporting tasks. Map search now fills from Apple Maps (~1 second) and swaps to fuller OpenStreetMap when Overpass answers. Search bar has working Done button and clear button. What's New moved from blocking sheet to card in view, solving the sheet stacking issue. iOS 2.5.17 submitted to App Review. Mac 2.5.16 in review. PR 189 open with money thousands-separator fix and Autopilot status-card fix, untested in the simulator.

## Where things stand

- iOS 2.5.17 submitted to App Review, waiting for review.
- Mac 2.5.16 in review.
- PR 189 open with two fixes: money formatting (thousands separators) and Autopilot status card (shows blank when load fails). Untested in simulator.
- Places swap from Apple Maps to OpenStreetMap shipped without actually seeing it run (Overpass was down all of 2026-10-04).
- Code sweep reference doc has 45 unverified leads waiting verification and fixes.
- SwiftLint plugin trust issue fixed machine-wide in Xcode command-line builds.

## Next, in order

1. Check PR #189 in the simulator (Portfolio, Markets, Settings) and merge it.
2. When `https://epiphany.heyitsmejosh.com/api/places?lat=49.2827&lon=-123.1207` returns 200, open Places in the simulator and watch the list swap from Apple Maps to OpenStreetMap.
3. Work through `docs/reference/code-sweep-2026-10-04.md`, verifying each of the 45 leads before fixing.
4. Ship Mac 2.5.17 once Mac 2.5.16 clears review.
5. Work through the open items under "2026-10-04 map QA leftovers" in `roadmap.md`.

## Restart prompt

```
/loop Epiphany QA until all is fixed: read docs/LOOP-HANDOFF.md and roadmap.md "2026-10-04 map QA leftovers", then do the next item in order. Test in the simulator with a throwaway UI test (see the reference_ios_sim_ui_test_quirks memory), never claim a fix without a screenshot, one subagent at a time.
```

## Edge search loop (stopped 2026-10-03)

Hourly edge search loop stopped per Joshua 2026-10-03 evening. Goal stays: beat both the S&P 500 and BTC on walk-forward backtests. Menu bar edge search engine ran 400+ trials on stocks with --crypto flag searching 20-200 day crossovers and multi-timeframe ensembles. Menu bar runs three paper sleeves: BTC trend (100 day), BTC funding-carry (~11%/yr backtest, 16% to 7% decay), BTC/SPY/GLD inverse-vol blend (28 day rebalance, started 17% BTC, 58% SPY, 26% GLD). Stress test shows blend beats SPY on Sharpe across all eras and parameter settings but return edge is Bitcoin only. Paper trading on Autopilot: Joshua's account at 10% of virtual $10k; real live stays capped at $50 per trade. IB Gateway on-demand weekdays 3:30-4:15pm ET.

### Where things stood

- Edge search 400+ trials on stocks: no leads beat S&P yet. --crypto flag added; nothing beats both yet.
- Menu bar has three paper sleeves (BTC trend, funding-carry, inverse-vol blend).
- Blend stress test: beats SPY on Sharpe all 3 eras and 9 parameter settings (1.17-1.39 vs 0.68); worst drop 23% vs SPY's 34%; without BTC made 8%/yr, capped 15% made 10.5%, both under SPY 13.8%.
- Haiku research reviewed 7 crypto methods: funding carry and BTC trend credible but modest, others flagged decaying/backtest-only.
- Joshua's autopilot on paper; Trend 2x at 10% of virtual $10k (was buying zero at $1 cap).
- iOS 2.5.15 waiting for review; Mac 2.5.15 in review.
- Docs updated (README, WHITEPAPER, API, ARCHITECTURE); carry and blend not yet in WHITEPAPER.

### Next (when resumed)

1. Forward-test paper results; better risk without return edge.
2. Run edge search on crypto months/years on paper, watch for a lead beating both.
3. If no lead: keep blend as risk management or pivot to stocks.
4. Once strategy beats both S&P and BTC on 12+ months paper: unlock live trading.
5. iOS/Mac release: unhide Autopilot screen, native sync, live status.
