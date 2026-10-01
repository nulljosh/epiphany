#!/usr/bin/env python3
"""A century of autopilot rules: monthly trend and momentum across asset classes, graded blind.

Monthly. Weights are decided on month-end t and earn month t+1. 0.1% fee on every dollar of
non-cash turnover. Cash earns the 3 month T-bill (FRED TB3MS) from 1934 and 0% before, which
handicaps the rules that sit in cash in the 1870s-1920s.

Every setting is picked by CAGR on the first half of the century (1872-1948), on the classic
mix (US stocks, 10 year Treasuries, gold), then frozen and graded blind on 1949-now, both on the
classic mix and on everything (assets join the day their history starts). Raw series are cached
in tradingview/data/.

    python3 tradingview/century.py            # full run, writes nothing, print to stdout
    python3 tradingview/century.py --stocks   # also re-grade edge.py's stock momentum lead, halves split
"""
import csv, json, os, statistics, sys
from datetime import datetime, timezone
from backtest import FEE, fetch, fetch_yahoo

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
SPLIT = "1949-01"  # first month of the blind half


# ---------- data ----------

def rows(name):
    with open(os.path.join(DATA, name)) as f:
        return list(csv.reader(f))[1:]


def daily(sym):
    """Yahoo adjusted daily bars via backtest.fetch_yahoo, mirrored into tradingview/data/ on first fetch."""
    path = os.path.join(DATA, f"yahoo-{sym.replace('^', '').replace('=', '_')}.json")
    if os.path.exists(path):
        return json.load(open(path))
    bars = fetch_yahoo(sym)
    if bars:
        json.dump([[r[0], round(r[4], 6)] for r in bars], open(path, "w"))
    return [[r[0], r[4]] for r in bars]


