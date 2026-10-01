#!/usr/bin/env python3
"""Hunt for an edge across the S&P 500: portfolio strategies vs an equal-weight basket of the same stocks.

Every pick uses data through yesterday's close and trades at today's close (IBS-close is the one
exception, flagged). 0.1% fee on every dollar traded. Settings picked on 2012-2019 by Sharpe,
scored blind on 2020-now, then the winner faces a luck test against random picks.

    python3 tradingview/edge.py            # pick and score
    python3 tradingview/edge.py --stress   # momentum + trend, frozen, on today's list
    python3 tradingview/edge.py --pit      # same, on point-in-time members (survivorship test)
"""
import bisect, csv, gzip, os, random, statistics
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from backtest import FEE, TRAIN, TEST, fetch_yahoo, sp500

DAY = 86400


def panel(syms=None):
    """Today's S&P list with history back to 2011, or any ticker list (the point-in-time run) as is."""
    pit = syms is not None
    syms = syms or sp500()
    with ThreadPoolExecutor(8) as ex:
        data = dict(zip(syms, ex.map(fetch_yahoo, syms)))
    cutoff = datetime(2099 if pit else 2011, 1, 1, tzinfo=timezone.utc).timestamp()
    data = {s: b for s, b in data.items() if b and b[0][0] <= cutoff}
    count = {}
    for b in data.values():
        for r in b:
            count[r[0] // DAY] = count.get(r[0] // DAY, 0) + 1
    days = sorted(d for d, n in count.items() if n >= (100 if pit else len(data) // 2))
    ix = {d: i for i, d in enumerate(days)}
    O, H, L, C = ({s: [None] * len(days) for s in data} for _ in range(4))
    for s, b in data.items():
        for t, o, h, l, c in b:
            i = ix.get(t // DAY)
            if i is not None:
                O[s][i], H[s][i], L[s][i], C[s][i] = o, h, l, c
    return days, list(data), O, H, L, C


def simulate(days, C, pick, sched, lo, hi, lag=1, fee_rate=FEE, last=None):
    """pick(i) -> list of symbols to hold equally from close i on. Decided with data through i - lag.
    A held name whose prices stop keeps its last price until the next rebalance sells it, or with
    last={sym: final index with a price} it goes to zero the day after (the -100% bound)."""
    vals, eq, rets, traded = {}, 1.0, [], 0.0
    for i in range(lo, hi):
        if i > lo:  # mark to market close i-1 -> close i
            new = 0.0
            for s, v in vals.items():
                a, b = C[s][i - 1], C[s][i]
                vals[s] = v * (b / a) if a and b else 0.0 if last and i > last[s] else v
                new += vals[s]
            if vals:  # in cash the day's return is 0, not -100%
                rets.append(new / eq - 1 if eq else 0.0)
                eq = new
            else:
                rets.append(0.0)
        if sched(i):
            names = pick(i - lag + 1 if lag else i + 1)
            target = {s: eq / len(names) for s in names} if names else {}
            turnover = sum(abs(target.get(s, 0) - vals.get(s, 0)) for s in set(target) | set(vals))
            fee = turnover * fee_rate
            if rets and eq:  # the fee comes out of today's return, or it never reaches the score
                rets[-1] = (1 + rets[-1]) * (1 - fee / eq) - 1
            traded += turnover / max(eq, 1e-12)
            eq -= fee
            vals = {s: v * (eq / sum(target.values())) for s, v in target.items()} if target else {}
            if not vals:
                eq = eq  # cash
    years = (days[hi - 1] - days[lo]) / 365.25
    mult = 1.0
    peak, mdd = 1.0, 0.0
    for r in rets:
        mult *= 1 + r
        peak = max(peak, mult)
        mdd = max(mdd, 1 - mult / peak)
    sd = statistics.pstdev(rets) or 1e-12
    return {"cagr": mult ** (1 / years) - 1, "mdd": mdd, "sharpe": statistics.mean(rets) / sd * 252 ** 0.5,
            "turnover": traded / years, "mult": mult}


def build(days, syms, O, H, L, C, sizes=(20, 50), member=None):
    """Strategy families: name -> {setting: (pick, sched, lag)}. pick(j) sees data up to index j-1.
    member(i) -> set of index members on day i, for the point-in-time run; None means all of syms."""
    member = member or (lambda i: syms)
    month = lambda i: i > 0 and datetime.fromtimestamp(days[i] * DAY, timezone.utc).month != datetime.fromtimestamp(days[i - 1] * DAY, timezone.utc).month
    week = lambda i: i % 5 == 0
    daily = lambda i: True
    def alive(j, back):
        return [s for s in member(j - 1) if C[s][j - 1] and C[s][j - 1 - back]]
    def ret(s, j, a, b):  # return from j-1-a to j-1-b
        x, y = C[s][j - 1 - a], C[s][j - 1 - b]
        return y / x - 1 if x and y else None
    def vol(s, j, n):
        r = [C[s][k] / C[s][k - 1] - 1 for k in range(j - n, j) if C[s][k] and C[s][k - 1]]
        return statistics.pstdev(r) if len(r) > n // 2 else None

    ew = lambda j: alive(j, 0)
    def mom(L, N):
        def f(j):
            xs = [(ret(s, j, L, 21), s) for s in alive(j, L)]
            return [s for _, s in sorted(x for x in xs if x[0] is not None)[-N:]]
        return f
    def lowvol(n, N):
        def f(j):
            xs = [(vol(s, j, n), s) for s in alive(j, n)]
            return [s for _, s in sorted(x for x in xs if x[0] is not None)[:N]]
        return f
    def rev(N):
        def f(j):
            xs = [(ret(s, j, 5, 0), s) for s in alive(j, 5)]
            return [s for _, s in sorted(x for x in xs if x[0] is not None)[:N]]
        return f
    def ibs(N, cut):
        def f(j):
            k = j - 1
            xs = [((C[s][k] - L[s][k]) / (H[s][k] - L[s][k]), s) for s in syms
                  if C[s][k] and H[s][k] and L[s][k] and H[s][k] > L[s][k]]
            return [s for x, s in sorted(xs)[:N] if x < cut]
        return f
    # Equal-weight index above its 200-day average? Built from the basket's own closes.
    idx = [None] * len(days)
    level = 1.0
    for i in range(1, len(days)):
        rs = [C[s][i] / C[s][i - 1] - 1 for s in member(i) if C[s][i] and C[s][i - 1]]
        level *= 1 + (statistics.mean(rs) if rs else 0)
        idx[i] = level
    def trend(f):
        def g(j):
            w = [x for x in idx[max(1, j - 200):j] if x]
            return f(j) if w and idx[j - 1] and idx[j - 1] > statistics.mean(w) else []
        return g
    return {
        "EW basket": {(): (ew, month, 1)},
        "Momentum 12-1": {(L, N): (mom(L, N), month, 1) for L in (126, 252) for N in sizes},
        "Momentum + trend": {(L, N): (trend(mom(L, N)), month, 1) for L in (126, 252) for N in sizes},
        "Low volatility": {(n, N): (lowvol(n, N), month, 1) for n in (63, 252) for N in (20, 50)},
        "Weekly reversal": {(N,): (rev(N), week, 1) for N in (20, 50)},
        "IBS next-day": {(N, c): (ibs(N, c), daily, 1) for N in (10, 20) for c in (0.1, 0.2)},
        "IBS at-close*": {(N, c): (ibs(N, c), daily, 0) for N in (10, 20) for c in (0.1, 0.2)},
    }


def span(days, a, b):
    ts = lambda d: datetime.fromisoformat(d).replace(tzinfo=timezone.utc).timestamp() // DAY
    idx = [i for i, d in enumerate(days) if ts(a) <= d <= ts(b)]
    return idx[0], idx[-1] + 1


def main():
    days, syms, O, H, L, C = panel()
    tr, te = span(days, *TRAIN), span(days, *TEST)
    print(f"{len(syms)} S&P 500 stocks, {len(days)} days. Fee {FEE:.1%} per dollar traded.")
    print(f"Pick on {TRAIN[0]}..{TRAIN[1]} by Sharpe, score blind {TEST[0]}..now.\n")
    print(f"{'strategy':18}{'setting':>11} | {'train Sharpe':>12} | {'TEST CAGR':>9} {'maxDD':>6} {'Sharpe':>7} {'turnover/yr':>12}")
    fams = build(days, syms, O, H, L, C)
    results = {}
    for name, grid in fams.items():
        best = max(grid, key=lambda k: simulate(days, C, *grid[k][:2], *tr, lag=grid[k][2])["sharpe"])
        a = simulate(days, C, *grid[best][:2], *tr, lag=grid[best][2])
        b = simulate(days, C, *grid[best][:2], *te, lag=grid[best][2])
        results[name] = (best, b)
        print(f"{name:18}{str(best):>11} | {a['sharpe']:>12.2f} | {b['cagr']:>9.1%} {b['mdd']:>6.0%} {b['sharpe']:>7.2f} {b['turnover']:>11.0f}x")
    base = results["EW basket"][1]
    winners = [(n, r) for n, r in results.items() if n != "EW basket" and r[1]["sharpe"] > base["sharpe"]]
    print(f"\n* fills at the same close the signal reads; needs market-on-close orders placed minutes before the bell.")
    for name, (best, r) in winners:
        pick, sched, lag = fams[name][best]
        N = best[-1] if name.startswith(("Momentum", "Low")) else best[0]
        rng = random.Random(1)
        luck = []
        for _ in range(200):
            seed = rng.random()
            def rand_pick(j, seed=seed, N=N):
                live = [s for s in syms if C[s][j - 1]]
                return random.Random(seed * 1e9 + j).sample(live, min(N, len(live)))
            luck.append(simulate(days, C, rand_pick, sched, *te, lag=lag)["sharpe"])
        beat = sum(x >= r["sharpe"] for x in luck) / len(luck)
        print(f"Luck test {name}: random {N}-stock picks on the same schedule matched its Sharpe {beat:.0%} of the time.")


def stress():
    """Momentum + trend with settings fixed (126 day lookback, 20 names): other periods, fees, sizes."""
    days, syms, O, H, L, C = panel()
    spy = {r[0] // DAY: r[4] for r in fetch_yahoo("SPY")}
    C["SPY"] = [spy.get(d) for d in days]
    fam = build(days, syms, O, H, L, C, sizes=(20, 30, 50))
    cell = lambda r: f"{r['cagr']:>6.1%} {r['mdd']:>4.0%}"
    def run(name, key, a, b, fee=FEE):
        pick, sched, lag = fam[name][key]
        lo, hi = span(days, a, b)
        return simulate(days, C, pick, sched, lo, hi, lag=lag, fee_rate=fee)
    def spy_run(a, b):
        lo, hi = span(days, a, b)
        return simulate(days, C, lambda j: ["SPY"], lambda i: i == lo, lo, hi, fee_rate=0)
    big = ("2099-01-01",)
    print(f"{len(syms)} S&P 500 stocks, data from {datetime.fromtimestamp(days[0] * DAY, timezone.utc).date()}. Cells are CAGR then max drawdown.")
    print("Momentum + trend = 126 day return skipping the latest 21, top N, only while the basket is above its 200 day average, monthly, per side fee.\n")
    print("1. Other periods (20 names, 0.1% fee, settings fixed)")
    print(f"{'period':12}{'mom+trend':>15}{'mom no filter':>15}{'EW basket':>15}{'SPY':>15}")
    periods = [("2008-01-01", "2011-12-31"), ("2012-01-01", "2019-12-31"), ("2020-01-01", "2099-01-01")]
    periods += [(f"{y}-01-01", f"{y}-12-31") for y in range(1994, datetime.now().year + 1)]
    for a, b in periods:
        tag = f"{a[:4]}-{'now' if b[:2] == '20' and b[:4] == '2099' else b[:4]}"
        if span(days, a, b)[1] - span(days, a, b)[0] < 20:
            continue
        print(f"{tag:12}{cell(run('Momentum + trend', (126, 20), a, b)):>15}{cell(run('Momentum 12-1', (126, 20), a, b)):>15}{cell(run('EW basket', (), a, b)):>15}{cell(spy_run(a, b)):>15}")
    print("\n2. Fees per side (20 names)")
    for a, b in (("2008-01-01", "2011-12-31"), ("2012-01-01", "2019-12-31"), ("2020-01-01", "2099-01-01")):
        spy_c = cell(spy_run(a, b))
        for fee in (0.001, 0.002, 0.005):
            r = run("Momentum + trend", (126, 20), a, b, fee)
            print(f"{a[:4]}-{b[:4] if b[:4] != '2099' else 'now':4}  fee {fee:.1%}  {cell(r)}  turnover {r['turnover']:.0f}x/yr   SPY {spy_c}")
    print("\n3. Holdings (0.1% fee)")
    for a, b in (("2008-01-01", "2011-12-31"), ("2012-01-01", "2019-12-31"), ("2020-01-01", "2099-01-01")):
        row = "  ".join(f"N={N}: {cell(run('Momentum + trend', (126, N), a, b))}" for N in (20, 30, 50))
        print(f"{a[:4]}-{b[:4] if b[:4] != '2099' else 'now':4}  {row}   SPY {cell(spy_run(a, b))}")
    print("\nSurvivorship: UNTESTED. No delisted constituents here. The EW basket column shares the same bias, so only the gap above it is momentum's own.")


def pit():
    """Momentum + trend on point-in-time S&P 500 members (fja05680/sp500, cached in data/), settings fixed."""
    with gzip.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sp500-pit.csv.gz"), "rt") as f:
        snaps = [(datetime.fromisoformat(d).replace(tzinfo=timezone.utc).timestamp() // DAY, {t.replace(".", "-") for t in ts.split(",")})
                 for d, ts in list(csv.reader(f))[1:]]
    names = sorted(set().union(*(m for _, m in snaps)))
    days, syms, O, H, L, C = panel(names)
    have = set(syms)
    keys = [d for d, _ in snaps]
    raw = [snaps[max(0, bisect.bisect_right(keys, d) - 1)][1] for d in days]
    mem = [m & have for m in raw]
    last = {s: max(i for i, c in enumerate(C[s]) if c) for s in syms}
    spy = {r[0] // DAY: r[4] for r in fetch_yahoo("SPY")}
    C["SPY"] = [spy.get(d) for d in days]
    fam = build(days, syms, O, H, L, C, sizes=(20,), member=lambda i: mem[i])
    month = lambda i: i > 0 and datetime.fromtimestamp(days[i] * DAY, timezone.utc).month != datetime.fromtimestamp(days[i - 1] * DAY, timezone.utc).month
    def cover(lo, hi):  # share of (month, member) slots with a price that day
        slots = [(len(raw[i]), sum(1 for s in raw[i] if s in have and C[s][i])) for i in range(lo, hi) if month(i)]
        return sum(b for _, b in slots) / max(1, sum(a for a, _ in slots))
    def run(name, lo, hi, zero):
        pick, sched, lag = fam[name][(126, 20) if name != "EW basket" else ()]
        return simulate(days, C, pick, sched, lo, hi, lag=lag, last=last if zero else None)
    cell = lambda r: f"{r['cagr']:>6.1%} {r['mdd']:>4.0%}"
    pair = lambda lo, hi, n: f"{cell(run(n, lo, hi, True))} | {cell(run(n, lo, hi, False))}"
    print(f"Point-in-time S&P 500: {len(snaps)} membership snapshots {datetime.fromtimestamp(snaps[0][0] * DAY, timezone.utc).date()} on, "
          f"{len(names)} tickers ever listed, {len(syms)} with Yahoo prices ({len(syms) / len(names):.0%}).")
    print("Momentum + trend = 126 day return skipping the latest 21, top 20 of that day's members, only while the members' equal-weight basket")
    print("is above its 200 day average, monthly, 0.1% fee per side. Settings fixed, nothing re-tuned.")
    print("Each strategy cell: low bound (a held name whose prices stop goes to zero) | high bound (it exits at its last price).")
    print("Cells are CAGR then max drawdown. Coverage = share of (month, member) slots with a price.\n")
    print(f"{'period':10}{'cover':>6}   {'mom+trend low | high':>25}   {'PIT EW basket low | high':>25}   {'SPY':>11}")
    periods = [("2008-01-01", "2011-12-31"), ("2012-01-01", "2019-12-31"), ("2020-01-01", "2099-01-01")]
    periods += [(f"{y}-01-01", f"{y}-12-31") for y in range(1997, datetime.now().year + 1)]
    won = {k: [0, 0, 0] for k in ("low", "high")}
    for a, b in periods:
        lo, hi = span(days, a, b)
        if hi - lo < 20:
            continue
        sp = simulate(days, C, lambda j: ["SPY"], lambda i: i == lo, lo, hi, fee_rate=0)
        tag = f"{a[:4]}-{'now' if b[:4] == '2099' else b[:4]}"
        print(f"{tag:10}{cover(lo, hi):>6.0%}   {pair(lo, hi, 'Momentum + trend'):>25}   {pair(lo, hi, 'EW basket'):>25}   {cell(sp):>11}")
        if a[:4] == b[:4]:
            for k, z in (("low", True), ("high", False)):
                m, e = run("Momentum + trend", lo, hi, z), run("EW basket", lo, hi, z)
                won[k][0] += m["cagr"] > sp["cagr"]
                won[k][1] += m["cagr"] > e["cagr"]
                won[k][2] += 1
    for k, (x, y, n) in won.items():
        print(f"\nCalendar years, {k} bound: beat SPY in {x} of {n}, beat the point-in-time basket in {y} of {n}.", end="")
    print("\nGaps: tickers Yahoo cannot find (mostly bankrupt or bought out before ~2010) never enter the ranking or the basket.")
    print("Reused tickers can carry the wrong company's prices. Both are listed in the coverage column, not hidden.")


if __name__ == "__main__":
    import sys
    pit() if "--pit" in sys.argv else stress() if "--stress" in sys.argv else main()
