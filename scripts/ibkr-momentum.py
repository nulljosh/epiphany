#!/usr/bin/env python3
"""Run the momentum rule from tradingview/edge.py as its own sleeve on the IBKR practice account.

    uv run --with ib_async python3 scripts/ibkr-momentum.py           # print the plan, send nothing
    uv run --with ib_async python3 scripts/ibkr-momentum.py --go      # rebalance for real

Rule (tradingview/edge.py, "Momentum + trend"): rank the S&P 500 by the return from about 6 months ago to a
month ago, hold the top 20 equally, but only while the equal-weight basket is above its 200 day average.
Otherwise cash. Rebalance monthly. The sleeve is --sleeve dollars, whole shares, DAY market orders.

It lives next to Double 7s without touching it. The sleeve has its own state file
(tradingview/ibkr-momentum.json) listing the shares it owns, and it only ever sells those. Demo and paper
accounts only (IDs starting with D) unless --live. ibkr-live.py runs it once a month.
"""
import argparse, json, os, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "..", "tradingview", "ibkr-momentum.json")
# Double 7s' 16 funds. Never in this sleeve, never touched by it.
ETFS = ["SPY", "QQQ", "DIA", "IWM", "MDY", "EFA", "EEM", "XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]
LOOKBACK, SKIP, NAMES = 126, 21, 20


def closes(sym):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
    return [x for x in r["chart"]["result"][0]["indicators"]["quote"][0]["close"] if x is not None]


def choose(days, syms, O, H, L, C):
    """edge.py's own Momentum + trend pick on the data we have: top 20 symbols, or [] when the trend is off."""
    sys.path.insert(0, os.path.join(HERE, "..", "tradingview"))
    import edge
    pick = edge.build(days, syms, O, H, L, C, sizes=(NAMES,))["Momentum + trend"][(LOOKBACK, NAMES)][0]
    return [s for s in pick(len(days)) if s not in ETFS]


def plan_orders(picks, prices, owned, sleeve):
    """[(side, symbol, qty, price)]. Sells come first. Only symbols in `owned` are ever sold, and never more
    than owned. A pick without a price is skipped. No picks means everything owned is sold (cash)."""
    picks = [s for s in picks if prices.get(s)]
    each = sleeve / len(picks) if picks else 0
    out = []
    for s, have in sorted(owned.items()):
        want = int(each // prices[s]) if s in picks else 0
        if have > want:
            out.append(("sell", s, int(have - want), prices.get(s, 0.0)))
    for s in picks:
        want = int(each // prices[s])
        if want > owned.get(s, 0):
            out.append(("buy", s, int(want - owned.get(s, 0)), prices[s]))
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
    ap.add_argument("--sleeve", type=float, default=100000, help="USD this sleeve manages, split equally")
    ap.add_argument("--port", type=int, default=4002)
    ap.add_argument("--live", action="store_true")
    a = ap.parse_args()

    from ib_async import IB, MarketOrder, Stock
    sys.path.insert(0, os.path.join(HERE, "..", "tradingview"))
    import edge
    now = datetime.now(ZoneInfo("America/New_York"))
    days, syms, O, H, L, C = edge.panel()
    if not days or (now.date() - datetime.fromtimestamp(days[-1] * edge.DAY, ZoneInfo("UTC")).date()).days > 6:
        sys.exit("price history is stale, not trading")
    picks = choose(days, syms, O, H, L, C)
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    st.setdefault("holdings", {})
    owned = {s: q for s, q in st["holdings"].items() if q > 0}

    ib = IB()
    ib.connect("127.0.0.1", a.port, clientId=24, timeout=10)
    try:
        acct = ib.managedAccounts()[0]
        if not acct.upper().startswith("D") and not a.live:
            sys.exit(f"refusing real account {acct}: pass --live if you mean it")
        actual = {p.contract.symbol: int(p.position) for p in ib.positions() if p.position}
        # Never sell what the account does not hold, whatever the state file believes.
        owned = {s: min(q, actual.get(s, 0)) for s, q in owned.items() if actual.get(s, 0) > 0}
        prices = {}
        for s in set(picks) | set(owned):
            try:
                prices[s] = closes(s)[-1]
            except Exception:
                pass
        plan = plan_orders(picks, prices, owned, a.sleeve)
        print(f"account {acct} on port {a.port}, sleeve ${a.sleeve:,.0f}, trend {'on' if picks else 'off (cash)'}")
        print(f"momentum picks: {', '.join(picks) or 'none'}")
        print(f"momentum owned: { {s: q for s, q in sorted(owned.items())} or 'nothing'}")
        print("momentum plan:", [f"{side} {q} {s} (~{px:.2f})" for side, s, q, px in plan] or "nothing to do")
        sent = []
        if a.go:
            spy = closes("SPY")[-1]
            st.setdefault("start", {"date": now.date().isoformat(), "sleeve": a.sleeve, "spy": spy})
            st.setdefault("cash", a.sleeve)
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
            st["lastRebalance"] = f"{now:%Y-%m}"
            st["picks"] = picks
            st.setdefault("orders", []).extend({**x, "date": now.isoformat(timespec="minutes")} for x in sent)
            os.makedirs(os.path.dirname(STATE), exist_ok=True)
            json.dump(st, open(STATE + ".tmp", "w"), indent=1)
            os.replace(STATE + ".tmp", STATE)
            print(f"momentum rebalanced {st['lastRebalance']}, sleeve owns {len(st['holdings'])} stocks")
        elif plan:
            print("(dry run, pass --go to send)")
    finally:
        ib.disconnect()


if __name__ == "__main__":
    main()
