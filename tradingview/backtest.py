#!/usr/bin/env python3
"""Replay epiphany.pine (plus Supertrend+RSI and Epiphany Kelly) on Bitstamp BTC daily history since 2011.

Signals on the close, fills at the next open, 0.1% fee per side, long only.
Settings are picked on 2012-2019 and scored blind on 2020-now.

    python3 tradingview/backtest.py          # BTC
    python3 tradingview/backtest.py sp500    # every current S&P 500 stock with history back to 2011
    python3 tradingview/backtest.py etfs     # index and sector ETFs
    python3 tradingview/backtest.py btc-years  # BTC, one row per calendar year
    python3 tradingview/backtest.py trend-spy  # hold the index only above its 200 day average, with and without leverage
    python3 tradingview/backtest.py portfolio  # Double 7s as one account over the index ETFs
    python3 tradingview/backtest.py sp-century  # S&P 500 index since 1927, per decade
    python3 tradingview/backtest.py watchlist  # live TradingView watchlist via the MCP, each symbol from its first bar
"""
import json, os, re, statistics, subprocess, sys, time, urllib.parse, urllib.request
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
        r = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?period1=-1400000000&period2=9999999999&interval=1d"))["chart"]["result"][0]
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


# ponytail: per-process global, the market (SPY above its 200 day average) aligned to the bars being scored.
MARKET, MK = {}, []
VIX, VX = {}, []  # VIX close over its 10 day average, by day


def set_market(m, v=None):
    global MARKET, VIX
    MARKET, VIX = m, v or {}


