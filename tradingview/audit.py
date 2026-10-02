#!/usr/bin/env python3
"""Multiple-testing audit of the two Scoreboard winners (Trend 2x S&P, Quality tenth).

    python3 tradingview/audit.py > tradingview/results-audit.txt

Reuses century.py's data and simulators, nothing is re-tuned. Blind half only (1976 to now).
Series audited are MONTHLY, two ways: absolute (return minus T-bills) and excess over holding.
The claim the paper makes is "beats holding", so the excess series is the headline.
"""
import math, os, random, re, statistics, sys
from datetime import datetime, timezone
from statistics import NormalDist
import century as C

N01 = NormalDist()
HERE = os.path.dirname(os.path.abspath(__file__))
EG = 0.5772156649


# ---------- series ----------

def month_ends(dates, curve, lo):
    """Daily equity curve -> {YYYY-MM: monthly return}. curve[k] is the close of dates[lo+k-1]."""
    last = {}
    for k in range(1, len(curve)):
        last[dates[lo + k - 1][:7]] = curve[k]
    ms = sorted(last)
    prev, out = curve[0], {}
    for m in ms:
        out[m] = last[m] / prev - 1
        prev = last[m]
    return out


def daily_series():
    D = C.lev_data()
    dates, bill = D[0], D[3]
    lo = next(i for i, d in enumerate(dates) if d >= "1929-01-01")
    split = next(i for i, d in enumerate(dates) if d >= C.LEV_SPLIT)
    hi = len(dates)
    hold = C.lev_sim(D, 1.0, None, "bills", "margin", split, hi)
    ms_h = month_ends(dates, hold, split)
    # monthly bills over the same days
    rf = {}
    for j in range(split, hi):
        rf[dates[j][:7]] = rf.get(dates[j][:7], 1.0) * (1 + bill[j])
    rf = {m: v - 1 for m, v in rf.items()}
    pool = {}
    for md in ("margin", "etf"):
        for L in (1.0, 1.25, 1.5, 2.0):
            for sg in ("200d", "10m"):
                for o in ("bills", "bonds"):
                    cv = C.lev_sim(D, L, sg, o, md, split, hi, gap=C.GAP if md == "etf" else 0.0)
                    pool[("lev", md, L, sg, o)] = month_ends(dates, cv, split)
    t2x = pool[("lev", "etf", 2.0, "200d", "bills")]
    cv = C.lev_sim(D, 2.0, "200d", "bills", "etf", split, hi, gap=C.GAP)
    st = C.dstats(dates, cv, split)
    return ms_h, rf, t2x, pool, st


def french_series():
    ff = C.french("F-F_Research_Data_Factors_CSV.zip", 0)
    mom = C.french("10_Portfolios_Prior_12_2_CSV.zip", 0)
    def tenth(name, hi):
        return {m: v[-1 if hi else len(v) - 10] for m, v in C.french(name, 0).items()}
    tq = 0.30 / 12 * 2 * C.FEE
    raw = {
        "value": ({m: x - tq for m, x in tenth("Portfolios_Formed_on_BE-ME_CSV.zip", True).items()}),
        "size": ({m: x - tq for m, x in tenth("Portfolios_Formed_on_ME_CSV.zip", False).items()}),
        "quality": ({m: x - tq for m, x in tenth("Portfolios_Formed_on_OP_CSV.zip", True).items()}),
        "investment": ({m: x - tq for m, x in tenth("Portfolios_Formed_on_INV_CSV.zip", False).items()}),
        "momentum": ({m: v[9] - 1.0 * C.FEE for m, v in mom.items()}),
        "lowvar": ({m: x - tq for m, x in tenth("Portfolios_Formed_on_VAR_CSV.zip", False).items()}),
        "lowbeta": ({m: x - tq for m, x in tenth("Portfolios_Formed_on_BETA_CSV.zip", False).items()}),
    }
    mk = {m: ff[m][0] + ff[m][3] for m in ff}
    rf = {m: ff[m][3] for m in ff}
    return mk, rf, raw


