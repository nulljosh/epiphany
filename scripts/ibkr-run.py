#!/usr/bin/env python3
"""Run Double 7s on 16 index and sector ETFs through a local IB Gateway, then show the account.

    uv run --with ib_async python3 scripts/ibkr-run.py           # print the plan and account, send nothing
    uv run --with ib_async python3 scripts/ibkr-run.py --go      # send the orders

Rule (WHITEPAPER section 5): in an uptrend (close above the 200 day average) buy a close at a 10 day low,
sell a close at a 10 day high. Each position is 10% of --sleeve. Whole shares only. Demo and paper accounts
only (IDs starting with D) unless --live. Meant to run once per trading day; it does not schedule itself.
"""
import argparse, json, os, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
from ib_async import IB, MarketOrder, Stock

ETFS = ["SPY", "QQQ", "DIA", "IWM", "MDY", "EFA", "EEM", "XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tradingview", "ibkr-state.json")

ap = argparse.ArgumentParser()
ap.add_argument("--go", action="store_true", help="actually send the orders")
ap.add_argument("--sleeve", type=float, default=10000, help="USD this strategy manages; each position is 10%% of it")
ap.add_argument("--lookback", type=int, default=10)
ap.add_argument("--port", type=int, default=4002)
ap.add_argument("--live", action="store_true")
a = ap.parse_args()


def closes(sym):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
    c = [x for x in r["chart"]["result"][0]["indicators"]["quote"][0]["close"] if x is not None]
    now = datetime.now(ZoneInfo("America/New_York"))
    if now.weekday() < 5 and (9, 30) <= (now.hour, now.minute) < (16, 0):
        c = c[:-1]  # the last bar is still forming, use completed days only
    return c


def decide(c, held):
    if len(c) < 200:
        return None
    up = c[-1] > sum(c[-200:]) / 200
    if not held and up and c[-1] <= min(c[-a.lookback:]):
        return "buy"
    if held and c[-1] >= max(c[-a.lookback:]):
        return "sell"
    return None


ib = IB()
ib.connect("127.0.0.1", a.port, clientId=19, timeout=10)
try:
    acct = ib.managedAccounts()[0]
    if not acct.upper().startswith("D") and not a.live:
        sys.exit(f"refusing real account {acct}: pass --live if you mean it")
    held = {p.contract.symbol: p.position for p in ib.positions() if p.position}
    plan = []
    for s in ETFS:
        c = closes(s)
        d = decide(c, s in held)
        if d == "buy":
            qty = int(a.sleeve * 0.10 // c[-1])
            if qty >= 1 and len(held) + sum(1 for x in plan if x[1] == "buy") < 10:
                plan.append((s, "buy", qty, c[-1]))
        elif d == "sell":
            plan.append((s, "sell", int(held[s]), c[-1]))
    print(f"account {acct} on port {a.port}, {len(held)} positions held: {held or 'none'}")
    print("plan:", [f"{side} {q} {s} (~{px:.2f})" for s, side, q, px in plan] or "nothing to do today")
    sent = []
    if a.go:
        for s, side, q, px in plan:
            c = Stock(s, "SMART", "USD")
            ib.qualifyContracts(c)
            o = MarketOrder(side.upper(), q)
            o.tif = "DAY"
            t = ib.placeOrder(c, o)
            ib.sleep(3)
            sent.append({"symbol": s, "side": side, "qty": q, "status": t.orderStatus.status, "fill": t.orderStatus.avgFillPrice})
            print(f"{t.orderStatus.status}: {side} {q} {s} @ {t.orderStatus.avgFillPrice}")
    elif plan:
        print("(dry run, pass --go to send)")
    summ = {v.tag: (float(v.value), v.currency) for v in ib.accountSummary() if v.tag in ("NetLiquidation", "UnrealizedPnL", "RealizedPnL", "TotalCashValue") and v.currency != "BASE"}
    nl, cur = summ.get("NetLiquidation", (0, "?"))
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    spy_now = closes("SPY")[-1]
    state.setdefault("start", {"account": acct, "netLiquidation": nl, "spy": spy_now, "date": datetime.now().isoformat(timespec="minutes")})
    state["start"].setdefault("spy", spy_now)
    if a.go:
        state["lastGo"] = datetime.now(ZoneInfo("America/New_York")).date().isoformat()  # lets a loop tell if today already ran
    state.setdefault("orders", []).extend({**x, "date": datetime.now().isoformat(timespec="minutes")} for x in sent)
    json.dump(state, open(STATE, "w"), indent=1)
    # One snapshot per run so we can later see which positions made (or lost) the money.
    state.setdefault("snapshots", []).append({
        "t": datetime.now().isoformat(timespec="minutes"), "netLiquidation": nl, "spy": spy_now,
        "positions": {p.contract.symbol: {"qty": p.position, "cost": p.averageCost, "px": p.marketPrice, "pnl": p.unrealizedPNL} for p in ib.portfolio()},
    })
    state["snapshots"] = state["snapshots"][-500:]
    json.dump(state, open(STATE, "w"), indent=1)
    start = state["start"]["netLiquidation"]
    print(f"\naccount value {nl:,.2f} {cur} ({nl - start:+,.2f} since {state['start']['date']}), "
          f"unrealized P&L {summ.get('UnrealizedPnL', (0,))[0]:,.2f}, realized {summ.get('RealizedPnL', (0,))[0]:,.2f}")
    port = ib.portfolio()
    cost = sum(p.averageCost * p.position for p in port)
    gain = sum(p.unrealizedPNL for p in port)
    if cost:
        spy_move = spy_now / state["start"]["spy"] - 1
        print(f"\nscoreboard since {state['start']['date']}: our positions {gain / cost:+.2%} (unrealized, USD), SPY buy and hold {spy_move:+.2%}")
    for p in port:
        print(f"  {p.contract.symbol:5} {p.position:>5g} @ {p.averageCost:8.2f}  now {p.marketPrice:8.2f}  P&L {p.unrealizedPNL:+9.2f}")
finally:
    ib.disconnect()
