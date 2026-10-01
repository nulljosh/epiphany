#!/usr/bin/env python3
"""Epiphany Live: a menu bar app for the IBKR practice account. No Terminal, no Dock icon.

The menu bar shows the account change since the first run. The menu shows our positions versus SPY, the best and
worst position, the record high and low, and when the daily trade runs next. It starts scripts/ibkr-live.py as a child (alerts, and the daily paper trade at 3:45pm New York,
12:45pm Pacific) and stops it on Quit. Demo accounts only. Start it from ~/Applications/Epiphany Live.app.

    uv run --with rumps --with ib_async python3 scripts/menubar.py            # the app
    uv run --with ib_async python3 scripts/menubar.py --selftest              # print what the menu would say
"""
import json, math, os, subprocess, sys, traceback, urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from ib_async import IB

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STATE = os.path.join(ROOT, "tradingview", "ibkr-state.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyIBKR.log")
BEST = os.path.join(ROOT, "tradingview", "ibkr-best.json")
# A file, not a flag in memory, so a pause survives a restart instead of quietly trading again.
PAUSED = os.path.join(ROOT, "tradingview", "ibkr-paused")


def read_json(path, default):
    """A missing or half-written file reads as the default instead of crashing every tick."""
    try:
        with open(path) as f:
            v = json.load(f)
        return v if isinstance(v, type(default)) else default
    except (OSError, ValueError):
        return default


def write_json(path, value):
    # Write then rename, so a crash mid-write never leaves a corrupt file behind.
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(value, f)
    os.replace(tmp, path)


def num(x):
    """IB reports NaN until market data arrives; treat that, None and junk as 0."""
    try:
        x = float(x)
    except (TypeError, ValueError):
        return 0.0
    return x if math.isfinite(x) else 0.0


def log(msg):
    try:
        with open(LOG, "a") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} menubar: {msg}\n")
    except OSError:
        pass


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
    """(title, header, rows) describing the account right now. A row is (label, value, number that colors the value)."""
    ib = IB()
    try:
        ib.connect("127.0.0.1", 4002, clientId=23, timeout=8)
        port = [p for p in ib.portfolio() if p.position]
        nl = next((num(v.value) for v in ib.accountSummary() if v.tag == "NetLiquidation" and v.currency != "BASE"), None)
    except Exception:
        return "!", "IB Gateway", [("Log in to IB Gateway", "", None)]
    finally:
        try:
            if ib.isConnected():
                ib.disconnect()
        except Exception:
            pass
    return summarize(port, nl, read_json(STATE, {}))


def summarize(port, nl, st):
    """The pure half of snapshot(): positions, net liquidation and runner state in, menu text out."""
    pnl = {id(p): num(p.unrealizedPNL) for p in port}
    cost = sum(num(p.averageCost) * num(p.position) for p in port)
    gain = sum(pnl.values())
    start = st.get("start") if isinstance(st.get("start"), dict) else {}
    d = nl - num(start["netLiquidation"]) if num(start.get("netLiquidation")) and nl is not None else 0.0
    try:
        spy = spy_price() / num(start["spy"]) - 1 if num(start.get("spy")) else 0.0
    except Exception:
        spy = 0.0
    # Own file, so it never races ibkr-live.py writing the state file.
    rec = read_json(BEST, {})
    rec = {"high": max(num(rec.get("high", d)), d), "low": min(num(rec.get("low", d)), d)}
    try:
        write_json(BEST, rec)
    except OSError as e:
        log(f"could not save record: {e}")
    rows = [
        ("Account", f"{money(d)} CAD", d),
        ("Holdings", pct(gain / cost if cost else 0.0), gain),
        ("SPY", pct(spy), spy),
    ]
    if port:
        ranked = sorted(port, key=lambda p: pnl[id(p)])
        for label, p in (("Best", ranked[-1]), ("Worst", ranked[0])):
            basis = num(p.averageCost) * num(p.position)
            u = pnl[id(p)]
            rows.append((f"{label} \u00b7 {p.contract.symbol}", f"{money(u)}   {pct(u / basis if basis else 0)}", u))
    else:
        rows += [("", "", None)] * 2  # keeps the slots lined up; empty rows are hidden
    rows += [
        ("High", money(rec["high"]), None),
        ("Low", money(rec["low"]), None),
        ("Next trade", "Paused" if os.path.exists(PAUSED) else next_trade(st), None),
    ]
    try:
        since = f"Since {datetime.fromisoformat(start['date']):%b %-d}"
    except (KeyError, TypeError, ValueError):
        since = "Since start"
    return f"{d:+.0f}".replace("-", "\u2212"), since, rows


