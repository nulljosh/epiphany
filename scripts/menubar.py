#!/usr/bin/env python3
"""Epiphany Live: a menu bar app for the IBKR practice account. No Terminal, no Dock icon.

The menu bar shows the holdings' return. The menu says one thing: are we beating the market, matching it or trailing it,
with a line or two on why (holdings against the S&P 500, the best or worst position, and what Trend 2x holds now).
Under that sit the phone watchlist, Pause/Resume, Open Log and Quit. It starts scripts/ibkr-live.py as a child (alerts, and
the daily paper trade at 3:45pm New York, 12:45pm Pacific) and stops it on Quit. Demo accounts only.
Start it from ~/Applications/Epiphany Live.app.

    uv run --with rumps --with ib_async python3 scripts/menubar.py            # the app
    uv run --with ib_async python3 scripts/menubar.py --selftest              # print what the menu would say
"""
import json, math, os, subprocess, sys, traceback, urllib.parse, urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from ib_async import IB

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STATE = os.path.join(ROOT, "tradingview", "ibkr-state.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyIBKR.log")
TREND = os.path.join(ROOT, "tradingview", "ibkr-trend.json")
# A file, not a flag in memory, so a pause survives a restart instead of quietly trading again.
PAUSED = os.path.join(ROOT, "tradingview", "ibkr-paused")
EDGE = os.path.join(ROOT, "tradingview", "edge-state.json")
EDGE_LOG = os.path.expanduser("~/Library/Logs/EpiphanyEdge.log")
CRYPTO_BOOK = os.path.join(ROOT, "tradingview", "crypto-paper.json")
EDGE_CRYPTO = os.path.join(ROOT, "tradingview", "edge-state-crypto.json")
CRYPTO_LOG = os.path.expanduser("~/Library/Logs/EpiphanyEdgeCrypto.log")


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


def sp500(start, entry=None):
    """The S&P 500's return (SPY) from the last close before `start` to now, one Yahoo call. Raises if Yahoo has nothing.
    With `entry`, the price we actually paid for SPY, it runs from there instead: our other buys filled mid morning,
    so measuring the market from the night before gives it a head start we never had to beat."""
    days = (datetime.now() - start).days
    rng = next(r for d, r in ((2, "5d"), (25, "1mo"), (85, "3mo"), (175, "6mo"), (355, "1y"), (720, "2y"), (math.inf, "5y")) if days <= d)
    d = yahoo(f"/v8/finance/spark?symbols=SPY&range={rng}&interval=1d")["SPY"]
    before = [c for t, c in zip(d["timestamp"], d["close"]) if c and datetime.fromtimestamp(t, timezone.utc).date() < start.date()]
    # Yahoo sometimes blanks today's bar after the close; its live price still has today, the last close doesn't.
    now = num(d.get("fulldayPrice")) or next(c for c in reversed(d["close"]) if c)
    return now / (entry or before[-1]) - 1


def spy_at(when):
    """SPY's price at `when` (local, naive, as the runner logs it), from 5 minute bars. None if Yahoo has nothing,
    so the caller falls back to the prior close. Yahoo keeps 5 minute bars for about a month."""
    try:
        d = yahoo("/v8/finance/chart/SPY?interval=5m&range=1mo")["chart"]["result"][0]
        t = when.astimezone().timestamp()
        bars = [c for ts, c in zip(d["timestamp"], d["indicators"]["quote"][0]["close"]) if c and ts <= t]
        return bars[-1] if bars else None
    except Exception:
        return None


SLEEVE = 1000.0  # the paper account: 10% of a virtual $10,000, same as the app's crypto autopilot


def btc_above(price):
    """BTC against its 100 day average (today's price standing in for today's bar), one Yahoo call."""
    d = yahoo("/v8/finance/chart/BTC-USD?interval=1d&range=1y")["chart"]["result"][0]
    closes = [c for c in d["indicators"]["quote"][0]["close"] if c]
    return price > sum((closes[:-1] + [price])[-100:]) / 100


def crypto_step(st, btc, spy, today):
    """The weekend paper trader. Crypto never closes, so this runs every tick, any day. Once per UTC day it asks
    whether BTC is above its 100 day average: yes means all-in on BTC, no means cash. Same rule as the app's
    crypto autopilot. The start prices of BTC and SPY are kept so the row can compare against both."""
    if not st:
        st = {"start": {"date": datetime.now().isoformat(timespec="minutes"), "btc": btc, "spy": spy}, "cash": SLEEVE, "qty": 0.0, "day": ""}
    if st["day"] != today:
        up = btc_above(btc)
        if up and st["qty"] == 0:
            st["qty"], st["cash"] = st["cash"] / btc, 0.0
        elif not up and st["qty"] > 0:
            st["cash"], st["qty"] = st["qty"] * btc, 0.0
        st["day"] = today
    return st


