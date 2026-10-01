#!/usr/bin/env python3
"""Epiphany Live: a menu bar app for the IBKR practice account. No Terminal, no Dock icon.

The menu bar shows the account change since the first run. The menu shows our positions versus SPY and when the
daily trade runs. It starts scripts/ibkr-live.py as a child (alerts, and the daily paper trade at 3:45pm New York,
12:45pm Pacific) and stops it on Quit. Demo accounts only. Start it from ~/Applications/Epiphany Live.app.

    uv run --with rumps --with ib_async python3 scripts/menubar.py            # the app
    uv run --with ib_async python3 scripts/menubar.py --selftest              # print what the menu would say
"""
import json, os, subprocess, sys, urllib.request
from ib_async import IB

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STATE = os.path.join(ROOT, "tradingview", "ibkr-state.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyIBKR.log")
BEST = os.path.join(ROOT, "tradingview", "ibkr-best.json")


def spy_price():
    url = "https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1d"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=10))
    return r["chart"]["result"][0]["meta"]["regularMarketPrice"]


def snapshot():
    """(title, lines) describing the account right now."""
    ib = IB()
    try:
        ib.connect("127.0.0.1", 4002, clientId=23, timeout=8)
        port = ib.portfolio()
        cost = sum(p.averageCost * p.position for p in port)
        gain = sum(p.unrealizedPNL for p in port)
        nl = next((float(v.value) for v in ib.accountSummary() if v.tag == "NetLiquidation" and v.currency != "BASE"), None)
    except Exception:
        return "!", ["Log in to IB Gateway"]
    finally:
        if ib.isConnected():
            ib.disconnect()
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    start = st.get("start", {})
    d = nl - start["netLiquidation"] if start.get("netLiquidation") and nl is not None else 0.0
    try:
        spy = spy_price() / start["spy"] - 1 if start.get("spy") else 0.0
    except Exception:
        spy = 0.0
    pct = gain / cost if cost else 0.0
    # Own file, so it never races ibkr-live.py writing the state file.
    rec = json.load(open(BEST)) if os.path.exists(BEST) else {"high": d, "low": d}
    rec = {"high": max(rec["high"], d), "low": min(rec["low"], d)}
    json.dump(rec, open(BEST, "w"))
    return f"{d:+.0f}", [
        f"{d:+,.2f} CAD since {start.get('date', 'the start')[5:10]}",
        f"Positions {pct:+.2%}   SPY {spy:+.2%}",
        f"High {rec['high']:+,.2f}   Low {rec['low']:+,.2f}",
    ]


def main():
    if "--selftest" in sys.argv:
        t, lines = snapshot()
        print(t, "|", " | ".join(lines))
        return
    import rumps

    class App(rumps.App):
        def __init__(self):
            super().__init__("Epiphany Live", title="..", icon=os.path.join(ROOT, "scripts", "menubar-icon.png"), template=True, quit_button=None)
            self.rows = [rumps.MenuItem(x, callback=None) for x in ("Starting...", " ", " ")]
            self.menu = [*self.rows, None, rumps.MenuItem("Quit", callback=self.quit)]
            self.child = None
            self.ensure_runner()

        def ensure_runner(self):
            # The [i] keeps pgrep from matching its own command line. Start the runner if nothing is running it.
            if subprocess.run(["pgrep", "-f", "[i]bkr-live.py"], capture_output=True).returncode != 0:
                out = open(LOG, "a")
                self.child = subprocess.Popen([os.path.expanduser("~/.local/bin/uv"), "run", "--quiet", "--with", "ib_async", "python3", "scripts/ibkr-live.py"], cwd=ROOT, stdout=out, stderr=out)

        @rumps.timer(60)
        def tick(self, _):
            self.ensure_runner()
            self.title, lines = snapshot()
            for row, text in zip(self.rows, lines + ["", "", ""]):
                row.title = text or " "

        def quit(self, _):
            if self.child:
                self.child.terminate()
            rumps.quit_application()

    app = App()
    app.tick(None)
    app.run()


if __name__ == "__main__":
    main()