def vix_stretch():
    vix = fetch_yahoo("^VIX")
    c = [r[4] for r in vix]
    a = sma(c, 10)
    return {r[0] // 86400: c[i] / a[i] for i, r in enumerate(vix) if a[i]}


def market_up():
    spy = fetch_yahoo("SPY")
    c = [r[4] for r in spy]
    a = sma(c, 200)
    return {r[0] // 86400: a[i] is not None and c[i] > a[i] for i, r in enumerate(spy)}


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
    if mode.startswith("D7"):  # Double 7s entry, tightened; p = (lookback,)
        t, n, r = sma(c, 200), p[0], rsi(c, 2)
        ibs = [(c[i] - l[i]) / (h[i] - l[i]) if h[i] > l[i] else 0.5 for i in range(N)]
        mk = MK or [True] * N
        base = [i >= n and t[i] is not None and c[i] > t[i] and c[i] <= min(c[i - n + 1:i + 1]) for i in range(N)]
        up_day = [i > 0 and c[i] > c[i - 1] for i in range(N)]
        if mode == "D7 first up close":
            return base, up_day
        if mode == "D7 + RSI2":
            return [base[i] and r[i] is not None and r[i] < 10 for i in range(N)], [i > 0 and c[i] > h[i - 1] for i in range(N)]
        if mode == "D7 + market":
            return [base[i] and mk[i] for i in range(N)], [i >= n and c[i] >= max(c[i - n + 1:i + 1]) for i in range(N)]
        if mode == "D7 stacked":
            return [base[i] and mk[i] and r[i] is not None and r[i] < 10 and ibs[i] < 0.3 for i in range(N)], up_day
    if mode == "D7 + VIX fear":  # Double 7s, only when fear is up: VIX 5%+ over its 10 day average
        t, n, vx = sma(c, 200), p[0], VX or [0] * N
        return ([i >= n and t[i] is not None and c[i] > t[i] and c[i] <= min(c[i - n + 1:i + 1]) and vx[i] >= 1.05 for i in range(N)],
                [i >= n and c[i] >= max(c[i - n + 1:i + 1]) for i in range(N)])
    if mode == "VIX stretch":  # Connors: uptrend, VIX stretched 3 days running, out when RSI(2) recovers
        t, r, vx = sma(c, 200), rsi(c, 2), VX or [0] * N
        return ([i >= 2 and t[i] is not None and c[i] > t[i] and min(vx[i - 2:i + 1]) >= 1.05 for i in range(N)],
                [r[i] is not None and r[i] > p[0] for i in range(N)])
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


def epiphany_kelly(bars, lo, hi, sized=True, fast=10, slow=20, strength=0.01, volcap=0.025, rising=5,
           stop=0.017, tgt=0.05, trig=0.02, trail=0.03, frac=0.25, cap=0.10, floor=0.01):
    """epiphany-kelly-strategy.pine, rule for rule. Stop/target are resting orders from the prior close,
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
        # Learn win rate and reward/risk from the strategy's own closed trades, but only once there are 10+ trades
        # with at least one win and one loss. Before that, use the 55% / 2.94 defaults. The old version divided by
        # zero after an early loss with no wins and never traded again. The floor keeps it trading, so it keeps learning.
        wins = [x for x in pnls if x > 0]
        losses = [x for x in pnls if x <= 0]
        if len(pnls) >= 10 and wins and losses:
            wr = len(wins) / len(pnls)
            rr = (sum(wins) / len(wins)) / (abs(sum(losses)) / len(losses))
        else:
            wr, rr = 0.55, 2.94
        return max(floor, min((rr * wr - (1 - wr)) / rr * frac, cap))
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
    if mode == "Epiphany Kelly":
        return epiphany_kelly(bars, lo, hi)
    if mode == "Epiphany all-in":
        return epiphany_kelly(bars, lo, hi, sized=False)
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
    "D7 first up close": [(5,), (7,), (10,)],
    "D7 + RSI2": [(5,), (7,), (10,)],
    "D7 + market": [(5,), (7,), (10,)],
    "D7 stacked": [(5,), (7,), (10,)],
    "D7 + VIX fear": [(5,), (7,), (10,)],
    "VIX stretch": [(65,), (70,), (80,)],
    "Epiphany Kelly": [()],   # as shipped, no tuning
    "Epiphany all-in": [()],  # same signal, whole account per trade
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
    # Gentle 0.5%/day climb: Epiphany Kelly enters, rides to the 5% target, repeats, never loses.
    slow = [[i * 86400, 100 * 1.005 ** i, 100 * 1.005 ** i * 1.001, 100 * 1.005 ** i * 0.999, 100 * 1.005 ** i] for i in range(400)]
    m = epiphany_kelly(slow, 0, 400, sized=False)
    assert m["mult"] > 1.5 and m["trades"] > 5 and m["mdd"] < 0.02, m


def halves(bars):
    """Origin mode: pick on the first half of a symbol's own history (after a 200 bar warmup), score on the second."""
    mid = 200 + (len(bars) - 200) // 2
    return (200, mid), (mid, len(bars))


def evaluate(bars, split=False):
    """Pick each mode's setting on TRAIN, score it on TEST. Returns {mode: test metrics}."""
    global MK
    global VX
    MK = [MARKET.get(r[0] // 86400, False) for r in bars] if MARKET else []
    VX = [VIX.get(r[0] // 86400, 0) for r in bars] if VIX else []
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    tr, te = halves(bars) if split else (window(bars, *TRAIN), window(bars, *TEST))
    out = {}
    for mode, grid in GRID.items():
        best = max(grid, key=lambda p: score(mode, p, bars, (o, h, l, c), *tr)["cagr"])
        out[mode] = score(mode, best, bars, (o, h, l, c), *te)
    return out


ETFS = ["SPY", "QQQ", "DIA", "IWM", "MDY", "EFA", "EEM", "XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]


def universe(syms=None, label="S&P 500", origin=False, data=None):
    # ponytail: today's S&P 500 members only, so dead and dropped companies are missing (survivorship bias flatters Hold).
    syms = syms or sp500()
    if data is None:
        with ThreadPoolExecutor(8) as ex:
            data = dict(zip(syms, ex.map(fetch_yahoo, syms)))
    if origin:
        ok = {s: b for s, b in data.items() if len(b) >= 600}
        print(f"{label}: {len(syms)} symbols, {len(ok)} with 600+ daily bars. Fee {FEE:.1%}/side.")
        print("Each symbol from its first bar: settings picked on the first half of its history, scored blind on the second.\n")
        for s, b in ok.items():
            day = lambda t: datetime.fromtimestamp(t, timezone.utc).date()
            print(f"  {s:10} {day(b[0][0])} to {day(b[-1][0])}, blind from {day(b[halves(b)[1][0]][0])}")
        print()
    else:
        cutoff = datetime(2011, 1, 1, tzinfo=timezone.utc).timestamp()
        ok = {s: b for s, b in data.items() if b and b[0][0] <= cutoff}
        print(f"{label}: {len(syms)} listed, {len(ok)} with daily history back to 2011. Fee {FEE:.1%}/side.")
        print(f"Settings picked per stock on {TRAIN[0]}..{TRAIN[1]}, scored blind {TEST[0]}..now.\n")
    with ProcessPoolExecutor(initializer=set_market, initargs=(market_up(), vix_stretch())) as ex:
        res = dict(zip(ok, ex.map(evaluate, ok.values(), [origin] * len(ok), chunksize=1 if origin else 4)))
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


def btc_years():
    """Each strategy's return per calendar year on BTC, settings picked on TRAIN, each year starts flat."""
    bars = fetch()
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    tr = window(bars, *TRAIN)
    show = ["Hold", "Donchian", "Supertrend+RSI", "Two MA", "RSI2 pullback", "Double 7s", "D7 + market"]
    picks = {m: max(GRID[m], key=lambda p: score(m, p, bars, (o, h, l, c), *tr)["cagr"]) for m in show}
    print("BTC, return per calendar year (settings picked on 2012-2019; 2020+ is blind). Fee 0.1%/side.\n")
    print(f"{'year':6}" + "".join(f"{m[:14]:>15}" for m in show))
    for y in range(2012, datetime.now(timezone.utc).year + 1):
        lo, hi = window(bars, f"{y}-01-01", f"{y}-12-31")
        print(f"{y:<6}" + "".join(f"{score(m, picks[m], bars, (o, h, l, c), lo, hi)['mult'] - 1:>15.0%}" for m in show))
    lo, hi = window(bars, "2012-01-01", "2099-01-01")
    rows = [score(m, picks[m], bars, (o, h, l, c), lo, hi) for m in show]
    print(f"{'wins':6}" + "".join(f"{(sum(x > 0 for x in r['rets']) / max(len(r['rets']), 1)):>15.0%}" for r in rows))
    print(f"{'trades':6}" + "".join(f"{len(r['rets']):>15}" for r in rows))


# TradingView symbol -> Yahoo symbol, for the ones that don't map by just dropping the exchange.
TV_YAHOO = {"CBOE:VIX": "^VIX", "TVC:DXY": "DX-Y.NYB", "TVC:SPX": "^GSPC", "SP:SPX": "^GSPC", "TVC:NDX": "^NDX",
            "OANDA:XAUUSD": "GC=F", "OANDA:XAGUSD": "SI=F", "BLACKBULL:WTI": "CL=F", "TVC:USOIL": "CL=F",
            "CAPITALCOM:SPX500": "^GSPC", "CAPITALCOM:US30": "^DJI", "OANDA:XCUUSD": "HG=F", "XETR:DBK": "DBK.DE"}


def watchlist():
    """Live TradingView watchlist (through the MCP), each symbol tested from its first bar."""
    here = os.path.dirname(os.path.abspath(__file__))
    tv = [x["symbol"] for x in json.loads(subprocess.check_output(["node", os.path.join(here, "watchlist.mjs")]))["symbols"]]
    data = {}
    # The VIX is a fear gauge, not something you can hold; it feeds the "D7 + VIX fear" filter instead.
    tv = [t for t in tv if t not in ("CBOE:VIX", "TVC:VIX")]
    for t in tv:
        if t == "BITSTAMP:BTCUSD":
            data[t] = fetch()
            continue
        y = TV_YAHOO.get(t) or (t.split(":")[1][:-3] + "-USD" if t.endswith("USD") and ":" in t else t.split(":")[-1].replace(".", "-"))
        data[t] = fetch_yahoo(y)
    universe(list(data), f"TradingView watchlist ({len(tv)})", origin=True, data=data)


def sp_century():
    """S&P 500 index since 1927: picked on the first half (to ~1977), graded blind on the rest, one row per decade."""
    bars = fetch_yahoo("^GSPC")
    o, h, l, c = ([r[k] for r in bars] for k in (1, 2, 3, 4))
    tr, te = halves(bars)
    day = lambda i: datetime.fromtimestamp(bars[i][0], timezone.utc).date()
    show = ["Hold", "Two MA", "Donchian", "Supertrend+RSI", "RSI2 pullback", "Cumulative RSI", "Double 7s"]
    picks = {m: max(GRID[m], key=lambda p: score(m, p, bars, (o, h, l, c), *tr)["cagr"]) for m in show}
    print(f"S&P 500 index, {day(0)} to {day(len(bars) - 1)}. Picked on {day(tr[0])}..{day(tr[1] - 1)}, blind from {day(te[0])}.")
    print("Before 1962 the data is closes only, so high/low strategies are blind there. Fee 0.1%/side.\n")
    print(f"{'decade':8}" + "".join(f"{m[:14]:>15}" for m in show))
    for y in range(1930, datetime.now(timezone.utc).year + 1, 10):
        lo, hi = window(bars, f"{y}-01-01", f"{y + 9}-12-31")
        print(f"{str(y) + 's':8}" + "".join(f"{score(m, picks[m], bars, (o, h, l, c), lo, hi)['cagr']:>15.1%}" for m in show))
    for name, (lo, hi) in (("blind", te), ("all", (200, len(bars)))):
        rows = [score(m, picks[m], bars, (o, h, l, c), lo, hi) for m in show]
        print(f"{name + ' win':8}" + "".join(f"{(sum(x > 0 for x in r['rets']) / max(len(r['rets']), 1)):>15.0%}" for r in rows))
        print(f"{name + ' n':8}" + "".join(f"{len(r['rets']):>15}" for r in rows))
        print(f"{name + ' dd':8}" + "".join(f"{r['mdd']:>15.0%}" for r in rows))


def portfolio(lookbacks=(5, 7, 10), cap=0.10, start=500.0, park=False):
    """Double 7s run as one account over the index and sector ETFs: each entry puts `cap` of equity in, fees both ways.
    park=True keeps idle cash in SPY instead of cash (rotating out of SPY on a dip signal costs an extra fee each way)."""
    data = {s: fetch_yahoo(s) for s in ETFS}
    data = {s: b for s, b in data.items() if len(b) > 400}
    days = sorted({r[0] // 86400 for r in data["SPY"]})
    ts = lambda d: datetime.fromisoformat(d).replace(tzinfo=timezone.utc).timestamp() // 86400

    def run_one(lookback, lo, hi):
        rows = {}
        for s, b in data.items():
            o, h, l, c = ([r[k] for r in b] for k in (1, 2, 3, 4))
            en, ex = signals("Double 7s", (lookback,), o, h, l, c)
            rows[s] = {b[i][0] // 86400: (b[i][1], b[i][4], en[i - 1], ex[i - 1]) for i in range(1, len(b))}
        cash, pos, last, curve, wins, trades = start, {}, {}, [], 0, 0
        window = [d for d in days if lo <= d <= hi]
        prev_spy, extra = None, (FEE if park else 0.0)
        for d in window:
            spy_c = rows["SPY"][d][1] if d in rows["SPY"] else None
            if park and spy_c and prev_spy:
                cash *= spy_c / prev_spy
            prev_spy = spy_c or prev_spy
            for s in list(pos):                      # exits first
                if d in rows[s] and rows[s][d][3]:
                    units, cost = pos.pop(s)
                    proceeds = units * rows[s][d][0] * (1 - FEE - extra)
                    cash += proceeds
                    wins += proceeds > cost
                    trades += 1
            equity = cash + sum(u * last.get(s, rows[s].get(d, (0, 0))[0]) for s, (u, _) in pos.items())
            for s in rows:                           # then entries
                if s in pos or d not in rows[s] or not rows[s][d][2]:
                    continue
                size = min(cap * equity, cash / (1 + FEE + extra))
                if size < 1:
                    continue
                pos[s] = (size * (1 - FEE) / rows[s][d][0], size)
                cash -= size * (1 + FEE + extra)
            for s in rows:
                if d in rows[s]:
                    last[s] = rows[s][d][1]
            curve.append((cash + sum(u * last.get(s, 0) for s, (u, _) in pos.items()), len(pos) * cap))
        return curve, wins, trades, window

    def stats(eq, window):
        yrs = (window[-1] - window[0]) / 365.25
        peak, mdd = eq[0], 0.0
        for v in eq:
            peak = max(peak, v)
            mdd = max(mdd, 1 - v / peak)
        return (eq[-1] / eq[0]) ** (1 / yrs) - 1, mdd, yrs

    print(f"Double 7s as one account, {len(data)} index and sector ETFs, {cap:.0%} per position, ${start:,.0f} start. Fee {FEE:.1%}/side.\n")
    print(f"{'period':14}{'lookback':>9}{'end value':>11}{'CAGR':>7}{'worst drop':>11}{'win rate':>9}{'trades/yr':>10}{'avg invested':>13} | {'SPY hold CAGR':>14}{'SPY worst drop':>15}")
    for label, a, b in (("2012 to now", "2012-01-01", "2099-01-01"), ("2020 to now", "2020-01-01", "2099-01-01")):
        lo, hi = ts(a), ts(b)
        spy = [r[4] for r in data["SPY"] if lo <= r[0] // 86400 <= hi]
        hold = stats(spy, [d for d in days if lo <= d <= hi])
        for lb in lookbacks:
            curve, wins, trades, window = run_one(lb, lo, hi)
            cagr, mdd, yrs = stats([v for v, _ in curve], window)
            inv = sum(x for _, x in curve) / len(curve)
            print(f"{label:14}{lb:>9}{curve[-1][0]:>11,.0f}{cagr:>7.1%}{mdd:>11.0%}{wins / max(trades, 1):>9.0%}{trades / yrs:>10.0f}{inv:>13.0%} | {hold[0]:>14.1%}{hold[1]:>15.0%}")


def trend_spy(sma_len=200, margin=0.05):
    """Faber-style timing: hold the index only while it closes above its `sma_len` day average, else cash (0%).
    Signal from yesterday's close, acted on today (one extra day of lag, conservative). 0.1% per switch.
    Leverage borrows at `margin` a year. Price index before 1993 has no dividends, SPY after has them."""
    data = {"S&P 500 index, 1928 on (price only)": fetch_yahoo("^GSPC"), "SPY, 1993 on (with dividends)": fetch_yahoo("SPY")}
    spans = (("whole history", "1900-01-01"), ("2000 on", "2000-01-01"), ("2020 on", "2020-01-01"))
    print(f"Hold only while above the {sma_len} day average. Fee {FEE:.1%}/switch, margin {margin:.0%}, cash earns 0%.\n")
    print(f"{'series':40}{'period':14}{'strategy':>10}{'CAGR':>7}{'worst drop':>11}{'invested':>9}{'switches':>9}")
    for name, bars in data.items():
        c = [r[4] for r in bars]
        a = sma(c, sma_len)
        for label, start in spans:
            idx0 = next((i for i, r in enumerate(bars) if datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d") >= start), 0)
            idx0 = max(idx0, sma_len + 3)
            if idx0 >= len(bars) - 50:
                continue
            for mode, lev in (("hold", None), ("trend 1.0x", 1.0), ("trend 1.5x", 1.5)):
                eq, peak, mdd, inv, sw, pos = 1.0, 1.0, 0.0, 0, 0, 0
                for i in range(idx0, len(bars)):
                    r = c[i] / c[i - 1] - 1
                    if lev is None:
                        eq *= 1 + r
                    else:
                        want = 1 if c[i - 2] > a[i - 2] else 0
                        if want != pos:
                            eq *= 1 - FEE * lev
                            sw, pos = sw + 1, want
                        if pos:
                            eq *= 1 + lev * r - (lev - 1) * margin / 252
                            inv += 1
                    peak = max(peak, eq)
                    mdd = max(mdd, 1 - eq / peak)
                yrs = (bars[-1][0] - bars[idx0][0]) / 31557600
                share = 1.0 if lev is None else inv / (len(bars) - idx0)
                print(f"{name:40}{label:14}{mode:>10}{eq ** (1 / yrs) - 1:>7.1%}{mdd:>11.0%}{share:>9.0%}{sw:>9}")


def main():
    check()
    if sys.argv[1:] == ["trend-spy"]:
        return trend_spy()
    if sys.argv[1:] == ["portfolio"]:
        return portfolio()
    if sys.argv[1:] == ["sp-century"]:
        return sp_century()
    if sys.argv[1:] == ["watchlist"]:
        return watchlist()
    if sys.argv[1:] == ["sp500"]:
        return universe()
    if sys.argv[1:] == ["etfs"]:
        return universe(ETFS, "Index ETFs")
    if sys.argv[1:] == ["btc-years"]:
        return btc_years()
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