def crypto_row(st, btc, spy):
    """(text, color number) for the menu: the paper trader, buy-and-hold BTC and the S&P, all since the start."""
    ours = (st["cash"] + st["qty"] * btc) / SLEEVE - 1
    hold, mkt = btc / st["start"]["btc"] - 1, spy / st["start"]["spy"] - 1
    began = datetime.fromisoformat(st["start"]["date"])
    return f"Crypto paper {pct(ours)} vs BTC {pct(hold)} vs S&P {pct(mkt)} since {began:%b} {began.day}", SIGN[verdict(ours, mkt)]


# How far ahead of SPY, in points of return, counts as really beating it. Inside the band is a tie.
EVEN = (-0.001, 0.0025)


def verdict(ours, spy):
    """'up' if the holdings beat SPY by more than a hair, 'down' if they trail it, 'even' in between."""
    d = ours - spy
    return "up" if d > EVEN[1] else "down" if d < EVEN[0] else "even"


def pct(x):
    return f"{x:+.2%}".replace("-", "\u2212")


def lead_title(v, d):
    """The menu bar title: are we beating the S&P or trailing it, and by how many points. `d` is holdings minus S&P."""
    return {"up": "Beating", "down": "Trailing"}[v] + f" {abs(d):.2%}" if v != "even" else f"Even {pct(d)}"


GATEWAY = os.path.expanduser("~/ibc/gatewaystartmacos.sh")
WINDOW = ((15, 30), (16, 15))  # New York time, weekdays: Gateway wakes before the 3:45pm trade and sleeps after


def gateway_up():
    return subprocess.run(["pgrep", "-f", "[b]in/java .*ibc/config.ini"], capture_output=True).returncode == 0


def in_window(now=None):
    now = now or datetime.now(ZoneInfo("America/New_York"))
    return now.weekday() < 5 and WINDOW[0] <= (now.hour, now.minute) < WINDOW[1]


