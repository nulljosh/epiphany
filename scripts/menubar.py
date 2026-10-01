#!/usr/bin/env python3
"""Epiphany Live: a menu bar app for the IBKR practice account. No Terminal, no Dock icon.

The menu bar shows the holdings' return. The menu shows our holdings against the S&P 500, the 16 funds we pick from, the Nasdaq, Dow,
Russell 2000, TSX, gold and Bitcoin, the best and
worst position, the record high and low, and when the daily trade runs next. It starts scripts/ibkr-live.py as a child (alerts, and the daily paper trade at 3:45pm New York,
12:45pm Pacific) and stops it on Quit. Demo accounts only. Start it from ~/Applications/Epiphany Live.app.

    uv run --with rumps --with ib_async python3 scripts/menubar.py            # the app
    uv run --with ib_async python3 scripts/menubar.py --selftest              # print what the menu would say
"""
import json, math, os, subprocess, sys, traceback, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from ib_async import IB

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STATE = os.path.join(ROOT, "tradingview", "ibkr-state.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyIBKR.log")
MOM = os.path.join(ROOT, "tradingview", "ibkr-momentum.json")
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


def yahoo(path):
    req = urllib.request.Request("https://query1.finance.yahoo.com" + path, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=5))


def intraday(sym):
    """Today's 5 minute closes and yesterday's close for one symbol."""
    r = yahoo(f"/v8/finance/chart/{sym}?interval=5m&range=1d")["chart"]["result"][0]
    return [c for c in r["indicators"]["quote"][0]["close"] if c is not None], num(r["meta"].get("chartPreviousClose"))


# Joshua's iPhone Stocks list, in his order.
WATCH = ["KODK", "DUOL", "IBM", "RL", "SHOO", "PLTR", "IGV", "BTC-USD", "SI=F", "NVDA", "NET", "SBUX", "^XAX", "GC=F",
         "IAU", "^RUT", "^NDX", "^GSPC", "SPY", "^NYA", "KO", "^DJI", "^IXIC", "CADUSD=X", "XIC.TO", "^GSPTSE",
         "T", "GS", "HG=F", "AAPL", "NKE", "HOOD", "GOOGL", "SPCX", "NG=F", "DIS"]


def watch_quotes(syms=WATCH):
    """{symbol: (price, day change %)} from Yahoo's batch spark endpoint, 20 symbols a call."""
    out = {}
    for i in range(0, len(syms), 20):
        q = urllib.parse.quote(",".join(syms[i:i + 20]))
        for sym, d in yahoo(f"/v8/finance/spark?symbols={q}&range=1d&interval=1d").items():
            if d and d.get("fulldayPrice") is not None:
                out[sym] = (num(d["fulldayPrice"]), num(d.get("fulldayChangePercent")) / 100)
    return out


def watch_line(sym, quote):
    """One watchlist row: symbol, price, day change. Missing quote reads as a dash, not a crash."""
    if not quote:
        return f"{sym}  \u2014"
    price, ch = quote
    return f"{sym}  {price:,.4f}  {pct(ch)}" if price < 1 else f"{sym}  {price:,.2f}  {pct(ch)}"  # currency pairs need the extra digits


