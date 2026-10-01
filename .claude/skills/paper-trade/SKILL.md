---
name: paper-trade
description: Run the daily Double 7s paper-trading check on Joshua's IBKR demo account and report how it is doing against SPY. Use when he says /paper-trade, "run the daily trade", "practice account", "how's the account", or "weekly review".
---

# Paper trade

Daily check for the IBKR practice account (demo, play money). The rule is Double 7s on 16 index and sector ETFs, run by `scripts/ibkr-run.py`. Everything here is paper. Never pass `--live`, never touch a real account.

## Daily run

1. **Gateway up?** `nc -z 127.0.0.1 4002`. If it is closed, tell Joshua to log in to IB Gateway (IB API, Live Trading, his trial login) and stop. Never restart the Gateway (it does not save the password) and never type credentials.
2. **Show the plan, send nothing:**
   `cd ~/Documents/Code/epiphany && uv run --quiet --with ib_async python3 scripts/ibkr-run.py`
3. **Send orders only after the US close** (1:05pm Pacific on weekdays) and only if `tradingview/ibkr-state.json` has no `lastGo` for today (New York date) and the plan is not empty:
   `uv run --quiet --with ib_async python3 scripts/ibkr-run.py --go`
   Before the close, or if it already ran today, just report.
4. **Report in three short lines:** account value and change since the start, our positions % vs SPY %, orders sent today. Be honest if it is flat or down.

## Weekly review (when asked, or on Fridays)

Read `tradingview/ibkr-state.json`: `snapshots` (per-position profit and loss over time) and `orders`. Say which positions made or lost money, how many trades won, and compare with the backtest: about 70% of trades win, about 3% a year as one account, and it does not beat SPY. After 20 trading days, give an honest verdict on whether live results match the backtest. Do not tune the rule to chase a few days of noise.

## Guardrails

- The runner refuses real accounts (IDs not starting with D) unless `--live`. Leave it that way.
- Whole shares only, 10% of the sleeve per position, at most 10 positions.
- One run per day. Weekends and US holidays: nothing to do.
- App Store price changes and standing background jobs are blocked for automation. Hand Joshua the command with the `!` prefix instead.
- `scripts/ibkr-live.py` runs all day with no Claude usage: Joshua starts it once in a terminal tab (`caffeinate -i uv run --with ib_async python3 scripts/ibkr-live.py`), it sends Mac notifications on 1% or 20 CAD moves, tells him if the Gateway logs out, and runs the daily trade after the close. Prefer pointing him at it over polling from a session.
- `scripts/ibkr-watch.py` is a quiet read-only watcher (pings on 1% moves, each 20 CAD from the start, and at the close). Start it as a Monitor if he wants pings.
