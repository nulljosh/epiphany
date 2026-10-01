#!/usr/bin/env python3
"""Quiet watcher for the IBKR demo account. Prints a line only when our positions move another --step percent
(default 1%) up or down from cost, and once at the market close. Read-only: it never places orders.

    uv run --with ib_async python3 scripts/ibkr-watch.py
"""
import argparse, json, os
from datetime import datetime
from zoneinfo import ZoneInfo
from ib_async import IB

ap = argparse.ArgumentParser()
ap.add_argument("--step", type=float, default=1.0, help="percent move that triggers a line")
ap.add_argument("--port", type=int, default=4002)
ap.add_argument("--abs", type=float, default=20.0, help="account currency move (e.g. CAD) from the first run that triggers a line")
ap.add_argument("--poll", type=int, default=60, help="seconds between checks")
a = ap.parse_args()

STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tradingview", "ibkr-state.json")
start_nl = json.load(open(STATE))["start"]["netLiquidation"] if os.path.exists(STATE) else None
ib, level, alevel, down = IB(), 0, 0, False
print("watching practice account", flush=True)
while True:
    now = datetime.now(ZoneInfo("America/New_York"))
    try:
        if not ib.isConnected():
            ib.connect("127.0.0.1", a.port, clientId=21, timeout=10)
            if down:
                print("gateway is back", flush=True)
                down = False
        port = ib.portfolio()
        cost = sum(p.averageCost * p.position for p in port)
        gain = sum(p.unrealizedPNL for p in port)
        pct = gain / cost * 100 if cost else 0.0
        best = max(port, key=lambda p: p.unrealizedPNL, default=None)
        worst = min(port, key=lambda p: p.unrealizedPNL, default=None)
        if (now.hour, now.minute) >= (16, 5):
            print(f"MARKET CLOSED: positions {pct:+.2f}% (${gain:+.2f} on ${cost:,.0f}); best {best.contract.symbol} {best.unrealizedPNL:+.2f}, worst {worst.contract.symbol} {worst.unrealizedPNL:+.2f}", flush=True)
            break
        nl = next((float(v.value) for v in ib.accountSummary() if v.tag == "NetLiquidation" and v.currency != "BASE"), None)
        if start_nl and nl is not None:
            alvl = int((nl - start_nl) / a.abs)
            if alvl != alevel:
                print(f"{'UP' if alvl > alevel else 'DOWN'}: account {nl - start_nl:+,.2f} since the start ({nl:,.2f})", flush=True)
                alevel = alvl
        lvl = int(pct / a.step)
        if lvl != level:
            print(f"{'UP' if lvl > level else 'DOWN'}: positions {pct:+.2f}% (${gain:+.2f} on ${cost:,.0f}); best {best.contract.symbol} {best.unrealizedPNL:+.2f}, worst {worst.contract.symbol} {worst.unrealizedPNL:+.2f}", flush=True)
            level = lvl
    except Exception as e:
        if not down:
            print(f"gateway problem: {str(e)[:80]}", flush=True)
            down = True
    ib.sleep(a.poll)
ib.disconnect()
