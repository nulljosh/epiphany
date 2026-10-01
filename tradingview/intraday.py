#!/usr/bin/env python3
"""Can many small intraday trades make money? 5-minute bars, 60 days (all Yahoo gives), 16 ETFs.
Rule: buy when a 2-bar RSI drops under BUY (a quick dip), sell when it rises over EXIT or at the last bar of the day.
No overnight, no new entries in the last 30 minutes. Fills at the NEXT bar's open (no peeking).
Costs: IBKR $0.005/share, $1 minimum per order, plus 1 cent/share spread each side. $10,000 per trade.

    python3 tradingview/intraday.py
"""
import json, statistics, urllib.request
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo
from backtest import ETFS

ET = ZoneInfo("America/New_York")
SIZE = 10_000


def days(sym):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=5m&range=60d"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30))["chart"]["result"][0]
    q, out = r["indicators"]["quote"][0], defaultdict(list)
    for i, t in enumerate(r["timestamp"]):
        o, c = q["open"][i], q["close"][i]
        if o is not None and c is not None:
            out[datetime.fromtimestamp(t, ET).date()].append((o, c))
    return {d: b for d, b in out.items() if len(b) >= 60}


def rsi2(closes, i):
    d = [closes[i - 1] - closes[i - 2], closes[i] - closes[i - 1]]
    g, l = sum(max(x, 0) for x in d) / 2, sum(max(-x, 0) for x in d) / 2
    return 100.0 if l == 0 and g > 0 else 50.0 if l == 0 else 100 * g / (g + l)


def trades(data, buy, exit_):
    out = []
    for sym, byday in data.items():
        for d, bars in byday.items():
            o, c, n, pos = [b[0] for b in bars], [b[1] for b in bars], len(bars), None
            for i in range(6, n - 1):
                r = rsi2(c, i)
                if pos is None and r < buy and i < n - 7:
                    pos = o[i + 1]  # fill at the next bar's open
                elif pos is not None and (r > exit_ or i == n - 2):
                    px = o[i + 1]
                    sh = max(int(SIZE / pos), 1)
                    cost = 2 * max(1.0, 0.005 * sh) + 2 * 0.01 * sh
                    out.append(((px - pos) * sh, (px - pos) * sh - cost, d))
                    pos = None
            if pos is not None:  # never carried overnight
                sh = max(int(SIZE / pos), 1)
                out.append(((c[-1] - pos) * sh, (c[-1] - pos) * sh - 2 * max(1.0, 0.005 * sh) - 0.02 * sh, d))
    return out


def main():
    data = {s: days(s) for s in ETFS}
    data = {s: b for s, b in data.items() if b}
    nd = len({d for b in data.values() for d in b})
    print(f"{len(data)} ETFs, {nd} trading days of 5-minute bars, ${SIZE:,} per trade, IBKR commissions plus 1 cent/share spread.\n")
    print(f"{'buy<':>5}{'exit>':>6}{'trades/day':>11}{'win rate':>9}{'gross $/trade':>14}{'net $/trade':>12}{'net $/day':>11}{'fees % of gross':>16}")
    for buy, ex in ((5, 50), (10, 60), (10, 80), (20, 70), (30, 70)):
        t = trades(data, buy, ex)
        if not t:
            continue
        g, nt = sum(x[0] for x in t), sum(x[1] for x in t)
        wins = sum(x[1] > 0 for x in t) / len(t)
        print(f"{buy:>5}{ex:>6}{len(t) / nd:>11.0f}{wins:>9.0%}{g / len(t):>14.2f}{nt / len(t):>12.2f}{nt / nd:>11.0f}{(g - nt) / g * 100 if g > 0 else float('nan'):>16.0f}")


if __name__ == "__main__":
    main()
