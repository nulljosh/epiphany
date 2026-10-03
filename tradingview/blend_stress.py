#!/usr/bin/env python3
"""Stress test for tradingview/blend.py: sub-periods, parameter grid, and "is it just Bitcoin?".

    uv run --with numpy python3 tradingview/blend_stress.py

Read-out on 2026-10-03: the blend beat the S&P on risk-adjusted return in all three eras and in all 9 parameter
settings (Sharpe 1.17 to 1.39 vs 0.83). But the return edge is Bitcoin: without it the mix made 8% a year, and with
Bitcoin capped at 15% of the mix it made 10.5%, both under the S&P's 13.8%. So: better risk, return only if Bitcoin
keeps doing what it did. Forward paper trading is the real test.
"""
import os, sys
import numpy as np
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backtest import fetch_yahoo  # noqa: E402

S = ["BTC-USD", "SPY", "GLD", "TLT"]


def m(r):
    r = np.asarray(r)
    eq = np.cumprod(1 + r)
    return eq[-1] ** (252 / len(r)) - 1, r.mean() / r.std() * 252 ** .5, (eq / np.maximum.accumulate(eq) - 1).min()


def blend(R, cols, target=.15, lb=60, reb=21, cap=None, cost=.001):
    out, w, X = [], np.zeros(len(cols)), R[:, cols]
    for t in range(lb, len(X)):
        c = 0.0
        if (t - lb) % reb == 0:
            nw = 1 / (X[t - lb:t].std(0) * 252 ** .5)
            nw = nw / nw.sum()
            if cap is not None:
                nw = np.minimum(nw, cap)
            nw = nw * min(1, target / np.sqrt(nw @ np.cov(X[t - lb:t].T) @ nw * 252))
            c, w = cost * abs(nw - w).sum(), nw
        out.append((w * X[t]).sum() - c)
    return np.array(out)


def fmt(x):
    return f"CAGR {x[0]:6.1%}  Sharpe {x[1]:4.2f}  worst {x[2]:6.1%}"


def main():
    ser = {s: {datetime.fromtimestamp(b[0], timezone.utc).date().isoformat(): b[4] for b in fetch_yahoo(s)} for s in S}
    dates = sorted(set.intersection(*(set(v) for v in ser.values())))
    P = np.array([[ser[s][d] for s in S] for d in dates])
    R, D = P[1:] / P[:-1] - 1, dates[1:]
    base, Db = blend(R, [0, 1, 2]), D[60:]
    print("sub-periods: blend | SPY | BTC")
    for a, b in (("2014", "2018"), ("2019", "2022"), ("2023", "2026")):
        i = [k for k, d in enumerate(Db) if a <= d[:4] <= b]
        print(a, b, "|", fmt(m(base[i])), "|", fmt(m(R[60:][i, 1])), "|", fmt(m(R[60:][i, 0])))
    print("parameter grid (15% target)")
    for lb in (30, 60, 120):
        for reb in (10, 21, 63):
            print(f"  lookback {lb:3} rebalance {reb:2}:", fmt(m(blend(R, [0, 1, 2], lb=lb, reb=reb))))
    print("is it just Bitcoin?")
    print("  no Bitcoin (SPY, GLD, TLT)   ", fmt(m(blend(R, [1, 2, 3]))), "| SPY same window", fmt(m(R[60:, 1])))
    print("  Bitcoin capped at 15%        ", fmt(m(blend(R, [0, 1, 2], cap=.15))))
    print("  equal thirds, daily rebalance", fmt(m(R[60:, [0, 1, 2]].mean(1))))


if __name__ == "__main__":
    main()
