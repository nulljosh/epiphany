#!/usr/bin/env python3
"""Replay epiphany.pine (plus Supertrend+RSI and Monica Kelly) on Bitstamp BTC daily history since 2011.

Signals on the close, fills at the next open, 0.1% fee per side, long only.
Settings are picked on 2012-2019 and scored blind on 2020-now.

    python3 tradingview/backtest.py          # BTC
    python3 tradingview/backtest.py sp500    # every current S&P 500 stock with history back to 2011
"""
import json, os, re, statistics, sys, time, urllib.request
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
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


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()


def fetch_yahoo(sym):
    """Split- and dividend-adjusted daily bars, cached a day."""
    path = os.path.expanduser(f"~/.cache/epiphany-bars/{sym}.json")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 86400:
        return json.load(open(path))
    try:
        r = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1=0&period2=9999999999&interval=1d"))["chart"]["result"][0]
        q, adj = r["indicators"]["quote"][0], r["indicators"]["adjclose"][0]["adjclose"]
        out = []
        for i, t in enumerate(r["timestamp"]):
            o, h, l, c, a = q["open"][i], q["high"][i], q["low"][i], q["close"][i], adj[i]
            if None not in (o, h, l, c, a) and c > 0:
                f = a / c
                out.append([t, o * f, h * f, l * f, a])
    except Exception:
        out = []
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(out, open(path, "w"))
    return out


def sp500():
    html = get("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies").decode()
    table = html.split('id="constituents"')[1].split("</table>")[0]
    rows = (re.search(r"<td[^>]*><a[^>]*>([A-Z.\-]+)</a>", row) for row in table.split("<tr")[2:])
    return [m.group(1).replace(".", "-") for m in rows if m]


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
    """Return (enter, exit) boolean lists, same rules as epiphany.pine."""
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
    if mode == "RSI2 pullback":  # Connors: dip inside an uptrend, out on the bounce
        r, t, x = rsi(c, 2), sma(c, 200), sma(c, p[1])
        return ([t[i] is not None and r[i] is not None and c[i] > t[i] and r[i] < p[0] for i in range(N)],
                [x[i] is not None and c[i] > x[i] for i in range(N)])
    if mode == "RSI2 exit high":  # same dip entry, out the first close above yesterday's high
        r, t = rsi(c, 2), sma(c, 200)
        return ([t[i] is not None and r[i] is not None and c[i] > t[i] and r[i] < p[0] for i in range(N)],
                [i > 0 and c[i] > h[i - 1] for i in range(N)])
    if mode == "Cumulative RSI":  # two-day RSI(2) sum
        r, t = rsi(c, 2), sma(c, 200)
        return ([i > 0 and t[i] is not None and r[i - 1] is not None and c[i] > t[i] and r[i] + r[i - 1] < p[0] for i in range(N)],
                [r[i] is not None and r[i] > p[1] for i in range(N)])
    if mode == "Double 7s":  # close at an n-day low in an uptrend, out at an n-day high
        t, n = sma(c, 200), p[0]
        return ([i >= n and t[i] is not None and c[i] > t[i] and c[i] <= min(c[i - n + 1:i + 1]) for i in range(N)],
                [i >= n and c[i] >= max(c[i - n + 1:i + 1]) for i in range(N)])
    if mode == "IBS + RSI2":
        r, t = rsi(c, 2), sma(c, 200)
        ibs = [(c[i] - l[i]) / (h[i] - l[i]) if h[i] > l[i] else 0.5 for i in range(N)]
        return ([t[i] is not None and r[i] is not None and c[i] > t[i] and ibs[i] < p[0] and r[i] < p[1] for i in range(N)],
                [i > 0 and c[i] > h[i - 1] for i in range(N)])
    if mode == "IBS + trend":
        t = sma(c, 200)
        ibs = [(c[i] - l[i]) / (h[i] - l[i]) if h[i] > l[i] else 0.5 for i in range(N)]
        return [t[i] is not None and c[i] > t[i] and ibs[i] < p[0] for i in range(N)], [x > p[1] for x in ibs]
    if mode == "Supertrend+RSI":
        up, r = supertrend(h, l, c, p[0], p[1]), rsi(c)
        return [up[i] and r[i] is not None and r[i] > 50 for i in range(N)], [not up[i] for i in range(N)]
    raise ValueError(mode)


