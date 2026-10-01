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
    python3 tradingview/century.py --factors  # Ken French long-only factor tilts (value, size, quality, investment, momentum), alone and stacked on Trend 2x, graded blind
    python3 tradingview/century.py --quality  # French quality tenth with a 1x market trend filter, plus quality + momentum and quality + value blends, graded blind, then QUAL/MTUM/VTV real-fund check
    python3 tradingview/century.py --lowvol   # French lowest variance and lowest beta tenths: 1x, with a market trend filter, and at 1.5x on margin, graded blind, then USMV/SPLV real-fund check
    python3 tradingview/century.py --robust   # random baseline, execution, fees and crashes for the leveraged pick
    python3 tradingview/century.py --indexes  # the same fixed 2x trend rule on Nasdaq 100, TSX, Nikkei, DAX, Dow, FTSE with dividends
    python3 tradingview/century.py --out     # what Trend 2x holds when out: bills vs Treasuries, gold, 2x bonds, each with its own trend filter
    python3 tradingview/century.py --voltarget # Trend 2x with exposure scaled to trailing realised vol (10/15/20% targets, 20/60 day), and a calm-market 2x/1x switch
    python3 tradingview/century.py --dual     # cross-asset dual momentum (stocks, bonds, gold vs bills) with a 10 month own-trend filter, with and without 2x on stocks
    python3 tradingview/century.py --seasonal # calendar overlays (turn of the month, Halloween, pre-holiday, skip Mondays), alone on 1x S&P and stacked on Trend 2x
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

FACTOR_ETFS = [
    ("Value (top book-to-market tenth)", "VTV or IWD (Russell 1000 Value, much milder than the top tenth); RPV is purer", "no 2x fund; 2x only by margin"),
    ("Size (smallest tenth)", "IWC (micro cap) is the match; IWM or VB are small cap, not micro", "UWM is 2x Russell 2000 (TNA, URTY 3x), not micro cap"),
    ("Quality (top operating profit tenth)", "QUAL (MSCI USA Quality), SPHQ", "no 2x fund; 2x only by margin"),
    ("Investment (lowest asset growth tenth)", "no clean fund; nearest are QUAL or the Dimensional and Avantis profitability tilts", "no 2x fund; 2x only by margin"),
    ("Momentum (top tenth, prior 12-2)", "MTUM, PDP", "no 2x fund; 2x only by margin"),
]


def factors():
    """Long-only Ken French factor tilts: top/bottom value-weighted tenth, monthly, graded blind, alone and stacked on Trend 2x."""
    import math
    ff = french("F-F_Research_Data_Factors_CSV.zip", 0)
    mom = french("10_Portfolios_Prior_12_2_CSV.zip", 0)
    def tenth(name, hi):
        return {m: v[-1 if hi else len(v) - 10] for m, v in french(name, 0).items()}
    TURN, SIDE, MOMT, STRESS = 0.30, FEE, 1.0, 0.005  # yearly one-way turnover, fee per side, momentum dollars traded a month, stress fee per side
    F = {
        "Value (top book-to-market tenth)": (tenth("Portfolios_Formed_on_BE-ME_CSV.zip", True), TURN / 12 * 2),
        "Size (smallest tenth)": (tenth("Portfolios_Formed_on_ME_CSV.zip", False), TURN / 12 * 2),
        "Quality (top operating profit tenth)": (tenth("Portfolios_Formed_on_OP_CSV.zip", True), TURN / 12 * 2),
        "Investment (lowest asset growth tenth)": (tenth("Portfolios_Formed_on_INV_CSV.zip", False), TURN / 12 * 2),
        "Momentum (top tenth, prior 12-2)": ({m: v[9] for m, v in mom.items()}, MOMT),
    }
    for nm, (s, _) in F.items():
        assert all(x > -0.9 for x in s.values()), nm
    ms = sorted(ff)
    mk = {m: ff[m][0] + ff[m][3] for m in ms}
    rf = {m: ff[m][3] for m in ms}
    GAPM = (SWAP_EXP + GAP) / 12  # 2x fund expense plus the measured real-fund gap, a month
    lev, sig = 1.0, []
    L = []
    for m in ms:
        lev *= 1 + mk[m]
        L.append(lev)
        sig.append(len(L) >= 10 and lev > sum(L[-10:]) / 10)
    pos = {ms[i]: sig[i - 1] for i in range(1, len(ms))}  # month-end t decides month t+1
    ms = ms[1:]

    def stats(cv):
        yrs, peak, mdd = (len(cv) - 1) / 12, cv[0], 0.0
        for v in cv:
            peak = max(peak, v)
            mdd = max(mdd, 1 - v / peak)
        return (cv[-1] / cv[0]) ** (1 / yrs) - 1, mdd
    def grow(xs):
        cv = [1.0]
        for x in xs:
            cv.append(cv[-1] * (1 + x))
        return cv
    def decs(sel, rets):
        out = {}
        for m, x in zip(sel, rets):
            out.setdefault(m[:3] + "0s", []).append(x)
        return {d: grow(xs)[-1] ** (12 / len(xs)) - 1 for d, xs in out.items() if len(xs) >= 36}
    def stack(sel, fin):
        """Month by month: 2x model while the market is above its 10 month average, bills otherwise, house fee on each switch."""
        eq, prev, rets = 1.0, pos[sel[0]], []
        for m in sel:
            r = fin[m] if pos[m] else rf[m]
            if pos[m] != prev:
                r = (1 + r) * (1 - FEE) - 1
                prev = pos[m]
            rets.append(r)
        return rets
    def verdict(c, d, won, h, hd):
        return c > h[0] and d <= h[1] and won > len(hd) / 2
    def fin_of(f, tm, fee=SIDE):
        return {m: 2 * (f[m] - tm * fee) - rf[m] - GAPM for m in f}

    split = "1976-01"
    print("KEN FRENCH LONG-ONLY FACTOR TILTS. Monthly, value weighted, survivorship free (CRSP). Top or bottom tenth of all US stocks sorted on each trait.")
    print(f"Market = Mkt-RF + RF. Blind {split} to {ms[-1]}. No settings were picked: every rule below is fixed in advance, so there is no train half to tune on.")
    print(f"Costs: value, size, quality, investment rebalance once a year in the French construction, assumed {TURN:.0%} yearly turnover, charged {SIDE:.1%} a side")
    print(f"  = {TURN * 2 * SIDE:.2%} a year. Momentum keeps the existing {MOMT:.0%} a month turnover, {MOMT * SIDE:.1%} a month. Stress row: {STRESS:.1%} a side on the same turnover.")
    print(f"Stack = hold the tenth at 2x only while the MARKET is above its 10 month average (month-end levels, decided at month end, earns the next month), else T-bills (French RF).")
    print(f"  2x month = 2 x tenth return - RF - {SWAP_EXP:.1%}/12 expense - {GAP:.1%}/12 real-fund gap. Costs double at 2x. {FEE:.1%} fee on every switch. This is monthly and coarser than a daily-reset fund.")
    print("  Monthly resolution misses intramonth drops, so every worst drop here reads a little kinder than a daily one.\n")

    sel_b = [m for m in ms if m >= split]
    mk_b = [mk[m] for m in sel_b]
    mh_b, mh_dec = stats(grow(mk_b)), decs(sel_b, mk_b)
    t2m_b = stack(sel_b, fin_of(mk, 0.0))
    t2_b, t2_dec = stats(grow(t2m_b)), decs(sel_b, t2m_b)
    dl = sorted(mh_dec)
    print(f"Market hold: BLIND {mh_b[0]:.1%} / {mh_b[1]:.0%}   Trend 2x on the market (monthly model): BLIND {t2_b[0]:.1%} / {t2_b[1]:.0%}, decades won vs hold {sum(t2_dec[d] > mh_dec[d] for d in dl)}/{len(dl)}")
    print(f"  (the daily 200 day Trend 2x in --leverage made 14.4% / 44%; the 10 month rule on a monthly series is a different, coarser rule)\n")

    rows_out = []
    print(f"{'UNLEVERED, long only':40}{'series':>9} | {'full span':>8}{'factor':>13}{'market':>13} | {'BLIND factor':>13}{'market':>13} | decades | {'0.5% stress':>11} | bar vs hold / vs Trend 2x")
    store = {}
    for nm, (f, tm) in F.items():
        fm = sorted(f)
        full = [m for m in ms if m in f]
        net = {m: f[m] - tm * SIDE for m in f}
        a = stats(grow([net[m] for m in full])); mfull = stats(grow([mk[m] for m in full]))
        sel = [m for m in sel_b if m in f]
        r = [net[m] for m in sel]
        b, dd = stats(grow(r)), decs(sel, r)
        won = sum(dd[d] > mh_dec[d] for d in dl); won2 = sum(dd[d] > t2_dec[d] for d in dl)
        stx = stats(grow([f[m] - tm * STRESS for m in sel]))
        v1, v2 = verdict(b[0], b[1], won, mh_b, dl), verdict(b[0], b[1], won2, t2_b, dl)
        print(f"{nm:40}{full[0]:>9} | {'':8}{a[0]:>8.1%}/{a[1]:.0%}{mfull[0]:>8.1%}/{mfull[1]:.0%} | {b[0]:>8.1%}/{b[1]:.0%}{mh_b[0]:>8.1%}/{mh_b[1]:.0%} | {won}/{len(dl)}     | {stx[0]:>6.1%}/{stx[1]:.0%} | {'PASS' if v1 else 'FAIL'} / {'PASS' if v2 else 'FAIL'}")
        store[nm] = (dd, b, v1)
    print(f"\n{'blind decade CAGR, unlevered':40}" + "".join(f"{d:>8}" for d in dl))
    print(f"{'Market':40}" + "".join(f"{mh_dec[d]:>8.1%}" for d in dl))
    for nm in F:
        print(f"{nm:40}" + "".join(f"{store[nm][0][d]:>8.1%}" for d in dl))

    print(f"\n{'STACKED on Trend 2x (market above 10 month avg)':48}{'series':>9} | {'full span':>14}{'market T2x':>13} | {'BLIND stack':>13}{'vs hold':>9}{'vs T2x':>9} | decades hold / T2x | random schedules (300): beaten, matched both | bar vs hold / vs Trend 2x")
    cases = [("Market (Trend 2x itself)", mk, 0.0)] + [(nm, F[nm][0], F[nm][1]) for nm in F]
    for nm, f, tm in cases:
        fin = fin_of(f, tm)
        full = [m for m in ms if m in f]
        sf = stats(grow(stack(full, fin))); tf = stats(grow(stack(full, fin_of(mk, 0.0))))
        sel = [m for m in sel_b if m in f]
        r = stack(sel, fin)
        b, dd = stats(grow(r)), decs(sel, r)
        w1 = sum(dd[d] > mh_dec[d] for d in dl); w2 = sum(dd[d] > t2_dec[d] for d in dl)
        v1, v2 = verdict(b[0], b[1], w1, mh_b, dl), verdict(b[0], b[1], w2, t2_b, dl)
        gin = [math.log(max(1 + fin[m], 1e-6)) for m in sel]; gout = [math.log(1 + rf[m]) for m in sel]
        (rc, rd), rnd, k = rand_base([pos[m] for m in sel], gin, gout, len(sel) / 12, draws=300, seed=7)
        beat = sum(x[0] < rc for x in rnd) / len(rnd); both = sum(x[0] >= rc and x[1] <= rd for x in rnd)
        assert abs(rc - b[0]) < 5e-4, (nm, rc, b[0])
        print(f"{nm:48}{full[0]:>9} | {sf[0]:>8.1%}/{sf[1]:.0%} {tf[0]:>7.1%}/{tf[1]:.0%} | {b[0]:>8.1%}/{b[1]:.0%} {b[0] - mh_b[0]:>+8.1%} {b[0] - t2_b[0]:>+8.1%} | {w1}/{len(dl)}  {w2}/{len(dl)}   | beat {beat:.0%}, {both} matched, {k} switches | {'PASS' if v1 else 'FAIL'} / {('PASS' if v2 else 'FAIL') if f is not mk else 'itself'}")
        store["S" + nm] = dd
    print(f"\n{'blind decade CAGR, stacked':48}" + "".join(f"{d:>8}" for d in dl))
    print(f"{'Market hold':48}" + "".join(f"{mh_dec[d]:>8.1%}" for d in dl))
    for nm, f, tm in cases:
        print(f"{nm:48}" + "".join(f"{store['S' + nm][d]:>8.1%}" for d in dl))
    print("\nTRADABILITY (names from memory, not checked against a live listing)")
    for nm, etf, two in FACTOR_ETFS:
        print(f"  {nm:40} {etf}. 2x: {two}.")
    print("  Market: SPY, and SSO is the 2x fund Trend 2x already uses.")


