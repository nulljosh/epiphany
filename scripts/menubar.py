#!/usr/bin/env python3
"""Epiphany Live: a menu bar app for the IBKR practice account. No Terminal, no Dock icon.

The menu bar shows the account change since the first run. The menu shows our positions versus SPY, the best and
worst position, the record high and low, and when the daily trade runs next. It starts scripts/ibkr-live.py as a child (alerts, and the daily paper trade at 3:45pm New York,
12:45pm Pacific) and stops it on Quit. Demo accounts only. Start it from ~/Applications/Epiphany Live.app.

    uv run --with rumps --with ib_async python3 scripts/menubar.py            # the app
    uv run --with ib_async python3 scripts/menubar.py --selftest              # print what the menu would say
"""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from ib_async import IB

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STATE = os.path.join(ROOT, "tradingview", "ibkr-state.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyIBKR.log")
BEST = os.path.join(ROOT, "tradingview", "ibkr-best.json")


def spy_price():
    url = "https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1d"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=10))
    return r["chart"]["result"][0]["meta"]["regularMarketPrice"]


def next_trade(st):
    """When ibkr-live.py places the next daily trade, in local time."""
    ny = datetime.now(ZoneInfo("America/New_York"))
    run = ny.replace(hour=15, minute=45, second=0, microsecond=0)
    if ny.weekday() < 5 and ny >= run and st.get("lastGo") != ny.date().isoformat():
        return "Now"
    if ny >= run or st.get("lastGo") == ny.date().isoformat():
        run += timedelta(days=1)
    while run.weekday() >= 5:
        run += timedelta(days=1)
    t = run.astimezone()
    day = "Today" if t.date() == datetime.now().date() else f"{t:%a}"
    return f"{day} {t:%-I:%M %p}"


def money(x):
    return f"{x:+,.2f}".replace("-", "\u2212")


def pct(x):
    return f"{x:+.2%}".replace("-", "\u2212")


def snapshot():
    """(title, rows) describing the account right now. A row is (label, value, number that colors the value)."""
    ib = IB()
    try:
        ib.connect("127.0.0.1", 4002, clientId=23, timeout=8)
        port = [p for p in ib.portfolio() if p.position]
        nl = next((float(v.value) for v in ib.accountSummary() if v.tag == "NetLiquidation" and v.currency != "BASE"), None)
    except Exception:
        return "!", [("Log in to IB Gateway", "", None)]
    finally:
        if ib.isConnected():
            ib.disconnect()
    cost = sum(p.averageCost * p.position for p in port)
    gain = sum(p.unrealizedPNL for p in port)
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    start = st.get("start", {})
    d = nl - start["netLiquidation"] if start.get("netLiquidation") and nl is not None else 0.0
    try:
        spy = spy_price() / start["spy"] - 1 if start.get("spy") else 0.0
    except Exception:
        spy = 0.0
    # Own file, so it never races ibkr-live.py writing the state file.
    rec = json.load(open(BEST)) if os.path.exists(BEST) else {"high": d, "low": d}
    rec = {"high": max(rec["high"], d), "low": min(rec["low"], d)}
    json.dump(rec, open(BEST, "w"))
    rows = [
        (f"Since {start.get('date', '')[5:10] or 'start'}", f"{money(d)} CAD", d),
        ("Positions", pct(gain / cost if cost else 0.0), gain),
        ("SPY", pct(spy), spy),
    ]
    if port:
        ranked = sorted(port, key=lambda p: p.unrealizedPNL)
        for label, p in (("Best", ranked[-1]), ("Worst", ranked[0])):
            basis = p.averageCost * p.position
            rows.append((f"{label}  {p.contract.symbol}", f"{money(p.unrealizedPNL)}   {pct(p.unrealizedPNL / basis if basis else 0)}", p.unrealizedPNL))
    else:
        rows += [("", "", None)] * 2  # keeps the slots lined up; empty rows are hidden
    rows += [
        ("High", money(rec["high"]), None),
        ("Low", money(rec["low"]), None),
        ("Next trade", next_trade(st), None),
    ]
    return f"{d:+.0f}".replace("-", "\u2212"), rows


def style(item, label, value, n):
    """Label left, value right-aligned in tabular digits, value green or red by sign. Empty rows hide."""
    from AppKit import (NSAttributedString, NSColor, NSFont, NSFontAttributeName, NSForegroundColorAttributeName,
                        NSMutableParagraphStyle, NSParagraphStyleAttributeName, NSTextAlignmentRight, NSTextTab)
    mi = item._menuitem
    mi.setHidden_(not label)
    para = NSMutableParagraphStyle.alloc().init()
    para.setTabStops_([NSTextTab.alloc().initWithTextAlignment_location_options_(NSTextAlignmentRight, 240, {})])
    size = NSFont.menuFontOfSize_(0).pointSize()
    base = {NSParagraphStyleAttributeName: para, NSFontAttributeName: NSFont.monospacedDigitSystemFontOfSize_weight_(size, 0)}
    s = NSAttributedString.alloc().initWithString_attributes_(label, base).mutableCopy()
    if value:
        color = NSColor.secondaryLabelColor() if not n else NSColor.systemGreenColor() if n > 0 else NSColor.systemRedColor()
        weight = NSFont.monospacedDigitSystemFontOfSize_weight_(size, 0.23)  # medium
        s.appendAttributedString_(NSAttributedString.alloc().initWithString_attributes_(
            "\t" + value, {**base, NSForegroundColorAttributeName: color, NSFontAttributeName: weight}))
    mi.setAttributedTitle_(s)


def main():
    if "--selftest" in sys.argv:
        t, rows = snapshot()
        print(t)
        for label, value, _ in rows:
            print(f"  {label:<14}{value:>24}")
        return
    import rumps

    class App(rumps.App):
        def __init__(self):
            super().__init__("Epiphany Live", title="..", icon=os.path.join(ROOT, "scripts", "menubar-icon.png"), template=True, quit_button=None)
            self.rows = [rumps.MenuItem(f"row{i}") for i in range(8)]
            r = self.rows
            self.menu = [*r[:3], None, *r[3:5], None, *r[5:], None,
                         rumps.MenuItem("Open Log", callback=lambda _: subprocess.run(["open", "-a", "Console", LOG])),
                         rumps.MenuItem("Quit", callback=self.quit)]
            style(r[0], "Starting...", "", None)
            for row in r[1:]:
                style(row, "", "", None)
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
            self.title, rows = snapshot()
            for row, data in zip(self.rows, rows + [("", "", None)] * 8):
                style(row, *data)

        def quit(self, _):
            if self.child:
                self.child.terminate()
            rumps.quit_application()

    app = App()
    app.tick(None)
    app.run()


if __name__ == "__main__":
    main()
