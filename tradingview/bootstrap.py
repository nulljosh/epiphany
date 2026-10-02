#!/usr/bin/env python3
"""Monte Carlo on what you could actually buy: Trend 2x (SSO above the S&P's 200 day average, BIL below)
against holding SPY, from the real fund prices since SSO launched in 2007.

Paired stationary bootstrap (Politis and Romano): resample the strategy and SPY daily returns together in
random blocks (mean 21 trading days) so volatility clusters and their correlation survive. 0.05% fee on
every flip, the signal is decided on the prior close. Cached bars come from ~/.cache/epiphany-bars/.

    python3 tradingview/bootstrap.py            # prints the table, 5000 runs a horizon, seed fixed
"""
import json, os, numpy as np, pandas as pd

def load(s):
    d = json.load(open(os.path.expanduser(f"~/.cache/epiphany-bars/{s}.json")))
    return pd.Series([x[4] for x in d], index=pd.to_datetime([x[0] for x in d], unit="s").normalize())

px = pd.concat({"spy": load("SPY"), "sso": load("SSO"), "bil": load("BIL")}, axis=1).dropna()
r = px.pct_change().fillna(0)
sig = (px.spy.shift(1) > px.spy.rolling(200).mean().shift(1)).astype(float)
ok = px.spy.rolling(200).mean().notna().values
strat = (sig * r.sso + (1 - sig) * r.bil - 0.0005 * sig.diff().abs().fillna(0)).values[ok]
spy = r.spy.values[ok]
n = len(spy)
rng = np.random.default_rng(7)

def paths(days, runs, block=21):
    """Index matrix (runs, days) of stationary-bootstrap draws."""
    idx = np.empty((runs, days), dtype=int)
    idx[:, 0] = rng.integers(0, n, runs)
    new = rng.random((runs, days)) < 1 / block
    jump = rng.integers(0, n, (runs, days))
    for t in range(1, days):
        idx[:, t] = np.where(new[:, t], jump[:, t], (idx[:, t - 1] + 1) % n)
    return idx

print(f"{px.index[ok][0].date()} to {px.index[-1].date()}, {n} days. Real: Trend 2x {(1+strat).prod()**(252/n)-1:.1%} a year, SPY {(1+spy).prod()**(252/n)-1:.1%}")
print("horizon | chance Trend 2x beats SPY | median excess over the horizon | 5th percentile excess | chance it loses money")
for name, days in (("1 day", 1), ("1 month", 21), ("1 year", 252), ("3 years", 756), ("5 years", 1260)):
    i = paths(days, 5000)
    a, b = np.prod(1 + strat[i], 1), np.prod(1 + spy[i], 1)
    ex = a - b  # raw return gap over the whole horizon, not annualized
    print(f"{name} | {np.mean(a > b):.0%} | {np.median(ex):+.1%} | {np.percentile(ex, 5):+.1%} | {np.mean(a < 1):.0%}")
assert abs(np.mean(strat) - strat.mean()) < 1e-12 and n > 3000