def quality():
    """Quality upgrades on Ken French monthly tenths, all fixed in advance: the quality tenth with the market 10 month trend filter at 1x,
    quality + momentum and quality + value as 50/50 monthly rebalanced blends. Graded blind against holding the market and plain quality."""
    import math
    ff = french("F-F_Research_Data_Factors_CSV.zip", 0)
    def tenth(name, hi):
        return {m: v[-1 if hi else len(v) - 10] for m, v in french(name, 0).items()}
    Q = tenth("Portfolios_Formed_on_OP_CSV.zip", True)
    V = tenth("Portfolios_Formed_on_BE-ME_CSV.zip", True)
    Mo = {m: v[9] for m, v in french("10_Portfolios_Prior_12_2_CSV.zip", 0).items()}
    TURN, MOMT, STRESS, split = 0.30, 1.0, 0.005, "1976-01"
    ms = sorted(ff)
    mk = {m: ff[m][0] + ff[m][3] for m in ms}
    rf = {m: ff[m][3] for m in ms}
    lev, sig, L = 1.0, [], []
    for m in ms:
        lev *= 1 + mk[m]
        L.append(lev)
        sig.append(len(L) >= 10 and lev > sum(L[-10:]) / 10)
    pos = {ms[i]: sig[i - 1] for i in range(1, len(ms))}  # month-end t decides month t+1
    late = {ms[i]: sig[max(i - 2, 0)] for i in range(1, len(ms))}  # one month later than that
    ms = ms[1:]
    GAPM = (SWAP_EXP + GAP) / 12

    def stats(cv):
        yrs, peak, mdd = (len(cv) - 1) / 12, cv[0], 0.0
        for v in cv:
            peak = max(peak, v)
            mdd = max(mdd, 1 - v / peak)
        return (cv[-1] / cv[0]) ** (1 / yrs) - 1, mdd
    def grow(xs):
        cv = [1.0]
        for x in xs:
            cv.append(cv[-1] * (1 + x))
        return cv
    def decs(sel, rets):
        out = {}
        for m, x in zip(sel, rets):
            out.setdefault(m[:3] + "0s", []).append(x)
        return {d: grow(xs)[-1] ** (12 / len(xs)) - 1 for d, xs in out.items() if len(xs) >= 36}
    def year(sel, rets, y):
        xs = [x for m, x in zip(sel, rets) if m[:4] == y]
        cv = grow(xs)
        return cv[-1] - 1, stats(cv)[1] if len(cv) > 2 else 0.0
    def run(sel, net, side, p=None):
        """Monthly returns. With p: hold net while p says in, else bills; each switch costs `side`."""
        if p is None:
            return [net[m] for m in sel]
        prev, rets = p[sel[0]], []
        for m in sel:
            r = net[m] if p[m] else rf[m]
            if p[m] != prev:
                r = (1 + r) * (1 - side) - 1
                prev = p[m]
            rets.append(r)
        return rets
    def nets(side):
        tq = TURN / 12 * 2 * side
        q = {m: Q[m] - tq for m in Q}
        v = {m: V[m] - tq for m in V}
        mo = {m: Mo[m] - MOMT * side for m in Mo}
        def blend(a, b):
            out = {}
            for m in a:
                if m in b:
                    g = 0.5 * a[m] + 0.5 * b[m]
                    out[m] = g - side * 2 * abs(0.5 * (1 + a[m]) / (1 + g) - 0.5)  # drift back to 50/50 each month end
            return out
        return {"q": q, "qm": blend(q, mo), "qv": blend(q, v)}
    VAR = [
        ("0 Quality tenth, plain (reference)", "q", False),
        ("1 Quality + market trend filter, 1x", "q", True),
        ("2 Quality + Momentum, 50/50", "qm", False),
        ("3 Quality + Momentum 50/50 + trend filter", "qm", True),
        ("4 Quality + Value, 50/50", "qv", False),
    ]
    NET, STR = nets(FEE), nets(STRESS)
    sel_b = [m for m in ms if m >= split and m in Q and m in Mo and m in V]
    sel_f = [m for m in ms if m in Q and m in Mo and m in V]
    mk_b = [mk[m] for m in sel_b]
    mh, mh_dec = stats(grow(mk_b)), decs(sel_b, mk_b)
    fin = {m: 2 * mk[m] - rf[m] - GAPM for m in mk}
    t2_r = run(sel_b, fin, FEE, pos)
    t2, t2_dec = stats(grow(t2_r)), decs(sel_b, t2_r)
    dl = sorted(mh_dec)
    def verdict(c, d, won, h, hd):
        return c > h[0] and d <= h[1] and won > len(hd) / 2

    print("QUALITY UPGRADES on Ken French monthly tenths (value weighted, survivorship free). Quality = top operating profitability tenth.")
    print(f"Blind {split} to {sel_b[-1]}. Every rule is fixed in advance, nothing picked. French has no operating profitability x momentum portfolio file, so the blends are 50/50 of two tenths, rebalanced monthly.")
    print(f"Costs: quality and value tenths {TURN:.0%} yearly one way turnover at {FEE:.1%} a side = {TURN * 2 * FEE:.2%} a year; momentum tenth {MOMT:.0%} a month traded = {MOMT * FEE:.1%} a month;")
    print(f"  blends also pay {FEE:.1%} a side on the dollars moved to rebalance back to 50/50 each month end. Trend filter = hold the sleeve only while the MARKET (Mkt-RF + RF cumulative) is above its")
    print(f"  10 month average, else T-bills (French RF); month end t decides month t+1; {FEE:.1%} fee on each switch; no leverage. Stress = {STRESS:.1%} a side on everything incl. switches. Late = signal acts one month later.")
    print("  Monthly resolution misses intramonth drops, so every worst drop reads a little kinder than a daily one.\n")
    print(f"Market hold: BLIND {mh[0]:.1%} / {mh[1]:.0%}.   Trend 2x on the market, monthly model: BLIND {t2[0]:.1%} / {t2[1]:.0%} (decades vs hold {sum(t2_dec[d] > mh_dec[d] for d in dl)}/{len(dl)}). The daily 200 day Trend 2x in --leverage made 14.4% / 44%.\n")

    res = {}
    for nm, k, filt in VAR:
        r = run(sel_b, NET[k], FEE, pos if filt else None)
        res[nm] = dict(r=r, b=stats(grow(r)), dd=decs(sel_b, r), st=stats(grow(run(sel_b, STR[k], STRESS, pos if filt else None))),
                       late=stats(grow(run(sel_b, NET[k], FEE, late))) if filt else None,
                       full=stats(grow(run(sel_f, NET[k], FEE, pos if filt else None))), mfull=stats(grow([mk[m] for m in sel_f])))
    q0 = res[VAR[0][0]]
    print(f"{'BLIND, 1x':44}{'full span ' + sel_f[0]:>26} | {'BLIND':>9}{'vs hold':>9}{'vs plain Q':>11} | decades won vs hold / Q / T2x | {'0.5% stress':>11} | {'1 mo late':>10} | bar: vs hold / vs plain Q / vs T2x model")
    for nm, k, filt in VAR:
        x = res[nm]
        b, dd = x["b"], x["dd"]
        w = [sum(dd[d] > h[d] for d in dl) for h in (mh_dec, q0["dd"], t2_dec)]
        v = [verdict(b[0], b[1], w[0], mh, dl), verdict(b[0], b[1], w[1], q0["b"], dl), verdict(b[0], b[1], w[2], t2, dl)]
        x["w"], x["v"] = w, v
        late_s = f"{x['late'][0]:.1%}/{x['late'][1]:.0%}" if x["late"] else "n/a"
        print(f"{nm:44}{x['full'][0]:>12.1%}/{x['full'][1]:.0%} mkt {x['mfull'][0]:.1%}/{x['mfull'][1]:.0%} | {b[0]:>5.1%}/{b[1]:.0%}{b[0] - mh[0]:>+9.1%}{b[0] - q0['b'][0]:>+11.1%} | {w[0]}/{len(dl)}  {w[1]}/{len(dl)}  {w[2]}/{len(dl)}"
              f"{'':12}| {x['st'][0]:>6.1%}/{x['st'][1]:.0%} | {late_s:>10} | " + " / ".join("PASS" if y else "FAIL" for y in v))
    print(f"{'Market hold':44}{'':26} | {mh[0]:>5.1%}/{mh[1]:.0%}")
    print(f"{'Trend 2x on the market, monthly model':44}{'':26} | {t2[0]:>5.1%}/{t2[1]:.0%}{t2[0] - mh[0]:>+9.1%}")
    print(f"Literal Trend 2x bar 14.4% / 44% (daily): beaten on return by {', '.join(nm[0] for nm, k, f in VAR if res[nm]['b'][0] > 0.144) or 'none'}; also with a drop of 44% or less: {', '.join(nm[0] for nm, k, f in VAR if res[nm]['b'][0] > 0.144 and res[nm]['b'][1] <= 0.44) or 'none'}")

    print(f"\n{'blind decade CAGR':44}" + "".join(f"{d:>8}" for d in dl))
    print(f"{'Market hold':44}" + "".join(f"{mh_dec[d]:>8.1%}" for d in dl))
    print(f"{'Trend 2x on the market, monthly model':44}" + "".join(f"{t2_dec[d]:>8.1%}" for d in dl))
    for nm, k, filt in VAR:
        print(f"{nm:44}" + "".join(f"{res[nm]['dd'][d]:>8.1%}" for d in dl))

    print(f"\n{'CRASH YEARS, return / worst drop inside the year':44}{'2008':>16}{'2022':>16}{'2000-2002':>16}")
    def crash(sel, r):
        xs = [x for m, x in zip(sel, r) if "2000" <= m[:4] <= "2002"]
        cv = grow(xs)
        return cv[-1] - 1, stats(cv)[1]
    def line(nm, sel, r):
        a, b, c = year(sel, r, "2008"), year(sel, r, "2022"), crash(sel, r)
        print(f"{nm:44}{a[0]:>9.1%}/{a[1]:.0%}{b[0]:>9.1%}/{b[1]:.0%}{c[0]:>9.1%}/{c[1]:.0%}")
    line("Market hold", sel_b, mk_b)
    line("Trend 2x on the market, monthly model", sel_b, t2_r)
    for nm, k, filt in VAR:
        line(nm, sel_b, res[nm]["r"])

    print(f"\n{'RANDOM BASELINE, 300 random in/out schedules':44} same months in the market, same number of switches, same sleeve returns")
    for nm, k, filt in VAR:
        if not filt:
            continue
        net = NET[k]
        gin = [math.log(max(1 + net[m], 1e-6)) for m in sel_b]; gout = [math.log(1 + rf[m]) for m in sel_b]
        p = [pos[m] for m in sel_b]
        (rc, rd), rnd, kk = rand_base(p, gin, gout, len(sel_b) / 12, draws=300, seed=7)
        assert abs(rc - res[nm]["b"][0]) < 5e-4, (nm, rc, res[nm]["b"][0])
        beat = sum(x[0] < rc for x in rnd) / len(rnd); both = sum(x[0] >= rc and x[1] <= rd for x in rnd)
        mean_c = sum(x[0] for x in rnd) / len(rnd)
        print(f"{nm:44} in market {sum(p) / len(p):.0%} of months, {kk} switches; beat {beat:.0%} of random on CAGR, {both} matched both CAGR and drop; random mean {mean_c:.1%}")

    print("\nVERDICT (bar = more CAGR than hold, drop no bigger than hold, most of 6 decades):")
    for nm, k, filt in VAR[1:]:
        x = res[nm]
        print(f"  {nm:44} vs hold {'PASS' if x['v'][0] else 'FAIL'}   vs plain quality {'PASS' if x['v'][1] else 'FAIL'}   vs Trend 2x (monthly) {'PASS' if x['v'][2] else 'FAIL'}")
    print()
    quality_real()


def quality_real():
    """The same four variants on the real funds: QUAL, MTUM, VTV against SPY, BIL as bills, daily adjusted closes, from QUAL's first day."""
    from datetime import date
    syms = ["QUAL", "MTUM", "VTV", "SPY", "BIL"]
    px = {}
    for s in syms:
        px[s] = {datetime.fromtimestamp(x[0], timezone.utc).strftime("%Y-%m-%d"): x[4] for x in fetch_yahoo(s)}
        assert px[s], "no Yahoo data for " + s
    ds = sorted(set.intersection(*[set(px[s]) for s in syms]))
    ds = [d for d in ds if d >= min(px["QUAL"])]
    r = {s: [px[s][ds[i]] / px[s][ds[i - 1]] - 1 for i in range(1, len(ds))] for s in syms}
    days = ds[1:]
    # market signal on SPY month ends (full SPY history for the 10 month average), month end t decides month t+1
    spy = px["SPY"]
    last = {}
    for d in sorted(spy):
        last[d[:7]] = spy[d]
    mon = sorted(last)
    sg = {}
    for i, m in enumerate(mon):
        sg[m] = i >= 9 and last[m] > sum(last[x] for x in mon[i - 9:i + 1]) / 10
    prevm = {mon[i]: mon[i - 1] for i in range(1, len(mon))}
    on = [sg.get(prevm.get(d[:7]), False) for d in days]

    def blend(a, b):
        out, va, vb, tot, cur = [], 0.5, 0.5, 1.0, None
        for i, d in enumerate(days):
            if d[:7] != cur:
                if cur is not None:
                    t = va + vb
                    t *= 1 - FEE * 2 * abs(va / t - 0.5)
                    va = vb = t / 2
                cur = d[:7]
            va *= 1 + a[i]; vb *= 1 + b[i]
            out.append((va + vb) / tot - 1)
            tot = va + vb
        return out
    def trend(e):
        out, prev = [], on[0]
        for i in range(len(days)):
            x = e[i] if on[i] else r["BIL"][i]
            if on[i] != prev:
                x = (1 + x) * (1 - FEE) - 1
                prev = on[i]
            out.append(x)
        return out
    qm, qv = blend(r["QUAL"], r["MTUM"]), blend(r["QUAL"], r["VTV"])
    ROWS = [("SPY hold", r["SPY"]), ("QUAL, plain (reference)", r["QUAL"]), ("1 QUAL + market trend filter (SPY 10 month), 1x", trend(r["QUAL"])),
            ("2 QUAL + MTUM, 50/50", qm), ("3 QUAL + MTUM 50/50 + trend filter", trend(qm)), ("4 QUAL + VTV, 50/50", qv)]
    d0 = date.fromisoformat(ds[0]); yrs = (date.fromisoformat(days[-1]) - d0).days / 365.25
    def st(x):
        cv, pk, dd = 1.0, 1.0, 0.0
        for v in x:
            cv *= 1 + v
            pk = max(pk, cv)
            dd = max(dd, 1 - cv / pk)
        return cv ** (1 / yrs) - 1, dd
    def cal(x):
        out = {}
        for d, v in zip(days, x):
            out[d[:4]] = out.get(d[:4], 1.0) * (1 + v)
        return {y: v - 1 for y, v in out.items()}
    ys = sorted(cal(r["SPY"]))
    C = {nm: cal(x) for nm, x in ROWS}
    S = {nm: st(x) for nm, x in ROWS}
    spy_s, q_s = S["SPY hold"], S["QUAL, plain (reference)"]
    print(f"REAL FUND CHECK, {date.today()}. QUAL, MTUM, VTV, SPY, BIL (bills), Yahoo daily adjusted close (dividends in, fund fees in), {ds[0]} (QUAL's first day) to {days[-1]}, {yrs:.1f} years.")
    print(f"Trend filter is on SPY month ends against its 10 month average, applied to the next month's days, {FEE:.1%} on each switch, BIL when out. Blends rebalance to 50/50 each month, {FEE:.1%} a side on the dollars moved.")
    print("Worst drop is peak to trough on daily closes, so it reads harsher than the monthly French rows. Years 2013 (from July) and the last year are partial.")
    print(f"{'':50}{'CAGR / worst drop':>20}{'vs SPY':>9}{'vs QUAL':>9} | years won vs SPY / vs QUAL (of {len(ys)}) | bar vs SPY | 2022")
    for nm, x in ROWS:
        c = S[nm]
        w1 = sum(C[nm][y] > C["SPY hold"][y] for y in ys); w2 = sum(C[nm][y] > C["QUAL, plain (reference)"][y] for y in ys)
        ok = c[0] > spy_s[0] and c[1] <= spy_s[1] + 1e-9 and w1 > len(ys) / 2
        tag = "reference" if nm == "SPY hold" else ("PASS" if ok else "FAIL")
        print(f"{nm:50}{c[0]:>12.1%} / {c[1]:.1%}{c[0] - spy_s[0]:>+9.1%}{c[0] - q_s[0]:>+9.1%} | {w1:>2} / {w2:<2}{'':26}| {tag:9} | {C[nm].get('2022', float('nan')):+.1%}")
    print(f"\n{'calendar year returns':50}" + "".join(f"{y:>8}" for y in ys))
    for nm, x in ROWS:
        print(f"{nm:50}" + "".join(f"{C[nm][y]:>+8.1%}" for y in ys))


