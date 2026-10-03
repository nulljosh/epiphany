# Epiphany loop handoff (2026-10-03, afternoon)

## What the loop is

Edge hunt: find a trading strategy that beats both the S&P 500 and BTC on walk-forward backtests. Menu bar edge search engine backtests multi-timeframe ensemble strategies on 20-200 day crossovers, now with a --crypto flag for crypto pairs. Paper trading on Autopilot: Joshua's account at 10% of virtual $10k (Trend 2x); real live trading stays capped at $50 per trade until backtests show a durable edge. IB Gateway starts on-demand weekdays 3:30-4:15pm ET (improved power management). ibkr-live.py reports fills to the app and treats Autopilot toggle as kill switch.

## Where things stand

- Edge search 400+ trials on stocks: no leads beat S&P yet. New --crypto flag searching crypto pairs with multi-timeframe ensemble.
- IB Gateway no longer auto-launches; menu bar starts it only on weekdays 3:30-4:15pm ET or on request.
- ibkr-live.py reports fills to /api/broker/ibkr-report (8 backfilled), treats Autopilot toggle as kill switch.
- Joshua's autopilot moved to paper trading; Trend 2x was buying zero at $1 cap, now sizes at 10% of $10k virtual account (real money untouched).
- Crypto paper trader runs daily including weekends, tracking BTC above 100-day average, opt in via allowCrypto toggle.
- Menu bar status line never idle: shows combined score vs S&P and BTC, BTC funding-carry paper sleeve (~11%/yr backtest), crypto daily results.
- iOS 2.5.15 waiting for review; Mac 2.5.15 in review.
- Docs updated (README, WHITEPAPER, docs/API.md, docs/ARCHITECTURE.md, architecture.svg).
- Haiku research agent on crypto quant methods still running; research direction pending.

## Next, in order

1. Await crypto-quant research direction from pending Haiku agent.
2. If promising: run edge search on crypto for ~year on paper, monitor for a lead.
3. If no lead found after year: pivot back to stock searches.
4. Once a strategy beats both S&P and BTC on 12+ months paper: unlock live trading with full account (stays capped at $50/trade).
5. iOS/Mac release: unhide Autopilot screen, native sync, live trading status.

## Restart prompt

```
/loop until beating both S&P and BTC (Epiphany 2026-10-03). Edge search 400+ trials on stocks/crypto with --crypto flag for multi-timeframe ensemble; nothing beats both yet. Paper trading: Joshua at 10% of $10k virtual (Trend 2x). Live stays capped $50/trade, real money waits. Haiku research agent on crypto quant methods still running (pending output). IB Gateway on-demand weekdays 3:30-4:15pm ET, ibkr-live.py reports fills and treats Autopilot toggle as kill switch. Menu bar status never idle, shows combined score vs S&P/BTC, funding-carry sleeve, crypto daily. iOS 2.5.15 waiting review, Mac in review. Docs updated. Loop ScheduleWakeup hourly. Next: crypto-quant research direction (pending), year of paper if promising or pivot to stocks, then release unlock at roadmap. Single Haiku agent for research, no fan-out, stop above 90 percent usage.
```