def ensure_gateway(force=False):
    """Gateway never opens at login. The menu bar starts it inside the trade window (unless paused) or on request.
    -inline keeps it out of Terminal; a new session lets it outlive this app."""
    if gateway_up() or not (force or (in_window() and not os.path.exists(PAUSED))):
        return
    subprocess.Popen(["/bin/bash", GATEWAY, "-inline"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def snapshot():
    """(title, rows, verdict) describing the account right now. A row is (text, number that colors it)."""
    if not gateway_up():
        return "Idle", [("IB Gateway is off until 3:30pm New York", None), ("", None), ("", None), ("", None)], None
    ib = IB()
    try:
        ib.connect("127.0.0.1", 4002, clientId=23, timeout=8)
        port = [p for p in ib.portfolio() if p.position]
    except Exception:
        return "!", [("Log in to IB Gateway", None)], None
    finally:
        try:
            if ib.isConnected():
                ib.disconnect()
        except Exception:
            pass
    return summarize(port, read_json(STATE, {}), read_json(TREND, {}))


VERDICT = {"up": "Beating the market", "even": "Matching the market", "down": "Trailing the market"}
SIGN = {"up": 1, "even": 0, "down": -1}


def trend_row(mst):
    """What Trend 2x holds now, or None when its state file is missing or not usable yet."""
    held = mst.get("holdings") if isinstance(mst.get("holdings"), dict) else {}
    if held.get("SSO"):
        return "Trend 2x: holding 2x S&P"
    if held.get("BIL"):
        return "Trend 2x: in T-bills, S&P below its 200-day"
    return None


def closed(orders, held):
    """(gain, cost) of positions the runner bought and fully sold, from its order ledger. Without this a sale
    drops out of the score along with its profit or loss. Symbols still held are left to the live positions."""
    by = {}
    for o in orders if isinstance(orders, list) else []:
        if not isinstance(o, dict) or o.get("status") != "Filled" or o.get("symbol") in ("SSO", "BIL") or o.get("symbol") in held:
            continue
        cash = num(o.get("qty")) * num(o.get("fill"))
        q, b, s = by.get(o.get("symbol"), (0.0, 0.0, 0.0))
        by[o.get("symbol")] = (q + num(o.get("qty")), b + cash, s) if o.get("side") == "buy" else (q - num(o.get("qty")), b, s + cash)
    # ponytail: whole round trips only, which is how the runner sells; a partial sale waits until the rest goes
    done = [(b, s) for q, b, s in by.values() if q == 0 and b]
    return sum(s - b for b, s in done), sum(b for b, _ in done)


def summarize(port, st, mst):
    """The pure half of snapshot(): positions, runner state and Trend 2x state in, menu text out.
    Rows: the verdict, up to two why rows, then the Trend 2x row. Empty text means hidden.
    The Trend 2x sleeve (SSO, BIL) stays out of the scoreboard: it is $100k that arrives at 3:45pm New York, so it
    would swamp the day's Double 7s buys with a position that has had no time to move. It has its own row."""
    port = [p for p in port if p.contract.symbol not in ("SSO", "BIL")]
    gain, basis = closed(st.get("orders"), {p.contract.symbol for p in port})
    cost = sum(num(p.averageCost) * num(p.position) for p in port) + basis
    ours = (sum(num(p.unrealizedPNL) for p in port) + gain) / cost if cost else 0.0
    start = st.get("start") if isinstance(st.get("start"), dict) else {}
    # Until the S&P comparison arrives the title is the holdings' return, not the account's: most of the million
    # sits in cash, so the account moves +0.00% forever. With it, the title is the lead over the S&P.
    title = pct(ours)
    trend = trend_row(mst)
    rows = [("No trades yet", None), ("", None), ("", None), (trend or "", None)]
    if not port:
        return title, rows, None
    try:
        began = datetime.fromisoformat(start["date"])
        # Our own SPY lot is the cleanest record of where the market stood when we bought.
        entry = next((num(p.averageCost) for p in port if p.contract.symbol == "SPY" and num(p.averageCost) > 0), None)
        if not entry:  # no SPY lot: measure the market from when our first buy filled, not from the night before
            first = min((o["date"] for o in st.get("orders", []) if isinstance(o, dict) and o.get("status") == "Filled" and o.get("symbol") not in ("SSO", "BIL") and o.get("date")), default=None)
            entry = spy_at(datetime.fromisoformat(first)) if first else None
        spy = sp500(began, entry)
        since = f" since {began:%b} {began.day}"
    except Exception:  # Yahoo down, or no start date yet: no comparison, so no verdict
        rows[0] = ("Market data unavailable", None)
        return title, rows, None
    v = verdict(ours, spy)
    title = lead_title(v, ours - spy)
    rows[0] = (VERDICT[v], SIGN[v])
    rows[1] = (f"Holdings {pct(ours)} vs S&P 500 {pct(spy)}{since}", None)
    ranked = sorted(port, key=lambda p: num(p.unrealizedPNL) / ((num(p.averageCost) * num(p.position)) or 1))
    pick, word = (ranked[0], "drags") if v == "down" else (ranked[-1], "leads")
    basis = num(pick.averageCost) * num(pick.position)
    r = num(pick.unrealizedPNL) / basis if basis else 0.0
    rows[2] = (f"{pick.contract.symbol} {word}, {'up' if r >= 0 else 'down'} {abs(r):.2%}", None)
    return title, rows, v


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


def row_view(big=False):
    """A non-clickable row of plain text. Full contrast on the glass, unlike a disabled menu item,
    and no hover highlight, since it isn't a button. The verdict row is bigger and bolder."""
    from AppKit import NSFont, NSTextField, NSView, NSViewWidthSizable
    size = NSFont.menuFontOfSize_(0).pointSize()
    h = 30 if big else 22
    v = NSView.alloc().initWithFrame_(((0, 0), (360, h)))
    v.setAutoresizingMask_(NSViewWidthSizable)
    label = NSTextField.labelWithString_("")
    label.setFont_(NSFont.systemFontOfSize_weight_(size + 5, 0.5) if big else NSFont.systemFontOfSize_(size))
    label.setFrame_(((14, 4 if big else 3), (336, 22 if big else 16)))
    v.addSubview_(label)
    return v, label


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


def fill(item, label, text, n=None):
    """Set a row's text. n colors it: positive green, negative red, zero plain. None is the quieter secondary color."""
    from AppKit import NSColor
    global UP, DOWN
    if "UP" not in globals():
        UP, DOWN = ink((0.0, 0.47, 0.2), NSColor.systemGreenColor()), ink((0.75, 0.08, 0.12), NSColor.systemRedColor())
    item.setHidden_(not text)
    label.setStringValue_(text)
    label.setTextColor_(NSColor.secondaryLabelColor() if n is None else NSColor.labelColor() if n == 0 else UP if n > 0 else DOWN)


def main():
    if "--selftest" in sys.argv:
        t, rows, v = snapshot()
        print(t, "|", v)
        for text, _ in rows:
            if text:
                print(f"  {text}")
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
            # Built once rumps owns the NSMenu, so the row views can go straight in.
            menu = self._menu._menu
            self.rows = []
            for big in (True, False, False, False, False):
                view, label = row_view(big)
                item = NSMenuItem.alloc().init()
                item.setView_(view)
                menu.addItem_(item)
                self.rows.append((item, label))
            menu.addItem_(NSMenuItem.separatorItem())
            self.watch = symbol(rumps.MenuItem("Watchlist"), "list.bullet")
            for sym in WATCH:
                self.watch.add(rumps.MenuItem(sym))
            self.toggle = rumps.MenuItem("", callback=self.pause)
            open_edge = lambda _: subprocess.run(["open", "-a", "Console", EDGE_LOG])
            self.edge = symbol(rumps.MenuItem("Edge search: starting", callback=open_edge), "flask")
            self.gateway = symbol(rumps.MenuItem("Start IB Gateway", callback=lambda _: ensure_gateway(True)), "bolt.fill")
            self.crypto = symbol(rumps.MenuItem("Crypto search: starting", callback=lambda _: subprocess.run(["open", "-a", "Console", CRYPTO_LOG])), "bitcoinsign.circle")
            self.menu = [self.watch, self.toggle, self.gateway, symbol(rumps.MenuItem("Open Log", callback=lambda _: subprocess.run(["open", "-a", "Console", LOG])), "doc.text.magnifyingglass"),
                         self.edge, self.crypto,
                         symbol(rumps.MenuItem("Quit Epiphany Live", callback=self.quit, key="q"), "power")]
            fill(*self.rows[0], "Starting...", 0)
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
                self.child = subprocess.Popen([os.path.expanduser("~/.local/bin/uv"), "run", "--quiet", "--with", "ib_async", "python3", "scripts/ibkr-live.py"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=out)  # note() already writes the log; stderr keeps crashes

        def ensure_edge(self):
            # Two searches, same engine: ETFs, and a crypto basket on its own state so each bar stays honest.
            uv = os.path.expanduser("~/.local/bin/uv")
            for pat, args, log in (("[e]dge-search.py$", [], EDGE_LOG), ("[e]dge-search.py --crypto", ["--crypto"], CRYPTO_LOG)):
                if subprocess.run(["pgrep", "-f", pat], capture_output=True).returncode != 0:
                    subprocess.Popen([uv, "run", "--quiet", "--with", "numpy", "python3", "scripts/edge-search.py", *args], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=open(log, "a"))

        def paint_edge(self):
            for item, path, name in ((self.edge, EDGE, "Edge search"), (self.crypto, EDGE_CRYPTO, "Crypto search")):
                try:
                    st = json.load(open(path))
                except Exception:
                    item.title = f"{name}: warming up"
                    continue
                n = len(st["leads"])
                item.title = f"{name}: {n} lead{'' if n == 1 else 's'}, see log" if n else f"{name}: {st['trials']:,} tried, none beat the S&P"

        @rumps.timer(60)
        def tick(self, _):
            # An exception escaping a timer can take the whole app down, so nothing gets past here.
            try:
                self.refresh()
            except Exception:
                log(traceback.format_exc())
                self.title = "!"
                if hasattr(self, "rows"):
                    fill(*self.rows[0], "Error, see Open Log", -1)

        def refresh(self):
            if not hasattr(self, "rows"):
                self.build()
            self.ensure_runner()
            try:
                self.ensure_edge()
                self.paint_edge()
            except Exception:
                log(traceback.format_exc())
            try:
                ensure_gateway()
                hide_gateway()
            except Exception:
                log(traceback.format_exc())
            self.title, rows, v = snapshot()
            self.paint(v)
            for (item, label), (text, n) in zip(self.rows, rows + [("", None)] * len(self.rows)):
                fill(item, label, text, n)
            try:
                quotes = watch_quotes()
            except Exception:  # Yahoo down: dashes, not a crash
                quotes = {}
            for sym in WATCH:
                self.watch[sym].title = watch_line(sym, quotes.get(sym))
            try:
                if "BTC-USD" in quotes and "SPY" in quotes:
                    btc, spy = quotes["BTC-USD"][0], quotes["SPY"][0]
                    st = crypto_step(read_json(CRYPTO_BOOK, {}), btc, spy, datetime.now(timezone.utc).date().isoformat())
                    write_json(CRYPTO_BOOK, st)
                    fill(*self.rows[4], *crypto_row(st, btc, spy))
            except Exception:
                log(traceback.format_exc())

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
            subprocess.run(["pkill", "-f", "[e]dge-search.py"])
            rumps.quit_application()

    app = App()
    app.tick(None)
    app.run()


if __name__ == "__main__":
    main()