def real_qual():
    """QUAL vs SPY real funds from QUAL's first month: monthly returns, adjusted closes."""
    def me(sym):
        out = {}
        for r in C.daily(sym):
            out[datetime.fromtimestamp(r[0], timezone.utc).strftime("%Y-%m")] = r[1]
        return out
    q, s = me("QUAL"), me("SPY")
    ms = sorted(set(q) & set(s))
    qr = {ms[i]: q[ms[i]] / q[ms[i - 1]] - 1 for i in range(1, len(ms))}
    sr = {ms[i]: s[ms[i]] / s[ms[i - 1]] - 1 for i in range(1, len(ms))}
    return qr, sr


# ---------- statistics ----------

def moments(x):
    n = len(x)
    mu = sum(x) / n
    sd = math.sqrt(sum((v - mu) ** 2 for v in x) / (n - 1))
    sk = sum((v - mu) ** 3 for v in x) / n / (sum((v - mu) ** 2 for v in x) / n) ** 1.5
    ku = sum((v - mu) ** 4 for v in x) / n / (sum((v - mu) ** 2 for v in x) / n) ** 2
    return n, mu, sd, sk, ku


def exp_max_sr(var_sr, n):
    """Bailey and Lopez de Prado 2014: expected max of n independent trials with Sharpe variance var_sr."""
    if n <= 1:
        return 0.0
    return math.sqrt(var_sr) * ((1 - EG) * N01.inv_cdf(1 - 1 / n) + EG * N01.inv_cdf(1 - 1 / (n * math.e)))


def dsr(x, sr0):
    n, mu, sd, sk, ku = moments(x)
    sr = mu / sd
    den = math.sqrt(max(1e-12, 1 - sk * sr + (ku - 1) / 4 * sr * sr))
    return N01.cdf((sr - sr0) * math.sqrt(n - 1) / den), sr


def nw_t(x, lags=6):
    n = len(x)
    mu = sum(x) / n
    d = [v - mu for v in x]
    g0 = sum(v * v for v in d) / n
    s = g0
    for k in range(1, lags + 1):
        gk = sum(d[i] * d[i - k] for i in range(k, n)) / n
        s += 2 * (1 - k / (lags + 1)) * gk
    return mu / math.sqrt(s / n)


def binom_p(k, n):
    """One-sided P(X >= k), X ~ Binomial(n, 0.5)."""
    return sum(math.comb(n, i) for i in range(k, n + 1)) / 2 ** n


def grp(ms, x, keyf):
    out = {}
    for m, v in zip(ms, x):
        out.setdefault(keyf(m), []).append(v)
    return {k: math.prod(1 + v for v in vs) - 1 for k, vs in out.items()}


def sign_test(ms, rule, hold, keyf, minmonths):
    cnt = {}
    for m in ms:
        cnt[keyf(m)] = cnt.get(keyf(m), 0) + 1
    r, h = grp(ms, rule, keyf), grp(ms, hold, keyf)
    ks = [k for k in sorted(r) if cnt[k] >= minmonths]
    w = sum(r[k] > h[k] for k in ks)
    return w, len(ks), binom_p(w, len(ks))


def pass_bar(ms, rule, hold):
    """The 3 part bar on monthly returns: more CAGR than hold, no bigger worst drop, wins most decades."""
    def cg(xs):
        cv, pk, dd = 1.0, 1.0, 0.0
        for v in xs:
            cv *= 1 + v
            pk = max(pk, cv)
            dd = max(dd, 1 - cv / pk)
        return cv ** (12 / len(xs)) - 1, dd
    rc, rd = cg(rule)
    hc, hd = cg(hold)
    dr = grp(ms, rule, lambda m: m[:3])
    dh = grp(ms, hold, lambda m: m[:3])
    cnt = {}
    for m in ms:
        cnt[m[:3]] = cnt.get(m[:3], 0) + 1
    ds = [k for k in dr if cnt[k] >= 36]
    won = sum(dr[k] > dh[k] for k in ds)
    return rc > hc and rd <= hd and won > len(ds) / 2


