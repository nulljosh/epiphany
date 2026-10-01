#!/usr/bin/env python3
"""Place one US stock/ETF market order through a locally running IB Gateway or TWS.

    uv run --with ib_async python3 scripts/ibkr-order.py buy SPY 1            # paper (port 4002)
    uv run --with ib_async python3 scripts/ibkr-order.py buy SPY 1 --dry-run  # connect, price it, send nothing

Safe by default: only demo/paper accounts (IDs starting with D, like DUR229411) are traded. A real account is
refused unless you pass --live. The check is on the account, not the port, because IBKR free-trial demo accounts
log in on the "live" port.
"""
import argparse, sys
from ib_async import IB, MarketOrder, Stock

PAPER = {4002, 7497}
LIVE = {4001, 7496}

ap = argparse.ArgumentParser()
ap.add_argument("side", choices=["buy", "sell"])
ap.add_argument("symbol")
ap.add_argument("qty", type=float)
ap.add_argument("--port", type=int, default=4002)
ap.add_argument("--live", action="store_true", help="allow a live-account port")
ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()

if a.port not in PAPER | LIVE:
    sys.exit(f"unknown port {a.port}: 4002/4001 (Gateway paper/live), 7497/7496 (TWS paper/live)")
if a.qty <= 0 or a.symbol.upper().endswith("USD"):
    sys.exit("stocks and ETFs only, qty above zero (crypto and FX are not routed here)")

ib = IB()
ib.connect("127.0.0.1", a.port, clientId=17, timeout=10)
try:
    c = Stock(a.symbol.upper(), "SMART", "USD")
    ib.qualifyContracts(c)
    acct = ib.managedAccounts()[0]
    demo = acct.upper().startswith("D")
    print(f"connected: account {acct} on port {a.port} ({'DEMO/PAPER' if demo else 'REAL MONEY'})")
    if not demo and not a.live:
        sys.exit(f"refusing real account {acct}: pass --live if you mean it")
    if a.dry_run:
        print(f"[dry-run] would {a.side} {a.qty:g} {c.symbol}")
    else:
        t = ib.placeOrder(c, MarketOrder(a.side.upper(), a.qty))
        ib.sleep(3)
        print(f"{t.orderStatus.status}: {a.side} {a.qty:g} {c.symbol}, filled {t.orderStatus.filled:g} @ {t.orderStatus.avgFillPrice}")
finally:
    ib.disconnect()
