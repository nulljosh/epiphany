#!/usr/bin/env python3
"""Daily close alerts for one stock: a macOS notification when a hold, sell or buy-more rule hits. Read only,
standard library only, never places orders. The ANT rules are in WHITEPAPER.md (Case: ANT).

    python3 scripts/close-alert.py ANT --below 83 --above 97.17 --base-high 90            # check the last close
    python3 scripts/close-alert.py ANT --below 83 --above 97.17 --base-high 90 --test     # same, plus a test notification
    python3 scripts/close-alert.py ANT --below 83 --above 97.17 --base-high 90 --install  # run it every weekday after the close

Rules, on completed daily closes only:
  sell      the last --days closes (default 2) are all below --below
  buy       the last close is above --above on more volume than the average day before it
  base      the last --base-days closes (default 5) all sit between --below and --base-high
Each rule notifies once per trading day. --install writes a launchd job for this Mac's paths that runs weekdays at
4:30pm New York, after the close; --uninstall removes it. Logs to ~/Library/Logs/EpiphanyCloseAlert.log.
"""
import argparse, json, os, plistlib, subprocess, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ap = argparse.ArgumentParser()
ap.add_argument("symbol")
ap.add_argument("--below", type=float, required=True, help="sell line (the floor)")
ap.add_argument("--above", type=float, required=True, help="buy-more line")
ap.add_argument("--days", type=int, default=2, help="closes in a row under --below before the sell rule hits")
ap.add_argument("--base-high", type=float, help="top of the base range; leave out to skip the base rule")
ap.add_argument("--base-days", type=int, default=5)
ap.add_argument("--test", action="store_true", help="also send a test notification")
ap.add_argument("--install", action="store_true")
ap.add_argument("--uninstall", action="store_true")
a = ap.parse_args()

SYM = a.symbol.upper()
ET = ZoneInfo("America/New_York")
LABEL = f"com.heyitsmejosh.close-alert-{SYM.lower()}"
AGENT = os.path.expanduser(f"~/Library/LaunchAgents/{LABEL}.plist")
STATE = os.path.expanduser(f"~/Library/Application Support/Epiphany/close-alert-{SYM}.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyCloseAlert.log")


def log(msg):
    line = f"{datetime.now():%F %R} {msg}"
    print(line, flush=True)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def notify(title, msg):
    script = f"display notification {json.dumps(msg)} with title {json.dumps(title)} sound name \"Glass\""
    subprocess.run(["osascript", "-e", script], check=False)


if a.install or a.uninstall:
    subprocess.run(["launchctl", "bootout", f"gui/{os.getuid()}/{LABEL}"], capture_output=True)
    if a.uninstall:
        if os.path.exists(AGENT):
            os.remove(AGENT)
        sys.exit(f"removed {LABEL}")
    # 4:30pm New York, written in this Mac's local time (launchd has no time zone setting).
    local = datetime.now(ET).replace(hour=16, minute=30, second=0, microsecond=0).astimezone()
    args = [sys.executable, os.path.abspath(__file__), SYM, "--below", str(a.below), "--above", str(a.above), "--days", str(a.days)]
    if a.base_high is not None:
        args += ["--base-high", str(a.base_high), "--base-days", str(a.base_days)]
    os.makedirs(os.path.dirname(AGENT), exist_ok=True)
    with open(AGENT, "wb") as f:
        plistlib.dump({
            "Label": LABEL,
            "ProgramArguments": args,
            "StartCalendarInterval": [{"Weekday": d, "Hour": local.hour, "Minute": local.minute} for d in range(1, 6)],
            "StandardOutPath": os.path.expanduser("~/Library/Logs/EpiphanyCloseAlert.out"),
            "StandardErrorPath": os.path.expanduser("~/Library/Logs/EpiphanyCloseAlert.out"),
        }, f)
    r = subprocess.run(["launchctl", "bootstrap", f"gui/{os.getuid()}", AGENT], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"launchctl bootstrap failed: {r.stderr.strip()}")
    sys.exit(f"installed {LABEL}: weekdays at {local:%-I:%M%p} local ({AGENT})")

url = f"https://query1.finance.yahoo.com/v8/finance/chart/{SYM}?interval=1d&range=6mo"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
res = json.load(urllib.request.urlopen(req, timeout=20))["chart"]["result"][0]
q = res["indicators"]["quote"][0]
bars = [(datetime.fromtimestamp(t, ET).date(), c, v or 0)
        for t, c, v in zip(res.get("timestamp", []), q["close"], q["volume"]) if c is not None]
now = datetime.now(ET)
if bars and bars[-1][0] == now.date() and (now.hour, now.minute) < (16, 0):
    bars = bars[:-1]  # today's bar is still forming: use completed closes only
if not bars:
    sys.exit(f"no completed daily closes for {SYM} yet")

day, close, vol = bars[-1]
closes = [b[1] for b in bars]
before = [b[2] for b in bars[:-1] if b[2]]
avg_vol = sum(before) / len(before) if before else 0

hits = []
if len(closes) >= a.days and all(c < a.below for c in closes[-a.days:]):
    hits.append(("sell", f"Closed under ${a.below:g} {a.days} days running (${close:.2f}). The floor broke: sell rule."))
if close > a.above and (avg_vol == 0 or vol > avg_vol):
    ratio = f" on {vol / avg_vol:.1f}x volume" if avg_vol else ""
    hits.append(("buy", f"Closed ${close:.2f}, above ${a.above:g}{ratio}. Buy-more rule."))
if a.base_high is not None and len(closes) >= a.base_days and all(a.below <= c <= a.base_high for c in closes[-a.base_days:]):
    hits.append(("base", f"Held ${a.below:g} to ${a.base_high:g} for {a.base_days} closes (${close:.2f}). Buy-more rule."))

state = {}
if os.path.exists(STATE):
    try:
        state = json.load(open(STATE))
    except ValueError:
        state = {}
log(f"{SYM} {day} close ${close:.2f}, volume {vol:,}: {', '.join(k for k, _ in hits) or 'no rule hit, hold'}")
for key, msg in hits:
    if state.get(key) != str(day):
        notify(f"{SYM} alert", msg)
        state[key] = str(day)
if a.test:
    notify(f"{SYM} alert (test)", f"Last close ${close:.2f} on {day}. Sell under ${a.below:g}, buy over ${a.above:g}.")
os.makedirs(os.path.dirname(STATE), exist_ok=True)
with open(STATE, "w") as f:
    json.dump(state, f)
