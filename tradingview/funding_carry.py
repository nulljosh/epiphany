#!/usr/bin/env python3
"""Crypto funding carry, backtested on real Binance history. Long spot + short perpetual: price moves cancel,
and you collect (or pay) the funding rate every 8 hours. A real, structural crypto edge, not a chart pattern.

    python3 tradingview/funding_carry.py [SYMBOL]      # default BTCUSDT; caches to tradingview/data/

Numbers are the funding stream only (both legs sized 1x, no leverage). Costs: 0.2% round trip per switch.
It ignores exchange risk, margin calls, and basis moves, so read it as an upper bound, not a promise.
"""
import json, os, sys, time, urllib.request
from statistics import mean, pstdev

SYM = sys.argv[1] if len(sys.argv) > 1 else "BTCUSDT"
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", f"binance-funding-{SYM}.json")
SWITCH_COST = 0.002


def fetch():
    rows, start = [], 1567296000000  # Sep 2019, when BTCUSDT perps began
    while True:
        u = f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={SYM}&limit=1000&startTime={start}"
        page = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
        if not page:
            return rows
        rows += [(p["fundingTime"], float(p["fundingRate"])) for p in page]
        start = page[-1]["fundingTime"] + 1
        if len(page) < 1000:
            return rows
        time.sleep(0.3)


def stats(r, label):
    """r: list of 8 hourly returns. Annualised mean, Sharpe, worst stretch."""
    per_year = 3 * 365
    m, s = mean(r), pstdev(r)
    eq, peak, dd = 1.0, 1.0, 0.0
    for x in r:
        eq *= 1 + x
        peak = max(peak, eq)
        dd = min(dd, eq / peak - 1)
    print(f"{label:34} {m * per_year:7.1%}/yr  Sharpe {m / s * per_year ** 0.5 if s else 0:5.2f}  worst drop {dd:6.2%}  ended x{eq:.2f}")


def main():
    if os.path.exists(CACHE):
        rows = json.load(open(CACHE))
    else:
        rows = fetch()
        json.dump(rows, open(CACHE, "w"))
    f = [x[1] for x in rows]
    days = len(f) / 3
    print(f"{SYM}: {len(f)} funding periods, {days / 365:.1f} years, {sum(x < 0 for x in f) / len(f):.0%} of periods negative")
    stats(f, "always on (collect funding)")
    for n in (3, 9, 21):  # follow the sign of the trailing average, pay the switch cost when it flips
        out, on, last = [], False, None
        for i, x in enumerate(f):
            want = i >= n and mean(f[i - n:i]) > 0
            cost = SWITCH_COST if want != on else 0.0
            on = want
            out.append((x if on else 0.0) - cost)
        stats(out, f"only when trailing {n * 8}h avg > 0")
    half = len(f) // 2
    stats(f[:half], "always on, first half")
    stats(f[half:], "always on, second half")


if __name__ == "__main__":
    main()
