#!/usr/bin/env python3
"""Run the IBKR practice account all day, for weeks, with no Claude usage. Start it once in a terminal tab:

    caffeinate -i uv run --with ib_async python3 scripts/ibkr-live.py      # Ctrl-C to stop

During US market hours it watches the account and pops a macOS notification when our positions move another
--step percent, or the account moves another --abs from the first run. At 3:45pm New York (12:45pm
Pacific), 15 minutes before the close, it runs scripts/ibkr-run.py --go once per day so the orders fill today. Once a month, at the first 3:45pm on a weekday, it also runs scripts/ibkr-momentum.py --go (the momentum sleeve). If the Gateway logs out it tells you once, and
tells you again when it is back. Demo accounts only (the runner refuses real ones). Logs to
~/Library/Logs/EpiphanyIBKR.log. It is a normal foreground process: closing the terminal stops it.
"""
import argparse, json, os, re, subprocess, sys
from datetime import datetime
from zoneinfo import ZoneInfo
from ib_async import IB

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STATE = os.path.join(ROOT, "tradingview", "ibkr-state.json")
MOM = os.path.join(ROOT, "tradingview", "ibkr-momentum.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyIBKR.log")
ET = ZoneInfo("America/New_York")

ap = argparse.ArgumentParser()
ap.add_argument("--step", type=float, default=1.0, help="percent move in our positions that triggers a notification")
ap.add_argument("--abs", type=float, default=20.0, help="account currency move from the first run that triggers a notification")
ap.add_argument("--poll", type=int, default=60, help="seconds between checks")
ap.add_argument("--port", type=int, default=4002)
ap.add_argument("--once", action="store_true", help="one check, then exit (for testing)")
a = ap.parse_args()


def note(msg):
    print(f"{datetime.now():%F %R} {msg}", flush=True)
    with open(LOG, "a") as f:
        f.write(f"{datetime.now():%F %R} {msg}\n")
    subprocess.run(["osascript", "-e", f"display notification {json.dumps(msg)} with title \"Epiphany practice account\""], check=False)


def json_or(default, path):
    try:
        return json.load(open(path))
    except (OSError, ValueError):
        return default


def state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


ib, level, alevel, down, closed_for, mom_tried = IB(), 0, 0, False, None, None
while True:
    now = datetime.now(ET)
    today, t, weekday = now.date().isoformat(), (now.hour, now.minute), now.weekday() < 5
    try:
        if not ib.isConnected():
            ib.connect("127.0.0.1", a.port, clientId=22, timeout=10)
            if down:
                note("Gateway is back")
                down = False
        port = ib.portfolio()
        cost = sum(p.averageCost * p.position for p in port)
        gain = sum(p.unrealizedPNL for p in port)
        pct = gain / cost * 100 if cost else 0.0
        nl = next((float(v.value) for v in ib.accountSummary() if v.tag == "NetLiquidation" and v.currency != "BASE"), None)
        start = state().get("start", {}).get("netLiquidation")
        if weekday and (9, 30) <= t < (16, 0):
            lvl = int(pct / a.step)
            if lvl != level:
                note(f"{'UP' if lvl > level else 'DOWN'}: positions {pct:+.2f}% (${gain:+.2f})")
                level = lvl
            if start and nl is not None:
                alvl = int((nl - start) / a.abs)
                if alvl != alevel:
                    note(f"{'UP' if alvl > alevel else 'DOWN'}: account {nl - start:+,.2f} since the start")
                    alevel = alvl
        if weekday and t >= (16, 5) and closed_for != today:
            note(f"Market closed: positions {pct:+.2f}% (${gain:+.2f}), account {nl - start:+,.2f} since the start" if start and nl is not None else f"Market closed: positions {pct:+.2f}%")
            closed_for = today
        if weekday and t >= (15, 45) and state().get("lastGo") != today:  # after 4pm it still runs, and the orders wait for the next open
            r = subprocess.run(["uv", "run", "--quiet", "--with", "ib_async", "python3", "scripts/ibkr-run.py", "--go"], cwd=ROOT, capture_output=True, text=True)
            lines = [l for l in r.stdout.splitlines() if l.startswith(("plan:", "Filled", "Submitted", "PreSubmitted", "scoreboard"))]
            note("Daily run: " + " | ".join(lines)[:220] if r.returncode == 0 else "Daily run failed: " + (r.stderr.strip().splitlines() or ["see log"])[-1][:120])
        # Momentum sleeve: once a month, the first weekday at or after 3:45pm New York. A failure retries tomorrow, not every minute.
        if weekday and t >= (15, 45) and json_or({}, MOM).get("lastRebalance") != f"{now:%Y-%m}" and mom_tried != today:
            mom_tried = today
            r = subprocess.run(["uv", "run", "--quiet", "--with", "ib_async", "python3", "scripts/ibkr-momentum.py", "--go"], cwd=ROOT, capture_output=True, text=True)
            lines = [l for l in r.stdout.splitlines() if l.startswith(("momentum plan:", "Filled", "Submitted", "PreSubmitted", "momentum rebalanced"))]
            note("Momentum run: " + " | ".join(lines)[:220] if r.returncode == 0 else "Momentum run failed: " + (r.stderr.strip().splitlines() or r.stdout.strip().splitlines() or ["see log"])[-1][:120])
    except Exception as e:
        if not down:
            note(f"Gateway problem: {str(e)[:80]}")
            down = True
    if a.once:
        break
    ib.sleep(a.poll)