def lowvol():
    """Low volatility anomaly on Ken French tenths, all fixed in advance: lowest variance tenth and lowest beta tenth, long only, value weighted,
    at 1x, with the market 10 month trend filter, and at 1.5x on margin (bills + 1%). Graded blind against holding the market and plain quality."""
    import math
    ff = french("F-F_Research_Data_Factors_CSV.zip", 0)
    def lo(name):
        s = {m: v[5] for m, v in french(name, 0).items()}  # columns: Lo 20, Qnt 2-4, Hi 20, then Lo 10, Dec 2-9, Hi 10
        assert all(x > -0.9 for x in s.values()), name
        return s
    LV, LB = lo("Portfolios_Formed_on_VAR_CSV.zip"), lo("Portfolios_Formed_on_BETA_CSV.zip")
    Q = {m: v[-1] for m, v in french("Portfolios_Formed_on_OP_CSV.zip", 0).items()}
    TURN, HI_TURN, STRESS, LEV, MARGIN, split = 0.30, 1.0, 0.005, 1.5, 0.01, "1976-01"
    ms = sorted(ff)
    mk = {m: ff[m][0] + ff[m][3] for m in ms}
    rf = {m: ff[m][3] for m in ms}
    lev, sig, L = 1.0, [], []
    for m in ms:
        lev *= 1 + mk[m]
        L.append(lev)
        sig.append(len(L) >= 10 and lev > sum(L[-10:]) / 10)
    pos = {ms[i]: sig[i - 1] for i in range(1, len(ms))}  # month end t decides month t+1
    late = {ms[i]: sig[max(i - 2, 0)] for i in range(1, len(ms))}  # one month later than that
    ms = ms[1:]
    def stats(cv):
        yrs, peak, mdd = (len(cv) - 1) / 12, cv[0], 0.0
        for v in cv:
            peak = max(peak, v)
            mdd = max(mdd, 1 - v / peak)
        return (cv[-1] / cv[0]) ** (1 / yrs) - 1, mdd
    def grow(xs):
        cv = [1.0]
        for x in xs:
            cv.append(cv[-1] * (1 + x))
        return cv
    def decs(sel, rets):
        out = {}
        for m, x in zip(sel, rets):
            out.setdefault(m[:3] + "0s", []).append(x)
        return {d: grow(xs)[-1] ** (12 / len(xs)) - 1 for d, xs in out.items() if len(xs) >= 36}
    def year(sel, rets, y):
        xs = [x for m, x in zip(sel, rets) if m[:4] == y]
        cv = grow(xs)
        return cv[-1] - 1, stats(cv)[1] if len(cv) > 2 else 0.0
    def sharpe(sel, rets):
        ex = [x - rf[m] for m, x in zip(sel, rets)]
        mu = sum(ex) / len(ex)
        return mu * 12 / (math.sqrt(sum((x - mu) ** 2 for x in ex) / (len(ex) - 1)) * math.sqrt(12))
    def roll(r, mr, w=120):
        cl, cm = [0.0], [0.0]
        for a, b in zip(r, mr):
            cl.append(cl[-1] + math.log(1 + a)); cm.append(cm[-1] + math.log(1 + b))
        d = [math.exp((cl[i + w] - cl[i]) / (w / 12)) - math.exp((cm[i + w] - cm[i]) / (w / 12)) for i in range(len(r) - w + 1)]
        return sum(x > 0 for x in d) / len(d), min(d), len(d)
    def run(sel, net, side, p=None):
        """Monthly returns. With p: hold net while p says in, else bills; each switch costs `side`."""
        if p is None:
            return [net[m] for m in sel]
        prev, rets = p[sel[0]], []
        for m in sel:
            r = net[m] if p[m] else rf[m]
            if p[m] != prev:
                r = (1 + r) * (1 - side) - 1
                prev = p[m]
            rets.append(r)
        return rets
    def series(src, lv, side, turn):
        """Monthly net return of a tenth at lv x. Turnover cost scales with lv; borrowing the extra (lv-1) costs bills + 1%; re-levering to lv x each month end costs `side` on the dollars moved."""
        tq = turn / 12 * 2 * side
        out = {}
        for m, f in src.items():
            if lv == 1.0:
                out[m] = f - tq
                continue
            c = rf[m] + MARGIN / 12
            pos_ = lv * (1 + f)
            eq = pos_ - (lv - 1) * (1 + c)
            out[m] = (eq - 1) - lv * tq - side * abs(lv * eq - pos_)
        return out
    VAR = [
        ("0 Quality tenth, plain (reference)", Q, False, 1.0),
        ("1 Low variance tenth, 1x", LV, False, 1.0),
        ("2 Low beta tenth, 1x", LB, False, 1.0),
        ("3 Low variance + market trend filter, 1x", LV, True, 1.0),
        ("4 Low beta + market trend filter, 1x", LB, True, 1.0),
        ("5 Low variance at 1.5x, margin at bills + 1%", LV, False, LEV),
        ("6 Low beta at 1.5x, margin at bills + 1%", LB, False, LEV),
    ]
    ok = [m for m in ms if m in Q and m in LV and m in LB]
    sel_f = ok
    sel_b = [m for m in ok if m >= split]
    sel_t = [m for m in ok if m < split]
    mk_f, mk_b, mk_t = [mk[m] for m in sel_f], [mk[m] for m in sel_b], [mk[m] for m in sel_t]
    mh, mh_dec, mfull, mtrain = stats(grow(mk_b)), decs(sel_b, mk_b), stats(grow(mk_f)), stats(grow(mk_t))
    mh_fdec = decs(sel_f, mk_f)
    dl, dlf = sorted(mh_dec), sorted(mh_fdec)
    def verdict(c, d, won, h, hd):
        return c > h[0] and d <= h[1] + 1e-9 and won > len(hd) / 2

    res = {}
    for nm, src, filt, lv in VAR:
        net = series(src, lv, FEE, TURN)
        p = pos if filt else None
        r_b, r_f, r_t = run(sel_b, net, FEE, p), run(sel_f, net, FEE, p), run(sel_t, net, FEE, p)
        res[nm] = dict(net=net, p=p, r=r_b, rf_=r_f, b=stats(grow(r_b)), dd=decs(sel_b, r_b), fdd=decs(sel_f, r_f), full=stats(grow(r_f)), tr=stats(grow(r_t)),
                       sh=sharpe(sel_b, r_b), roll=roll(r_f, mk_f),
                       st=stats(grow(run(sel_b, series(src, lv, STRESS, TURN), STRESS, p))),
                       ht=stats(grow(run(sel_b, series(src, lv, FEE, HI_TURN), FEE, p))),
                       late=stats(grow(run(sel_b, net, FEE, late))) if filt else None)
    q0 = res[VAR[0][0]]

    print("LOW VOLATILITY on Ken French tenths (value weighted, survivorship free): lowest variance tenth and lowest beta tenth of all US stocks, long only, monthly.")
    print("French files used: Portfolios_Formed_on_VAR (10 Portfolios Formed on Variance: total return variance over the last 60 days, re-sorted every month end) and")
    print("  Portfolios_Formed_on_BETA (10 Portfolios Formed on Beta: Scholes-Williams beta on 60 months, re-sorted every June). Both start 1963-07, so the unseen half is 1976-now and the")
    print(f"  'train' stretch 1963-07 to 1975-12 is only {len(sel_t) / 12:.1f} years. Nothing is tuned anywhere, so train is just one more window, not a tuning set. Plain quality (top operating profit tenth) is the in-house yardstick.")
    print(f"Costs: every tenth {TURN:.0%} yearly one way turnover at {FEE:.1%} a side = {TURN * 2 * FEE:.2%} a year. The variance tenth is re-sorted monthly, so its real turnover is surely higher than a yearly sort: the '100% turnover' column")
    print(f"  charges {HI_TURN:.0%} a year ({HI_TURN * 2 * FEE:.1%} a year) as a sensitivity, not a pick. Stress = {STRESS:.1%} a side. Trend filter = hold the tenth only while the MARKET (Mkt-RF + RF cumulative) is above its 10 month")
    print(f"  average, else T-bills (French RF); month end t decides month t+1; {FEE:.1%} fee on each switch; no leverage. Late = signal acts one month later.")
    print(f"1.5x rows ({LEV}x fixed from Frazzini and Pedersen's logic, not tuned): 1.5 x tenth return - 0.5 x (T-bill + {MARGIN:.0%} a year margin), turnover cost x1.5, re-levered to 1.5x every month end paying {FEE:.1%} a side on the dollars moved. No fund fee (margin on the tenth itself).")
    print("  Monthly resolution misses intramonth drops, so every worst drop reads a little kinder than a daily one. Sharpe = excess over French RF, annualised, blind.\n")
    print(f"Market hold: BLIND {mh[0]:.1%} / {mh[1]:.0%}, Sharpe {sharpe(sel_b, mk_b):.2f}.  Full {sel_f[0]} to {sel_f[-1]}: {mfull[0]:.1%} / {mfull[1]:.0%}.  Train {sel_t[0]} to {sel_t[-1]}: {mtrain[0]:.1%} / {mtrain[1]:.0%}.\n")

    print(f"{'BLIND 1976-now':46}{'BLIND':>10}{'vs hold':>9}{'vs plain Q':>11}{'Sharpe':>7} | decades won vs hold / Q (of {len(dl)}) | {'0.5% stress':>11} | {'100% turn':>10} | {'1 mo late':>10} | bar: vs hold / vs plain Q")
    for nm, src, filt, lv in VAR:
        x = res[nm]
        b = x["b"]
        w = [sum(x["dd"][d] > h[d] for d in dl) for h in (mh_dec, q0["dd"])]
        x["w"], x["v"] = w, [verdict(b[0], b[1], w[0], mh, dl), verdict(b[0], b[1], w[1], q0["b"], dl)]
        late_s = f"{x['late'][0]:.1%}/{x['late'][1]:.0%}" if x["late"] else "n/a"
        print(f"{nm:46}{b[0]:>5.1%}/{b[1]:.0%}{b[0] - mh[0]:>+9.1%}{b[0] - q0['b'][0]:>+11.1%}{x['sh']:>7.2f} | {w[0]}/{len(dl)}   {w[1]}/{len(dl)}{'':23}| {x['st'][0]:>6.1%}/{x['st'][1]:.0%} | {x['ht'][0]:>5.1%}/{x['ht'][1]:.0%} | {late_s:>10} | "
              + " / ".join("PASS" if y else "FAIL" for y in x["v"]))
    print(f"{'Market hold':46}{mh[0]:>5.1%}/{mh[1]:.0%}{'':9}{'':11}{sharpe(sel_b, mk_b):>7.2f}")

    print(f"\n{'ALL WINDOWS':46}{'train ' + sel_t[0] + ' to 1975':>26}{'full ' + sel_f[0] + ' to now':>26} | decades won vs hold (of {len(dlf)}) | rolling 10 year windows beating market, worst gap")
    print(f"{'Market hold':46}{mtrain[0]:>17.1%}/{mtrain[1]:.0%}{mfull[0]:>17.1%}/{mfull[1]:.0%}")
    for nm, src, filt, lv in VAR:
        x = res[nm]
        wf = sum(x["fdd"][d] > mh_fdec[d] for d in dlf)
        x["wf"] = wf
        print(f"{nm:46}{x['tr'][0]:>17.1%}/{x['tr'][1]:.0%}{x['full'][0]:>17.1%}/{x['full'][1]:.0%} | {wf}/{len(dlf)}{'':26}| {x['roll'][0]:.0%} of {x['roll'][2]} windows, worst {x['roll'][1]:+.1%} a year")

    print(f"\n{'blind decade CAGR':46}" + "".join(f"{d:>8}" for d in dl))
    print(f"{'Market hold':46}" + "".join(f"{mh_dec[d]:>8.1%}" for d in dl))
    for nm, *_ in VAR:
        print(f"{nm:46}" + "".join(f"{res[nm]['dd'][d]:>8.1%}" for d in dl))
    print(f"\n{'full span decade CAGR (1960s from 1963-07)':46}" + "".join(f"{d:>8}" for d in dlf))
    print(f"{'Market hold':46}" + "".join(f"{mh_fdec[d]:>8.1%}" for d in dlf))
    for nm, *_ in VAR:
        print(f"{nm:46}" + "".join(f"{res[nm]['fdd'][d]:>8.1%}" for d in dlf))

    print(f"\n{'CRASH YEARS, return / worst drop inside the year':46}{'2008':>16}{'2022':>16}{'2000-2002':>16}")
    def line(nm, sel, r):
        a, b = year(sel, r, "2008"), year(sel, r, "2022")
        xs = [x for m, x in zip(sel, r) if "2000" <= m[:4] <= "2002"]
        c = (grow(xs)[-1] - 1, stats(grow(xs))[1])
        print(f"{nm:46}{a[0]:>9.1%}/{a[1]:.0%}{b[0]:>9.1%}/{b[1]:.0%}{c[0]:>9.1%}/{c[1]:.0%}")
    line("Market hold", sel_b, mk_b)
    for nm, *_ in VAR:
        line(nm, sel_b, res[nm]["r"])

    print(f"\n{'RANDOM BASELINE, 300 random in/out schedules':46} same months in the market, same number of switches, same tenth returns")
    for nm, src, filt, lv in VAR:
        if not filt:
            continue
        net = res[nm]["net"]
        gin = [math.log(max(1 + net[m], 1e-6)) for m in sel_b]; gout = [math.log(1 + rf[m]) for m in sel_b]
        p = [pos[m] for m in sel_b]
        (rc, rd), rnd, kk = rand_base(p, gin, gout, len(sel_b) / 12, draws=300, seed=7)
        assert abs(rc - res[nm]["b"][0]) < 5e-4, (nm, rc, res[nm]["b"][0])
        beat = sum(x[0] < rc for x in rnd) / len(rnd); both = sum(x[0] >= rc and x[1] <= rd for x in rnd)
        mean_c = sum(x[0] for x in rnd) / len(rnd)
        print(f"{nm:46} in market {sum(p) / len(p):.0%} of months, {kk} switches; beat {beat:.0%} of random on CAGR, {both} matched both CAGR and drop; random mean {mean_c:.1%}")

    print("\nVERDICT MODEL (bar = more CAGR than the comparison, drop no bigger, most of 6 blind decades):")
    for nm, *_ in VAR[1:]:
        x = res[nm]
        print(f"  {nm:46} vs hold {'PASS' if x['v'][0] else 'FAIL'}   vs plain quality {'PASS' if x['v'][1] else 'FAIL'}")
    print()
    lowvol_real()