# ibkr-run.py's 16 funds: the basket Double 7s picks from. Holding all of them equally is the fair test of the picking.
ETFS = ["SPY", "QQQ", "DIA", "IWM", "MDY", "EFA", "EEM", "XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]
BENCH = [("S&P 500", "SPY"), ("All 16 funds", None), ("Nasdaq 100", "QQQ"), ("Dow", "DIA"), ("Russell 2000", "IWM"),
         ("TSX", "XIC.TO"), ("Gold", "GLD"), ("Bitcoin", "BTC-USD")]


def benchmarks(start):
    """{label: return from the last close before `start` to now}, in BENCH order, one Yahoo call. A missing symbol is left out."""
    days = (datetime.now() - start).days
    rng = next(r for d, r in ((2, "5d"), (25, "1mo"), (85, "3mo"), (175, "6mo"), (355, "1y"), (720, "2y"), (math.inf, "5y")) if days <= d)
    syms = ",".join(sorted(set(ETFS) | {s for _, s in BENCH if s}))
    ret = {}
    for sym, d in yahoo(f"/v8/finance/spark?symbols={urllib.parse.quote(syms)}&range={rng}&interval=1d").items():
        try:
            before = [c for t, c in zip(d["timestamp"], d["close"]) if c and datetime.fromtimestamp(t, timezone.utc).date() < start.date()]
            ret[sym] = next(c for c in reversed(d["close"]) if c) / before[-1] - 1
        except (KeyError, TypeError, IndexError, StopIteration, ZeroDivisionError):
            pass
    if all(s in ret for s in ETFS):
        ret[None] = sum(ret[s] for s in ETFS) / len(ETFS)
    return {name: ret[s] for name, s in BENCH if s in ret}


def safe(f, *a):
    """f(*a), or None if it raises."""
    try:
        return f(*a)
    except Exception:
        return None


def top_gainer():
    """The biggest US stock gainer today, or None."""
    try:
        return yahoo("/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=1")["finance"]["result"][0]["quotes"][0]["symbol"]
    except Exception:
        return None


def chart_symbols(rows):
    """(symbol, label) for SPY, today's top gainer, then the best and worst holding, each once."""
    out, g = {"SPY": "SPY"}, top_gainer()
    if g:
        out.setdefault(g, f"{g} \u00b7 Top gainer")
    for r in rows:
        if " \u00b7 " in r[0]:
            sym = r[0].split(" \u00b7 ")[1]
            out.setdefault(sym, sym)
    return list(out.items())[:4]


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


def next_rebalance(mst, now=None):
    """When ibkr-live.py rebalances the momentum sleeve: the first weekday at or after 3:45pm New York in a month it has not run."""
    ny = now or datetime.now(ZoneInfo("America/New_York"))
    run = ny.replace(hour=15, minute=45, second=0, microsecond=0)
    if mst.get("lastRebalance") == f"{ny:%Y-%m}":
        run = (run.replace(day=1) + timedelta(days=32)).replace(day=1)
    elif ny.weekday() < 5 and ny >= run:
        return "Now"
    while run.weekday() >= 5:
        run += timedelta(days=1)
    t = run.astimezone()
    return f"Today {t:%-I:%M %p}" if t.date() == datetime.now().date() else f"{t:%b %-d}"


def momentum_rows(port, mst):
    """Two rows for the momentum sleeve: its return since its start against the S&P 500, and the next rebalance.
    No state file, or one that is not usable yet, gives two empty rows (hidden)."""
    empty = [("", "", None)] * 2
    try:
        start = mst["start"]
        base = num(start["sleeve"])
        if not base:
            return empty
        px = {p.contract.symbol: num(getattr(p, "marketPrice", 0)) for p in port}
        last = mst.get("last", {}) if isinstance(mst.get("last"), dict) else {}
        value = num(mst.get("cash")) + sum(num(q) * (px.get(s) or num(last.get(s))) for s, q in mst.get("holdings", {}).items())
        ret = value / base - 1
    except (KeyError, TypeError, AttributeError):
        return empty
    try:
        spy = benchmarks(datetime.fromisoformat(start["date"])).get("S&P 500")
    except Exception:
        spy = None
    lead = ret - spy if spy is not None else None
    return [(f"Momentum  {pct(ret)}", "" if lead is None else f"{'ahead' if lead >= 0 else 'behind'} {abs(lead):.2%}", ret if lead is None else lead),
            ("Next rebalance", next_rebalance(mst), None)]


# How far ahead of SPY, in points of return, counts as really beating it. Inside the band is a tie.
EVEN = (-0.001, 0.0025)


def verdict(ours, spy):
    """'up' if the holdings beat SPY by more than a hair, 'down' if they trail it, 'even' in between."""
    d = ours - spy
    return "up" if d > EVEN[1] else "down" if d < EVEN[0] else "even"


def money(x):
    return f"{x:+,.2f}".replace("-", "\u2212")


def pct(x):
    return f"{x:+.2%}".replace("-", "\u2212")


def snapshot():
    """(title, header, rows, verdict) describing the account right now. A row is (label, value, number that colors the value)."""
    ib = IB()
    try:
        ib.connect("127.0.0.1", 4002, clientId=23, timeout=8)
        port = [p for p in ib.portfolio() if p.position]
        nl = next((num(v.value) for v in ib.accountSummary() if v.tag == "NetLiquidation" and v.currency != "BASE"), None)
    except Exception:
        return "!", "IB Gateway", [("Log in to IB Gateway", "", None)], None
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
        bench = benchmarks(datetime.fromisoformat(start["date"]))
    except Exception:
        bench = {}
    spy = bench.get("S&P 500", 0.0)
    ours = gain / cost if cost else 0.0
    # Own file, so it never races ibkr-live.py writing the state file.
    rec = read_json(BEST, {})
    rec = {"high": max(num(rec.get("high", d)), d), "low": min(num(rec.get("low", d)), d)}
    try:
        write_json(BEST, rec)
    except OSError as e:
        log(f"could not save record: {e}")
    rows = [
        ("Account", f"{money(d)} CAD", d),
        ("Holdings", pct(ours), gain),
    ]
    # Each benchmark's return since the start, and how far our holdings are ahead of it or behind it.
    for name, r in bench.items():
        lead = ours - r
        rows.append((f"{name}  {pct(r)}", f"{'ahead' if lead >= 0 else 'behind'} {abs(lead):.2%}" if port else "", lead))
    rows += [("", "", None)] * (len(BENCH) - len(bench))
    if port:
        ranked = sorted(port, key=lambda p: pnl[id(p)])
        for label, p in (("Best", ranked[-1]), ("Worst", ranked[0])):
            basis = num(p.averageCost) * num(p.position)
            u = pnl[id(p)]
            rows.append((f"{label} \u00b7 {p.contract.symbol}", f"{money(u)}   {pct(u / basis if basis else 0)}", u))
    else:
        rows += [("", "", None)] * 2  # keeps the slots lined up; empty rows are hidden
    rows += momentum_rows(port, read_json(MOM, {}))
    rows += [
        ("High / Low", f"{rec['high']:+,.0f} / {rec['low']:+,.0f}".replace("-", "\u2212"), None),
        ("Next trade", "Paused" if os.path.exists(PAUSED) else next_trade(st), None),
    ]
    try:
        since = f"Since {datetime.fromisoformat(start['date']):%b %-d}"
    except (KeyError, TypeError, ValueError):
        since = "Since start"
    # The title is the holdings' return, not the account's: most of the million sits in cash, so the account
    # moves +0.00% forever. This is the strategy's score, and the benchmark rows line up against it.
    return pct(ours), since, rows, verdict(ours, spy) if port else None


def hide_gateway(seen=set()):
    """Hide the IB Gateway window once per Gateway launch; the menu bar is the UI. Needs Accessibility
    permission, which macOS asks for the first time. Without it the window just stays put."""
    try:
        pid = int(subprocess.run(["pgrep", "-f", "[b]in/java .*ibc/config.ini"], capture_output=True, text=True).stdout.split()[0])
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
GROUPS = [("", 2), ("Vs the market", len(BENCH)), ("Positions", 2), ("Momentum", 2), ("Record", 1), (None, 1)]


def row_view():
    """A non-clickable row: label left, value right in tabular digits. Full contrast on the glass,
    unlike a disabled menu item, and no hover highlight, since it isn't a button."""
    from AppKit import NSColor, NSFont, NSTextField, NSView, NSViewMinXMargin, NSViewWidthSizable, NSTextAlignmentRight
    size = NSFont.menuFontOfSize_(0).pointSize()
    v = NSView.alloc().initWithFrame_(((0, 0), (290, 22)))
    v.setAutoresizingMask_(NSViewWidthSizable)
    label = NSTextField.labelWithString_("")
    label.setFont_(NSFont.systemFontOfSize_(size))
    label.setTextColor_(NSColor.labelColor())
    label.setFrame_(((14, 3), (160, 16)))
    value = NSTextField.labelWithString_("")
    value.setFont_(NSFont.monospacedDigitSystemFontOfSize_weight_(size, 0.3))  # semibold
    value.setAlignment_(NSTextAlignmentRight)
    value.setFrame_(((150, 3), (126, 16)))
    value.setAutoresizingMask_(NSViewMinXMargin)
    v.addSubview_(label)
    v.addSubview_(value)
    return v, label, value


def chart_view():
    """A row with the symbol and today's move on top and today's line under it."""
    from AppKit import NSImageView
    v, label, value = row_view()
    v.setFrameSize_((290, 46))
    label.setFrameOrigin_((14, 27))
    value.setFrameOrigin_((150, 27))
    img = NSImageView.alloc().initWithFrame_(((14, 5), (240, 20)))
    v.addSubview_(img)
    return v, label, value, img


def spark(closes, prev, color, w=240, h=20):
    """Today's line against a dotted line at yesterday's close. The x axis is the whole session (78 five
    minute bars), so at noon the line stops halfway across."""
    from AppKit import NSBezierPath, NSColor, NSImage
    lo, hi = min(closes + [prev]), max(closes + [prev])
    y = lambda v: 1.5 + (v - lo) / ((hi - lo) or 1) * (h - 3)

    def draw(_):
        base = NSBezierPath.bezierPath()
        base.moveToPoint_((0, y(prev)))
        base.lineToPoint_((w, y(prev)))
        base.setLineDash_count_phase_([1, 3], 2, 0)
        NSColor.tertiaryLabelColor().set()
        base.stroke()
        line = NSBezierPath.bezierPath()
        line.setLineWidth_(1.5)
        line.setLineJoinStyle_(1)  # round
        for i, c in enumerate(closes):
            (line.lineToPoint_ if i else line.moveToPoint_)((min(i, 77) * (w - 1) / 77, y(c)))
        color.set()
        line.stroke()
        return True
    return NSImage.imageWithSize_flipped_drawingHandler_((w, h), False, draw)


def tinted(icon, color):
    """The template icon filled with one color. Drawn at display time, so system colors follow the menu bar."""
    from AppKit import NSCompositingOperationSourceAtop, NSImage, NSRectFillUsingOperation
    def draw(rect):
        icon.drawInRect_(rect)
        color.set()
        NSRectFillUsingOperation(rect, NSCompositingOperationSourceAtop)
        return True
    return NSImage.imageWithSize_flipped_drawingHandler_(icon.size(), False, draw)


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
        t, since, rows, v = snapshot()
        print(t, "|", since, "|", v)
        for label, value, _ in rows:
            print(f"  {label:<14}{value:>24}")
        return
    # One copy only. Exit 0 so the launcher's restart loop ends instead of stacking a second icon.
    import fcntl
    global LOCK
    LOCK = open(os.path.join(ROOT, "tradingview", "menubar.lock"), "w")
    try:
        fcntl.flock(LOCK, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log("already running, exiting")
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
            self.plain = self._icon_nsimage
            try:
                self.ensure_runner()
            except Exception:
                log(traceback.format_exc())

        def build(self):
            # Built once rumps owns the NSMenu, so the native section headers and row views can go straight in.
            menu = self._menu._menu
            self.headers, self.rows, self.charts = [], [], []
            menu.addItem_(NSMenuItem.sectionHeaderWithTitle_("Today"))
            for _ in range(4):
                view, *fields = chart_view()
                item = NSMenuItem.alloc().init()
                item.setView_(view)
                item.setHidden_(True)
                menu.addItem_(item)
                self.charts.append((item, fields))
            menu.addItem_(NSMenuItem.separatorItem())
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
            self.watch = symbol(rumps.MenuItem("Watchlist"), "list.bullet")
            for sym in WATCH:
                self.watch.add(rumps.MenuItem(sym))
            self.toggle = rumps.MenuItem("", callback=self.pause)
            self.menu = [self.watch, self.toggle, symbol(rumps.MenuItem("Open Log", callback=lambda _: subprocess.run(["open", "-a", "Console", LOG])), "doc.text.magnifyingglass"),
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
            self.title, since, rows, v = snapshot()
            self.paint(v)
            rows = rows + [("", "", None)] * len(self.rows)
            for (item, fields), data in zip(self.rows, rows):
                fill(item, fields, *data)
            for i, (h, first, n) in enumerate(self.headers):
                h.setTitle_(since if i == 0 else GROUPS[i][0])
                h.setHidden_(not any(r[0] for r in rows[first:first + n]))
            quotes = safe(watch_quotes) or {}
            for sym in WATCH:
                self.watch[sym].title = watch_line(sym, quotes.get(sym))
            syms = chart_symbols(rows)
            # In parallel, so four slow fetches freeze the menu for one timeout, not four.
            with ThreadPoolExecutor(4) as ex:
                data = list(ex.map(lambda s: safe(intraday, s[0]), syms))
            for i, (item, fields) in enumerate(self.charts):
                try:
                    (_, name), (closes, prev) = syms[i], data[i]
                    ch = closes[-1] / prev - 1
                except Exception:  # no symbol, no data yet, or Yahoo down: hide the row
                    fill(item, fields[:2], "", "", None)
                    continue
                fill(item, fields[:2], name, pct(ch), ch)
                fields[2].setImage_(spark(closes, prev, UP if ch >= 0 else DOWN))

        def paint(self, v):
            """Green when we beat SPY, yellow when we're level with it, red when we trail. Plain when unknown."""
            from AppKit import NSColor
            color = {"up": NSColor.systemGreenColor(), "even": NSColor.systemYellowColor(), "down": NSColor.systemRedColor()}.get(v)
            self._icon_nsimage = tinted(self.plain, color) if color else self.plain
            if hasattr(self, "_nsapp"):
                self._nsapp.setStatusBarIcon()

        def quit(self, _):
            if self.child:
                self.child.terminate()
            rumps.quit_application()

    app = App()
    app.tick(None)
    app.run()


if __name__ == "__main__":
    main()