def hide_gateway(seen=set()):
    """Hide the IB Gateway window once per Gateway launch; the menu bar is the UI. Needs Accessibility
    permission, which macOS asks for the first time. Without it the window just stays put."""
    try:
        pid = int(subprocess.run(["pgrep", "-f", "java.*ibc/config.ini"], capture_output=True, text=True).stdout.split()[0])
    except (IndexError, ValueError):
        return
    if pid in seen:
        return
    import ApplicationServices as AX
    if not AX.AXIsProcessTrustedWithOptions({AX.kAXTrustedCheckOptionPrompt: True}):
        return
    # Gateway is up a few seconds before its window; retry next tick until the hide lands.
    if AX.AXUIElementSetAttributeValue(AX.AXUIElementCreateApplication(pid), "AXHidden", True) == 0:
        seen.add(pid)


# Menu layout: (section header, rows in it). The first header is filled in with the start date.
GROUPS = [("", 3), ("Positions", 2), ("Record", 2), (None, 1)]


def row_view():
    """A non-clickable row: label left, value right in tabular digits. Full contrast on the glass,
    unlike a disabled menu item, and no hover highlight, since it isn't a button."""
    from AppKit import NSColor, NSFont, NSTextField, NSView, NSViewMinXMargin, NSViewWidthSizable, NSTextAlignmentRight
    size = NSFont.menuFontOfSize_(0).pointSize()
    v = NSView.alloc().initWithFrame_(((0, 0), (268, 22)))
    v.setAutoresizingMask_(NSViewWidthSizable)
    label = NSTextField.labelWithString_("")
    label.setFont_(NSFont.systemFontOfSize_(size))
    label.setTextColor_(NSColor.labelColor())
    label.setFrame_(((14, 3), (130, 16)))
    value = NSTextField.labelWithString_("")
    value.setFont_(NSFont.monospacedDigitSystemFontOfSize_weight_(size, 0.3))  # semibold
    value.setAlignment_(NSTextAlignmentRight)
    value.setFrame_(((116, 3), (138, 16)))
    value.setAutoresizingMask_(NSViewMinXMargin)
    v.addSubview_(label)
    v.addSubview_(value)
    return v, label, value


def ink(light, dark):
    """Deeper green and red on light glass, where the system ones wash out; the system ones on dark."""
    from AppKit import NSAppearanceNameAqua, NSAppearanceNameDarkAqua, NSColor
    light = NSColor.colorWithSRGBRed_green_blue_alpha_(*light, 1)
    return NSColor.colorWithName_dynamicProvider_(None, lambda ap: dark if ap.bestMatchFromAppearancesWithNames_(
        [NSAppearanceNameAqua, NSAppearanceNameDarkAqua]) == NSAppearanceNameDarkAqua else light)


def fill(item, fields, label, value, n):
    from AppKit import NSColor
    global UP, DOWN
    if "UP" not in globals():
        UP, DOWN = ink((0.0, 0.47, 0.2), NSColor.systemGreenColor()), ink((0.75, 0.08, 0.12), NSColor.systemRedColor())
    item.setHidden_(not label)
    fields[0].setStringValue_(label)
    fields[1].setStringValue_(value)
    fields[1].setTextColor_(NSColor.labelColor() if not n else UP if n > 0 else DOWN)


