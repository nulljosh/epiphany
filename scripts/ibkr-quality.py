#!/usr/bin/env python3
"""Run the Quality sleeve on the IBKR practice account: buy QUAL once and hold it.

    uv run --with ib_async python3 scripts/ibkr-quality.py           # print the plan, send nothing
    uv run --with ib_async python3 scripts/ibkr-quality.py --go      # buy for real

Rule (WHITEPAPER section 3): long only profitability. QUAL is iShares MSCI USA Quality Factor, the nearest fund
to French's top tenth on operating profit. One buy, whole shares, a DAY market order for --sleeve dollars, then
nothing: no rebalance, no timing, never a sell. It lives next to Double 7s and Trend 2x without touching them.
The sleeve has its own state file (tradingview/ibkr-quality.json) holding the start date, SPY's close that day,
the shares it owns and every order. A state file with a start means the buy is done, so a second run does
nothing. Demo and paper accounts only (IDs starting with D) unless --live. ibkr-live.py runs it once, from
3:45 to 4pm New York, while the state file has no start.
"""
import argparse, json, os, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "..", "tradingview", "ibkr-quality.json")
FUND, MARKET = "QUAL", "SPY"


def closes(sym, now=None):
    """Daily closes, today's forming bar kept from 3:30pm New York (the buy reads today's price), dropped before."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1mo"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
    c = [x for x in r["chart"]["result"][0]["indicators"]["quote"][0]["close"] if x is not None]
    now = now or datetime.now(ZoneInfo("America/New_York"))
    if now.weekday() < 5 and (9, 30) <= (now.hour, now.minute) < (15, 30):
        c = c[:-1]
    return c


def plan_orders(st, price, budget):
    """[(side, symbol, qty, price)]. One buy, ever: nothing once the state has a start. There is no sell path,
    so it can never touch a share it does not own. `budget` is the sleeve's size in dollars."""
    if st.get("start") or not price:
        return []
    qty = int(budget // price)
    return [("buy", FUND, qty, price)] if qty > 0 else []


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


def reconcile(st, actual, px):
    """A market order still working when the last run ended can fill later. Book what the account shows now,
    never more than was ordered. True if the state changed."""
    got = min(int(actual), int(st.get("ordered", 0)))
    have = st["holdings"].get(FUND, 0)
    if got > have:
        apply_fill(st, "buy", FUND, got - have, px)
        return True
    return False


def save(st):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(st, open(STATE + ".tmp", "w"), indent=1)
    os.replace(STATE + ".tmp", STATE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true", help="actually send the order")
    ap.add_argument("--sleeve", type=float, default=50000, help="USD this sleeve buys")
    ap.add_argument("--port", type=int, default=4002)
    ap.add_argument("--live", action="store_true")
    a = ap.parse_args()

    from ib_async import IB, MarketOrder, Stock
    now = datetime.now(ZoneInfo("America/New_York"))
    price = closes(FUND, now)[-1]
    spy = closes(MARKET, now)[-1]
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    st.setdefault("holdings", {})

    ib = IB()
    ib.connect("127.0.0.1", a.port, clientId=26, timeout=10)
    try:
        acct = ib.managedAccounts()[0]
        if not acct.upper().startswith("D") and not a.live:
            sys.exit(f"refusing real account {acct}: pass --live if you mean it")
        actual = {p.contract.symbol: int(p.position) for p in ib.positions() if p.position}
        plan = plan_orders(st, price, a.sleeve)
        print(f"account {acct} on port {a.port}, sleeve ${a.sleeve:,.0f}, {FUND} {price:.2f}, SPY {spy:.2f}")
        if st.get("start"):
            print(f"quality: bought on {st['start']['date']}, sleeve owns {st['holdings'] or 'nothing'}, nothing to do")
        print("quality plan:", [f"{side} {q} {s} (~{px:.2f})" for side, s, q, px in plan] or "nothing to do")
        if a.go:
            if st.get("start") and reconcile(st, actual.get(FUND, 0), price):
                save(st)
            for side, s, q, px in plan:
                # The start is written before the order goes out, so a crash can never lead to a second buy.
                st["start"] = {"date": now.date().isoformat(), "sleeve": a.sleeve, "spy": spy}
                st["cash"], st["ordered"] = a.sleeve, q
                c = Stock(s, "SMART", "USD")
                ib.qualifyContracts(c)
                o = MarketOrder(side.upper(), q)
                o.tif = "DAY"
                t = ib.placeOrder(c, o)
                save(st)
                for _ in range(20):
                    if t.orderStatus.status in ("Filled", "Cancelled", "Inactive"):
                        break
                    ib.sleep(1)
                got = int(t.orderStatus.filled or 0)
                fill = t.orderStatus.avgFillPrice or px
                if got:
                    apply_fill(st, side, s, got, fill)
                st.setdefault("orders", []).append({"symbol": s, "side": side, "qty": q, "filled": got, "status": t.orderStatus.status,
                                                    "fill": fill, "date": now.isoformat(timespec="minutes")})
                save(st)
                print(f"{t.orderStatus.status}: {side} {q} {s} @ {t.orderStatus.avgFillPrice}")
            print(f"quality sleeve owns {st['holdings'] or 'nothing'}")
        elif plan:
            print("(dry run, pass --go to send)")
    finally:
        ib.disconnect()


if __name__ == "__main__":
    main()
