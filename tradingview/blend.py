#!/usr/bin/env python3
"""Inverse-vol blend of Bitcoin, the S&P 500 (SPY) and gold (GLD), risk capped at a target, rest in cash.

    uv run --with numpy python3 tradingview/blend.py

Monthly: weight each asset by 1 / its 60 day volatility, scale the whole mix down if its risk is above the
target, hold cash for the rest (cash earns 0 here, so it is conservative). 10 bps per unit traded.
Weights use returns up to yesterday only. Diversification, not a prediction: the three barely move together.
Caveat: Bitcoin's 2014 to 2026 run is the best any asset has had, so read the blend as promising, not proven.
"""
import os, sys
import numpy as np
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backtest import fetch_yahoo  # noqa: E402

S = ["BTC-USD", "SPY", "GLD"]


def stat(r, label):
    r = np.asarray(r)
    eq = np.cumprod(1 + r)
    print(f"{label:34} CAGR {eq[-1] ** (252 / len(r)) - 1:6.1%}  Sharpe {r.mean() / r.std() * 252 ** .5:5.2f}  worst {(eq / np.maximum.accumulate(eq) - 1).min():6.1%}")


def blend(R, target, cost=0.001):
    out, w = [], np.zeros(R.shape[1])
    for t in range(60, len(R)):
        c = 0.0
        if (t - 60) % 21 == 0:
            raw = 1 / (R[t - 60:t].std(0) * 252 ** .5)
            nw = raw / raw.sum()
            nw = nw * min(1, target / np.sqrt(nw @ np.cov(R[t - 60:t].T) @ nw * 252))
            c, w = cost * abs(nw - w).sum(), nw
        out.append((w * R[t]).sum() - c)
    return out


def main():
    ser = {s: {datetime.fromtimestamp(b[0], timezone.utc).date().isoformat(): b[4] for b in fetch_yahoo(s)} for s in S}
    dates = sorted(set.intersection(*(set(v) for v in ser.values())))
    P = np.array([[ser[s][d] for s in S] for d in dates])
    R = P[1:] / P[:-1] - 1
    print(dates[0], "to", dates[-1])
    h = len(R[60:]) // 2
    for tgt in (0.10, 0.15, 0.20):
        r = blend(R, tgt)
        stat(r, f"blend, {tgt:.0%} risk target")
        stat(r[:h], "  first half")
        stat(r[h:], "  second half")
    for i, s in enumerate(S):
        stat(R[60:, i], f"{s} hold")


if __name__ == "__main__":
    main()
