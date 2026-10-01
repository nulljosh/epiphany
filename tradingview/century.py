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
    python3 tradingview/century.py --leverage # S&P above its average at L x leverage, daily since 1928; French momentum deciles
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


# ---------- leverage for the long run (Gayed & Bilello 2016) ----------

LEV_SPLIT = "1976-01-01"  # first blind day
SWAP_EXP, PLAIN_EXP = 0.009, 0.0009  # leveraged ETF and plain index fund expense ratios


def french(name, block=0):
    """Ken French data library CSV zip (cached in tradingview/data/): {YYYY-MM: [returns as fractions]} for one block."""
    import io, urllib.request, zipfile
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        url = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/" + name
        open(path, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read())
    z = zipfile.ZipFile(path)
    lines = z.read(z.namelist()[0]).decode("latin-1").splitlines()
    blocks, cur = [], None
    for ln in lines:
        p = [x.strip() for x in ln.split(",")]
        if len(p) > 1 and len(p[0]) == 6 and p[0].isdigit():
            if cur is None:
                cur = {}
                blocks.append(cur)
            cur[p[0][:4] + "-" + p[0][4:]] = [float(x) / 100 for x in p[1:]]
        else:
            cur = None
    return blocks[block]


def lev_data():
    """Daily S&P 500 total-return-ish series since 1928 plus daily T-bill and 10y Treasury returns."""
    bars = daily("^GSPC")
    dates = [datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d") for r in bars]
    c = [r[1] for r in bars]
    sh = {r[0][:7]: (float(r[1]), float(r[2]), float(r[5])) for r in rows("shiller.csv")}
    dy, last = {}, 0.0
    for m in sorted(sh):
        if sh[m][1] > 0:
            last = sh[m][1] / sh[m][0]
        dy[m] = last
    rf = {m: v[3] * 12 for m, v in french("F-F_Research_Data_Factors_CSV.zip").items()}
    tb = {r[0][:7]: float(r[1]) / 100 for r in rows("tb3ms.csv") if r[1] not in ("", ".")}
    y = {k: v[2] / 100 for k, v in sh.items() if v[2] > 0 and k < "1953-04"}
    y.update({r[0][:7]: float(r[1]) / 100 for r in rows("gs10.csv") if r[1] not in ("", ".")})
    yk = sorted(y)
    bond_m = {yk[i]: bond_ret(y[yk[i - 1]], y[yk[i]]) for i in range(1, len(yk))}
    ndays = {}
    for d in dates:
        ndays[d[:7]] = ndays.get(d[:7], 0) + 1
    sp, bill, bond = [0.0], [0.0], [0.0]
    for i in range(1, len(c)):
        m = dates[i][:7]
        sp.append(c[i] / c[i - 1] - 1 + dy.get(m, last) / 252)
        bill.append(tb.get(m, rf.get(m, 0.0)) / 252)
        bond.append((1 + bond_m.get(m, 0.0)) ** (1 / ndays[m]) - 1)
    # signals at each close: 200 day average, or 10 month average of month-end closes (updated at month ends)
    s200 = [False] * len(c)
    run = sum(c[:200])
    for i in range(200, len(c)):
        run += c[i] - c[i - 200]
        s200[i] = c[i] > run / 200
    s10, ends, cur = [False] * len(c), [], False
    for i in range(len(c)):
        if i + 1 == len(c) or dates[i + 1][:7] != dates[i][:7]:
            ends.append(c[i])
            if len(ends) >= 10:
                cur = c[i] > sum(ends[-10:]) / 10
        s10[i] = cur
    return dates, c, sp, bill, bond, {"200d": s200, "10m": s10}


def lev_sim(D, L, sig, out, model, lo, hi):
    """Daily equity. Signal read at close j-2, traded at close j-1, earns day j. Fee on every dollar traded.
    margin: L x stock, borrow (L-1) at T-bill + 1%, rebalanced to L each month.
    etf: (L-1) in a daily-reset 2x fund (T-bill financing, 0.9% expense) + (2-L) in a plain fund, rebalanced monthly."""
    dates, _, sp, bill, bond, sigs = D
    s = sigs[sig] if sig else None
    eq, pos, curve = 1.0, None, [1.0]
    S = Dt = a = b = 0.0
    for j in range(lo, hi):
        want = s[j - 2] if s else True
        newm = dates[j][:7] != dates[j - 1][:7]
        if want != pos or (want and newm):  # switch, or monthly rebalance while in
            if pos is None or want != pos:
                traded = eq * (L if model == "margin" else 1.0) + (eq if out == "bonds" and pos is not None else 0)
            else:  # rebalance drift back to target
                traded = abs(S - L * eq) if model == "margin" else abs(a - (L - 1) * eq)
            eq *= 1 - FEE * traded / eq
            pos = want
            S, Dt = L * eq, (L - 1) * eq
            a, b = (L - 1) * eq, (2 - L) * eq
        if pos:
            if model == "margin":
                S *= 1 + sp[j]
                Dt *= 1 + bill[j] + 0.01 / 252
                eq = max(S - Dt, 1e-12)
            else:
                a *= 1 + 2 * sp[j] - bill[j] - SWAP_EXP / 252
                b *= 1 + sp[j] - PLAIN_EXP / 252
                eq = max(a + b, 1e-12)
        else:
            eq *= 1 + (bill[j] if out == "bills" else bond[j])
        curve.append(eq)
    return curve


def dstats(dates, curve, lo):
    yrs = (datetime.fromisoformat(dates[lo + len(curve) - 2]) - datetime.fromisoformat(dates[lo - 1])).days / 365.25
    peak, mdd = curve[0], 0.0
    for v in curve:
        peak = max(peak, v)
        mdd = max(mdd, 1 - v / peak)
    return {"cagr": (curve[-1] / curve[0]) ** (1 / yrs) - 1, "mdd": mdd}


def ddecades(dates, curve, lo):
    out = {}
    for k, v in enumerate(curve[1:], 1):
        d = dates[lo + k - 1][:3] + "0s"
        out.setdefault(d, [None, None, 0])
        if out[d][0] is None:
            out[d][0] = curve[k - 1]
        out[d][1], out[d][2] = v, out[d][2] + 1
    return {d: (e / s) ** (252 / n) - 1 for d, (s, e, n) in out.items() if n >= 756}


def leverage():
    D = lev_data()
    dates = D[0]
    lo = next(i for i, d in enumerate(dates) if d >= "1929-01-01")
    split = next(i for i, d in enumerate(dates) if d >= LEV_SPLIT)
    hi = len(dates)
    print(f"LEVERAGE FOR THE LONG RUN. Daily, {dates[lo]} to {dates[-1]}. Pick on {dates[lo]}..{dates[split - 1]}, blind {dates[split]}..{dates[-1]}.")
    print("S&P: ^GSPC daily close plus Shiller monthly dividend yield / 252 a day (yield carried forward past mid 2023).")
    print("T-bills: FRED TB3MS from 1934, Ken French RF before. 'bonds' = 10y Treasury priced from Shiller/FRED GS10 yields,")
    print(f"monthly return spread evenly over the month's trading days. Fee {FEE:.1%} per dollar traded on every switch and rebalance.")
    print("margin = L x index, borrow at T-bill + 1%, rebalanced monthly. etf = (L-1) daily-reset 2x fund (T-bill financing +")
    print(f"{SWAP_EXP:.1%} expense) + (2-L) plain fund ({PLAIN_EXP:.2%}), monthly rebalance. Signal at close, trade next close.\n")
    hold_tr = dstats(dates, lev_sim(D, 1.0, None, "bills", "margin", lo, split), lo)
    hold_cv = lev_sim(D, 1.0, None, "bills", "margin", split, hi)
    hold_b, hold_dec = dstats(dates, hold_cv, split), ddecades(dates, hold_cv, split)
    print(f"S&P hold (no fees): train {hold_tr['cagr']:.1%} / {hold_tr['mdd']:.0%}   BLIND {hold_b['cagr']:.1%} / {hold_b['mdd']:.0%}\n")
    combos = [(L, sg, o, md) for md in ("margin", "etf") for L in (1.0, 1.25, 1.5, 2.0) for sg in ("200d", "10m") for o in ("bills", "bonds")]
    res = {}
    print(f"{'model':7}{'L':>5}{'signal':>7}{'out':>6} | {'train CAGR':>10}{'maxDD':>6} | {'BLIND CAGR':>10}{'maxDD':>6} | decades won (blind)")
    for k in combos:
        tr = dstats(dates, lev_sim(D, *k[:3], k[3], lo, split), lo)
        cv = lev_sim(D, *k[:3], k[3], split, hi)
        b, dec = dstats(dates, cv, split), ddecades(dates, cv, split)
        won = sum(dec[d] > hold_dec[d] for d in hold_dec)
        res[k] = (tr, b, dec, won)
        print(f"{k[3]:7}{k[0]:>5}{k[1]:>7}{k[2]:>6} | {tr['cagr']:>10.1%}{tr['mdd']:>6.0%} | {b['cagr']:>10.1%}{b['mdd']:>6.0%} | {won}/{len(hold_dec)}")
    print(f"\nCombos tried: {len(combos)} (16 per cost model). Pick rule: best train CAGR whose train worst drop is no bigger than hold's ({hold_tr['mdd']:.0%}).")
    decs = sorted(hold_dec)
    print(f"\n{'blind decade CAGR':34}" + "".join(f"{d:>8}" for d in decs))
    print(f"{'S&P hold':34}" + "".join(f"{hold_dec[d]:>8.1%}" for d in decs))
    for md in ("margin", "etf"):
        ok = [k for k in combos if k[3] == md and res[k][0]["mdd"] <= hold_tr["mdd"]]
        p = max(ok, key=lambda k: res[k][0]["cagr"])
        tr, b, dec, won = res[p]
        bar = b["cagr"] > hold_b["cagr"] and b["mdd"] <= hold_b["mdd"] and won > len(hold_dec) / 2
        print(f"{'PICK ' + md + ' ' + str(p[:3]):34}" + "".join(f"{dec[d]:>8.1%}" for d in decs)
              + f"   blind {b['cagr']:.1%}/{b['mdd']:.0%}, won {won}/{len(hold_dec)}: {'CLEARS THE BAR' if bar else 'fails the bar'}")
    clear = [k for k in combos if res[k][1]["cagr"] > hold_b["cagr"] and res[k][1]["mdd"] <= hold_b["mdd"] and res[k][3] > len(hold_dec) / 2]
    print(f"\nHindsight check, any of the {len(combos)} combos clearing the bar on the blind half: {clear or 'none'}")

    print("\nETF MODEL VS REAL FUNDS, 2010 on, always invested (Yahoo adjusted closes)")
    real = {"SPY": 1, "SSO": 2, "UPRO": 3}
    a0 = next(i for i, d in enumerate(dates) if d >= "2010-01-04")
    for sym, k in real.items():
        px = {datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d"): r[1] for r in daily(sym)}
        cv, eq = [1.0], 1.0
        for j in range(a0, hi):
            eq *= 1 + k * D[2][j] - (k - 1) * D[3][j] - (SWAP_EXP if k > 1 else PLAIN_EXP) / 252
            cv.append(eq)
        m = dstats(dates, cv, a0)
        rc = [px[d] / px[dates[a0 - 1]] for d in dates[a0 - 1:hi] if d in px]
        r = dstats(dates, rc, a0)
        print(f"  {sym:5}{k}x  model {m['cagr']:.1%} / worst {m['mdd']:.0%}   real {r['cagr']:.1%} / worst {r['mdd']:.0%}   gap {m['cagr'] - r['cagr']:+.1%} a year")

    print("\nKEN FRENCH 10 PORTFOLIOS ON MOMENTUM (prior 12-2 months), value weighted, monthly, survivorship free (CRSP)")
    mom = french("10_Portfolios_Prior_12_2_CSV.zip", 0)
    ff = french("F-F_Research_Data_Factors_CSV.zip", 0)
    ms = sorted(set(mom) & set(ff))
    print(f"  {ms[0]} to {ms[-1]}. Market = Mkt-RF + RF. Turnover estimate: half the top decile replaced each month,")
    print("  so 1.0 dollar traded per dollar held per month (sell + buy), charged at 0.1% (house fee) and at 0.5% (old spreads).")
    def grow(xs):
        cv = [1.0]
        for x in xs:
            cv.append(cv[-1] * (1 + x))
        return cv
    def mstats(cv):
        yrs, peak, mdd = (len(cv) - 1) / 12, cv[0], 0.0
        for v in cv:
            peak = max(peak, v)
            mdd = max(mdd, 1 - v / peak)
        return (cv[-1] / cv[0]) ** (1 / yrs) - 1, mdd
    series = {"Market": lambda m: ff[m][0] + ff[m][3], "Top decile, 0.1% cost": lambda m: mom[m][9] - 0.001,
              "Top decile, 0.5% cost": lambda m: mom[m][9] - 0.005}
    for lab, (a_, z) in (("train 1927-1975", ("1927-01", "1975-12")), ("BLIND 1976-now", ("1976-01", "9999"))):
        sel = [m for m in ms if a_ <= m <= z]
        print(f"  {lab}: " + "   ".join(f"{n} {mstats(grow([f(m) for m in sel]))[0]:.1%}/{mstats(grow([f(m) for m in sel]))[1]:.0%}" for n, f in series.items()))
    decs = sorted({m[:3] + "0s" for m in ms if m >= "1976-01"})
    print(f"  {'blind decade CAGR':24}" + "".join(f"{d:>8}" for d in decs))
    for n, f in series.items():
        out = []
        for d in decs:
            sel = [m for m in ms if m[:3] + "0s" == d and m >= "1976-01"]
            out.append(mstats(grow([f(m) for m in sel]))[0])
        print(f"  {n:24}" + "".join(f"{x:>8.1%}" for x in out))


if __name__ == "__main__":
    if "--leverage" in sys.argv:
        leverage()
        sys.exit()
    century()
    if "--stocks" in sys.argv:
        print()
        stocks()