def run(bars, enter, exit_, lo, hi):
    """Equity curve over bars[lo:hi]. Decide on close i, fill at open i+1."""
    eq, cash, units, peak, mdd, trades, cost, rets = 1.0, 1.0, 0.0, 1.0, 0.0, 0, 0.0, []
    for i in range(lo, hi):
        o, c = bars[i][1], bars[i][4]
        if i > lo:  # act on yesterday's signal at today's open
            if units == 0 and enter[i - 1]:
                units, cost, cash, trades = cash * (1 - FEE) / o, cash, 0.0, trades + 1
            elif units > 0 and exit_[i - 1]:
                cash, units = units * o * (1 - FEE), 0.0
                rets.append(cash / cost - 1)
        eq = cash + units * c
        peak = max(peak, eq)
        mdd = max(mdd, 1 - eq / peak)
    years = (bars[hi - 1][0] - bars[lo][0]) / 31557600
    return {"mult": eq, "cagr": eq ** (1 / years) - 1, "mdd": mdd, "trades": trades, "rets": rets}


def stdev(x, n):
    m = sma(x, n)
    return [None if m[i] is None else (sum((v - m[i]) ** 2 for v in x[i - n + 1:i + 1]) / n) ** 0.5 for i in range(len(x))]


def monica(bars, lo, hi, sized=True, fast=10, slow=20, strength=0.01, volcap=0.025, rising=5,
           stop=0.017, tgt=0.05, trig=0.02, trail=0.03, frac=0.25, cap=0.10):
    """monica-kelly-strategy.pine, rule for rule. Stop/target are resting orders from the prior close,
    filled TradingView style: gap fills at the open, otherwise the extreme nearer the open is hit first."""
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    sf, ss, sd = sma(c, fast), sma(c, slow), stdev(c, fast)
    def entry(i):
        if i < max(slow, 11) or ss[i] is None:
            return False
        up = sum(c[i - j + 1] > c[i - j] for j in range(1, 11))
        return ((c[i] - sf[i]) / sf[i] >= strength and (c[i - 1] - sf[i - 1]) / sf[i - 1] > 0
                and sd[i] / sf[i] < volcap and up >= rising and c[i] > ss[i])
    def kelly(pnls):
        wins = [x for x in pnls if x > 0]
        n = len(pnls)
        wr = len(wins) / n if n > 10 else 0.55
        aw = sum(wins) / max(len(wins), 1)
        al = abs(sum(x for x in pnls if x <= 0)) / max(n - len(wins), 1)
        rr = aw / al if al > 0 else 2.94
        return 0.0 if rr == 0 else max(0.0, min((rr * wr - (1 - wr)) / rr * frac, cap))
    cash, units, entry_px, cost, pending, orders = 1.0, 0.0, 0.0, 0.0, False, None
    pnls, rets, peak, mdd, trades, eq = [], [], 1.0, 0.0, 0, 1.0
    for i in range(lo, hi):
        if units and orders:
            sp, tp = orders
            if o[i] <= sp or o[i] >= tp:
                fill = o[i]
            else:
                high_first = h[i] - o[i] <= o[i] - l[i]
                hits = [(tp, h[i] >= tp), (sp, l[i] <= sp)] if high_first else [(sp, l[i] <= sp), (tp, h[i] >= tp)]
                fill = next((px for px, hit in hits if hit), None)
            if fill is not None:
                proceeds = units * fill * (1 - FEE)
                cash, units, orders = cash + proceeds, 0.0, None
                pnls.append(proceeds - cost)
                rets.append(proceeds / cost - 1)
        if pending and not units:
            size = cash * (kelly(pnls) if sized else 1.0)
            units, entry_px, cost, cash, trades = size * (1 - FEE) / o[i], o[i], size, cash - size, trades + 1
        pending = False
        if units:
            sp, tp = entry_px * (1 - stop), entry_px * (1 + tgt)
            if (c[i] - entry_px) / entry_px > trig:
                sp = max(sp, c[i] * (1 - trail))
            orders = (sp, tp)
        elif entry(i) and (not sized or kelly(pnls) > 0):
            pending = True
        eq = cash + units * c[i]
        peak = max(peak, eq)
        mdd = max(mdd, 1 - eq / peak)
    years = (bars[hi - 1][0] - bars[lo][0]) / 31557600
    return {"mult": eq, "cagr": eq ** (1 / years) - 1, "mdd": mdd, "trades": trades, "rets": rets}


def score(mode, p, bars, ohlc, lo, hi):
    if mode == "Monica Kelly":
        return monica(bars, lo, hi)
    if mode == "Monica all-in":
        return monica(bars, lo, hi, sized=False)
    return run(bars, *signals(mode, p, *ohlc), lo, hi)