def lowvol_real():
    """The same rows on real funds: USMV and SPLV against SPY from USMV's first day, BIL as bills, daily adjusted closes."""
    from datetime import date
    syms = ["USMV", "SPLV", "SPY", "BIL"]
    px = {}
    for s in syms:
        px[s] = {datetime.fromtimestamp(x[0], timezone.utc).strftime("%Y-%m-%d"): x[4] for x in fetch_yahoo(s)}
        assert px[s], "no Yahoo data for " + s
    ds = sorted(set.intersection(*[set(px[s]) for s in syms]))
    r = {s: [px[s][ds[i]] / px[s][ds[i - 1]] - 1 for i in range(1, len(ds))] for s in syms}
    days = ds[1:]
    spy = px["SPY"]
    last = {}
    for d in sorted(spy):
        last[d[:7]] = spy[d]
    mon = sorted(last)
    sg = {}
    for i, m in enumerate(mon):
        sg[m] = i >= 9 and last[m] > sum(last[x] for x in mon[i - 9:i + 1]) / 10
    prevm = {mon[i]: mon[i - 1] for i in range(1, len(mon))}
    on = [sg.get(prevm.get(d[:7]), False) for d in days]
    on_late = [sg.get(prevm.get(prevm.get(d[:7])), False) for d in days]
    MARGIN, LEV = 0.01, 1.5

    def trend(e, sw):
        out, prev = [], sw[0]
        for i in range(len(days)):
            x = e[i] if sw[i] else r["BIL"][i]
            if sw[i] != prev:
                x = (1 + x) * (1 - FEE) - 1
                prev = sw[i]
            out.append(x)
        return out
    def lever(e):
        """1.5x on margin at BIL + 1%, drifts through the month, re-levered each month end paying FEE on the dollars moved."""
        out, p, debt, cur, prev_eq = [], LEV, LEV - 1, None, 1.0
        for i, d in enumerate(days):
            if d[:7] != cur:
                if cur is not None:
                    eq = p - debt
                    eq -= FEE * abs(LEV * eq - p)
                    p, debt = LEV * eq, (LEV - 1) * eq
                cur = d[:7]
            p *= 1 + e[i]
            debt *= 1 + r["BIL"][i] + MARGIN / 252
            out.append((p - debt) / prev_eq - 1)
            prev_eq = p - debt
        return out
    ROWS = [("SPY hold", r["SPY"]), ("USMV, 1x", r["USMV"]), ("SPLV, 1x", r["SPLV"]),
            ("USMV + SPY 10 month trend filter, 1x", trend(r["USMV"], on)), ("Same, signal one month late", trend(r["USMV"], on_late)),
            ("USMV at 1.5x, margin at BIL + 1%", lever(r["USMV"])), ("SPLV at 1.5x, margin at BIL + 1%", lever(r["SPLV"]))]
    d0 = date.fromisoformat(ds[0]); yrs = (date.fromisoformat(days[-1]) - d0).days / 365.25
    def st(x):
        cv, pk, dd = 1.0, 1.0, 0.0
        for v in x:
            cv *= 1 + v
            pk = max(pk, cv)
            dd = max(dd, 1 - cv / pk)
        return cv ** (1 / yrs) - 1, dd
    def sh(x):
        ex = [a - b for a, b in zip(x, r["BIL"])]
        mu = sum(ex) / len(ex)
        return mu * 252 / ((sum((a - mu) ** 2 for a in ex) / (len(ex) - 1)) ** 0.5 * 252 ** 0.5)
    def cal(x):
        out = {}
        for d, v in zip(days, x):
            out[d[:4]] = out.get(d[:4], 1.0) * (1 + v)
        return {y: v - 1 for y, v in out.items()}
    ys = sorted(cal(r["SPY"]))
    C = {nm: cal(x) for nm, x in ROWS}
    S = {nm: st(x) for nm, x in ROWS}
    spy_s = S["SPY hold"]
    print(f"REAL FUND CHECK, {date.today()}. USMV (iShares MSCI USA Min Vol), SPLV (Invesco S&P 500 Low Volatility), SPY, BIL (bills), Yahoo daily adjusted close (dividends in, fund fees in), {ds[0]} (USMV's first day) to {days[-1]}, {yrs:.1f} years.")
    print(f"SPLV also trades from 2011-05 but is cut to the common window. Trend filter on SPY month ends against its 10 month average, applied to the next month's days, {FEE:.1%} on each switch, BIL when out. 1.5x rows borrow at BIL + {MARGIN:.0%},")
    print(f"drift through the month, re-lever every month end paying {FEE:.1%} on the dollars moved. Worst drop is peak to trough on daily closes, so it reads harsher than the monthly French rows. Years 2011 (from October) and the last year are partial.")
    print(f"{'':42}{'CAGR / worst drop':>20}{'vs SPY':>9}{'Sharpe':>7} | years won vs SPY (of {len(ys)}) | bar vs SPY | 2022")
    for nm, x in ROWS:
        c = S[nm]
        w1 = sum(C[nm][y] > C["SPY hold"][y] for y in ys)
        okb = c[0] > spy_s[0] and c[1] <= spy_s[1] + 1e-9 and w1 > len(ys) / 2
        tag = "reference" if nm == "SPY hold" else ("PASS" if okb else "FAIL")
        print(f"{nm:42}{c[0]:>12.1%} / {c[1]:.1%}{c[0] - spy_s[0]:>+9.1%}{sh(x):>7.2f} | {w1:>2}{'':22}| {tag:9} | {C[nm].get('2022', float('nan')):+.1%}")
    print(f"\n{'calendar year returns':42}" + "".join(f"{y:>8}" for y in ys))
    for nm, x in ROWS:
        print(f"{nm:42}" + "".join(f"{C[nm][y]:>+8.1%}" for y in ys))


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


# ---------- what to hold when the trend is out (--out) ----------

OUT_EXP = {"ief": 0.0015, "tlt": 0.0015, "gold": 0.004}  # IEF, TLT, GLD expense ratios, taken off the model series


def out_data(D):
    """Daily returns after fund expenses: ief = 10y Treasury priced from yields, tlt = 20y par bond repriced off the same 10y yield
    (parallel shift, 10y coupon, so carry is a little low), gold = monthly gold price spread over the month's days."""
    dates, bill = D[0], D[3]
    sh = {r[0][:7]: float(r[5]) for r in rows("shiller.csv")}
    y = {k: v / 100 for k, v in sh.items() if v > 0 and k < "1953-04"}
    y.update({r[0][:7]: float(r[1]) / 100 for r in rows("gs10.csv") if r[1] not in ("", ".")})
    yk = sorted(y)
    b20 = {yk[i]: bond_ret(y[yk[i - 1]], y[yk[i]], 20.0) for i in range(1, len(yk))}
    gm = to_rets({r[0][:7]: float(r[1]) for r in rows("gold.csv")})
    nd = {}
    for d in dates:
        nd[d[:7]] = nd.get(d[:7], 0) + 1
    spread = lambda m, k: (1 + m.get(k, 0.0)) ** (1 / nd[k]) - 1
    ief = [r - OUT_EXP["ief"] / 252 for r in D[4]]
    tlt = [spread(b20, d[:7]) - OUT_EXP["tlt"] / 252 for d in dates]
    gold = [spread(gm, d[:7]) - OUT_EXP["gold"] / 252 for d in dates]
    return {"ief": ief, "tlt": tlt, "gold": gold, "mix": [0.5 * b + 0.5 * g for b, g in zip(bill, gold)]}


def real_rets(dates, sym):
    """Daily return of a real fund (Yahoo adjusted close, dividends in, expenses out) on the S&P calendar; 0 before it exists."""
    px, prev, out = {r[0]: r[2] for r in raw(sym)}, None, []
    for d in dates:
        out.append(px[d] / prev - 1 if d in px and prev else 0.0)
        if d in px:
            prev = px[d]
    return out


def trend_of(rets):
    """True while the asset's own total return index closes above its 200 day average."""
    idx, v = [], 1.0
    for r in rets:
        v *= 1 + r
        idx.append(v)
    sg, run = [False] * len(idx), sum(idx[:200])
    for i in range(200, len(idx)):
        run += idx[i] - idx[i - 200]
        sg[i] = idx[i] > run / 200
    return sg


def out_sim(D, spec, lo, hi, fee=FEE, delay=0, gap=GAP, amask=None):
    """Fixed Trend 2x (2x fund above the S&P 200 day average, signal at close j-2, trade close j-1, earn day j, 2x fund model with
    SWAP_EXP + gap). When out, hold spec['ret'] (x spec['mult'] as a daily-reset fund: m*r - bill - SWAP_EXP - gap), or bills when
    spec['sig'] (the asset's own 200 day trend) says no. Fee on every non-cash dollar bought or sold; spec['frac'] = non-cash share."""
    dates, _, sp, bill, _, sigs = D
    s, r0, so = sigs["200d"], spec["ret"], spec.get("sig")
    fr = {"stock": 1.0, "asset": spec["frac"], "bills": 0.0, None: 1.0}
    m = spec["mult"]
    eq, pos, curve = 1.0, None, [1.0]
    for j in range(lo, hi):
        if s[j - 2 - delay]:
            st = "stock"
        elif amask is not None:
            st = "asset" if amask[j - lo] else "bills"
        else:
            st = "asset" if (so is None or so[j - 2 - delay]) else "bills"
        if st != pos:
            eq *= 1 - fee * (fr[st] + fr[pos])
            pos = st
        if st == "stock":
            eq *= max(1 + 2 * sp[j] - bill[j] - (SWAP_EXP + gap) / 252, 1e-12)
        elif st == "asset":
            eq *= max(1 + (r0[j] if m == 1 else m * r0[j] - bill[j] - (SWAP_EXP + gap) / 252), 1e-12)
        else:
            eq *= 1 + bill[j]
        curve.append(eq)
    return curve


def out_specs(D, rets):
    """name -> spec. rets = {'ief','tlt','gold','mix'} daily returns (model or real funds)."""
    sp = {"T-bills (baseline)": {"ret": D[3], "mult": 1, "frac": 0.0}}
    for key, nm in (("ief", "IEF-like 10y"), ("tlt", "TLT-like 20y"), ("gold", "Gold"), ("mix", "50/50 bills+gold")):
        fr = 0.5 if key == "mix" else 1.0
        sp[nm] = {"ret": rets[key], "mult": 1, "frac": fr}
        sp[nm + ", own trend"] = {"ret": rets[key], "mult": 1, "frac": fr, "sig": trend_of(rets[key])}
    for key, nm in (("ief", "2x IEF-like"), ("tlt", "2x TLT-like")):
        sp[nm + ", bond uptrend"] = {"ret": rets[key], "mult": 2, "frac": 1.0, "sig": trend_of(rets[key])}
    return sp


def out_random(D, spec, lo, hi, base, draws=500, seed=7):
    """Rule's own asset on/off schedule against random ones: same stock schedule, same asset days among the out days, same number of
    asset/bills switches. Returns (share of randoms the rule's CAGR beats, randoms matching both CAGR and worst drop)."""
    import random
    dates, s = D[0], D[5]["200d"]
    outs = [j for j in range(lo, hi) if not s[j - 2]]
    seq = [spec["sig"][j - 2] for j in outs]
    n, n_in = len(seq), sum(seq)
    if n_in in (0, n):
        return None
    k = sum(seq[i] != seq[i - 1] for i in range(1, n))
    segs = k + 1
    n_si = (segs + 1) // 2 if seq[0] else segs // 2
    n_so = segs - n_si
    def comp(total, m):
        cuts = sorted(random.sample(range(1, total), m - 1))
        return [b - a for a, b in zip([0] + cuts, cuts + [total])]
    st = dstats(dates, out_sim(D, spec, lo, hi), lo)
    random.seed(seed)
    wins = both = 0
    for _ in range(draws):
        ins, ots = comp(n_in, n_si), comp(n - n_in, n_so)
        p, cur, ii, oo = [], seq[0], 0, 0
        for _ in range(segs):
            if cur:
                p += [True] * ins[ii]; ii += 1
            else:
                p += [False] * ots[oo]; oo += 1
            cur = not cur
        mk = [False] * (hi - lo)
        for j, v in zip(outs, p):
            mk[j - lo] = v
        r = dstats(dates, out_sim(D, spec, lo, hi, amask=mk), lo)
        wins += r["cagr"] < st["cagr"]
        both += r["cagr"] >= st["cagr"] and r["mdd"] <= st["mdd"]
    return wins / draws, both, k


def out_asset():
    D = lev_data()
    dates = D[0]
    lo = next(i for i, d in enumerate(dates) if d >= "1929-01-01")
    split = next(i for i, d in enumerate(dates) if d >= LEV_SPLIT)
    hi = len(dates)
    M = out_data(D)
    specs = out_specs(D, M)
    base = "T-bills (baseline)"
    print(f"WHAT TO HOLD WHEN OUT. Fixed rule: Trend 2x S&P (2x fund above 200 day average, signal at close, trade next close, {FEE:.1%} a switch,")
    print(f"daily-reset 2x fund model with {SWAP_EXP:.1%} expense, {GAP:.1%} a year model gap taken off). Pick on {dates[lo]}..{dates[split - 1]}, blind {dates[split]}..{dates[-1]}.")
    print("Out-assets, daily, net of fund expenses (IEF 0.15%, TLT 0.15%, GLD 0.40%). IEF-like = 10y Treasury priced off GS10 yields. TLT-like = 20y par bond")
    print("repriced off the same GS10 yield (parallel shift, 10y coupon). Gold = monthly price series (fixed at $20.67/$35 until 1971, private ownership banned")
    print("until 1974, so its train half is not a real test) spread over the month. 2x bond = daily-reset 2x of that bond, T-bill financing, 0.9% expense + gap.")
    print("'own trend' = hold it only while its own total return index is above its 200 day average, else bills (signal timing as the stock rule).")
    print("The 50/50 mix is half bills, half gold, rebalance cost ignored. Fee counted on every non-cash dollar bought or sold.\n")

    # model against real funds
    r0 = next(i for i, d in enumerate(dates) if d >= "2006-01-03")
    print("MODEL VS REAL FUNDS, 2006-01-03 on, always invested (Yahoo adjusted closes)")
    for key, sym in (("ief", "IEF"), ("tlt", "TLT"), ("gold", "GLD")):
        mc, rc = [1.0], [1.0]
        rr = real_rets(dates, sym)
        for j in range(r0, hi):
            mc.append(mc[-1] * (1 + M[key][j]))
            rc.append(rc[-1] * (1 + rr[j]))
        m_, r_ = dstats(dates, mc, r0), dstats(dates, rc, r0)
        print(f"  {sym:4} model {m_['cagr']:.1%} / worst {m_['mdd']:.0%}   real {r_['cagr']:.1%} / worst {r_['mdd']:.0%}   gap {m_['cagr'] - r_['cagr']:+.1%} a year")
    print()

    names = list(specs)
    tr, bl, nog, late, cur = {}, {}, {}, {}, {}
    for nm in names:
        sp_ = specs[nm]
        tr[nm] = dstats(dates, out_sim(D, sp_, lo, split), lo)
        cur[nm] = out_sim(D, sp_, split, hi)
        bl[nm] = dstats(dates, cur[nm], split)
        nog[nm] = dstats(dates, out_sim(D, sp_, split, hi, gap=0.0), split)
        late[nm] = dstats(dates, out_sim(D, sp_, split, hi, delay=1), split)
    dec = {nm: ddecades(dates, cur[nm], split) for nm in names}
    decs = sorted(dec[base])
    chk = dstats(dates, lev_sim(D, 2.0, "200d", "bills", "etf", split, hi, FEE, 0, GAP), split)
    assert abs(chk["cagr"] - bl[base]["cagr"]) < 1e-3 and abs(chk["mdd"] - bl[base]["mdd"]) < 1e-3, (chk, bl[base])
    print(f"Baseline matches lev_sim (etf, 2x, 200d, bills, gap {GAP:.1%}): {chk['cagr']:.1%} / {chk['mdd']:.0%}. Without the gap it is {nog[base]['cagr']:.1%} / {nog[base]['mdd']:.0%}, the --leverage row.\n")

    W = 28
    print(f"{'out-asset':{W}} | {'train CAGR':>10}{'maxDD':>6} | {'BLIND CAGR':>10}{'maxDD':>6}{'no gap':>8} | {'won vs bills':>12} | {'1 day late':>12}")
    for nm in names:
        print(f"{nm:{W}} | {tr[nm]['cagr']:>10.1%}{tr[nm]['mdd']:>6.0%} | {bl[nm]['cagr']:>10.1%}{bl[nm]['mdd']:>6.0%}{nog[nm]['cagr']:>8.1%} | "
              f"{(sum(dec[nm][d] > dec[base][d] for d in decs) if nm != base else '-'):>9}/{len(decs) if nm != base else '':<2}| {late[nm]['cagr']:>7.1%} /{late[nm]['mdd']:>3.0%}")

    print(f"\n{'blind decade CAGR':{W}}" + "".join(f"{d:>8}" for d in decs))
    for nm in names:
        print(f"{nm:{W}}" + "".join(f"{dec[nm][d]:>8.1%}" for d in decs))

    # stress windows
    dl = dates[split - 1:hi]
    hold = lev_sim(D, 1.0, None, "bills", "margin", split, hi)
    wins = (("2008 (calendar year)", "2008-01-01", "2008-12-31"), ("2022 (calendar year)", "2022-01-01", "2022-12-31"),
            ("Mar 2020 (Feb 19 to Apr 30)", "2020-02-19", "2020-04-30"))
    print("\nSTRESS, blind, rule with each out-asset: return over the window (worst drop inside it)")
    print(f"{'':{W}}" + "".join(f"{w[0][:17]:>20}" for w in wins))
    print(f"{'S&P hold':{W}}" + "".join(f"{window(dl, hold, a, b)[0]:>+12.0%} ({window(dl, hold, a, b)[1]:>3.0%})  " for _, a, b in wins))
    for nm in names:
        print(f"{nm:{W}}" + "".join(f"{window(dl, cur[nm], a, b)[0]:>+12.0%} ({window(dl, cur[nm], a, b)[1]:>3.0%})  " for _, a, b in wins))
    print("\nThe out-assets alone in those windows (always held, no stocks), return (worst drop):")
    for key, nm in (("ief", "IEF-like"), ("tlt", "TLT-like"), ("gold", "Gold"), ("mix", "50/50 bills+gold"), ("bill", "T-bills")):
        r_ = D[3] if key == "bill" else M[key]
        cv = [1.0]
        for j in range(split, hi):
            cv.append(cv[-1] * (1 + r_[j]))
        print(f"{nm:{W}}" + "".join(f"{window(dl, cv, a, b)[0]:>+12.0%} ({window(dl, cv, a, b)[1]:>3.0%})  " for _, a, b in wins))
    # how often the stock rule is out in those windows
    s = D[5]["200d"]
    for lab, a, b in wins[:2]:
        js = [j for j in range(split, hi) if a <= dates[j] <= b]
        print(f"  Stock rule out of the S&P on {sum(not s[j - 2] for j in js)} of {len(js)} days in {lab[:4]}.")

    # random baseline
    print("\nRANDOM BASELINE where the switch schedule differs (500 random asset/bills schedules, same stock schedule, same asset days among the out days, same asset switches)")
    for nm in names:
        if "sig" not in specs[nm]:
            continue
        r = out_random(D, specs[nm], split, hi, base)
        if r is None:
            print(f"  {nm:{W}} filter never differs from always holding it"); continue
        print(f"  {nm:{W}} {bl[nm]['cagr']:.1%} beats {r[0]:.0%} of random schedules ({r[2]} asset/bills flips), randoms matching on return and worst drop: {r[1]} of 500")
    print("  The unfiltered rows share the baseline's stock in/out schedule exactly; only the asset held when out differs, so there is nothing to shuffle.")

    # pick and bar
    b0, d0 = bl[base], dec[base]
    print(f"\nPICK on the train half: best train CAGR whose train worst drop is no bigger than the bills baseline's ({tr[base]['mdd']:.0%}); must also beat its train CAGR ({tr[base]['cagr']:.1%}).")
    ok = [nm for nm in names if nm != base and tr[nm]["cagr"] > tr[base]["cagr"] and tr[nm]["mdd"] <= tr[base]["mdd"]]
    pk = max(ok, key=lambda nm: tr[nm]["cagr"]) if ok else base
    print(f"  train pick: {pk}" + ("" if ok else " (nothing beat bills on the train half)"))
    ok2 = [nm for nm in ok if "Gold" not in nm and "gold" not in nm]
    l35 = next(i for i, d in enumerate(dates) if d >= "1935-01-01")
    g35, b35 = (dstats(dates, out_sim(D, specs[n_], l35, split), l35) for n_ in ("Gold, own trend", base))
    print(f"  Gold's train half is a fixed price (one revaluation, Jan 1934, +69%) until 1971, and private gold was banned until 1974, so its train edge is not tradable history."
          f" From 1935 on: gold own trend {g35['cagr']:.1%} / {g35['mdd']:.0%} against bills {b35['cagr']:.1%} / {b35['mdd']:.0%}.")
    print(f"  train pick with gold set aside: {max(ok2, key=lambda nm: tr[nm]['cagr']) if ok2 else base}")
    print(f"\nBAR vs Trend 2x with bills ({b0['cagr']:.1%} / {b0['mdd']:.1%}): blind CAGR higher, worst drop no bigger, more than half the decades won.")
    for nm in names[1:]:
        w = sum(dec[nm][d] > d0[d] for d in decs)
        pas = bl[nm]["cagr"] > b0["cagr"] and bl[nm]["mdd"] <= b0["mdd"] and w > len(decs) / 2
        why = "" if pas else " (" + ", ".join(x for x, c in (("less return", bl[nm]["cagr"] <= b0["cagr"]), ("bigger drop", bl[nm]["mdd"] > b0["mdd"]), (f"{w} of {len(decs)} decades", w <= len(decs) / 2)) if c) + ")"
        print(f"  {nm:{W}} {bl[nm]['cagr']:.1%} / {bl[nm]['mdd']:.1%}, won {w}/{len(decs)}: {'PASS' if pas else 'FAIL'}{why}{'   [train pick]' if nm == pk else ''}")

    # real funds
    print("\nREAL FUNDS CHECK, 2006-01-03 on (Yahoo adjusted closes for IEF, TLT, GLD; 2x rows run the 2x fund model on the real fund's returns). Same fixed rule, gap taken off.")
    real = {"ief": real_rets(dates, "IEF"), "tlt": real_rets(dates, "TLT"), "gold": real_rets(dates, "GLD")}
    real["mix"] = [0.5 * b + 0.5 * g for b, g in zip(D[3], real["gold"])]
    rs = out_specs(D, real)
    rc = {nm: out_sim(D, rs[nm], r0, hi) for nm in rs}
    dl2 = dates[r0 - 1:hi]
    print(f"{'out-asset':{W}} | {'CAGR':>6}{'maxDD':>6} | {'2008':>12} | {'2022':>12}")
    for nm in rs:
        c, dd = dstats(dates, rc[nm], r0)["cagr"], dstats(dates, rc[nm], r0)["mdd"]
        w8, w22 = window(dl2, rc[nm], "2008-01-01", "2008-12-31"), window(dl2, rc[nm], "2022-01-01", "2022-12-31")
        print(f"{nm:{W}} | {c:>6.1%}{dd:>6.0%} | {w8[0]:>+6.0%} ({w8[1]:>3.0%}) | {w22[0]:>+6.0%} ({w22[1]:>3.0%})")


