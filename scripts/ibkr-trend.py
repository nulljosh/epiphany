#!/usr/bin/env python3
"""Run Trend 2x as its own sleeve on the IBKR practice account.

    uv run --with ib_async python3 scripts/ibkr-trend.py           # print the plan, send nothing
    uv run --with ib_async python3 scripts/ibkr-trend.py --go      # switch for real

Rule (WHITEPAPER section 1): if SPY closes above its 200 day average, hold SSO (2x S&P 500). Otherwise hold
BIL (T-bills). Checked daily, but it only trades when the side changes. Today's close is SPY's price at run
time, so run it around 3:45pm New York like ibkr-run.py. The sleeve is --sleeve dollars, whole shares, DAY
market orders.

It lives next to Double 7s without touching it. The sleeve has its own state file (tradingview/ibkr-trend.json)
listing the shares it owns, and it only ever sells those. Demo and paper accounts only (IDs starting with D)
unless --live. ibkr-live.py runs it once a day.
"""
import argparse, json, os, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "..", "tradingview", "ibkr-trend.json")
BULL, BEAR, TREND = "SSO", "BIL", "SPY"
SIDES = {BULL: "2x S&P", BEAR: "T-bills"}


def closes(sym, now=None):
    """Daily closes, today's forming bar kept from 3:30pm New York (the signal reads today's price), dropped before."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
    c = [x for x in r["chart"]["result"][0]["indicators"]["quote"][0]["close"] if x is not None]
    now = now or datetime.now(ZoneInfo("America/New_York"))
    if now.weekday() < 5 and (9, 30) <= (now.hour, now.minute) < (15, 30):
        c = c[:-1]
    return c


def target(spy):
    """SSO when the last SPY close is above its 200 day average, BIL when not, None until 200 closes."""
    if len(spy) < 200:
        return None
    return BULL if spy[-1] > sum(spy[-200:]) / 200 else BEAR


def plan_orders(want, prices, owned, budget):
    """[(side, symbol, qty, price)]. Sells come first and only touch shares in `owned`, never more than owned.
    Nothing happens while the sleeve already holds the target side. `budget` is the sleeve's value in dollars."""
    other = BEAR if want == BULL else BULL
    out = []
    if owned.get(other, 0) > 0:
        out.append(("sell", other, int(owned[other]), prices.get(other, 0.0)))
    if owned.get(want, 0) <= 0 and prices.get(want):
        qty = int(budget // prices[want])
        if qty > 0:
            out.append(("buy", want, qty, prices[want]))
    return out


def apply_fill(st, side, sym, qty, px):
    """Book a fill in the state: shares owned, sleeve cash, last price."""
    sign = 1 if side == "buy" else -1
    have = st["holdings"].get(sym, 0) + sign * qty
    if have > 0:
        st["holdings"][sym] = have
    else:
        st["holdings"].pop(sym, None)
    st["cash"] = st.get("cash", 0.0) - sign * qty * px
    st.setdefault("last", {})[sym] = px


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true", help="actually send the orders")
    ap.add_argument("--sleeve", type=float, default=100000, help="USD this sleeve manages")
    ap.add_argument("--port", type=int, default=4002)
    ap.add_argument("--live", action="store_true")
    a = ap.parse_args()

    from ib_async import IB, MarketOrder, Stock
    now = datetime.now(ZoneInfo("America/New_York"))
    spy = closes(TREND, now)
    want = target(spy)
    if want is None:
        sys.exit("not enough SPY history, not trading")
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    st.setdefault("holdings", {})
    owned = {s: q for s, q in st["holdings"].items() if q > 0}

    ib = IB()
    ib.connect("127.0.0.1", a.port, clientId=25, timeout=10)
    try:
        acct = ib.managedAccounts()[0]
        if not acct.upper().startswith("D") and not a.live:
            sys.exit(f"refusing real account {acct}: pass --live if you mean it")
        actual = {p.contract.symbol: int(p.position) for p in ib.positions() if p.position}
        # Never sell what the account does not hold, whatever the state file believes.
        owned = {s: min(q, actual.get(s, 0)) for s, q in owned.items() if actual.get(s, 0) > 0}
        prices = {}
        for s in (BULL, BEAR):
            try:
                prices[s] = closes(s, now)[-1]
            except Exception:
                pass
        budget = st.get("cash", a.sleeve) + sum(q * prices.get(s, st.get("last", {}).get(s, 0.0)) for s, q in owned.items())
        plan = plan_orders(want, prices, owned, budget)
        print(f"account {acct} on port {a.port}, sleeve ${a.sleeve:,.0f}, SPY {spy[-1]:.2f} vs 200 day {sum(spy[-200:]) / 200:.2f}")
        print(f"trend side: {SIDES[want]} ({want})")
        print(f"trend owned: { {s: q for s, q in sorted(owned.items())} or 'nothing'}")
        print("trend plan:", [f"{side} {q} {s} (~{px:.2f})" for side, s, q, px in plan] or "nothing to do")
        if a.go:
            st.setdefault("start", {"date": now.date().isoformat(), "sleeve": a.sleeve, "spy": spy[-1]})
            st.setdefault("cash", a.sleeve)
            sent = []
            for side, s, q, px in plan:
                c = Stock(s, "SMART", "USD")
                ib.qualifyContracts(c)
                o = MarketOrder(side.upper(), q)
                o.tif = "DAY"
                t = ib.placeOrder(c, o)
                for _ in range(15):
                    if t.orderStatus.status in ("Filled", "Cancelled", "Inactive"):
                        break
                    ib.sleep(1)
                got = int(t.orderStatus.filled or 0)
                fill = t.orderStatus.avgFillPrice or px
                if got:
                    apply_fill(st, side, s, got, fill)
                sent.append({"symbol": s, "side": side, "qty": q, "filled": got, "status": t.orderStatus.status, "fill": fill})
                print(f"{t.orderStatus.status}: {side} {q} {s} @ {t.orderStatus.avgFillPrice}")
                if side == "sell" and got < q:
                    break  # the old side is not out yet, do not buy on money we do not have
            if st["holdings"].get(want):
                st["side"] = want
            st["lastRun"] = now.date().isoformat()
            st.setdefault("orders", []).extend({**x, "date": now.isoformat(timespec="minutes")} for x in sent)
            os.makedirs(os.path.dirname(STATE), exist_ok=True)
            json.dump(st, open(STATE + ".tmp", "w"), indent=1)
            os.replace(STATE + ".tmp", STATE)
            print(f"trend side {SIDES[want]}, sleeve owns {st['holdings'] or 'nothing'}")
        elif plan:
            print("(dry run, pass --go to send)")
    finally:
        ib.disconnect()


if __name__ == "__main__":
    main()