GRID = {
    "Hold": [()],
    "Single MA": [(n,) for n in (20, 50, 100, 150, 200)],
    "Two MA": [(f, s) for f in (5, 10, 20, 50) for s in (20, 50, 100, 200) if f < s],
    "Three MA": [(5, 10, 20), (5, 20, 50), (10, 50, 200), (20, 50, 200)],
    "Donchian": [(n,) for n in (10, 20, 55, 100)],
    "IBS": [(0.1, 0.9), (0.2, 0.8), (0.3, 0.7)],
    "Supertrend+RSI": [(10, 2), (10, 3), (14, 3), (20, 4)],
    "RSI2 pullback": [(5, 5), (10, 5), (10, 10), (15, 5)],
    "IBS + trend": [(0.1, 0.7), (0.2, 0.8), (0.2, 0.5)],
    "RSI2 exit high": [(5,), (10,), (15,)],
    "Cumulative RSI": [(20, 70), (35, 65), (35, 70)],
    "Double 7s": [(5,), (7,), (10,)],
    "IBS + RSI2": [(0.25, 10), (0.25, 20), (0.5, 10)],
    "Monica Kelly": [()],   # as shipped, no tuning
    "Monica all-in": [()],  # same signal, whole account per trade
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
    # Gentle 0.5%/day climb: Monica enters, rides to the 5% target, repeats, never loses.
    slow = [[i * 86400, 100 * 1.005 ** i, 100 * 1.005 ** i * 1.001, 100 * 1.005 ** i * 0.999, 100 * 1.005 ** i] for i in range(400)]
    m = monica(slow, 0, 400, sized=False)
    assert m["mult"] > 1.5 and m["trades"] > 5 and m["mdd"] < 0.02, m


def evaluate(bars):
    """Pick each mode's setting on TRAIN, score it on TEST. Returns {mode: test metrics}."""
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    tr, te = window(bars, *TRAIN), window(bars, *TEST)
    out = {}
    for mode, grid in GRID.items():
        best = max(grid, key=lambda p: score(mode, p, bars, (o, h, l, c), *tr)["cagr"])
        out[mode] = score(mode, best, bars, (o, h, l, c), *te)
    return out


def universe():
    # ponytail: today's S&P 500 members only, so dead and dropped companies are missing (survivorship bias flatters Hold).
    syms = sp500()
    with ThreadPoolExecutor(8) as ex:
        data = dict(zip(syms, ex.map(fetch_yahoo, syms)))
    cutoff = datetime(2011, 1, 1, tzinfo=timezone.utc).timestamp()
    ok = {s: b for s, b in data.items() if b and b[0][0] <= cutoff}
    print(f"S&P 500: {len(syms)} listed, {len(ok)} with daily history back to 2011. Fee {FEE:.1%}/side.")
    print(f"Settings picked per stock on {TRAIN[0]}..{TRAIN[1]}, scored blind {TEST[0]}..now.\n")
    with ProcessPoolExecutor() as ex:
        res = dict(zip(ok, ex.map(evaluate, ok.values(), chunksize=4)))
    hold = {s: r["Hold"] for s, r in res.items()}
    print(f"{'strategy':16}{'median CAGR':>12}{'median maxDD':>13}{'beat Hold':>10}{'win rate':>9}{'avg trade':>10}{'trades':>8}")
    for mode in GRID:
        rows = [(r[mode], hold[s]) for s, r in res.items()]
        med = lambda k: statistics.median(m[k] for m, _ in rows)
        beat = sum(m["cagr"] > hd["cagr"] for m, hd in rows) / len(rows)
        pooled = [x for m, _ in rows for x in m["rets"]]
        win = sum(x > 0 for x in pooled) / max(len(pooled), 1)
        avg = statistics.mean(pooled) if pooled else 0
        print(f"{mode:16}{med('cagr'):>12.1%}{med('mdd'):>13.0%}{beat:>10.0%}{win:>9.0%}{avg:>10.2%}{len(pooled):>8}")


def main():
    check()
    if sys.argv[1:] == ["sp500"]:
        return universe()
    bars = fetch()
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    tr, te = window(bars, *TRAIN), window(bars, *TEST)
    day = lambda i: datetime.fromtimestamp(bars[i][0], timezone.utc).date()
    print(f"BTC daily, {day(0)} to {day(len(bars) - 1)}, {len(bars)} bars. Fee {FEE:.1%}/side.")
    print(f"Pick on {day(tr[0])}..{day(tr[1] - 1)}, score blind on {day(te[0])}..{day(te[1] - 1)}.\n")
    print(f"{'strategy':16}{'setting':>14} | {'train CAGR':>10} {'maxDD':>6} | {'TEST CAGR':>10} {'maxDD':>6} {'x money':>8} {'trades':>6}")
    for mode, grid in GRID.items():
        ohlc = (o, h, l, c)
        best = max(grid, key=lambda p: score(mode, p, bars, ohlc, *tr)["cagr"])
        a, b = score(mode, best, bars, ohlc, *tr), score(mode, best, bars, ohlc, *te)
        print(f"{mode:16}{str(best):>14} | {a['cagr']:>10.0%} {a['mdd']:>6.0%} | {b['cagr']:>10.0%} {b['mdd']:>6.0%} {b['mult']:>8.1f} {b['trades']:>6}")


if __name__ == "__main__":
    main()