# ---------- volatility targeting on top of Trend 2x (--voltarget) ----------

VT_BAND = 0.25  # rebalance only when the exposure held is this far from the target


def vt_weights(e):
    """(2x fund share, plain fund share) of the dollar for exposure e in [0, 2]: plain fund and bills below 1x, 2x fund and plain fund from 1x to 2x."""
    return (0.0, e) if e <= 1 else (e - 1, 2 - e)


def vt_cost(levels):
    """Non-cash dollars traded per dollar held when walking the exposure levels from all cash (no drift, so it is a clean yardstick)."""
    prev = tot = 0.0
    for e in levels:
        a0, b0 = vt_weights(prev)
        a1, b1 = vt_weights(e)
        tot += abs(a1 - a0) + abs(b1 - b0)
        prev = e
    return tot


def vol_roll(sp, w):
    """Annualised std of the trailing w daily returns, known at that day's close; None until w returns exist."""
    out, s1, s2 = [None] * len(sp), 0.0, 0.0
    for i in range(1, len(sp)):
        s1 += sp[i]
        s2 += sp[i] * sp[i]
        if i > w:
            s1 -= sp[i - w]
            s2 -= sp[i - w] * sp[i - w]
        if i >= w:
            out[i] = (max(s2 - s1 * s1 / w, 0.0) / (w - 1)) ** 0.5 * 252 ** 0.5
    return out


def vt_targets(sp, s, kind, par):
    """Exposure wanted at each close (0 = all bills). trend: 2 above the 200 day average. vol: min(2, target / realised vol) above it, par = (target, window).
    regime: 2 when the 20 day vol is under its own trailing 1 year median, else 1, above the average."""
    import bisect
    if kind == "trend":
        return [2.0 if x else 0.0 for x in s]
    if kind == "vol":
        v = vol_roll(sp, par[1])
        return [min(2.0, par[0] / v[i]) if s[i] and v[i] else 0.0 for i in range(len(sp))]
    v = vol_roll(sp, 20)
    win, out = [], [0.0] * len(sp)
    for i in range(len(sp)):
        if v[i] is None:
            continue
        bisect.insort(win, v[i])
        if i - 20 >= 252:
            old = v[i - 252]
            win.pop(bisect.bisect_left(win, old))
        if s[i]:
            out[i] = 1.0 if len(win) < 252 else (2.0 if v[i] < (win[125] + win[126]) / 2 else 1.0)
    return out


def vt_run(F, tg, lo, hi, delay=0, fee=FEE, band=VT_BAND, plan=None):
    """Daily equity of a mix of a 2x fund, a plain fund and bills. F = (2x fund, plain fund, bills) daily growth factors. The target read at close
    j-2-delay is traded at close j-1 and earns day j, but only when the position flips between in and out or the exposure held has drifted more than band
    from it. Fee on every non-cash dollar bought or sold. plan {day: exposure} forces rebalances at exactly those days instead (random baselines).
    Returns the curve and (events, non-cash dollars traded per dollar, mean exposure held, mean exposure while in)."""
    f2, f1, fb = F
    A = B = 0.0
    C = eq = 1.0
    pos, x = None, 0.0
    curve, ev, traded, esum, isum, idays = [1.0], [], 0.0, 0.0, 0.0, 0
    for j in range(lo, hi):
        if plan is None:
            e = tg[j - 2 - delay]
            do = (e > 0) != pos or (pos and abs(e - x) > band)
        else:
            e = plan.get(j)
            do = e is not None
        if do:
            w2, w1 = vt_weights(e)
            t = abs(w2 * eq - A) + abs(w1 * eq - B)
            traded += t / eq
            eq *= 1 - fee * t / eq
            A, B = w2 * eq, w1 * eq
            C = eq - A - B
            pos, x = e > 0, e
            ev.append((j, e))
        esum += x
        if x > 0:
            isum += x
            idays += 1
        A *= f2[j]
        B *= f1[j]
        C *= fb[j]
        eq = A + B + C
        x = (2 * A + B) / eq
        curve.append(eq)
    return curve, (ev, traded, esum / (hi - lo), isum / idays if idays else 0.0)


def vt_random(F, ev, lo, hi, draws=300, seed=7):
    """Shuffle the rule's own holding runs (exposure, length): same days at each exposure, same number of rebalances, so the same mean exposure.
    Each draw's fee is scaled so its turnover matches the rule's. Returns [(cagr, worst drop, dollars traded a year)]."""
    import random
    segs = [(e, (ev[k + 1][0] if k + 1 < len(ev) else hi) - j) for k, (j, e) in enumerate(ev)]
    t_rule = vt_cost([e for e, _ in segs])
    rng, out = random.Random(seed), []
    for _ in range(draws):
        p = segs[:]
        rng.shuffle(p)
        plan, j = {}, lo
        for e, n in p:
            plan[j] = e
            j += n
        cv, info = vt_run(F, None, lo, hi, plan=plan, fee=FEE * t_rule / max(vt_cost([e for e, _ in p]), 1e-9))
        out.append((cv[-1] ** (1 / ((hi - lo) / 252)) - 1, max(1 - v / pk for v, pk in zip(cv, __import__("itertools").accumulate(cv, max))), info[1]))
    return out


