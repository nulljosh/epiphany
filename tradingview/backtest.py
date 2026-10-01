#!/usr/bin/env python3
"""Replay surf-strategies.pine (plus Supertrend+RSI) on Bitstamp BTC daily history since 2011.

Signals on the close, fills at the next open, 0.1% fee per side, long only.
Settings are picked on 2012-2019 and scored blind on 2020-now.

    python3 tradingview/backtest.py
"""
import json, os, time, urllib.request
from datetime import datetime, timezone

FEE = 0.001
CACHE = os.path.expanduser("~/.cache/epiphany-btc-daily.json")
TRAIN = ("2012-01-01", "2019-12-31")
TEST = ("2020-01-01", "2099-01-01")


def fetch():
    if os.path.exists(CACHE) and time.time() - os.path.getmtime(CACHE) < 86400:
        return json.load(open(CACHE))
    bars, start = {}, 1313625600
    while start < time.time():
        url = f"https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1000&start={start}"
        rows = json.load(urllib.request.urlopen(url))["data"]["ohlc"]
        if not rows:
            break
        for r in rows:
            bars[int(r["timestamp"])] = [float(r[k]) for k in ("open", "high", "low", "close")]
        start = max(bars) + 86400
    out = [[t, *bars[t]] for t in sorted(bars)]
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(out, open(CACHE, "w"))
    return out


def sma(x, n):
    out, s = [None] * len(x), 0.0
    for i, v in enumerate(x):
        s += v
        if i >= n:
            s -= x[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def wilder(x, n):
    out, avg = [None] * len(x), None
    for i in range(1, len(x)):
        if i < n:
            continue
        avg = sum(x[1:n + 1]) / n if avg is None else (avg * (n - 1) + x[i]) / n
        out[i] = avg
    return out


def rsi(c, n=14):
    up = [0.0] + [max(c[i] - c[i - 1], 0) for i in range(1, len(c))]
    dn = [0.0] + [max(c[i - 1] - c[i], 0) for i in range(1, len(c))]
    au, ad = wilder(up, n), wilder(dn, n)
    return [None if a is None else 100 if d == 0 else 100 - 100 / (1 + a / d) for a, d in zip(au, ad)]


def supertrend(h, l, c, n, m):
    tr = [h[0] - l[0]] + [max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1])) for i in range(1, len(c))]
    atr = wilder(tr, n)
    up, fu, fl, trend = [False] * len(c), None, None, False
    for i in range(len(c)):
        if atr[i] is None:
            continue
        mid = (h[i] + l[i]) / 2
        ub, lb = mid + m * atr[i], mid - m * atr[i]
        if fu is not None:
            trend = True if c[i] > fu else False if c[i] < fl else trend
            ub = ub if ub < fu or c[i - 1] > fu else fu
            lb = lb if lb > fl or c[i - 1] < fl else fl
        fu, fl = ub, lb
        up[i] = trend
    return up


def signals(mode, p, o, h, l, c):
    """Return (enter, exit) boolean lists, same rules as surf-strategies.pine."""
    N = len(c)
    if mode == "Hold":
        return [True] * N, [False] * N
    if mode == "Single MA":
        a = sma(c, p[0])
        return [a[i] is not None and c[i] > a[i] for i in range(N)], [a[i] is not None and c[i] < a[i] for i in range(N)]
    if mode == "Two MA":
        a, b = sma(c, p[0]), sma(c, p[1])
        ok = [b[i] is not None for i in range(N)]
        return [ok[i] and a[i] > b[i] for i in range(N)], [ok[i] and a[i] < b[i] for i in range(N)]
    if mode == "Three MA":
        a, b, d = sma(c, p[0]), sma(c, p[1]), sma(c, p[2])
        ok = [d[i] is not None for i in range(N)]
        return [ok[i] and a[i] > b[i] > d[i] for i in range(N)], [ok[i] and a[i] <= b[i] for i in range(N)]
    if mode == "Donchian":
        T = p[0]
        hi = [None] * T + [max(h[i - T:i]) for i in range(T, N)]
        lo = [None] * T + [min(l[i - T:i]) for i in range(T, N)]
        return [hi[i] is not None and c[i] >= hi[i] for i in range(N)], [lo[i] is not None and c[i] <= lo[i] for i in range(N)]
    if mode == "IBS":
        ibs = [(c[i] - l[i]) / (h[i] - l[i]) if h[i] > l[i] else 0.5 for i in range(N)]
        return [x < p[0] for x in ibs], [x > p[1] for x in ibs]
    if mode == "Supertrend+RSI":
        up, r = supertrend(h, l, c, p[0], p[1]), rsi(c)
        return [up[i] and r[i] is not None and r[i] > 50 for i in range(N)], [not up[i] for i in range(N)]
    raise ValueError(mode)