def month_end(bars):
    out = {}
    for r in bars:
        out[datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m")] = r[-1]
    return out


def to_rets(levels):
    """{month: level} -> {month: return over that month}."""
    ks = sorted(levels)
    return {ks[i]: levels[ks[i]] / levels[ks[i - 1]] - 1 for i in range(1, len(ks)) if levels[ks[i - 1]] > 0}


def bond_ret(y0, y1, n=10.0):
    """Return of a par 10 year bond bought at yield y0, repriced a month later at y1 (semiannual coupons)."""
    m = 2 * (n - 1 / 12)
    price = y0 / y1 * (1 - (1 + y1 / 2) ** -m) + (1 + y1 / 2) ** -m if y1 > 0 else 1 + y0 * m / 2
    return price - 1 + y0 / 12


def load():
    """Returns (months, {asset: {month: return}}, {month: cash return}, notes)."""
    sh = {r[0][:7]: (float(r[1]), float(r[2]), float(r[5])) for r in rows("shiller.csv")}
    gspc = month_end(daily("^GSPC"))
    spy = month_end(daily("SPY"))
    ks = sorted(sh)
    last_yield, stock = 0.0, {}
    for i in range(1, len(ks)):
        m, p = ks[i], ks[i - 1]
        if sh[m][1] > 0:
            last_yield = sh[m][1] / sh[m][0]  # dividend yield, carried forward once Shiller stops (mid 2023)
        if m < "1928-01":  # Shiller monthly averages
            stock[m] = sh[m][0] / sh[p][0] - 1 + last_yield / 12
        elif m <= "1993-01" and m in gspc and p in gspc:  # index month-end close plus Shiller dividends
            stock[m] = gspc[m] / gspc[p] - 1 + last_yield / 12
        elif m in spy and p in spy:  # SPY with dividends reinvested
            stock[m] = spy[m] / spy[p] - 1
    y = {k: v[2] / 100 for k, v in sh.items() if v[2] > 0 and k < "1953-04"}
    y.update({r[0][:7]: float(r[1]) / 100 for r in rows("gs10.csv") if r[1] not in ("", ".")})
    yk = sorted(y)
    bonds = {yk[i]: bond_ret(y[yk[i - 1]], y[yk[i]]) for i in range(1, len(yk))}
    tb = {r[0][:7]: float(r[1]) / 100 / 12 for r in rows("tb3ms.csv") if r[1] not in ("", ".")}
    gold = to_rets({r[0][:7]: float(r[1]) for r in rows("gold.csv")})
    a = {"US stocks": stock, "10y Treasuries": bonds, "Gold": gold}
    # Wider universe. Each joins when its history starts. Futures are front-month closes, no roll adjustment.
    extra = {"Long Treasuries": "VUSTX", "Intl stocks": "VGTSX", "Emerging stocks": "VEIEX", "REITs": "VGSIX",
             "Commodities": "DBC", "Oil": "CL=F", "Silver": "SI=F", "Copper": "HG=F", "US dollar": "UUP",
             "Ethereum": "ETH-USD"}
    for name, sym in extra.items():
        r = to_rets(month_end(daily(sym)))
        if r:
            a[name] = r
    btc_path = os.path.join(DATA, "bitstamp-btc.json")
    if not os.path.exists(btc_path):
        json.dump([[r[0], r[4]] for r in fetch()], open(btc_path, "w"))
    a["Bitcoin"] = to_rets(month_end(json.load(open(btc_path))))
    end = min(max(s) for s in (stock, bonds))
    months = [m for m in sorted(stock) if m <= end]
    cash = {m: tb.get(m, 0.0) for m in months}
    return months, a, cash


# ---------- engine ----------

def simulate(months, A, cash, rule, lo, hi):
    """rule(t) -> {asset: weight} decided at the end of month t-1; the rest sits in cash."""
    eq, w, curve, fees = 1.0, {}, [1.0], 0.0
    for t in range(lo, hi):
        target = rule(t)
        turn = sum(abs(target.get(k, 0) - w.get(k, 0)) for k in set(target) | set(w))
        eq *= 1 - turn * FEE
        fees += turn
        m = months[t]
        rs = {k: A[k].get(m, 0.0) for k in target}
        c = cash[m]
        port = sum(target[k] * rs[k] for k in target) + (1 - sum(target.values())) * c
        eq *= 1 + port
        w = {k: target[k] * (1 + rs[k]) / (1 + port) for k in target} if port > -1 else {}
        curve.append(eq)
    return curve, fees


def stats(curve):
    yrs = (len(curve) - 1) / 12
    peak, mdd = curve[0], 0.0
    for v in curve:
        peak = max(peak, v)
        mdd = max(mdd, 1 - v / peak)
    return {"cagr": (curve[-1] / curve[0]) ** (1 / yrs) - 1 if yrs else 0, "mdd": mdd}


def make_rules(months, A, cash, assets):
    """Rule families: name -> {setting: rule(t)}. A rule only sees months before t."""
    idx = {}
    for k in assets:  # total-return index per asset, None before it starts
        lv, out, start = None, [], min(A[k])
        for m in months:
            r = A[k].get(m)
            lv = (lv or 1.0) * (1 + r) if r is not None else (lv if lv is not None and m > min(A[k]) else None)
            out.append(lv)
        idx[k] = out
    cidx = [1.0]
    for m in months[1:]:
        cidx.append(cidx[-1] * (1 + cash[m]))

    def live(t, n=13):  # assets with n months of history through t-1
        return [k for k in assets if t - n >= 0 and idx[k][t - n] is not None]

    def ret(k, t, L):
        return idx[k][t - 1] / idx[k][t - 1 - L] - 1

    def above(k, t, L):
        return idx[k][t - 1] > statistics.mean(idx[k][t - L:t])

    def cash_ret(t, L):
        return cidx[t - 1] / cidx[t - 1 - L] - 1

    def ew(t):
        ks = live(t)
        return {k: 1 / len(ks) for k in ks}

    def riskpar(t):
        ks = live(t)
        iv = {}
        for k in ks:
            r = [idx[k][j] / idx[k][j - 1] - 1 for j in range(t - 12, t)]
            iv[k] = 1 / max(statistics.pstdev(r), 1e-4)
        s = sum(iv.values())
        return {k: v / s for k, v in iv.items()}

    def trend(L):
        def f(t):
            ks = live(t)
            return {k: 1 / len(ks) for k in ks if above(k, t, L)}
        return f

    def tsmom(L):
        def f(t):
            ks = live(t)
            return {k: 1 / len(ks) for k in ks if ret(k, t, L) > cash_ret(t, L)}
        return f

    def dual(L, N):
        def f(t):
            ks = sorted(live(t), key=lambda k: ret(k, t, L), reverse=True)[:N]
            out = {}
            for k in ks:  # each slot: the asset if it beats T-bills, else bonds if they do, else cash
                if ret(k, t, L) > cash_ret(t, L):
                    pick = k
                elif ret("10y Treasuries", t, L) > cash_ret(t, L):
                    pick = "10y Treasuries"
                else:
                    continue
                out[pick] = out.get(pick, 0) + 1 / N
            return out
        return f

    def sp_trend(L):
        return lambda t: {"US stocks": 1.0} if above("US stocks", t, L) else {}

    return {
        "S&P hold": {(): lambda t: {"US stocks": 1.0}},
        "60/40": {(): lambda t: {"US stocks": 0.6, "10y Treasuries": 0.4}},
        "Equal weight hold": {(): ew},
        "Risk parity hold": {(): riskpar},
        "S&P trend (SMA)": {(L,): sp_trend(L) for L in (6, 8, 10, 12)},
        "Trend per asset (SMA)": {(L,): trend(L) for L in (6, 8, 10, 12)},
        "12m sign per asset": {(L,): tsmom(L) for L in (6, 9, 12)},
        "Dual momentum": {(L, N): dual(L, N) for L in (6, 9, 12) for N in (1, 2, 3)},
    }


def decade_rows(months, curve, lo):
    out = {}
    for i, m in enumerate(months[lo:], 1):
        out.setdefault(m[:3] + "0s", []).append(curve[i] / curve[i - 1])
    res = {}
    for d, xs in out.items():
        if len(xs) >= 36:  # skip stubs under 3 years
            mult = 1.0
            for x in xs:
                mult *= x
            res[d] = mult ** (12 / len(xs)) - 1
    return res


def century():
    months, A, cash = load()
    first = 13  # 12 month warmup
    split = months.index(SPLIT)
    end = len(months)
    classic = ["US stocks", "10y Treasuries", "Gold"]
    everything = list(A)
    print(f"Monthly, {months[first]} to {months[-1]}. Fee {FEE:.1%} per dollar traded. Cash = 3m T-bill from 1934, 0% before.")
    print(f"Settings picked by CAGR on {months[first]}..{months[split - 1]} (classic mix), graded blind {SPLIT}..{months[-1]}.\n")
    print("Series starts (returns):")
    for k in everything:
        print(f"  {k:16} {min(A[k])}")
    print("US stocks: Shiller monthly averages + dividends to 1927, ^GSPC month-end + Shiller dividends to Jan 1993,")
    print("SPY adjusted after. Dividend yield carried forward past mid 2023. 10y Treasuries: priced from Shiller/FRED")
    print("GS10 yields as a par bond. Gold: datahub monthly (pegged near $20-35 until 1971). Drawdowns are month-end,")
    print("so real intramonth drops were deeper.\n")

    picked, combos = {}, 0
    rules_c = make_rules(months, A, cash, classic)
    for name, grid in rules_c.items():
        combos += len(grid)
        picked[name] = max(grid, key=lambda k: stats(simulate(months, A, cash, grid[k], first, split)[0])["cagr"])
    print(f"Combos tried: {combos} (every one counted, picks below).\n")

    report = {}
    no_crypto = [k for k in everything if k not in ("Bitcoin", "Ethereum")]
    for label, assets in (("CLASSIC MIX (US stocks, 10y Treasuries, gold)", classic),
                          ("EVERYTHING BUT CRYPTO (same frozen settings)", no_crypto),
                          ("EVERYTHING (all assets as they appear)", everything)):
        rules = rules_c if assets is classic else make_rules(months, A, cash, assets)
        print(label)
        print(f"{'rule':24}{'setting':>9} | {'train CAGR':>10} {'maxDD':>6} | {'BLIND CAGR':>10} {'maxDD':>6} {'turnover/yr':>11} | {'decades beat S&P':>16}")
        curves = {}
        for name in rules:
            p = picked[name]
            tr = stats(simulate(months, A, cash, rules[name][p], first, split)[0])
            cv, turn = simulate(months, A, cash, rules[name][p], split, end)
            full, _ = simulate(months, A, cash, rules[name][p], first, end)
            curves[name] = (stats(cv), decade_rows(months, full, first), turn / ((end - split) / 12))
            b, dec, t = curves[name]
            sp = curves["S&P hold"][1]
            won = sum(dec[d] > sp[d] for d in dec)
            won_blind = sum(dec[d] > sp[d] for d in dec if d >= "1950s")
            n_blind = sum(1 for d in dec if d >= "1950s")
            print(f"{name:24}{str(p):>9} | {tr['cagr']:>10.1%} {tr['mdd']:>6.0%} | {b['cagr']:>10.1%} {b['mdd']:>6.0%} {t:>10.1f}x | {won:>3}/{len(dec)} all, {won_blind}/{n_blind} blind")
        decs = sorted(curves["S&P hold"][1])
        print("\nCAGR by decade (full run; 1950s on is blind)")
        print(f"{'rule':24}" + "".join(f"{d:>7}" for d in decs))
        for name, (_, dec, _) in curves.items():
            print(f"{name:24}" + "".join(f"{dec.get(d, float('nan')):>7.1%}" for d in decs))
        sp = curves["S&P hold"]
        winners = [n for n, (b, dec, _) in curves.items() if n not in ("S&P hold",)
                   and b["cagr"] > sp[0]["cagr"] and b["mdd"] < sp[0]["mdd"]
                   and sum(dec[d] > sp[1][d] for d in dec) > len(dec) / 2]
        print(f"\nBar (blind CAGR above S&P hold, smaller blind worst drop, beats S&P in most decades): {', '.join(winners) or 'NOTHING CLEARS IT'}\n")
        report[label] = curves
    return report


def stocks():
    """edge.py's momentum + trend lead, re-graded the century.py way: pick on the first half of its history, blind on the second."""
    import edge
    days, syms, O, H, L, C = edge.panel()
    spy = {r[0] // edge.DAY: r[4] for r in fetch_yahoo("SPY")}
    C["SPY"] = [spy.get(d) for d in days]
    fam = edge.build(days, syms, O, H, L, C)
    lo, hi = 260, len(days)
    mid = lo + (hi - lo) // 2
    day = lambda i: datetime.fromtimestamp(days[i] * edge.DAY, timezone.utc).date()
    grid = fam["Momentum + trend"]
    best = max(grid, key=lambda k: edge.simulate(days, C, *grid[k][:2], lo, mid, lag=grid[k][2])["cagr"])
    pick, sched, lag = grid[best]
    b = edge.simulate(days, C, pick, sched, mid, hi, lag=lag)
    first = next(i for i in range(len(days)) if C["SPY"][i])
    s = edge.simulate(days, C, lambda j: ["SPY"], lambda i: i == max(mid, first), max(mid, first), hi, fee_rate=0)
    print(f"STOCK MOMENTUM LEAD (edge.py), {len(syms)} of today's S&P 500 stocks. Survivorship bias: today's members only.")
    print(f"Picked by CAGR on {day(lo)}..{day(mid - 1)} from {len(grid)} combos, blind {day(mid)}..{day(hi - 1)}.")
    e = edge.simulate(days, C, *fam["EW basket"][()][:2], mid, hi, lag=1)
    print(f"  pick {best}: blind CAGR {b['cagr']:.1%}, worst drop {b['mdd']:.0%}   SPY hold {s['cagr']:.1%}, {s['mdd']:.0%}"
          f"   same-stocks EW basket {e['cagr']:.1%}, {e['mdd']:.0%} (shares the bias)")
    print("  by decade (blind CAGR, mom+trend vs SPY):")
    for y in (2000, 2010, 2020):
        a_, z = edge.span(days, f"{y}-01-01", f"{y + 9}-12-31")
        a_ = max(a_, mid)
        if z - a_ < 500:
            continue
        r = edge.simulate(days, C, pick, sched, a_, z, lag=lag)
        q = edge.simulate(days, C, lambda j: ["SPY"], lambda i: i == a_, a_, z, fee_rate=0)
        print(f"    {y}s from {day(a_)}: {r['cagr']:.1%} / {r['mdd']:.0%} vs {q['cagr']:.1%} / {q['mdd']:.0%}")
    return len(grid)


if __name__ == "__main__":
    century()
    if "--stocks" in sys.argv:
        print()
        stocks()