def voltarget():
    D = lev_data()
    dates, c, sp, bill, bond, sigs = D
    s = sigs["200d"]
    lo = next(i for i, d in enumerate(dates) if d >= "1929-01-01")
    split = next(i for i, d in enumerate(dates) if d >= LEV_SPLIT)
    hi = len(dates)
    n = len(dates)
    F = ([max(1 + 2 * sp[j] - bill[j] - (SWAP_EXP + GAP) / 252, 1e-12) for j in range(n)], [1 + sp[j] - PLAIN_EXP / 252 for j in range(n)], [1 + bill[j] for j in range(n)])
    yrs_b = (hi - split) / 252
    print(f"VOLATILITY TARGETING ON TOP OF TREND 2x. Daily, {dates[lo]} to {dates[-1]}. Pick on {dates[lo]}..{dates[split - 1]}, blind {dates[split]}..{dates[-1]}.")
    print("Base: 2x S&P fund above its 200 day average, T-bills below. Daily-reset fund model, 0.9% expense, 0.8% a year model gap off the 2x fund, S&P with")
    print(f"dividends, {FEE:.1%} on every non-cash dollar traded, signal read at one close and traded at the next. Exposure e between 0 and 2 is a mix: below 1x the plain")
    print(f"fund (0.09%) and bills, 1x to 2x the 2x fund and the plain fund. Rebalance only when the exposure held is {VT_BAND} off target (or the position flips in/out).")
    print("Realised vol = trailing std of daily S&P returns, annualised. Pick rule as --leverage: best train CAGR whose train worst drop is no bigger than hold's.\n")
    hold_tr = dstats(dates, lev_sim(D, 1.0, None, "bills", "margin", lo, split), lo)
    hold_cv = lev_sim(D, 1.0, None, "bills", "margin", split, hi)
    hold_b, hold_dec = dstats(dates, hold_cv, split), ddecades(dates, hold_cv, split)
    decs = sorted(hold_dec)
    tg2 = vt_targets(sp, s, "trend", None)
    t2_cv, t2_i = vt_run(F, tg2, split, hi)
    t2_b, t2_dec = dstats(dates, t2_cv, split), ddecades(dates, t2_cv, split)
    chk = dstats(dates, lev_sim(D, 2.0, "200d", "bills", "etf", split, hi, FEE, 0, GAP), split)
    assert abs(chk["cagr"] - t2_b["cagr"]) < 2e-3 and abs(chk["mdd"] - t2_b["mdd"]) < 2e-3, (chk, t2_b)
    print(f"Check: this engine's Trend 2x blind {t2_b['cagr']:.1%} / {t2_b['mdd']:.1%} matches lev_sim ({chk['cagr']:.1%} / {chk['mdd']:.1%}).")
    print(f"S&P hold: train {hold_tr['cagr']:.1%} / {hold_tr['mdd']:.0%}   BLIND {hold_b['cagr']:.1%} / {hold_b['mdd']:.1%}.  Trend 2x BLIND {t2_b['cagr']:.1%} / {t2_b['mdd']:.1%}\n")
    combos = [("vol", (T, w)) for T in (0.10, 0.15, 0.20) for w in (20, 60)] + [("regime", None)]
    def name(k):
        return f"vol target {k[1][0]:.0%}, {k[1][1]}d" if k[0] == "vol" else "2x in calm, else 1x"
    res, W = {}, 22
    print(f"{'rule':{W}} | {'train CAGR':>10}{'maxDD':>6} | {'BLIND CAGR':>10}{'maxDD':>7} | {'vs T2x':>6}{'vs hold':>8} | {'turnover/yr':>11}{'rebal/yr':>9}{'mean e':>7}{'e in':>6}")
    for k in combos:
        tg = vt_targets(sp, s, *k)
        tr = dstats(dates, vt_run(F, tg, lo, split)[0], lo)
        cv, (ev, trd, me, mi) = vt_run(F, tg, split, hi)
        b, dec = dstats(dates, cv, split), ddecades(dates, cv, split)
        w2, wh = sum(dec[d] > t2_dec[d] for d in decs), sum(dec[d] > hold_dec[d] for d in decs)
        res[k] = (tr, b, dec, w2, wh, cv, ev, trd, me, mi, tg)
        print(f"{name(k):{W}} | {tr['cagr']:>10.1%}{tr['mdd']:>6.0%} | {b['cagr']:>10.1%}{b['mdd']:>7.1%} | {w2:>4}/{len(decs)}{wh:>6}/{len(decs)} | {trd / yrs_b:>11.1f}{len(ev) / yrs_b:>9.1f}{me:>7.2f}{mi:>6.2f}")
    print(f"{'Trend 2x (reference)':{W}} | {'':>17} | {t2_b['cagr']:>10.1%}{t2_b['mdd']:>7.1%} | {'':>15} | {t2_i[1] / yrs_b:>11.1f}{len(t2_i[0]) / yrs_b:>9.1f}{t2_i[2]:>7.2f}{t2_i[3]:>6.2f}")
    print(f"\nCombos tried: {len(combos)} (3 vol targets x 2 windows = 6 picked among, plus the 1 regime switch, which has no knob to pick).")
    vts = [k for k in combos if k[0] == "vol"]
    ok = [k for k in vts if res[k][0]["mdd"] <= hold_tr["mdd"]]
    pk = max(ok, key=lambda k: res[k][0]["cagr"])
    print(f"Pick rule: best train CAGR whose train worst drop is no bigger than hold's ({hold_tr['mdd']:.0%}): {name(pk)}  (train {res[pk][0]['cagr']:.1%} / {res[pk][0]['mdd']:.0%}).")
    best = max(vts, key=lambda k: res[k][1]["cagr"])
    print(f"Hindsight only: best blind CAGR of the six is {name(best)} at {res[best][1]['cagr']:.1%} / {res[best][1]['mdd']:.1%}.")
    clear = [name(k) for k in combos if res[k][1]["cagr"] > t2_b["cagr"] and res[k][1]["mdd"] <= t2_b["mdd"] and res[k][3] > len(decs) / 2]
    print(f"Hindsight check, combos clearing the bar against Trend 2x on the blind half: {clear or 'none'}")

    print(f"\n{'blind decade CAGR':{W + 12}}" + "".join(f"{d:>8}" for d in decs))
    print(f"{'S&P hold':{W + 12}}" + "".join(f"{hold_dec[d]:>8.1%}" for d in decs))
    print(f"{'Trend 2x':{W + 12}}" + "".join(f"{t2_dec[d]:>8.1%}" for d in decs))
    for k in combos:
        tag = ("PICK " if k == pk else "") + name(k)
        print(f"{tag:{W + 12}}" + "".join(f"{res[k][2][d]:>8.1%}" for d in decs))

    # real funds, 2006 on
    r0 = next(i for i, d in enumerate(dates) if d >= "2006-07-03")
    bil = real_rets(dates, "BIL")
    fb0 = next(i for i, x in enumerate(bil) if x != 0.0)
    bill_r = [bil[j] if j >= fb0 else bill[j] for j in range(n)]
    spy, sso = real_rets(dates, "SPY"), real_rets(dates, "SSO")
    FR = ([max(1 + x, 1e-12) for x in sso], [1 + x for x in spy], [1 + x for x in bill_r])
    s_r = trend_of(spy)
    dl_r = dates[r0 - 1:hi]

    # the two variants graded in detail: the pick and the regime switch
    details = [("PICK " + name(pk), pk), (name(("regime", None)), ("regime", None))]
    wins = (("1987 (Sep 1 to Dec 31)", "1987-09-01", "1987-12-31"), ("2008 (calendar year)", "2008-01-01", "2008-12-31"),
            ("Mar 2020 (Feb 19 to Apr 30)", "2020-02-19", "2020-04-30"), ("2022 (calendar year)", "2022-01-01", "2022-12-31"))
    dl = dates[split - 1:hi]
    print("\nBAR vs Trend 2x (blind CAGR higher, worst drop no bigger, more than half the decades won), and vs S&P hold, 0.8% gap off:")
    verdict = {}
    for lab, k in details:
        tr, b, dec, w2, wh, cv, ev, trd, me, mi, tg = res[k]
        pas2 = b["cagr"] > t2_b["cagr"] and b["mdd"] <= t2_b["mdd"] and w2 > len(decs) / 2
        pash = b["cagr"] > hold_b["cagr"] and b["mdd"] <= hold_b["mdd"] and wh > len(decs) / 2
        why = ", ".join(x for x, f in (("less return", b["cagr"] <= t2_b["cagr"]), ("bigger drop", b["mdd"] > t2_b["mdd"]), (f"{w2} of {len(decs)} decades", w2 <= len(decs) / 2)) if f)
        verdict[lab] = pas2
        print(f"  {lab:{W + 5}} blind {b['cagr']:.1%} / {b['mdd']:.1%}   vs Trend 2x {t2_b['cagr']:.1%} / {t2_b['mdd']:.1%}, won {w2}/{len(decs)}: {'PASS' if pas2 else 'FAIL'}{'' if pas2 else ' (' + why + ')'}"
              f"   vs hold {hold_b['cagr']:.1%} / {hold_b['mdd']:.1%}, won {wh}/{len(decs)}: {'PASS' if pash else 'FAIL'}")
    print("\nSKEPTIC 1. CONSTANT LEVERAGE AT THE SAME AVERAGE: Trend at a fixed L (the rule's mean exposure while in), same engine, same band")
    for lab, k in details:
        mi = res[k][9]
        tgL = [round(mi, 2) if x else 0.0 for x in s]
        cvL = vt_run(F, tgL, split, hi)[0]
        bL = dstats(dates, cvL, split)
        print(f"  {lab:{W + 5}} mean exposure while in {mi:.2f}: constant {round(mi, 2)}x trend blind {bL['cagr']:.1%} / {bL['mdd']:.1%}   (rule {res[k][1]['cagr']:.1%} / {res[k][1]['mdd']:.1%})")
    print("\nSKEPTIC 2. RANDOM BASELINE: 300 random orders of the rule's own holding runs (same days at each exposure, same mean exposure, same number")
    print("rebalances, per-dollar fee scaled up so the total fee paid matches the rule's; shuffled runs that land next to an equal run trade nothing), blind.")
    print("Trend 2x gets the same treatment (random in/out order, same switches).")
    for lab, tgk, cvk, evk, trd in (("Trend 2x", None, t2_cv, t2_i[0], t2_i[1]),) + tuple((lab, None, res[k][5], res[k][6], res[k][7]) for lab, k in details):
        rs = vt_random(F, evk, split, hi)
        rc = dstats(dates, cvk, split)
        cg, dd = sorted(r[0] for r in rs), sorted(r[1] for r in rs)
        beat_c, beat_d = sum(r[0] < rc["cagr"] for r in rs), sum(r[1] > rc["mdd"] for r in rs)
        both = sum(r[0] >= rc["cagr"] and r[1] <= rc["mdd"] for r in rs)
        tm = sorted(r[2] for r in rs)[len(rs) // 2] / yrs_b
        print(f"  {lab:{W + 5}} rule {rc['cagr']:.1%} / {rc['mdd']:.0%}, turnover {trd / yrs_b:.1f}/yr.  random: median {cg[150]:.1%} (5th {cg[15]:.1%}, 95th {cg[285]:.1%}), median worst drop "
              f"{dd[150]:.0%} (5th {dd[15]:.0%}, 95th {dd[285]:.0%}), turnover {tm:.1f}/yr.  Rule return beats {beat_c / 3:.0f}%, drop smaller than {beat_d / 3:.0f}%, randoms matching both: {both} of 300")
    print("\nSKEPTIC 3. ONE DAY LATE (both the 200 day signal and the vol read a day later), blind")
    for lab, k in (("Trend 2x", None),) + tuple(details):
        tg = tg2 if k is None else res[k][10]
        b1 = dstats(dates, vt_run(F, tg, split, hi, delay=1)[0], split)
        b2 = dstats(dates, vt_run(F, tg, split, hi, delay=2)[0], split)
        print(f"  {lab:{W + 5}} 1 day late {b1['cagr']:.1%} / {b1['mdd']:.1%}   2 days late {b2['cagr']:.1%} / {b2['mdd']:.1%}")
    print(f"\nSTRESS, blind, return over the window (worst drop inside it). S&P hold, Trend 2x, then each variant.")
    print(f"{'':{W + 5}}" + "".join(f"{w[0][:20]:>22}" for w in wins))
    for lab, cv in (("S&P hold", hold_cv), ("Trend 2x", t2_cv)) + tuple((lab, res[k][5]) for lab, k in details):
        print(f"{lab:{W + 5}}" + "".join(f"{window(dl, cv, a, b)[0]:>+13.0%} ({window(dl, cv, a, b)[1]:>3.0%})  " for _, a, b in wins))

    print(f"\nREAL FUNDS CHECK, {dates[r0]} on (real adjusted closes: SSO, SPY, BIL with the T-bill series before BIL began {dates[fb0]}). Trend and vol read off the real SPY.")
    print(f"{'':{W + 5}} | {'CAGR':>6}{'maxDD':>6} | {'2008':>12} | {'Mar 2020':>12} | {'2022':>12} | {'model, same window':>20} | turnover/yr")
    rows_ = [("SPY hold", vt_run(FR, [1.0] * n, r0, hi, fee=0.0), vt_run(F, [1.0] * n, r0, hi, fee=0.0), False)]
    tgr = vt_targets(spy, s_r, "trend", None)
    rows_.append(("Trend 2x (SSO / BIL)", vt_run(FR, tgr, r0, hi), vt_run(F, tg2, r0, hi), True))
    for lab, k in details:
        if k[0] == "vol":
            tgr = vt_targets(spy, s_r, "vol", k[1])
        else:
            tgr = vt_targets(spy, s_r, "regime", None)
        rows_.append((lab, vt_run(FR, tgr, r0, hi), vt_run(F, res[k][10], r0, hi), True))
    real_res = {}
    for nm, (cv, inf), (mcv, _), show in rows_:
        inf = inf if show else None
        sr, sm = dstats(dates, cv, r0), dstats(dates, mcv, r0)
        real_res[nm] = sr
        w8, w20, w22 = (window(dl_r, cv, a, b) for a, b in (("2008-01-01", "2008-12-31"), ("2020-02-19", "2020-04-30"), ("2022-01-01", "2022-12-31")))
        tov = f"{inf[1] / ((hi - r0) / 252):.1f}" if inf else "-"
        print(f"{nm:{W + 5}} | {sr['cagr']:>6.1%}{sr['mdd']:>6.0%} | {w8[0]:>+6.0%} ({w8[1]:>3.0%}) | {w20[0]:>+6.0%} ({w20[1]:>3.0%}) | {w22[0]:>+6.0%} ({w22[1]:>3.0%}) | {sm['cagr']:>12.1%} /{sm['mdd']:>4.0%} | {tov}")
    sh_, t2r = real_res["SPY hold"], real_res["Trend 2x (SSO / BIL)"]
    print("  Real-fund bar: higher CAGR and no bigger drop than SPY hold, and than Trend 2x on the same funds.")
    for lab, _ in details:
        r_ = real_res[lab]
        print(f"  {lab:{W + 5}} vs SPY hold {'PASS' if r_['cagr'] > sh_['cagr'] and r_['mdd'] <= sh_['mdd'] else 'FAIL'}   vs Trend 2x real {'PASS' if r_['cagr'] > t2r['cagr'] and r_['mdd'] <= t2r['mdd'] else 'FAIL'}")


# ---------- cross-asset dual momentum, trend filter and leverage (--dual) ----------

DUAL_L, DUAL_SMA = 12, 10  # fixed from the literature: 12 month lookback (Antonacci), 10 month average (Faber). Nothing is tuned.


def dual_targets(dates, rets, assets, sma):
    """Month-end signal. Hold the asset with the best 12 month total return if it beat bills, and (when sma) it also sits above its own
    10 month average of month-end levels; else bills. Returns (month-end day indexes, state decided at each)."""
    tr = {}
    for k, r in rets.items():
        v, out = 1.0, []
        for x in r:
            v *= 1 + x
            out.append(v)
        tr[k] = out
    me = [i for i in range(len(dates)) if i + 1 == len(dates) or dates[i + 1][:7] != dates[i][:7]]
    tgt = []
    for q, e in enumerate(me):
        if q < DUAL_L:
            tgt.append("bills")
            continue
        ret = {a: tr[a][e] / tr[a][me[q - DUAL_L]] - 1 for a in list(assets) + ["bills"]}
        w = max(assets, key=lambda a: ret[a])
        ok = ret[w] > ret["bills"]
        if ok and sma:
            ok = tr[w][e] > sum(tr[w][me[q - i]] for i in range(sma)) / sma
        tgt.append(w if ok else "bills")
    return me, tgt


def dual_q(me, lo, hi):
    """For each day j, the index of the latest month-end e <= j-2: signal at that close, trade the next close, earn from the day after."""
    out, q = [], -1
    for j in range(lo, hi):
        while q + 1 < len(me) and me[q + 1] <= j - 2:
            q += 1
        out.append(q)
    return out


def dual_F(D, M, gap):
    """Daily growth factor of each holding. stocks2 = daily-reset 2x fund model (0.9% expense plus the model gap, T-bill financing)."""
    sp, bill = D[2], D[3]
    return {"stocks": [1 + x for x in sp],
            "stocks2": [max(1 + 2 * sp[j] - bill[j] - (SWAP_EXP + gap) / 252, 1e-12) for j in range(len(sp))],
            "bonds": [1 + x for x in M["ief"]], "gold": [1 + x for x in M["gold"]], "bills": [1 + x for x in bill]}


DUAL_FR = {"stocks": 1.0, "stocks2": 1.0, "bonds": 1.0, "gold": 1.0, "bills": 0.0}  # share of the dollar that pays the fee on a switch


def dual_path(F, st, lo, fee=FEE):
    eq, prev, cv = 1.0, None, [1.0]
    for n, s in enumerate(st):
        if s != prev:
            eq *= 1 - fee * (DUAL_FR[s] + (DUAL_FR[prev] if prev else 0.0))
            prev = s
        eq *= F[s][lo + n]
        cv.append(eq)
    return cv


def dual_fast(F, st, lo, yrs, fee=FEE):
    eq = pk = 1.0
    mdd, prev = 0.0, None
    for n, s in enumerate(st):
        if s != prev:
            eq *= 1 - fee * (DUAL_FR[s] + (DUAL_FR[prev] if prev else 0.0))
            prev = s
        eq *= F[s][lo + n]
        if eq > pk:
            pk = eq
        elif 1 - eq / pk > mdd:
            mdd = 1 - eq / pk
    return eq ** (1 / yrs) - 1, mdd


def run_shuffle(seq, rng):
    """Same holding runs (state and length in months), random order, no two neighbours alike: same time in each asset, same switches."""
    runs = []
    for s in seq:
        if runs and runs[-1][0] == s:
            runs[-1][1] += 1
        else:
            runs.append([s, 1])
    for _ in range(2000):
        rem, out, prev = [r[:] for r in runs], [], None
        while rem:
            cand = [i for i, r in enumerate(rem) if r[0] != prev]
            if not cand:
                break
            out.append(rem.pop(rng.choice(cand)))
            prev = out[-1][0]
        if not rem:
            return [s for s, n in out for _ in range(n)], len(runs) - 1
    rng.shuffle(runs)
    return [s for s, n in runs for _ in range(n)], len(runs) - 1


def dual():
    import random
    D = lev_data()
    dates = D[0]
    lo = next(i for i, d in enumerate(dates) if d >= "1929-01-01")
    split = next(i for i, d in enumerate(dates) if d >= LEV_SPLIT)
    hi = len(dates)
    M = out_data(D)
    yrs_b = (datetime.fromisoformat(dates[hi - 1]) - datetime.fromisoformat(dates[split - 1])).days / 365.25
    rets = {"stocks": D[2], "bonds": M["ief"], "gold": M["gold"], "bills": D[3]}
    F, F0 = dual_F(D, M, GAP), dual_F(D, M, 0.0)
    print(f"CROSS-ASSET DUAL MOMENTUM, TREND FILTER, LEVERAGE. Daily engine on the --out series: S&P 500 with dividends (stocks), 10y Treasury priced off GS10 (bonds, IEF 0.15% off),")
    print(f"gold monthly price spread over the days (GLD 0.40% off), T-bills. Signal at each month end, traded at the next day's close, earns from the day after (first close of next month).")
    print(f"{FEE:.1%} a switch on every non-cash dollar bought or sold. 2x = daily-reset 2x fund model, T-bill financing, {SWAP_EXP:.1%} expense, {GAP:.1%} a year model gap taken off.")
    print(f"Fixed from the literature, nothing tuned: {DUAL_L} month lookback, {DUAL_SMA} month average. Train {dates[lo]}..{dates[split - 1]}, BLIND {dates[split]}..{dates[-1]}.")
    print("Gold is a fixed price (one revaluation, Jan 1934, +69%) until 1971 and private gold was banned until 1974, so the train half of any gold row is not tradable history.")
    print("Plain stocks carry no expense in any row, as in the S&P hold rows.\n")

    specs = {  # name -> (assets, own 10 month filter, 2x on stocks)
        "Dual, no filter (reference)": (["stocks", "bonds", "gold"], False, False),
        "1 Dual + own trend": (["stocks", "bonds", "gold"], True, False),
        "2 Dual + own trend, 2x stocks": (["stocks", "bonds", "gold"], True, True),
        "3 Dual + own trend, no gold": (["stocks", "bonds"], True, False),
        "4 Same, 2x stocks, no gold": (["stocks", "bonds"], True, True),
    }
    sig = D[5]["200d"]
    hold_st = ["stocks"] * (hi - split)
    base_st = ["stocks2" if sig[j - 2] else "bills" for j in range(split, hi)]
    base_tr = ["stocks2" if sig[j - 2] else "bills" for j in range(lo, split)]
    W = 31
    names = list(specs)
    hold = lev_sim(D, 1.0, None, "bills", "margin", split, hi)
    hold_tr = lev_sim(D, 1.0, None, "bills", "margin", lo, split)
    base = dual_path(F, base_st, split)
    chk = dstats(dates, lev_sim(D, 2.0, "200d", "bills", "etf", split, hi, FEE, 0, GAP), split)
    bs = dstats(dates, base, split)
    assert abs(chk["cagr"] - bs["cagr"]) < 2e-3 and abs(chk["mdd"] - bs["mdd"]) < 2e-3, (chk, bs)
    print(f"Trend 2x bills rebuilt in this engine: {bs['cagr']:.1%} / {bs['mdd']:.1%}; lev_sim says {chk['cagr']:.1%} / {chk['mdd']:.1%}.\n")

    cur, late, tr, nog, share, sw, qs_, tg_ = {}, {}, {}, {}, {}, {}, {}, {}
    k0 = None
    for nm, (assets, sma, lev) in specs.items():
        me, tgt = dual_targets(dates, rets, assets, DUAL_SMA if sma else 0)
        mp = (lambda s: "stocks2" if s == "stocks" and lev else s)
        qa, qb = dual_q(me, lo, split), dual_q(me, split, hi)
        mk = lambda qs, dl=0: [mp(tgt[q - dl]) if q - dl >= 0 else "bills" for q in qs]
        st_b = mk(qb)
        cur[nm] = dual_path(F, st_b, split)
        late[nm] = dstats(dates, dual_path(F, mk(qb, 1), split), split)
        tr[nm] = dstats(dates, dual_path(F, mk(qa), lo), lo)
        nog[nm] = dstats(dates, dual_path(F0, st_b, split), split)
        share[nm] = {s: sum(x == s for x in st_b) / len(st_b) for s in ("stocks", "stocks2", "bonds", "gold", "bills")}
        sw[nm] = sum(st_b[i] != st_b[i - 1] for i in range(1, len(st_b))) / yrs_b
        qs_[nm], tg_[nm] = qb, (me, tgt, mp)
    bl = {nm: dstats(dates, cur[nm], split) for nm in names}
    dec = {nm: ddecades(dates, cur[nm], split) for nm in names}
    dec["S&P hold"], dec["Trend 2x, bills"] = ddecades(dates, hold, split), ddecades(dates, base, split)
    decs = sorted(dec["S&P hold"])
    h, b0 = dstats(dates, hold, split), bs
    tr["S&P hold"], tr["Trend 2x, bills"] = dstats(dates, hold_tr, lo), dstats(dates, dual_path(F, base_tr, lo), lo)
    late["Trend 2x, bills"] = dstats(dates, dual_path(F, ["stocks2" if sig[j - 3] else "bills" for j in range(split, hi)], split), split)
    nog_b = dstats(dates, dual_path(F0, base_st, split), split)

    print(f"{'rule':{W}} | {'train CAGR':>10}{'maxDD':>6} | {'BLIND CAGR':>10}{'maxDD':>6}{'no gap':>8} | {'beat hold':>9} {'beat T2x':>8} | {'1 late (T2x: 1 day)':>19} | {'switches/yr':>11}")
    print(f"{'S&P hold':{W}} | {tr['S&P hold']['cagr']:>10.1%}{tr['S&P hold']['mdd']:>6.0%} | {h['cagr']:>10.1%}{h['mdd']:>6.0%}{h['cagr']:>8.1%} | {'-':>9} {'':>8} | {'':>19} |")
    print(f"{'Trend 2x, bills (14.4/44 bar)':{W}} | {tr['Trend 2x, bills']['cagr']:>10.1%}{tr['Trend 2x, bills']['mdd']:>6.0%} | {b0['cagr']:>10.1%}{b0['mdd']:>6.0%}{nog_b['cagr']:>8.1%} | "
          f"{sum(dec['Trend 2x, bills'][d] > dec['S&P hold'][d] for d in decs):>7}/{len(decs)} {'-':>8} | {late['Trend 2x, bills']['cagr']:>14.1%} /{late['Trend 2x, bills']['mdd']:>3.0%}  | {sum(base_st[i] != base_st[i - 1] for i in range(1, len(base_st))) / yrs_b:>11.1f}")
    for nm in names:
        wh, wt = (sum(dec[nm][d] > dec[o][d] for d in decs) for o in ("S&P hold", "Trend 2x, bills"))
        print(f"{nm:{W}} | {tr[nm]['cagr']:>10.1%}{tr[nm]['mdd']:>6.0%} | {bl[nm]['cagr']:>10.1%}{bl[nm]['mdd']:>6.0%}{nog[nm]['cagr']:>8.1%} | {wh:>7}/{len(decs)} {wt:>6}/{len(decs)} | "
              f"{late[nm]['cagr']:>14.1%} /{late[nm]['mdd']:>3.0%}  | {sw[nm]:>11.1f}")

    print(f"\n{'blind decade CAGR':{W}}" + "".join(f"{d:>8}" for d in decs))
    for nm in ["S&P hold", "Trend 2x, bills"] + names:
        print(f"{nm:{W}}" + "".join(f"{dec[nm][d]:>8.1%}" for d in decs))

    print("\nTIME HELD, blind days")
    print(f"{'':{W}}{'stocks':>8}{'2x stocks':>10}{'bonds':>8}{'gold':>8}{'bills':>8}")
    for nm in names:
        s_ = share[nm]
        print(f"{nm:{W}}{s_['stocks']:>8.0%}{s_['stocks2']:>10.0%}{s_['bonds']:>8.0%}{s_['gold']:>8.0%}{s_['bills']:>8.0%}")

    dl = dates[split - 1:hi]
    wins = (("2008 (calendar year)", "2008-01-01", "2008-12-31"), ("2022 (calendar year)", "2022-01-01", "2022-12-31"),
            ("Mar 2020 (Feb 19 to Apr 30)", "2020-02-19", "2020-04-30"))
    print("\nSTRESS, blind: return over the window (worst drop inside it)")
    print(f"{'':{W}}" + "".join(f"{w[0][:17]:>20}" for w in wins))
    for nm, cv in [("S&P hold", hold), ("Trend 2x, bills", base)] + [(n_, cur[n_]) for n_ in names]:
        print(f"{nm:{W}}" + "".join(f"{window(dl, cv, a, b)[0]:>+12.0%} ({window(dl, cv, a, b)[1]:>3.0%})  " for _, a, b in wins))

    print("\nRANDOM BASELINE (300 random orders of the rule's own blind holding runs: same months in each asset, same switches, no neighbours alike)")
    rng = random.Random(7)
    for nm in names:
        me, tgt, mp = tg_[nm]
        qb = qs_[nm]
        k0, k1 = qb[0], qb[-1]
        seq = tgt[k0:k1 + 1]
        wins_c = both = 0
        for _ in range(300):
            sh, k = run_shuffle(seq, rng)
            c, d_ = dual_fast(F, [mp(sh[q - k0]) for q in qb], split, yrs_b)
            wins_c += c < bl[nm]["cagr"]
            both += c >= bl[nm]["cagr"] and d_ <= bl[nm]["mdd"]
        print(f"  {nm:{W}} {bl[nm]['cagr']:.1%} / {bl[nm]['mdd']:.0%} beats {wins_c / 300:.0%} of randoms ({k} run changes), randoms matching on return and worst drop: {both} of 300")

    print(f"\nBAR vs S&P hold ({h['cagr']:.1%} / {h['mdd']:.1%}): blind CAGR higher, worst drop no bigger, more than half the blind decades won.")
    print(f"BAR vs Trend 2x with bills ({b0['cagr']:.1%} / {b0['mdd']:.1%}): same three tests.")
    for nm in names:
        for lab, ref, rd in (("S&P hold", h, dec["S&P hold"]), ("Trend 2x", b0, dec["Trend 2x, bills"])):
            w = sum(dec[nm][d] > rd[d] for d in decs)
            pas = bl[nm]["cagr"] > ref["cagr"] and bl[nm]["mdd"] <= ref["mdd"] and w > len(decs) / 2
            why = "" if pas else " (" + ", ".join(x for x, c in (("less return", bl[nm]["cagr"] <= ref["cagr"]), ("bigger drop", bl[nm]["mdd"] > ref["mdd"]), (f"{w} of {len(decs)} decades", w <= len(decs) / 2)) if c) + ")"
            print(f"  {nm:{W}} vs {lab:9} {bl[nm]['cagr']:.1%} / {bl[nm]['mdd']:.1%}, won {w}/{len(decs)}: {'PASS' if pas else 'FAIL'}{why}")

    # real funds, from the first full month after SSO launched (June 2006)
    r0 = next(i for i, d in enumerate(dates) if d >= "2006-07-03")
    for sym in ("BIL",):
        raw(sym)
    bil = real_rets(dates, "BIL")
    first_bil = next(i for i, x in enumerate(bil) if x != 0.0)
    bill_r = [bil[j] if j >= first_bil else D[3][j] for j in range(hi)]
    rr = {"stocks": real_rets(dates, "SPY"), "bonds": real_rets(dates, "IEF"), "gold": real_rets(dates, "GLD"), "bills": bill_r}
    sso = real_rets(dates, "SSO")
    FR = {"stocks": [1 + x for x in rr["stocks"]], "stocks2": [max(1 + x, 1e-12) for x in sso], "bonds": [1 + x for x in rr["bonds"]],
          "gold": [1 + x for x in rr["gold"]], "bills": [1 + x for x in bill_r]}
    print(f"\nREAL FUNDS CHECK, {dates[r0]} on (first full month after SSO launched; real adjusted closes: SPY, SSO for 2x, IEF, GLD, BIL, with the T-bill series before BIL began {dates[first_bil]}). Signals read off the real funds.")
    print(f"{'rule':{W}} | {'real CAGR':>9}{'maxDD':>6} | {'2008':>12} | {'2022':>12} | {'model, same window':>20}")
    dl2 = dates[r0 - 1:hi]
    rows_ = [("SPY hold", dual_path(FR, ["stocks"] * (hi - r0), r0), dual_path(F, ["stocks"] * (hi - r0), r0)),
             ("Trend 2x (SSO / BIL)", dual_path(FR, ["stocks2" if sig[j - 2] else "bills" for j in range(r0, hi)], r0),
              dual_path(F, ["stocks2" if sig[j - 2] else "bills" for j in range(r0, hi)], r0))]
    real_res = {}
    for nm, (assets, sma, lev) in specs.items():
        me, tgt = dual_targets(dates, rr, assets, DUAL_SMA if sma else 0)
        st = [("stocks2" if s == "stocks" and lev else s) for s in (tgt[q] if q >= 0 else "bills" for q in dual_q(me, r0, hi))]
        mo = [("stocks2" if s == "stocks" and lev else s) for s in (tg_[nm][1][q] if q >= 0 else "bills" for q in dual_q(tg_[nm][0], r0, hi))]
        rows_.append((nm, dual_path(FR, st, r0), dual_path(F, mo, r0)))
    for nm, cv, mcv in rows_:
        s_, ms = dstats(dates, cv, r0), dstats(dates, mcv, r0)
        w8, w22 = window(dl2, cv, "2008-01-01", "2008-12-31"), window(dl2, cv, "2022-01-01", "2022-12-31")
        real_res[nm] = s_
        print(f"{nm:{W}} | {s_['cagr']:>9.1%}{s_['mdd']:>6.0%} | {w8[0]:>+6.0%} ({w8[1]:>3.0%}) | {w22[0]:>+6.0%} ({w22[1]:>3.0%}) | {ms['cagr']:>12.1%} /{ms['mdd']:>4.0%}")
    sh_, t2_ = real_res["SPY hold"], real_res["Trend 2x (SSO / BIL)"]
    print("  Real-fund bar: higher CAGR and no bigger drop than SPY hold, and than Trend 2x on the same funds.")
    for nm in names:
        r_ = real_res[nm]
        print(f"  {nm:{W}} vs SPY hold {'PASS' if r_['cagr'] > sh_['cagr'] and r_['mdd'] <= sh_['mdd'] else 'FAIL'}   vs Trend 2x real {'PASS' if r_['cagr'] > t2_['cagr'] and r_['mdd'] <= t2_['mdd'] else 'FAIL'}")

# ---------- calendar overlays on Trend 2x (--seasonal) ----------

def cal_masks(dates):
    """Calendar windows from the literature, nothing tuned. mask[j] is True when the position held through day j's return (close j-1 to close j) is
    the window's. Known in advance, so no signal lag. tom: last trading day of the month and the first 3 (Lakonishok and Smidt 1988). halloween: Nov to
    Apr (Bouman and Jacobsen 2002). preholiday: the last trading day before a gap of 2 or more weekdays in the price series (Ariel 1990).
    nomonday: every day but Monday (hold bills Friday close to Monday close)."""
    from datetime import date, timedelta
    n = len(dates)
    ds = [date.fromisoformat(d) for d in dates]
    tom, first, pre = [False] * n, 0, [False] * n
    for j in range(n):
        first = first + 1 if j and dates[j][:7] == dates[j - 1][:7] else 1
        last = j + 1 < n and dates[j + 1][:7] != dates[j][:7]
        tom[j] = first <= 3 or last
        if j + 1 < n:
            gap = sum((ds[j] + timedelta(days=k)).weekday() < 5 for k in range(1, (ds[j + 1] - ds[j]).days + 1))
            pre[j] = gap >= 2
    return {"tom": tom, "halloween": [d[5:7] in ("11", "12", "01", "02", "03", "04") for d in dates], "preholiday": pre,
            "nomonday": [x.weekday() != 0 for x in ds]}


def cal_tg(s, M, kind):
    """Exposure wanted at each close k, to be earned on day k+2 (the engine reads tg[j-2-delay]). alone: 1x S&P in the window, bills out of it, no trend.
    filter: Trend 2x in the window and Trend 1x outside it (bills when the 200 day signal is off). skip: Trend 2x, bills when the window is off."""
    n = len(s)
    m = M + [False, False]
    if kind == "alone":
        return [1.0 if m[k + 2] else 0.0 for k in range(n)]
    if kind == "filter":
        return [(2.0 if m[k + 2] else 1.0) if s[k] else 0.0 for k in range(n)]
    return [2.0 if s[k] and m[k + 2] else 0.0 for k in range(n)]


def rand_mask(M, lo, hi, rng):
    """Random calendar mask on days lo..hi-1: same number of days on, same on-run lengths, same number of runs as M, placed at random."""
    on, run = [], 0
    for j in range(lo, hi):
        if M[j]:
            run += 1
        elif run:
            on.append(run)
            run = 0
    if run:
        on.append(run)
    R, extra = len(on), (hi - lo) - sum(on) - (len(on) - 1)
    rng.shuffle(on)
    p = sorted(rng.sample(range(extra + R), R))
    gaps = [p[0]] + [p[i] - p[i - 1] - 1 + 1 for i in range(1, R)] + [extra + R - 1 - p[-1]]
    out = [False] * len(M)
    j = lo + gaps[0]
    for i, L in enumerate(on):
        for t in range(L):
            out[j + t] = True
        j += L + gaps[i + 1]
    return out


def seasonal():
    import random
    from itertools import accumulate
    D = lev_data()
    dates, c, sp, bill, bond, sigs = D
    s = sigs["200d"]
    n = len(dates)
    lo = next(i for i, d in enumerate(dates) if d >= "1929-01-01")
    split = next(i for i, d in enumerate(dates) if d >= LEV_SPLIT)
    hi = n
    yrs_b = (hi - split) / 252
    F = ([max(1 + 2 * sp[j] - bill[j] - (SWAP_EXP + GAP) / 252, 1e-12) for j in range(n)], [1 + sp[j] - PLAIN_EXP / 252 for j in range(n)], [1 + bill[j] for j in range(n)])
    masks = cal_masks(dates)
    print(f"CALENDAR OVERLAYS. Daily, {dates[lo]} to {dates[-1]}. Context (train) {dates[lo]}..{dates[split - 1]}, blind {dates[split]}..{dates[-1]}. Nothing is tuned: every window is fixed from the paper it comes from.")
    print("Fund model as Trend 2x: S&P with dividends, 2x fund = daily reset, T-bill financing, 0.9% expense, 0.8% a year model gap taken off; plain fund 0.09%; bills when out.")
    print(f"Fee {FEE:.1%} on every non-cash dollar traded, so a swap between the 1x and 2x fund (sell one, buy the other) pays it twice; fee sensitivity below. 'Trend' = 2x above the S&P 200 day average")
    print("(signal read at close j-2, traded close j-1, earns day j). Calendar windows are known ahead and need no signal lag.")
    print("Windows: tom = last trading day of the month plus the first 3 (Lakonishok and Smidt 1988); halloween = in Nov to Apr, out May to Oct (Bouman and Jacobsen 2002);")
    print("preholiday = the last trading day before any gap of 2 or more weekdays in the price series (Ariel 1990, an approximation of NYSE holidays); nomonday = out Friday close to Monday close.")
    print("Stacks always keep the trend gate: filter = Trend 2x inside the window, Trend 1x outside it; skip = Trend 2x, bills when the window is off. 'alone' = 1x S&P in the window, bills out, no trend.")
    cnt = {k: sum(v[split:]) / yrs_b for k, v in masks.items()}
    pre24 = [dates[j] for j in range(n) if masks["preholiday"][j] and dates[j].startswith("2024")]
    print(f"Days a year in the window, blind: " + ", ".join(f"{k} {v:.0f}" for k, v in cnt.items()) + f"   (252 trading days a year). Pre-holiday days found in 2024: {', '.join(d[5:] for d in pre24)}.\n")

    hold_tr = dstats(dates, lev_sim(D, 1.0, None, "bills", "margin", lo, split), lo)
    hold_cv = lev_sim(D, 1.0, None, "bills", "margin", split, hi)
    hold_b, hold_dec = dstats(dates, hold_cv, split), ddecades(dates, hold_cv, split)
    decs = sorted(hold_dec)
    tg2 = [2.0 if x else 0.0 for x in s]
    t2_cv, t2_i = vt_run(F, tg2, split, hi)
    t2_b, t2_dec = dstats(dates, t2_cv, split), ddecades(dates, t2_cv, split)
    t2_tr = dstats(dates, vt_run(F, tg2, lo, split)[0], lo)
    chk = dstats(dates, lev_sim(D, 2.0, "200d", "bills", "etf", split, hi, FEE, 0, GAP), split)
    assert abs(chk["cagr"] - t2_b["cagr"]) < 2e-3 and abs(chk["mdd"] - t2_b["mdd"]) < 2e-3, (chk, t2_b)
    print(f"Check: this engine's Trend 2x blind {t2_b['cagr']:.1%} / {t2_b['mdd']:.1%} matches lev_sim ({chk['cagr']:.1%} / {chk['mdd']:.1%}).")
    print(f"Baselines. Standalone vs S&P hold: train {hold_tr['cagr']:.1%} / {hold_tr['mdd']:.0%}, BLIND {hold_b['cagr']:.1%} / {hold_b['mdd']:.1%} (no fees, no expense; the overlays pay the 0.09% fund expense, so they are a hair worse off).")
    print(f"Stacked vs Trend 2x: train {t2_tr['cagr']:.1%} / {t2_tr['mdd']:.0%}, BLIND {t2_b['cagr']:.1%} / {t2_b['mdd']:.1%}.\n")

    names = {"tom": "Turn of the month", "halloween": "Sell in May / Halloween", "preholiday": "Pre-holiday", "nomonday": "Skip Mondays"}
    variants = [(f"{names[k]}, 1x alone", k, "alone", False) for k in names] + \
               [(f"{names[k]}, stacked on Trend 2x", k, "filter" if k != "nomonday" else "skip", True) for k in names]
    W = 46
    res = {}
    print("1. BLIND RESULTS, 0.1% fee. Bar: higher blind CAGR than the baseline, worst drop no bigger, more than half the decades won against it.")
    print(f"{'overlay':{W}} | {'train CAGR':>10}{'maxDD':>6} | {'BLIND CAGR':>10}{'maxDD':>6} | {'decades':>7} | {'gross CAGR':>10} | {'in mkt':>6}{'mean e':>7} | {'switches/yr':>11}{'$ traded/yr':>12}{'fee drag':>9} | bar")
    for lab, k, kind, stk in variants:
        tg = cal_tg(s, masks[k], kind)
        tr = dstats(dates, vt_run(F, tg, lo, split)[0], lo)
        cv, (ev, trd, me, mi) = vt_run(F, tg, split, hi)
        gross = dstats(dates, vt_run(F, tg, split, hi, fee=0.0)[0], split)
        b, dec = dstats(dates, cv, split), ddecades(dates, cv, split)
        base_b, base_dec = (t2_b, t2_dec) if stk else (hold_b, hold_dec)
        won = sum(dec[d] > base_dec[d] for d in decs)
        ok = b["cagr"] > base_b["cagr"] and b["mdd"] <= base_b["mdd"] and won > len(decs) / 2
        why = ", ".join(x for x, f in (("less return", b["cagr"] <= base_b["cagr"]), ("bigger drop", b["mdd"] > base_b["mdd"]), (f"{won} of {len(decs)} decades", won <= len(decs) / 2)) if f)
        res[lab] = (tg, b, dec, ok, cv, ev, trd, gross)
        inm = sum(1 for x in tg[split - 2:hi - 2] if x > 0) / (hi - split)
        print(f"{lab:{W}} | {tr['cagr']:>10.1%}{tr['mdd']:>6.0%} | {b['cagr']:>10.1%}{b['mdd']:>6.0%} | {won:>5}/{len(decs)} | {gross['cagr']:>10.1%} | {inm:>6.0%}{me:>7.2f} | {len(ev) / yrs_b:>11.1f}{trd / yrs_b:>12.1f}{gross['cagr'] - b['cagr']:>8.1%} | {'PASS' if ok else 'FAIL (' + why + ')'}")
    t2_g = dstats(dates, vt_run(F, tg2, split, hi, fee=0.0)[0], split)
    print(f"{'Trend 2x (reference)':{W}} | {t2_tr['cagr']:>10.1%}{t2_tr['mdd']:>6.0%} | {t2_b['cagr']:>10.1%}{t2_b['mdd']:>6.0%} | {'':>7} | {t2_g['cagr']:>10.1%} | {'':>6}{t2_i[2]:>7.2f} | {len(t2_i[0]) / yrs_b:>11.1f}{t2_i[1] / yrs_b:>12.1f}")
    print(f"{'S&P hold (reference)':{W}} | {hold_tr['cagr']:>10.1%}{hold_tr['mdd']:>6.0%} | {hold_b['cagr']:>10.1%}{hold_b['mdd']:>6.0%}")
    print("Variants tried: 8 (4 windows x alone and stacked), nothing picked among them. 'gross CAGR' = same rule at zero fee; fee drag = gross minus net, in points a year.")
    print(f"\n{'blind decade CAGR':{W + 3}}" + "".join(f"{d:>8}" for d in decs))
    print(f"{'S&P hold':{W + 3}}" + "".join(f"{hold_dec[d]:>8.1%}" for d in decs))
    print(f"{'Trend 2x':{W + 3}}" + "".join(f"{t2_dec[d]:>8.1%}" for d in decs))
    for lab, *_ in variants:
        print(f"{lab:{W + 3}}" + "".join(f"{res[lab][2][d]:>8.1%}" for d in decs))

    print("\n2. RANDOM CALENDAR MASKS: 300 random masks per overlay with the same days on, the same on-run lengths and the same number of runs (so the same switches and fee),")
    print("   placed at random in the blind window, run through the same rule (alone, or on top of the same Trend gate), 0.1% fee.")
    for lab, k, kind, stk in variants:
        rng = random.Random(7)
        out = []
        for _ in range(300):
            cvr = vt_run(F, cal_tg(s, rand_mask(masks[k], split, hi, rng), kind), split, hi)[0]
            out.append((cvr[-1] ** (1 / yrs_b) - 1, max(1 - v / pk for v, pk in zip(cvr, accumulate(cvr, max)))))
        b = res[lab][1]
        cg, dd = sorted(r[0] for r in out), sorted(r[1] for r in out)
        beat_c, beat_d = sum(r[0] < b["cagr"] for r in out), sum(r[1] > b["mdd"] for r in out)
        both = sum(r[0] >= b["cagr"] and r[1] <= b["mdd"] for r in out)
        print(f"  {lab:{W}} rule {b['cagr']:.1%} / {b['mdd']:.0%}.  random: median {cg[150]:.1%} (5th {cg[15]:.1%}, 95th {cg[285]:.1%}), median worst drop {dd[150]:.0%} (5th {dd[15]:.0%}, 95th {dd[285]:.0%}).  "
              f"Rule return beats {beat_c / 3:.0f}% of randoms (percentile), drop smaller than {beat_d / 3:.0f}%, randoms matching both: {both} of 300")
    print("\n   Same-leverage control for the stacks: Trend at one fixed L equal to the overlay's mean exposure while in, same engine (what you get from simply using less leverage).")
    for lab, k, kind, stk in variants:
        if not stk:
            continue
        tg = res[lab][0]
        mi = sum(x for x in tg[split - 2:hi - 2] if x > 0) / max(1, sum(1 for x in tg[split - 2:hi - 2] if x > 0))
        L = round(mi, 2)
        bL = dstats(dates, vt_run(F, [L if x else 0.0 for x in s], split, hi)[0], split)
        print(f"  {lab:{W}} mean exposure while in {L:.2f}: fixed {L}x trend {bL['cagr']:.1%} / {bL['mdd']:.1%}   (overlay {res[lab][1]['cagr']:.1%} / {res[lab][1]['mdd']:.1%})")

    print("\n3. ONE DAY LATE (the 200 day signal and the calendar window both executed a day later), blind, 0.1% fee")
    b1t = dstats(dates, vt_run(F, tg2, split, hi, delay=1)[0], split)
    print(f"  {'Trend 2x (reference)':{W}} 1 day late {b1t['cagr']:.1%} / {b1t['mdd']:.1%}")
    for lab, k, kind, stk in variants:
        b1 = dstats(dates, vt_run(F, res[lab][0], split, hi, delay=1)[0], split)
        print(f"  {lab:{W}} 1 day late {b1['cagr']:.1%} / {b1['mdd']:.1%}   (on time {res[lab][1]['cagr']:.1%} / {res[lab][1]['mdd']:.1%})")

    print("\n4. FEE SENSITIVITY, blind, fee per dollar traded (a 1x/2x swap trades two dollars, so 0.05% here is a flat 0.1% per swap). Baselines pay the same fee.")
    fees = (0.0005, 0.001, 0.0025)
    print(f"{'':{W}}" + "".join(f"{f'fee {f:.2%}':>26}" for f in fees) + "   bar at each fee")
    bt = [dstats(dates, vt_run(F, tg2, split, hi, fee=f)[0], split) for f in fees]
    print(f"{'Trend 2x (baseline for stacks)':{W}}" + "".join(f"{x['cagr']:>17.1%} /{x['mdd']:>5.0%}   " for x in bt))
    print(f"{'S&P hold (baseline for alone)':{W}}" + "".join(f"{hold_b['cagr']:>17.1%} /{hold_b['mdd']:>5.0%}   " for _ in fees))
    for lab, k, kind, stk in variants:
        cells, oks = [], []
        for f, base in zip(fees, bt):
            bf = dstats(dates, vt_run(F, res[lab][0], split, hi, fee=f)[0], split)
            bb = base if stk else hold_b
            cells.append(f"{bf['cagr']:>17.1%} /{bf['mdd']:>5.0%}   ")
            oks.append("pass" if bf["cagr"] > bb["cagr"] and bf["mdd"] <= bb["mdd"] else "fail")
        print(f"{lab:{W}}" + "".join(cells) + "   (return and drop only) " + " / ".join(oks))

    print("\n5. REAL FUNDS FROM 2006 (SSO, SPY, BIL with the T-bill series before BIL began; the 200 day trend read off the real SPY), 0.1% fee")
    r0 = next(i for i, d in enumerate(dates) if d >= "2006-07-03")
    bil = real_rets(dates, "BIL")
    fb0 = next(i for i, x in enumerate(bil) if x != 0.0)
    bill_r = [bil[j] if j >= fb0 else bill[j] for j in range(n)]
    spy, sso = real_rets(dates, "SPY"), real_rets(dates, "SSO")
    FR = ([max(1 + x, 1e-12) for x in sso], [1 + x for x in spy], [1 + x for x in bill_r])
    s_r = trend_of(spy)
    sh_ = dstats(dates, vt_run(FR, [1.0] * n, r0, hi, fee=0.0)[0], r0)
    t2r = dstats(dates, vt_run(FR, [2.0 if x else 0.0 for x in s_r], r0, hi)[0], r0)
    print(f"  {'SPY hold':{W}} {sh_['cagr']:>6.1%} / {sh_['mdd']:.0%}")
    print(f"  {'Trend 2x (SSO / BIL)':{W}} {t2r['cagr']:>6.1%} / {t2r['mdd']:.0%}")
    for lab, k, kind, stk in variants:
        rr = dstats(dates, vt_run(FR, cal_tg(s_r, masks[k], kind), r0, hi)[0], r0)
        base, bn = (t2r, "Trend 2x real") if stk else (sh_, "SPY hold")
        ok = rr["cagr"] > base["cagr"] and rr["mdd"] <= base["mdd"]
        print(f"  {lab:{W}} {rr['cagr']:>6.1%} / {rr['mdd']:.0%}   vs {bn} {base['cagr']:.1%} / {base['mdd']:.0%}: {'PASS' if ok else 'FAIL'}")

    print("\nVERDICT per overlay on the bar (0.1% fee, model):")
    for lab, k, kind, stk in variants:
        print(f"  {lab:{W}} {'PASS' if res[lab][3] else 'FAIL'}")


if __name__ == "__main__":
    if "--seasonal" in sys.argv:
        seasonal()
        sys.exit()
    if "--dual" in sys.argv:
        dual()
        sys.exit()
    if "--out" in sys.argv:
        out_asset()
        sys.exit()
    if "--voltarget" in sys.argv:
        voltarget()
        sys.exit()
    if "--robust" in sys.argv:
        robust()
        sys.exit()
    if "--leverage" in sys.argv:
        leverage()
        sys.exit()
    if "--factors" in sys.argv:
        factors()
        sys.exit()
    if "--quality" in sys.argv:
        quality()
        sys.exit()
    if "--lowvol" in sys.argv:
        lowvol()
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