def null_pass_rate(ms, rule, hold, draws=4000, block=12, seed=11):
    """Null: the rule's true excess return is zero. Take its monthly excess over holding, remove the mean,
    resample in 12 month blocks, add back to the real holding path, and ask how often the 3 part bar is cleared."""
    ex = [a - b for a, b in zip(rule, hold)]
    mu = sum(ex) / len(ex)
    ex = [v - mu for v in ex]
    rng, n, hit = random.Random(seed), len(ex), 0
    for _ in range(draws):
        s = []
        while len(s) < n:
            i = rng.randrange(0, n - block + 1)
            s.extend(ex[i:i + block])
        s = s[:n]
        hit += pass_bar(ms, [h + e for h, e in zip(hold, s)], hold)
    return hit / draws


# ---------- trial count ----------

def count_trials():
    txt = open(os.path.join(HERE, "..", "WHITEPAPER.md")).read()
    sb = txt.split("#### Scoreboard")[1].split("### Broker abstraction")[0]
    rows = [l for l in sb.splitlines() if l.startswith("| ") and not l.startswith("| Edge") and not l.startswith("|---")]
    return len(rows)


def main():
    out = print
    ms_h, rf_h, t2x, pool, st = daily_series()
    ms = sorted(set(ms_h) & set(t2x))
    hold = [ms_h[m] for m in ms]
    rule = [t2x[m] for m in ms]
    bills = [rf_h[m] for m in ms]
    mk, rf_f, raw = french_series()
    fm = sorted(m for m in raw["quality"] if m >= "1976-01" and m in mk)
    fhold = [mk[m] for m in fm]
    fbills = [rf_f[m] for m in fm]
    fq = [raw["quality"][m] for m in fm]

    out("MULTIPLE TESTING AUDIT of the two Scoreboard winners. Blind half only, monthly series.")
    out("Winner 1: Trend 2x S&P (2x fund above 200 day average, else bills; fund gap 0.8% off, 0.1% fee, daily model rolled to months).")
    out(f"  daily model check: blind {st['cagr']:.1%} / {st['mdd']:.0%} (paper 14.4% / 44%)")
    out(f"  {ms[0]} to {ms[-1]}, {len(ms)} months, benchmark = hold S&P with dividends.")
    out("Winner 2: Quality, top operating profitability tenth (Ken French, value weighted, 0.06% a year costs) vs the market, 1976 to now.")
    out(f"  {fm[0]} to {fm[-1]}, {len(fm)} months. Real QUAL vs SPY is also shown (it is the tradable version).\n")

    # ---- 1. trials ----
    n_rows = count_trials()
    extra = {"century.py: 24 settings + 4 stock momentum settings, minus 3 that already have rows": 25,
             "leverage: 32 combos picked among, minus the 1 pick that has a row": 31,
             "voltarget: 7 combos, minus the 2 that have rows": 5,
             "crypto: 4 rules picked among, minus the 1 pick that has a row": 3}
    N = n_rows + sum(extra.values())
    out("1. TRIAL COUNT")
    out(f"  Scoreboard rows (parsed from WHITEPAPER.md): {n_rows}")
    for k, v in extra.items():
        out(f"  + {v:3d}  {k}")
    out(f"  N = {N} trials. This is a floor: the Double 7s and backtest.py tuning runs, the 5 Quality-upgrade picks")
    out("  inside rows, and any run we threw away before writing it down are not counted. Many trials are near copies")
    out("  (the same trend rule on the same S&P), so the effective number of independent bets is far lower. Both bounds are used below.\n")

    # ---- cross-trial Sharpe variance ----
    ir, sh = [], []
    for k, s in pool.items():
        mm = sorted(set(s) & set(ms_h))
        ex = [s[m] - ms_h[m] for m in mm]
        ab = [s[m] - rf_h[m] for m in mm]
        ir.append(statistics.mean(ex) / statistics.stdev(ex))
        sh.append(statistics.mean(ab) / statistics.stdev(ab))
    fir, fsh = [], []
    for k, s in raw.items():
        ex = [s[m] - mk[m] for m in fm]
        ab = [s[m] - rf_f[m] for m in fm]
        fir.append(statistics.mean(ex) / statistics.stdev(ex))
        fsh.append(statistics.mean(ab) / statistics.stdev(ab))
    pool_ir, pool_sh = ir + fir, sh + fsh
    v_ir, v_sh = statistics.pvariance(pool_ir), statistics.pvariance(pool_sh)
    out("   Cross-trial Sharpe variance, estimated by recomputing cheap Scoreboard trials on the blind half:")
    out(f"   {len(ir)} leverage combos + {len(fir)} French long only tenths = {len(pool_ir)} trials")
    out(f"   monthly information ratio (excess over hold): mean {statistics.mean(pool_ir):+.3f}, sd {math.sqrt(v_ir):.3f}, var {v_ir:.5f}")
    out(f"   monthly Sharpe (over bills):                  mean {statistics.mean(pool_sh):+.3f}, sd {math.sqrt(v_sh):.3f}, var {v_sh:.5f}")
    out("   Conservative (a floor on variance would flatter the winners): also run at 2x that variance.\n")

    # ---- series stats ----
    def series(name, rule_x, hold_x, bills_x):
        ex = [a - b for a, b in zip(rule_x, hold_x)]
        ab = [a - r for a, r in zip(rule_x, bills_x)]
        return {"name": name, "ex": ex, "ab": ab}
    S = [series("Trend 2x S&P", rule, hold, bills), series("Quality tenth (French)", fq, fhold, fbills)]
    qr, sr_ = real_qual()
    qm = sorted(set(qr) & set(sr_))
    S.append(series("QUAL real fund vs SPY", [qr[m] for m in qm], [sr_[m] for m in qm], [0.0] * len(qm)))
    S[2]["ab"] = None

    out("2. DEFLATED SHARPE RATIO (Bailey and Lopez de Prado 2014)")
    out("   SR0 = expected best Sharpe of N trials with zero true skill. DSR = P(true Sharpe > 0) after that haircut.")
    out("   Monthly Sharpe units. Skew and kurtosis (raw) are of the same monthly series.\n")
    res = {}
    for s in S:
        for lab, x, var in (("excess over hold (IR)", s["ex"], v_ir), ("absolute (over bills)", s["ab"], v_sh)):
            if x is None:
                continue
            n, mu, sd, sk, ku = moments(x)
            out(f"   {s['name']}, {lab}: T={n} months ({n / 12:.1f} yrs), monthly SR {mu / sd:.3f} (annual {mu / sd * math.sqrt(12):.2f}), skew {sk:+.2f}, kurtosis {ku:.2f}")
            rows_ = []
            for nlab, nn, vv in (("N=1 (no haircut)", 1, var), (f"N={N}", N, var), (f"N={N}, 2x variance", N, 2 * var),
                                 ("N=40 effective", 40, var), ("N=10 effective", 10, var)):
                sr0 = exp_max_sr(vv, nn)
                d, sr = dsr(x, sr0)
                rows_.append((nlab, sr0, d))
                out(f"     {nlab:22} SR0 {sr0:.3f} (annual {sr0 * math.sqrt(12):.2f})  DSR {d:.3f}")
            res[(s["name"], lab)] = rows_
        out("")

    # ---- 3. sign + t ----
    out("3. SIGN TESTS AND T-STATS (excess over hold, blind half)")
    out("   Sign test: one sided binomial, P(at least this many wins by coin flip). Years with under 6 months are skipped; decades with under 36 months skipped.")
    thr_bonf = N01.inv_cdf(1 - 0.05 / N / 2)
    thr_bonf_n40 = N01.inv_cdf(1 - 0.05 / 40 / 2)
    out(f"   t thresholds: plain 2.0, Harvey-Liu-Zhu about 3.0, Bonferroni two sided 5% over N={N} is {thr_bonf:.2f} (over 40 effective: {thr_bonf_n40:.2f}).\n")
    tstats = {}
    sets = [("Trend 2x S&P", ms, rule, hold), ("Quality tenth (French)", fm, fq, fhold), ("QUAL real fund vs SPY", qm, [qr[m] for m in qm], [sr_[m] for m in qm])]
    for nm, mm, r_, h_ in sets:
        ex = [a - b for a, b in zip(r_, h_)]
        n, mu, sd, _, _ = moments(ex)
        t, tnw = mu / (sd / math.sqrt(n)), nw_t(ex)
        yw = sign_test(mm, r_, h_, lambda m: m[:4], 6)
        dw = sign_test(mm, r_, h_, lambda m: m[:3], 36)
        tstats[nm] = (t, tnw, yw, dw, mu * 12)
        out(f"   {nm}: mean excess {mu * 12:+.2%} a year, monthly t {t:.2f}, Newey-West (6 lags) t {tnw:.2f}")
        out(f"     beat hold in {yw[0]} of {yw[1]} blind years (sign test p {yw[2]:.3f}), {dw[0]} of {dw[1]} decades (p {dw[2]:.3f})")
        out(f"     t vs 3.0: {'ABOVE' if t >= 3 else 'BELOW'}; vs Bonferroni N={N} ({thr_bonf:.2f}): {'ABOVE' if t >= thr_bonf else 'BELOW'}")
    out("")

    # ---- 4. expected false passes ----
    out("4. EXPECTED FALSE PASSES")
    out("   Null pass rate p0 = chance a rule with NO true edge clears the 3 part bar (more return, no bigger drop, most decades).")
    out("   Measured by Monte Carlo: demean each winner's monthly excess over hold, resample in 12 month blocks, add to the real")
    out("   holding path, test the bar. 4000 draws each. The random schedule baselines in results-leverage-robust.txt,")
    out("   results-quality.txt and friends say the same thing from the other side: random in and out timing almost never")
    out("   matched a winner on return and drop (0 of 1000 for Trend 2x).")
    p0 = {}
    for nm, mm, r_, h_ in sets[:2]:
        p0[nm] = null_pass_rate(mm, r_, h_)
        out(f"   {nm}: null pass rate {p0[nm]:.3f}")
    pbar = statistics.mean(p0.values())
    out(f"   Average p0 = {pbar:.3f}. Observed passes: 2 (Trend 2x S&P and Trend 2x Nasdaq 100, the same bet), plus Quality (vs hold only, and the real fund fails).")
    for nlab, nn in (("all trials N", N), ("40 effective", 40), ("10 effective", 10)):
        lam = nn * pbar
        pge2 = 1 - sum(math.exp(-lam) * lam ** k / math.factorial(k) for k in range(2))
        pge3 = 1 - sum(math.exp(-lam) * lam ** k / math.factorial(k) for k in range(3))
        out(f"   {nlab:14}: expected false passes {lam:.1f}; P(at least 2 by luck) {pge2:.2f}; P(at least 3) {pge3:.2f}")
    out("   Read: noise alone clears this bar about 3% to 11% of the time for rules shaped like our winners. Over the independent")
    out("   bets (somewhere between 10 and 40) that is 1 to 3 false passes. We got 2 or 3. That is what luck looks like.")
    out("   If all 148 trials were independent the luck count would be 10, and the observed 2 or 3 would sit below it, but they are")
    out("   not independent, most are the same trend rule on the same index, so the effective number is the honest one to use.\n")

    # ---- 5. verdicts ----
    out("5. VERDICT INPUTS")
    for s in S[:3]:
        t = tstats[s["name"]]
        key = (s["name"], "excess over hold (IR)")
        r = res[key]
        out(f"   {s['name']}: IR DSR at N={N} {r[1][2]:.2f}, 2x variance {r[2][2]:.2f}, 40 effective {r[3][2]:.2f}; t {t[0]:.2f}; years {t[2][0]}/{t[2][1]}, decades {t[3][0]}/{t[3][1]}")


if __name__ == "__main__":
    main()
