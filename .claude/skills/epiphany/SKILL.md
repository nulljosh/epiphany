---
name: epiphany
description: Admin access to a user's Epiphany portfolio data in Upstash KV without logging into the app. Use when asked to view or edit Epiphany account/portfolio data directly (bump database info, fix a user's data) without browser login.
---

# Epiphany KV admin

Wraps `~/Documents/Code/epiphany/scripts/kv-portfolio-edit.sh`, which talks to Upstash KV directly — no app login, no browser.

## Usage

```bash
~/Documents/Code/epiphany/scripts/kv-portfolio-edit.sh get <email>            # dump current portfolio JSON
~/Documents/Code/epiphany/scripts/kv-portfolio-edit.sh set <email> <file.json> # overwrite with file contents
```

The script pulls `KV_REST_API_URL`/`KV_REST_API_TOKEN` fresh from Vercel prod env on every run, so no local secrets are needed.

## Critical rule: never blind-overwrite

`set` replaces the entire `portfolio:<userId>` value. Before calling `set`:
1. Run `get <email>` and save the output to a temp file.
2. Merge your changes into that JSON (e.g. in Python) — keep holdings, accounts, broker-synced balances, budget targets, debt entries that aren't part of this edit.
3. Write the merged JSON to a file and pass that to `set`.

Skipping the merge step wipes unrelated fields (this happened before — see project memory `reference_epiphany_kv_admin.md`).

## Scope

This only edits `portfolio:<userId>` (holdings, debt, budget, spending, accounts). It does not touch `user:<email>` (auth/profile) or sessions — don't extend it to those without checking how session/auth state is structured first.

## Trading benchmark and paper trading

The autopilot trades Double 7s (`double7s()` in `src/utils/indicators.js`, mirrored in `Shared/Indicators.swift`), on paper only. Results live in `WHITEPAPER.md` section 5. Do not claim it beats the S&P 500: it does not.

```bash
python3 tradingview/backtest.py sp500        # 429 S&P 500 stocks, tuned on 2012-2019, graded blind 2020-now
python3 tradingview/backtest.py portfolio    # one account over 16 ETFs vs SPY
uv run --with ib_async python3 scripts/ibkr-run.py        # plan and scoreboard against IB Gateway (demo account), sends nothing
uv run --with ib_async python3 scripts/ibkr-run.py --go   # send today's paper orders
```

IB Gateway must be logged in on port 4002 (it does not save the password, so never restart it without telling Joshua). The runner refuses real accounts without `--live`. App Store price changes are blocked for automation: Joshua runs `asc pricing schedule create` himself.