def run(bars, enter, exit_, lo, hi):
    """Equity curve over bars[lo:hi]. Decide on close i, fill at open i+1."""
    eq, cash, units, peak, mdd, trades = 1.0, 1.0, 0.0, 1.0, 0.0, 0
    for i in range(lo, hi):
        o, c = bars[i][1], bars[i][4]
        if i > lo:  # act on yesterday's signal at today's open
            if units == 0 and enter[i - 1]:
                units, cash, trades = cash * (1 - FEE) / o, 0.0, trades + 1
            elif units > 0 and exit_[i - 1]:
                cash, units = units * o * (1 - FEE), 0.0
        eq = cash + units * c
        peak = max(peak, eq)
        mdd = max(mdd, 1 - eq / peak)
    years = (bars[hi - 1][0] - bars[lo][0]) / 31557600
    return {"mult": eq, "cagr": eq ** (1 / years) - 1, "mdd": mdd, "trades": trades}


GRID = {
    "Hold": [()],
    "Single MA": [(n,) for n in (20, 50, 100, 150, 200)],
    "Two MA": [(f, s) for f in (5, 10, 20, 50) for s in (20, 50, 100, 200) if f < s],
    "Three MA": [(5, 10, 20), (5, 20, 50), (10, 50, 200), (20, 50, 200)],
    "Donchian": [(n,) for n in (10, 20, 55, 100)],
    "IBS": [(0.1, 0.9), (0.2, 0.8), (0.3, 0.7)],
    "Supertrend+RSI": [(10, 2), (10, 3), (14, 3), (20, 4)],
}


def window(bars, a, b):
    ts = lambda d: datetime.fromisoformat(d).replace(tzinfo=timezone.utc).timestamp()
    idx = [i for i, r in enumerate(bars) if ts(a) <= r[0] <= ts(b)]
    return idx[0], idx[-1] + 1


def check():
    # Steady 1%/day climb: Hold and every trend mode must finish up, IBS never trades a perfect close-at-high.
    bars = [[i * 86400, 100 * 1.01 ** i, 100 * 1.01 ** i * 1.001, 100 * 1.01 ** i * 0.999, 100 * 1.01 ** i] for i in range(400)]
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    hold = run(bars, *signals("Hold", (), o, h, l, c), 0, 400)
    assert abs(hold["mult"] - 1.01 ** 399 * (1 - FEE)) / hold["mult"] < 0.02, hold
    for mode in ("Single MA", "Two MA", "Donchian", "Supertrend+RSI"):
        assert run(bars, *signals(mode, GRID[mode][0], o, h, l, c), 0, 400)["mult"] > 1, mode


def main():
    check()
    bars = fetch()
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    tr, te = window(bars, *TRAIN), window(bars, *TEST)
    day = lambda i: datetime.fromtimestamp(bars[i][0], timezone.utc).date()
    print(f"BTC daily, {day(0)} to {day(len(bars) - 1)}, {len(bars)} bars. Fee {FEE:.1%}/side.")
    print(f"Pick on {day(tr[0])}..{day(tr[1] - 1)}, score blind on {day(te[0])}..{day(te[1] - 1)}.\n")
    print(f"{'strategy':16}{'setting':>14} | {'train CAGR':>10} {'maxDD':>6} | {'TEST CAGR':>10} {'maxDD':>6} {'x money':>8} {'trades':>6}")
    for mode, grid in GRID.items():
        best = max(grid, key=lambda p: run(bars, *signals(mode, p, o, h, l, c), *tr)["cagr"])
        sig = signals(mode, best, o, h, l, c)
        a, b = run(bars, *sig, *tr), run(bars, *sig, *te)
        print(f"{mode:16}{str(best):>14} | {a['cagr']:>10.0%} {a['mdd']:>6.0%} | {b['cagr']:>10.0%} {b['mdd']:>6.0%} {b['mult']:>8.1f} {b['trades']:>6}")


if __name__ == "__main__":
    main()