def main():
    if "--selftest" in sys.argv:
        t, since, rows = snapshot()
        print(t, "|", since)
        for label, value, _ in rows:
            print(f"  {label:<14}{value:>24}")
        return
    import rumps
    from AppKit import NSImage, NSMenuItem

    def symbol(item, name):
        item._menuitem.setImage_(NSImage.imageWithSystemSymbolName_accessibilityDescription_(name, None))
        return item

    class App(rumps.App):
        def __init__(self):
            super().__init__("Epiphany Live", title="..", icon=os.path.join(ROOT, "scripts", "menubar-icon.png"), template=True, quit_button=None)
            self.child = None
            try:
                self.ensure_runner()
            except Exception:
                log(traceback.format_exc())

        def build(self):
            # Built once rumps owns the NSMenu, so the native section headers and row views can go straight in.
            menu = self._menu._menu
            self.headers, self.rows = [], []
            for header, n in GROUPS:
                if self.headers or self.rows:
                    menu.addItem_(NSMenuItem.separatorItem())
                if header is not None:
                    h = NSMenuItem.sectionHeaderWithTitle_(header)
                    menu.addItem_(h)
                    self.headers.append((h, len(self.rows), n))
                for _ in range(n):
                    view, *fields = row_view()
                    item = NSMenuItem.alloc().init()
                    item.setView_(view)
                    menu.addItem_(item)
                    self.rows.append((item, fields))
            menu.addItem_(NSMenuItem.separatorItem())
            self.toggle = rumps.MenuItem("", callback=self.pause)
            self.menu = [self.toggle, symbol(rumps.MenuItem("Open Log", callback=lambda _: subprocess.run(["open", "-a", "Console", LOG])), "doc.text.magnifyingglass"),
                         symbol(rumps.MenuItem("Quit Epiphany Live", callback=self.quit, key="q"), "power")]
            fill(*self.rows[0], "Starting...", "", None)
            self.label_toggle()

        def label_toggle(self):
            paused = os.path.exists(PAUSED)
            self.toggle.title = "Resume Trading" if paused else "Pause Trading"
            symbol(self.toggle, "play.fill" if paused else "pause.fill")

        def pause(self, _):
            try:
                if os.path.exists(PAUSED):
                    os.remove(PAUSED)
                else:
                    open(PAUSED, "w").close()
                    subprocess.run(["pkill", "-f", "[i]bkr-live.py"])
                    self.child = None
                self.label_toggle()
            except Exception:
                log(traceback.format_exc())
            self.tick(None)

        def ensure_runner(self):
            if self.child and self.child.poll() is not None:
                log(f"runner exited with {self.child.returncode}, restarting")
                self.child = None  # reaped, so it doesn't linger as a zombie
            # The [i] keeps pgrep from matching its own command line. Start the runner if nothing is running it.
            if not os.path.exists(PAUSED) and subprocess.run(["pgrep", "-f", "[i]bkr-live.py"], capture_output=True).returncode != 0:
                out = open(LOG, "a")
                self.child = subprocess.Popen([os.path.expanduser("~/.local/bin/uv"), "run", "--quiet", "--with", "ib_async", "python3", "scripts/ibkr-live.py"], cwd=ROOT, stdout=out, stderr=out)

        @rumps.timer(60)
        def tick(self, _):
            # An exception escaping a timer can take the whole app down, so nothing gets past here.
            try:
                self.refresh()
            except Exception:
                log(traceback.format_exc())
                self.title = "!"
                if hasattr(self, "rows"):
                    fill(*self.rows[0], "Error, see Open Log", "", None)

        def refresh(self):
            if not hasattr(self, "rows"):
                self.build()
            self.ensure_runner()
            try:
                hide_gateway()
            except Exception:
                log(traceback.format_exc())
            self.title, since, rows = snapshot()
            rows = rows + [("", "", None)] * len(self.rows)
            for (item, fields), data in zip(self.rows, rows):
                fill(item, fields, *data)
            for i, (h, first, n) in enumerate(self.headers):
                h.setTitle_(since if i == 0 else GROUPS[i][0])
                h.setHidden_(not any(r[0] for r in rows[first:first + n]))

        def quit(self, _):
            if self.child:
                self.child.terminate()
            rumps.quit_application()

    app = App()
    app.tick(None)
    app.run()


if __name__ == "__main__":
    main()
