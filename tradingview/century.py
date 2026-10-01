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
    python3 tradingview/century.py --robust   # random baseline, execution, fees and crashes for the leveraged pick
    python3 tradingview/century.py --indexes  # the same fixed 2x trend rule on Nasdaq 100, TSX, Nikkei, DAX, Dow, FTSE with dividends
    python3 tradingview/century.py --crypto   # 1x trend on BTC, ETH and a coin basket, daily, 0.25% a side, plus a 5% sleeve next to Trend 2x S&P
"""
import csv, json, os, statistics, sys
from datetime import datetime, timezone
from backtest import FEE, fetch, fetch_yahoo, get

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


def lev_sim(D, L, sig, out, model, lo, hi, fee=FEE, delay=0, gap=0.0):
    """Daily equity. Signal read at close j-2, traded at close j-1, earns day j. Fee on every dollar traded.
    margin: L x stock, borrow (L-1) at T-bill + 1%, rebalanced to L each month.
    etf: (L-1) in a daily-reset 2x fund (T-bill financing, 0.9% expense) + (2-L) in a plain fund, rebalanced monthly."""
    dates, _, sp, bill, bond, sigs = D
    s = sigs[sig] if sig else None
    eq, pos, curve = 1.0, None, [1.0]
    S = Dt = a = b = 0.0
    for j in range(lo, hi):
        want = s[j - 2 - delay] if s else True
        newm = dates[j][:7] != dates[j - 1][:7]
        if want != pos or (want and newm):  # switch, or monthly rebalance while in
            if pos is None or want != pos:
                traded = eq * (L if model == "margin" else 1.0) + (eq if out == "bonds" and pos is not None else 0)
            else:  # rebalance drift back to target
                traded = abs(S - L * eq) if model == "margin" else abs(a - (L - 1) * eq)
            eq *= 1 - fee * traded / eq
            pos = want
            S, Dt = L * eq, (L - 1) * eq
            a, b = (L - 1) * eq, (2 - L) * eq
        if pos:
            if model == "margin":
                S *= 1 + sp[j]
                Dt *= 1 + bill[j] + 0.01 / 252
                eq = max(S - Dt, 1e-12)
            else:
                a *= 1 + 2 * sp[j] - bill[j] - (SWAP_EXP + gap) / 252
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


def legs(on, idn, bill, p_on, p_id, fee, gap=0.0):
    """Two legs a day (overnight, intraday), 2x fund model: in = 2r - bill - expense, out = bill. Fee on every change of position."""
    cv, eq, prev = [1.0], 1.0, p_on[0]
    for j in range(len(on)):
        for r, p in ((on[j], p_on[j]), (idn[j], p_id[j])):
            if p != prev:
                eq *= 1 - fee
                prev = p
            eq *= max(1 + 2 * r - bill[j] / 2 - (SWAP_EXP + gap) / 504, 1e-12) if p else 1 + bill[j] / 2
        cv.append(eq)
    return cv


def cstats(dates, cv):
    yrs = (datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days / 365.25
    pk, mdd = cv[0], 0.0
    for v in cv:
        pk = max(pk, v)
        mdd = max(mdd, 1 - v / pk)
    return (cv[-1] / cv[0]) ** (1 / yrs) - 1, mdd


def window(dates, cv, a, b):
    """Return and worst drop inside [a, b]; cv[k] is the close of dates[k]."""
    ks = [k for k, d in enumerate(dates) if a <= d <= b]
    seg = cv[ks[0] - 1:ks[-1] + 1] if ks[0] else cv[:ks[-1] + 1]
    pk, mdd = seg[0], 0.0
    for v in seg:
        pk = max(pk, v)
        mdd = max(mdd, 1 - v / pk)
    return seg[-1] / seg[0] - 1, mdd


def robust():
    import random
    D = lev_data()
    dates, c, sp, bill, bond, sigs = D
    s = sigs["200d"]
    split = next(i for i, d in enumerate(dates) if d >= LEV_SPLIT)
    hi = len(dates)
    print(f"ROBUSTNESS OF THE PICK (2x S&P above 200 day average, else T-bills; signal at close, trade next close). Blind {dates[split]}..{dates[-1]}.")
    print("Settings fixed, nothing re-tuned. 'fund' = daily-reset 2x model (T-bill financing + 0.9% expense), 'margin' = L x index, T-bill + 1%.\n")
    # 1. random baseline
    print("1. RANDOM BASELINE: 1000 random in/out schedules, same days in the market, same number of switches, fund model, 0.1% a switch")
    pos = [s[j - 2] for j in range(split, hi)]
    gin = [__import__("math").log(max(1 + 2 * sp[j] - bill[j] - SWAP_EXP / 252, 1e-12)) for j in range(split, hi)]
    gout = [__import__("math").log(1 + bill[j]) for j in range(split, hi)]
    lf = __import__("math").log(1 - FEE)
    yrs = (datetime.fromisoformat(dates[hi - 1]) - datetime.fromisoformat(dates[split - 1])).days / 365.25
    def path(p):
        cum = pk = worst = 0.0
        prev = p[0]
        for g_in, g_out, x in zip(gin, gout, p):
            if x != prev:
                cum += lf
                prev = x
            cum += g_in if x else g_out
            if cum > pk:
                pk = cum
            elif pk - cum > worst:
                worst = pk - cum
        m = __import__("math")
        return m.exp(cum / yrs) - 1, 1 - m.exp(-worst)
    n = len(pos)
    n_in = sum(pos)
    k = sum(pos[i] != pos[i - 1] for i in range(1, n))
    rc, rd = path(pos)
    print(f"  rule: {rc:.1%} a year, worst drop {rd:.0%}, in market {n_in / n:.0%} of days, {k} switches ({k / yrs:.1f} a year)")
    segs = k + 1
    n_si = (segs + 1) // 2 if pos[0] else segs // 2
    n_so = segs - n_si
    def comp(total, m):
        cuts = sorted(random.sample(range(1, total), m - 1))
        return [b - a for a, b in zip([0] + cuts, cuts + [total])]
    random.seed(7)
    res = []
    for _ in range(1000):
        ins, outs = comp(n_in, n_si), comp(n - n_in, n_so)
        p, st = [], pos[0]
        ii = oo = 0
        for _ in range(segs):
            if st:
                p += [True] * ins[ii]; ii += 1
            else:
                p += [False] * outs[oo]; oo += 1
            st = not st
        res.append(path(p))
    cg = sorted(r[0] for r in res)
    dd = sorted(r[1] for r in res)
    beat_c = sum(r[0] < rc for r in res)
    beat_d = sum(r[1] > rd for r in res)
    both = sum(r[0] >= rc and r[1] <= rd for r in res)
    print(f"  random: median {cg[500]:.1%} a year (5th {cg[50]:.1%}, 95th {cg[950]:.1%}), median worst drop {dd[500]:.0%} (5th {dd[50]:.0%}, 95th {dd[950]:.0%})")
    print(f"  rule return beats {beat_c / 10:.1f}% of random schedules (p about {(1000 - beat_c) / 1000:.3f}); rule drop smaller than {beat_d / 10:.1f}%; randoms matching both: {both} of 1000")
    # 2. execution
    print("\n2. EXECUTION AND FEES (blind, 2x 200d bills). SSO gap = 0.8% a year taken off while in the fund.")
    hold = lev_sim(D, 1.0, None, "bills", "margin", split, hi)
    hc, hd = dstats(dates, hold, split)["cagr"], dstats(dates, hold, split)["mdd"]
    print(f"  S&P hold: {hc:.1%} / {hd:.0%}")
    print(f"  {'case':32}{'fund CAGR/maxDD':>18}{'fund - 0.8%':>14}{'margin CAGR/maxDD':>20}")
    for lab, fee, dl in (("base (0.1%, next close)", FEE, 0), ("1 day later", FEE, 1), ("2 days later", FEE, 2), ("fee 0.25%", 0.0025, 0), ("fee 0.5%", 0.005, 0),
                         ("fee 0.5% + 2 days later", 0.005, 2)):
        f = dstats(dates, lev_sim(D, 2.0, "200d", "bills", "etf", split, hi, fee, dl), split)
        g = dstats(dates, lev_sim(D, 2.0, "200d", "bills", "etf", split, hi, fee, dl, 0.008), split)
        m = dstats(dates, lev_sim(D, 2.0, "200d", "bills", "margin", split, hi, fee, dl), split)
        print(f"  {lab:32}{f['cagr']:>11.1%} /{f['mdd']:>4.0%}{g['cagr']:>9.1%} /{g['mdd']:>4.0%}{m['cagr']:>13.1%} /{m['mdd']:>4.0%}")
    bars = fetch_yahoo("^GSPC")
    od = [datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d") for r in bars]
    om = {d: r for d, r in zip(od, bars)}
    flat = sum(1 for r in bars if r[1] == r[4]) / len(bars)
    kk = [r[1] == r[4] for r in bars]
    first = next((od[i] for i in range(len(od) - 250) if od[i] >= LEV_SPLIT and sum(kk[i:i + 250]) < 12), None)
    st = next(i for i in range(split, hi) if dates[i] >= (first or "9999") and dates[i - 1] in om)
    print(f"  next OPEN: Yahoo ^GSPC opens equal the close on {flat:.0%} of all days (old bars are close only), so open trading is tested from {dates[st]}.")
    on = [om[dates[j]][1] / c[j - 1] - 1 + (sp[j] - (c[j] / c[j - 1] - 1)) for j in range(st, hi)]
    idn = [c[j] / om[dates[j]][1] - 1 for j in range(st, hi)]
    bl = [bill[j] for j in range(st, hi)]
    dl = dates[st:hi]
    hp = [True] * len(dl)
    hold_o = legs(on, idn, bl, hp, hp, 0.0)
    hold_o = [1.0]
    e = 1.0
    for a_, b_ in zip(on, idn):
        e *= (1 + a_) * (1 + b_); hold_o.append(e)
    d0 = [dates[st - 1]] + dl
    hc2, hd2 = cstats(d0, hold_o)
    cl = [s[j - 2] for j in range(st, hi)]
    op = [s[j - 1] for j in range(st, hi)]
    print(f"  from {dates[st]}: hold {hc2:.1%} / {hd2:.0%}")
    for lab, po, pi in (("fund, trade next close", cl, cl), ("fund, trade next open", cl, op)):
        a_, b_ = cstats(d0, legs(on, idn, bl, po, pi, FEE))
        a2, b2 = cstats(d0, legs(on, idn, bl, po, pi, FEE, 0.008))
        print(f"  {lab:32}{a_:>11.1%} /{b_:>4.0%}{a2:>9.1%} /{b2:>4.0%}")
    # 3. other markets
    print("\n3. OTHER MARKETS, same rule, 2x fund model, 0.1% a switch, own buy and hold. PRICE ONLY (Yahoo adjusted closes, no dividends added;")
    print("   hold gets none either). Cash is the US T-bill for every market. Blind = 1976 on or the series' full history where shorter (200 days burn-in).")
    tb = {r[0][:7]: float(r[1]) / 100 for r in rows("tb3ms.csv") if r[1] not in ("", ".")}
    rf = {m: v[3] * 12 for m, v in french("F-F_Research_Data_Factors_CSV.zip").items()}
    def bl_of(d):
        return tb.get(d[:7], rf.get(d[:7], tb[max(tb)])) / 252
    print(f"  {'index':10}{'from':>12}{'hold CAGR/maxDD':>18}{'rule CAGR/maxDD':>18}   beats hold, no bigger drop?")
    won = tot = 0
    for sym in ("^GSPC", "^NDX", "^IXIC", "^DJI", "^GSPTSE", "^N225", "^FTSE", "^GDAXI"):
        b = daily(sym)
        if not b:
            print(f"  {sym:10} no data"); continue
        ds = [datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d") for r in b]
        px = [r[1] for r in b]
        sg = [False] * len(px)
        run = sum(px[:200])
        for i in range(200, len(px)):
            run += px[i] - px[i - 200]
            sg[i] = px[i] > run / 200
        a = next(i for i, d in enumerate(ds) if d >= LEV_SPLIT)
        a = max(a, 202)
        r_ = [px[j] / px[j - 1] - 1 for j in range(a, len(px))]
        bb = [bl_of(ds[j]) for j in range(a, len(px))]
        pp = [sg[j - 2] for j in range(a, len(px))]
        dd_ = [ds[a - 1]] + ds[a:]
        hcv = [1.0]
        for x in r_:
            hcv.append(hcv[-1] * (1 + x))
        rcv = legs([0.0] * len(r_), r_, bb, pp, pp, FEE)  # whole day in the intraday leg
        hcg, hmd = cstats(dd_, hcv)
        rcg, rmd = cstats(dd_, rcv)
        ok = rcg > hcg and rmd <= hmd
        tot += 1; won += ok
        print(f"  {sym:10}{dd_[0]:>12}{hcg:>11.1%} /{hmd:>4.0%}{rcg:>11.1%} /{rmd:>4.0%}   {'YES' if ok else 'no'}{'' if rcg > hcg else ' (lower return)' if rmd <= hmd else ' (lower return and bigger drop)' if rcg <= hcg and rmd > hmd else ''}")
        if rcg > hcg and rmd > hmd:
            print(f"{'':10}   (more return, bigger drop)")
    print(f"  Markets where the rule beats hold with no bigger worst drop: {won} of {tot} (the first row is the S&P without dividends, so not independent).")
    # 4. worst cases
    print("\n4. WORST CASES, blind, base settings (fund model, margin model, hold)")
    cvs = {"hold": hold, "fund": lev_sim(D, 2.0, "200d", "bills", "etf", split, hi), "margin": lev_sim(D, 2.0, "200d", "bills", "margin", split, hi)}
    dl = dates[split - 1:hi]
    for nm, cv in cvs.items():
        rets = [cv[k] / cv[k - 1] - 1 for k in range(1, len(cv))]
        w = min(range(len(rets)), key=rets.__getitem__)
        mo = {}
        for k in range(1, len(cv)):
            mo.setdefault(dl[k][:7], [cv[k - 1], cv[k]])[1] = cv[k]
        wm = min(mo, key=lambda m: mo[m][1] / mo[m][0])
        print(f"  {nm:7} worst day {dl[w + 1]} {rets[w]:+.1%}   worst month {wm} {mo[wm][1] / mo[wm][0] - 1:+.1%}")
    for lab, a_, b_ in (("1987 crash (Sep 1 to Dec 31 1987)", "1987-09-01", "1987-12-31"), ("2008 (calendar year)", "2008-01-01", "2008-12-31"),
                        ("Mar 2020 (Feb 19 to Apr 30)", "2020-02-19", "2020-04-30"), ("2022 (calendar year)", "2022-01-01", "2022-12-31")):
        print(f"  {lab}: " + "   ".join(f"{nm} {window(dl, cv, a_, b_)[0]:+.0%} (drop {window(dl, cv, a_, b_)[1]:.0%})" for nm, cv in cvs.items()))


# ---------- Trend 2x on other indexes, with dividends (--indexes) ----------

GAP = 0.008  # measured SSO model gap, a year, taken off while in the fund


def raw(sym):
    """Yahoo [date, close, adjusted close]. Close has splits but no dividends; adjusted close has both. Cached in tradingview/data/."""
    path = os.path.join(DATA, f"yahoo-raw-{sym.replace('^', '').replace('=', '_')}.json")
    if os.path.exists(path):
        return json.load(open(path))
    import urllib.parse
    r = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?period1=-1400000000&period2=9999999999&interval=1d"))["chart"]["result"][0]
    cl, adj = r["indicators"]["quote"][0]["close"], r["indicators"]["adjclose"][0]["adjclose"]
    out = [[datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d"), round(c, 6), round(a, 6)] for t, c, a in zip(r["timestamp"], cl, adj) if c and a]
    json.dump(out, open(path, "w"))
    return out


def yield_est(sym, a="0000", b="9999"):
    """Dividend yield a year of a fund, from its own adjusted close against its plain close, between dates a and b."""
    rs = [r for r in raw(sym) if a <= r[0] <= b]
    yrs = (datetime.fromisoformat(rs[-1][0]) - datetime.fromisoformat(rs[0][0])).days / 365.25
    return ((rs[-1][2] / rs[0][2]) / (rs[-1][1] / rs[0][1])) ** (1 / yrs) - 1


def bill_fn():
    tb = {r[0][:7]: float(r[1]) / 100 for r in rows("tb3ms.csv") if r[1] not in ("", ".")}
    rf = {m: v[3] * 12 for m, v in french("F-F_Research_Data_Factors_CSV.zip").items()}
    return lambda d: tb.get(d[:7], rf.get(d[:7], tb[max(tb)])) / 252


def idx_series(kind, sym, etf=None):
    """(dates, price the signal reads, daily total return). index+yield: index price plus the flat yield measured on etf.
    etf: the fund's plain close for the signal, its adjusted close (real dividends) for the return. tr: an index that already reinvests dividends."""
    if kind == "etf":
        rs = raw(sym)
        ds, sig, adj = [r[0] for r in rs], [r[1] for r in rs], [r[2] for r in rs]
        y = 0.0
    else:
        bars = daily(sym)
        ds = [datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d") for r in bars]
        sig = adj = [r[1] for r in bars]
        y = yield_est(etf) if kind == "index+yield" else 0.0
    return ds, sig, [0.0] + [adj[i] / adj[i - 1] - 1 + y / 252 for i in range(1, len(adj))]


def trend_pos(sig, a, delay=0):
    n = len(sig)
    sg, run = [False] * n, sum(sig[:200])
    for i in range(200, n):
        run += sig[i] - sig[i - 200]
        sg[i] = sig[i] > run / 200
    return [sg[j - 2 - delay] for j in range(a, n)]


def yearly(dates, cv, a):
    out = {}
    for k in range(1, len(cv)):
        e = out.setdefault(dates[a + k - 1][:4], [cv[k - 1], cv[k], 0])
        e[1], e[2] = cv[k], e[2] + 1
    return {y: e / s for y, (s, e, n) in out.items() if n >= 200}


def rand_base(pos, gin, gout, yrs, draws=500, seed=7, fee=FEE):
    """Same random in/out schedules as --robust: same days in the market, same number of switches. Returns (CAGR, drop) of the rule and a list for the randoms."""
    import math, random
    lf = math.log(1 - fee)
    def path(p):
        cum = pk = worst = 0.0
        prev = p[0]
        for gi, go, x in zip(gin, gout, p):
            if x != prev:
                cum += lf
                prev = x
            cum += gi if x else go
            if cum > pk:
                pk = cum
            elif pk - cum > worst:
                worst = pk - cum
        return math.exp(cum / yrs) - 1, 1 - math.exp(-worst)
    n, n_in = len(pos), sum(pos)
    k = sum(pos[i] != pos[i - 1] for i in range(1, n))
    segs = k + 1
    n_si = (segs + 1) // 2 if pos[0] else segs // 2
    n_so = segs - n_si
    def comp(total, m):
        cuts = sorted(random.sample(range(1, total), m - 1))
        return [b - a for a, b in zip([0] + cuts, cuts + [total])]
    random.seed(seed)
    res = []
    for _ in range(draws):
        ins, outs = comp(n_in, n_si), comp(n - n_in, n_so)
        p, st, ii, oo = [], pos[0], 0, 0
        for _ in range(segs):
            if st:
                p += [True] * ins[ii]; ii += 1
            else:
                p += [False] * outs[oo]; oo += 1
            st = not st
        res.append(path(p))
    return path(pos), res, k


def trend_indexes():
    import math
    bill = bill_fn()
    print("TREND 2x ON OTHER INDEXES, WITH DIVIDENDS. Rule fixed, nothing tuned: 2x while the index closes above its 200 day average, T-bills below,")
    print(f"signal at the close, trade the next close, {FEE:.1%} a switch, daily-reset 2x fund model ({SWAP_EXP:.1%} expense, T-bill financing) with the measured {GAP:.1%} a year SSO gap")
    print("taken off while in the fund. Cash is the US T-bill for every market. Blind = each series' second half by date. Bar: more CAGR than hold on the blind half,")
    print("no bigger worst drop, wins most blind decades.\n")
    print("DIVIDEND YIELDS (the fund's own adjusted close against its plain close, a year):")
    ylds = {e: yield_est(e) for e in ("QQQ", "XIU.TO", "EWJ", "DIA", "EWU")}
    for e, y in ylds.items():
        rs = raw(e)
        print(f"  {e:8}{y:6.2%}   {rs[0][0]}..{rs[-1][0]}")
    print("  The index rows add that yield flat on every day the index is held (hold and rule alike). ^GDAXI is a total return index already (Yahoo's DAX is the performance index).")
    print("  ISF.L (the FTSE 100 fund) is not dividend adjusted on Yahoo (0.03% a year), so the FTSE rows use EWU (MSCI UK, USD) instead.\n")
    sets = [("Nasdaq 100", [("index+yield", "^NDX", "QQQ", "^NDX price + QQQ yield"), ("etf", "QQQ", None, "QQQ real dividends")]),
            ("TSX", [("index+yield", "^GSPTSE", "XIU.TO", "^GSPTSE price + XIU yield"), ("etf", "XIU.TO", None, "XIU.TO real dividends")]),
            ("Nikkei 225", [("index+yield", "^N225", "EWJ", "^N225 price + EWJ yield"), ("etf", "EWJ", None, "EWJ real dividends, USD")]),
            ("DAX", [("tr", "^GDAXI", None, "^GDAXI (total return)"), ("etf", "EWG", None, "EWG real dividends, USD")]),
            ("Dow", [("index+yield", "^DJI", "DIA", "^DJI price + DIA yield"), ("etf", "DIA", None, "DIA real dividends")]),
            ("FTSE 100", [("index+yield", "^FTSE", "EWU", "^FTSE price + EWU yield"), ("etf", "EWU", None, "EWU real dividends, USD")])]
    print(f"{'series':30}{'blind from':>11}{'hold':>11}{'rule':>11}{'rule-0.8%':>12}{'decades':>9}{'years':>8}{'random':>8}{'1 day late':>13}  verdict")
    verdicts = {}
    for name, variants in sets:
        for kind, sym, etf, label in variants:
            ds, sig, ret = idx_series(kind, sym, etf)
            d0, d1 = datetime.fromisoformat(ds[0]), datetime.fromisoformat(ds[-1])
            mid = (d0 + (d1 - d0) / 2).strftime("%Y-%m-%d")
            a = next(i for i, d in enumerate(ds) if d >= mid)
            n = len(ds)
            bl = [bill(ds[j]) for j in range(a, n)]
            r_, dd = ret[a:], [ds[a - 1]] + ds[a:]
            hold = [1.0]
            for x in r_:
                hold.append(hold[-1] * (1 + x))
            pos = trend_pos(sig, a)
            rule = legs([0.0] * len(r_), r_, bl, pos, pos, FEE, GAP)
            late = legs([0.0] * len(r_), r_, bl, trend_pos(sig, a, 1), trend_pos(sig, a, 1), FEE, GAP)
            raw_rule = legs([0.0] * len(r_), r_, bl, pos, pos, FEE)
            hc, hm = cstats(dd, hold)
            rc, rm = cstats(dd, rule)
            lc, lm = cstats(dd, late)
            xc, xm = cstats(dd, raw_rule)
            hdec, rdec = ddecades(ds, hold, a), ddecades(ds, rule, a)
            won = sum(rdec[d] > hdec[d] for d in hdec)
            hy, ry = yearly(ds, hold, a), yearly(ds, rule, a)
            ywon = sum(ry[y] > hy[y] for y in hy)
            yrs = (datetime.fromisoformat(ds[-1]) - datetime.fromisoformat(ds[a - 1])).days / 365.25
            gin = [math.log(max(1 + 2 * r_[i] - bl[i] - (SWAP_EXP + GAP) / 252, 1e-12)) for i in range(len(r_))]
            gout = [math.log(1 + b) for b in bl]
            (pc, pd), res, k = rand_base(pos, gin, gout, yrs)
            pct = sum(r[0] < pc for r in res) / len(res)
            both = sum(r[0] >= pc and r[1] <= pd for r in res)
            ok = rc > hc and rm <= hm and won > len(hdec) / 2
            verdicts[(name, kind)] = (label, ds[a], hc, hm, rc, rm, won, len(hdec), ywon, len(hy), pct, both, lc, lm, ok, k / yrs, xc, xm)
            print(f"{label[:29]:30}{ds[a]:>11}{hc:>7.1%}/{hm:>3.0%}{xc:>7.1%}/{xm:>3.0%}{rc:>8.1%}/{rm:>3.0%}{won:>6}/{len(hdec)}{ywon:>5}/{len(hy)}{pct:>8.0%}{lc:>8.1%}/{lm:>3.0%}  {'PASS' if ok else 'fail'}")
    print("\n  columns: hold = 1x with dividends; rule = fund model; rule-0.8% = the headline, gap taken off; decades/years = blind decades (3+ years) and calendar years the headline beat hold;")
    print("  random = share of 500 random schedules (same days in, same switches, gap off) the headline beats; 1 day late = headline traded one close later.")
    print("\nRANDOM BASELINE, matched on both return and drop (of 500):")
    for key, v in verdicts.items():
        print(f"  {v[0]:30} beats {v[10]:.0%} of random on return; randoms with both a higher return and a no bigger drop: {v[11]} of 500; {v[14] and 'pass' or 'fail'}; {v[15]:.1f} switches a year")
    print("\nMODEL VS REAL 2x FUNDS, always invested, T-bill financing + 0.9% expense, from the fund's first day (underlying = index price + the ETF's yield over the same window)")
    for fund, idx, etf in (("QLD", "^NDX", "QQQ"), ("DDM", "^DJI", "DIA"), ("SSO", "^GSPC", "SPY")):
        fr = raw(fund)
        ur = {datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d"): r[1] for r in daily(idx)}
        ds = [r[0] for r in fr if r[0] in ur]
        y = yield_est(etf, ds[0], ds[-1])
        mv, rv, em, er = [1.0], [1.0], 1.0, 1.0
        f = {r[0]: r[2] for r in fr}
        for i in range(1, len(ds)):
            r = ur[ds[i]] / ur[ds[i - 1]] - 1 + y / 252
            em *= 1 + 2 * r - bill(ds[i]) - SWAP_EXP / 252
            er = f[ds[i]] / f[ds[0]]
            mv.append(em); rv.append(er)
        mc, mm = cstats(ds, mv)
        rc, rm = cstats(ds, rv)
        print(f"  {fund:4} {ds[0]}..{ds[-1]}  yield {y:.2%}  model {mc:.1%} / worst {mm:.0%}   real {rc:.1%} / worst {rm:.0%}   gap {mc - rc:+.1%} a year")
    print("  HXU.TO (2x TSX 60) and HQU.TO are not served by Yahoo any more (delisted), so the TSX model could not be checked against a real fund.")
    return verdicts


# ---------- Trend on crypto, 1x (--crypto) ----------

CFEE = 0.0025  # exchange-realistic fee per side
CM_ASSETS = "btc,eth,xrp,ltc,bnb,ada,doge,sol,trx,link,bch,xlm,dot,avax,matic,xmr,etc,dash"
BASKET = ["btc", "eth", "xrp", "ltc", "bnb", "ada", "doge", "sol", "trx", "link"]


def cm_daily():
    """Coin Metrics community API PriceUSD, daily, free, BTC from 2010-07-18 (Mt. Gox era), ETH from 2015-08-08. Cached in tradingview/data/."""
    path = os.path.join(DATA, "coinmetrics-crypto.json")
    if os.path.exists(path):
        return json.load(open(path))
    import urllib.request
    u = f"https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets={CM_ASSETS}&metrics=PriceUSD&frequency=1d&start_time=2010-07-01&page_size=10000"
    out = {}
    while u:
        j = json.loads(get(u))
        for r in j["data"]:
            if r.get("PriceUSD"):
                out.setdefault(r["asset"], {})[r["time"][:10]] = float(r["PriceUSD"])
        u = j.get("next_page_url")
    out = {k: sorted(v.items()) for k, v in out.items()}
    json.dump(out, open(path, "w"))
    return out


def csigs(px):
    """Signals at each close: price above its 50, 100 or 200 day average, or 84 day (12 week) return above zero."""
    n, out = len(px), {}
    for N in (50, 100, 200):
        sg, run = [False] * n, sum(px[:N])
        for i in range(N, n):
            run += px[i] - px[i - N]
            sg[i] = px[i] > run / N
        sg[N - 1] = px[N - 1] > run / N if n >= N else False
        out[f"{N}d average"] = sg
    out["12 week return"] = [i >= 84 and px[i] > px[i - 84] for i in range(n)]
    return out


def ccurve(ds, px, bl, sg, lo, hi, delay=0, fee=CFEE):
    """Daily equity, 24/7. Signal read at close j-2-delay, traded at close j-1-delay... same convention as the index tests: earns day j. 1x or cash at T-bill, fee on every switch."""
    cv, eq, prev = [1.0], 1.0, None
    pos = [sg[j - 2 - delay] for j in range(lo, hi)]
    for k, j in enumerate(range(lo, hi)):
        if prev is not None and pos[k] != prev:
            eq *= 1 - fee
        prev = pos[k]
        eq *= px[j] / px[j - 1] if pos[k] else 1 + bl[j]
        cv.append(eq)
    return cv, pos


def crypto():
    import math
    bill = bill_fn()
    cb = lambda d: bill(d) * 252 / 365  # the house T-bill a day, spread over 365 days
    raw_ = cm_daily()
    print("TREND ON CRYPTO, 1x ONLY. Daily, 24/7, BTC from 2010-07-18 (Coin Metrics community PriceUSD, free), ETH from 2015-08-08 (same source).")
    print(f"Rules: close above its 50, 100 or 200 day average, or 12 week (84 day) return above zero. Signal at one close, trade the next close, {CFEE:.2%} per side (exchange-realistic),")
    print("out of the coin = T-bills. Hold pays no fee. 1x only: a 2x crypto fund resets daily and decays too much in choppy years, so there is no leverage here.")
    print("Pick on the FIRST half of BTC history (by date), by train CAGR among rules whose train worst drop is no bigger than hold's. Blind = second half. ETH and the basket reuse the frozen rule, same blind dates.")
    print("Drops are daily closes only; intraday they were deeper.\n")
    series = {}
    for k, v in raw_.items():
        series[k] = ([d for d, _ in v], [p for _, p in v])
    def idx(k):
        return series[k]
    ds, px = idx("btc")
    n = len(ds)
    bl = [cb(d) for d in ds]
    sg = csigs(px)
    lo0 = 202  # first day every rule (and the 1 day late test) has a signal
    mid = (datetime.fromisoformat(ds[lo0 - 1]) + (datetime.fromisoformat(ds[-1]) - datetime.fromisoformat(ds[lo0 - 1])) / 2).strftime("%Y-%m-%d")
    a = next(i for i, d in enumerate(ds) if d >= mid)
    dd = lambda lo, hi: ds[lo - 1:hi]
    hold = lambda ds_, px_, lo, hi: [px_[j] / px_[lo - 1] for j in range(lo - 1, hi)]
    ht = cstats(dd(lo0, a), hold(ds, px, lo0, a))
    hb = cstats(dd(a, n), hold(ds, px, a, n))
    print(f"BTC: {ds[0]}..{ds[-1]}, {n} days. Rules start {ds[lo0]}. TRAIN {ds[lo0]}..{ds[a - 1]}, BLIND {ds[a]}..{ds[-1]}.")
    print(f"BTC hold: train {ht[0]:.0%} / {ht[1]:.0%}   BLIND {hb[0]:.1%} / {hb[1]:.0%}\n")
    print(f"{'rule':16} | {'train CAGR':>10}{'maxDD':>6} | {'BLIND CAGR':>10}{'maxDD':>6}{'x money':>9}")
    res = {}
    for name, s_ in sg.items():
        tc, _ = ccurve(ds, px, bl, s_, lo0, a)
        bc, _ = ccurve(ds, px, bl, s_, a, n)
        t, b = cstats(dd(lo0, a), tc), cstats(dd(a, n), bc)
        res[name] = (t, b)
        print(f"{name:16} | {t[0]:>10.1%}{t[1]:>6.0%} | {b[0]:>10.1%}{b[1]:>6.0%}{bc[-1]:>9.1f}")
    ok = [k for k in res if res[k][0][1] <= ht[1]]
    pick = max(ok, key=lambda k: res[k][0][0])
    print(f"\nPICK (train only): {pick}. Rules tried: {len(res)}.\n")
    s_ = sg[pick]

    def grade(label, ds_, px_, s__, lo, hi, show_years=False):
        bl_ = [cb(d) for d in ds_]
        cv, pos = ccurve(ds_, px_, bl_, s__, lo, hi, 0)
        late, _ = ccurve(ds_, px_, bl_, s__, lo, hi, 1)
        dd_ = ds_[lo - 1:hi]
        h = hold(ds_, px_, lo, hi)
        hc, hm = cstats(dd_, h)
        rc, rm = cstats(dd_, cv)
        lc, lm = cstats(dd_, late)
        hy, ry = yearly(ds_, h, lo), yearly(ds_, cv, lo)
        yw = sum(ry[y] > hy[y] for y in hy)
        yrs = (datetime.fromisoformat(ds_[hi - 1]) - datetime.fromisoformat(ds_[lo - 1])).days / 365.25
        gin = [math.log(px_[j] / px_[j - 1]) for j in range(lo, hi)]
        gout = [math.log(1 + bl_[j]) for j in range(lo, hi)]
        (pc, pd), rnd, k = rand_base(pos, gin, gout, yrs, fee=CFEE)
        pct = sum(r[0] < pc for r in rnd) / len(rnd)
        both = sum(r[0] >= pc and r[1] <= pd for r in rnd)
        okb = rc > hc and rm <= hm and yw > len(hy) / 2
        print(f"{label:50}{ds_[lo]:>11}{hc:>7.1%}/{hm:>3.0%}{rc:>8.1%}/{rm:>3.0%}{yw:>6}/{len(hy)}{pct:>8.0%}{both:>6}{lc:>8.1%}/{lm:>3.0%}{sum(pos) / len(pos):>6.0%}{k / yrs:>6.1f}  {'PASS' if okb else 'fail'}")
        if show_years:
            print("    " + "  ".join(f"{y}: {ry[y] - 1:+.0%} vs {hy[y] - 1:+.0%}" for y in sorted(hy)))
        return cv, hc, hm, rc, rm, okb
    print(f"{'series (rule: ' + pick + ')':50}{'from':>11}{'hold':>11}{'rule':>12}{'years':>6}{'  rand':>8}{'both':>6}{'1 day late':>13}{'in':>6}{'sw/yr':>6}")
    cvb = grade("BTC blind", ds, px, s_, a, n, True)
    grade("BTC train (picked here, not blind)", ds, px, s_, lo0, a)
    out = {"BTC": cvb}
    e_ds, e_px = idx("eth")
    es = csigs(e_px)[pick]
    ea = max(next(i for i, d in enumerate(e_ds) if d >= ds[a]), 202)
    out["ETH"] = grade("ETH, frozen rule, BTC blind dates", e_ds, e_px, es, ea, len(e_ds), True)
    grade("ETH whole life from 2016 (coin unseen, dates not)", e_ds, e_px, es, 202, len(e_ds))
    # basket: equal weight of the BASKET coins already trading that day, rebalanced daily (today's survivors: flattering, hindsight list)
    days = ds
    cl = {k: dict(zip(*idx(k))) for k in BASKET}
    bpx = [1.0]
    for j in range(1, n):
        rs = [cl[k][days[j]] / cl[k][days[j - 1]] - 1 for k in BASKET if days[j] in cl[k] and days[j - 1] in cl[k]]
        bpx.append(bpx[-1] * (1 + sum(rs) / len(rs)))
    bs = csigs(bpx)[pick]
    out["basket"] = grade("Top 10 equal weight basket (hindsight)", ds, bpx, bs, a, n, True)
    print("    basket = BTC ETH XRP LTC BNB ADA DOGE SOL TRX LINK, whichever were trading each day, rebalanced daily. These are today's survivors, so hold and rule are both flattered.")
    print("    columns: hold = 1x no fee; rule = headline, 0.25% a side; years = calendar years (200+ days) the rule beat hold; rand = share of 500 random in/out schedules (same days in, same switches) it beats;")
    print("    both = randoms with a return at least as high and a no bigger drop; 1 day late = rule traded one more close later; in = share of days in the coin; sw/yr = switches a year.")
    print(f"    Bar: more CAGR than hold on the blind half, no bigger worst drop, wins most blind years.")

    # data check: Coin Metrics against Bitstamp (BTC) and Yahoo (ETH) over the same days
    print("\nSOURCE CHECK, buy and hold CAGR over the same days:")
    bs_ = {datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d"): r[1] for r in json.load(open(os.path.join(DATA, "bitstamp-btc.json")))}
    cmb = dict(zip(ds, px))
    com = [d for d in ds if d in bs_ and d >= "2011-09-01"]
    print(f"  BTC {com[0]}..{com[-1]}: Coin Metrics {(cmb[com[-1]] / cmb[com[0]]) ** (365.25 / (datetime.fromisoformat(com[-1]) - datetime.fromisoformat(com[0])).days) - 1:.1%}, Bitstamp {(bs_[com[-1]] / bs_[com[0]]) ** (365.25 / (datetime.fromisoformat(com[-1]) - datetime.fromisoformat(com[0])).days) - 1:.1%}")
    ye = {datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m-%d"): r[1] for r in daily("ETH-USD")}
    cme = dict(zip(e_ds, e_px))
    com = [d for d in e_ds if d in ye]
    yy = (datetime.fromisoformat(com[-1]) - datetime.fromisoformat(com[0])).days / 365.25
    print(f"  ETH {com[0]}..{com[-1]}: Coin Metrics {(cme[com[-1]] / cme[com[0]]) ** (1 / yy) - 1:.1%}, Yahoo {(ye[com[-1]] / ye[com[0]]) ** (1 / yy) - 1:.1%}")

    # sleeve: 5% in BTC trend or BTC hold, 95% Trend 2x S&P, blind window, monthly rebalance
    print(f"\nSLEEVE IN CONTEXT, blind window {ds[a]}..{ds[-1]}. Rest = Trend 2x S&P (2x fund above its 200 day average, else T-bills, 0.8% fund gap off, 0.1% a switch).")
    D = lev_data()
    sd = D[0]
    s0 = next(i for i, d in enumerate(sd) if d >= ds[a])
    sv = lev_sim(D, 2.0, "200d", "bills", "etf", s0, len(sd), FEE, 0, 0.008)
    lvl = {sd[s0 - 1 + k]: sv[k] for k in range(len(sv))}
    cal, last = [], sv[0]
    for d in ds[a - 1:]:
        last = lvl.get(d, last)
        cal.append(last)
    first = next(i for i, v in enumerate(cal) if v is not None)
    days_ = ds[a - 1 + first:]
    sl = [v for v in cal[first:]]
    cvt = cvb[0][first:]
    hh = hold(ds, px, a, n)[first:]
    def blend(w, ser):
        eq_s, eq_c, cur, curve = 1 - w, w, days_[0][:7], [1.0]
        for k in range(1, len(days_)):
            eq_s *= sl[k] / sl[k - 1]
            eq_c *= ser[k] / ser[k - 1]
            if days_[k][:7] != cur:
                cur = days_[k][:7]
                tot = eq_s + eq_c
                tr = abs(eq_c - w * tot)
                tot -= tr * (CFEE + FEE)
                eq_s, eq_c = (1 - w) * tot, w * tot
            curve.append(eq_s + eq_c)
        return curve
    rows_ = [("100% Trend 2x S&P", blend(0.0, hh)), ("95% Trend 2x S&P + 5% BTC hold", blend(0.05, hh)), ("95% Trend 2x S&P + 5% BTC trend", blend(0.05, cvt)),
             ("90% Trend 2x S&P + 10% BTC hold", blend(0.10, hh)), ("90% Trend 2x S&P + 10% BTC trend", blend(0.10, cvt))]
    print(f"  {'portfolio':36}{'CAGR':>8}{'worst drop':>12}{'x money':>9}   (monthly rebalance, {CFEE:.2%} on the crypto side, {FEE:.1%} on the S&P side of every trade)")
    for lab, cv in rows_:
        c_, m_ = cstats(days_, cv)
        print(f"  {lab:36}{c_:>8.1%}{m_:>12.0%}{cv[-1]:>9.1f}")
    c_, m_ = cstats(days_, cvt)
    print(f"  {'BTC trend alone':36}{c_:>8.1%}{m_:>12.0%}{cvt[-1]:>9.1f}")
    c_, m_ = cstats(days_, hh)
    print(f"  {'BTC hold alone':36}{c_:>8.1%}{m_:>12.0%}{hh[-1]:>9.1f}")
    return out


if __name__ == "__main__":
    if "--robust" in sys.argv:
        robust()
        sys.exit()
    if "--leverage" in sys.argv:
        leverage()
        sys.exit()
    if "--indexes" in sys.argv:
        trend_indexes()
        sys.exit()
    if "--crypto" in sys.argv:
        crypto()
        sys.exit()
    century()
    if "--stocks" in sys.argv:
        print()
        stocks()
