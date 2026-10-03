#!/usr/bin/env python3
"""Edge search: random strategies on ETFs, scored the honest way, forever. Backtests only, never orders.

    uv run --with numpy python3 scripts/edge-search.py          # the menu bar app runs this
    uv run --with numpy python3 scripts/edge-search.py --once   # 300 trials, print the board, exit

Three families (trend on a random basket, top-K momentum, inverse-vol trend scaled to a target vol) on
random subsets of 16 ETFs plus cash. Signals use the close of day t and earn day t+1, 6 bps per unit traded.
Selection sees 2008 through 2022 only. 2023 on is held out and shown, never used to pick. A leader must also
beat SPY's Sharpe in BOTH halves of the training years. Its Sharpe is deflated by every trial ever run (the
variance of Sharpes across all trials sets the bar), so the board will say "no edge" until something earns it.
A LEAD means: deflated Sharpe 0.95+, and it beat SPY by 0.1 Sharpe on the held-out years. It is not proof.
Proof is paper trading forward.

State: tradingview/edge-state.json (the menu bar reads it). Log: ~/Library/Logs/EpiphanyEdge.log.
"""
import json, os, random, sys, time, traceback
from datetime import datetime, timezone
from statistics import NormalDist
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tradingview"))
from backtest import fetch_yahoo  # noqa: E402

STATE = os.path.join(HERE, "..", "tradingview", "edge-state.json")
LOG = os.path.expanduser("~/Library/Logs/EpiphanyEdge.log")
UNI = ["SPY", "QQQ", "IWM", "EFA", "EEM", "TLT", "IEF", "LQD", "GLD", "DBC", "VNQ", "XLE", "XLK", "XLV", "XLF", "XLU"]
CASH, HOLDOUT = "BIL", "2023-01-01"
COST, FIN, WARM = 0.0006, 0.005 / 252, 260
LS, MS = (100, 150, 200, 250), (63, 126, 189, 252)
Z, EULER = NormalDist(), 0.5772156649


def note(msg):
    with open(LOG, "a") as f:
        f.write(f"{datetime.now():%b %d, %I:%M %p}  {msg}\n")


def sharpe(x):
    s = x.std()
    return float(x.mean() / s * 252 ** 0.5) if s > 0 else 0.0


def sma(P, L):
    c = np.cumsum(np.vstack([np.zeros((1, P.shape[1])), P]), 0)
    out = np.full(P.shape, np.nan)
    out[L - 1:] = (c[L:] - c[:-L]) / L
    return out


def rollstd(x, n):
    z = np.zeros((1, x.shape[1]))
    c1, c2 = np.cumsum(np.vstack([z, x]), 0), np.cumsum(np.vstack([z, x * x]), 0)
    s1, s2 = c1[n:] - c1[:-n], c2[n:] - c2[:-n]
    out = np.full(x.shape, np.nan)
    out[n - 1:] = np.sqrt(np.maximum(s2 / n - (s1 / n) ** 2, 0))
    return out


class Data:
    def __init__(self):
        series = {}
        for s in UNI + [CASH]:
            bars = fetch_yahoo(s)
            series[s] = {datetime.fromtimestamp(b[0], timezone.utc).date().isoformat(): b[4] for b in bars}
        dates = sorted(set.intersection(*(set(v) for v in series.values())))
        if len(dates) < 1500:
            raise RuntimeError(f"only {len(dates)} common days, a fetch failed")
        P = np.array([[series[s][d] for s in UNI] for d in dates])
        B = np.array([series[CASH][d] for d in dates])
        self.dates, self.T, self.P = dates, len(dates), P
        self.R, self.C = P[1:] / P[:-1] - 1, B[1:] / B[:-1] - 1  # R[t] is the return earned after the close of day t
        self.sma = {L: sma(P, L) for L in LS}
        self.mom = {}
        for m in MS:
            out = np.full(P.shape, np.nan)
            out[m:] = P[m:] / P[:-m] - 1
            self.mom[m] = out
        self.vol = rollstd(np.vstack([np.zeros((1, len(UNI))), self.R]), 60)  # only returns known by day t
        self.h = next(t for t in range(self.T - 1) if dates[t + 1] >= HOLDOUT)
        self.mid = (WARM + self.h) // 2
        ex = self.R[:, 0] - self.C
        self.spy = [sharpe(ex[WARM:self.mid]), sharpe(ex[self.mid:self.h]), sharpe(ex[WARM:self.h]), sharpe(ex[self.h:])]


def pnl(d, W):
    W = W[:-1]
    g = W.sum(1)
    turn = np.abs(np.diff(W, axis=0, prepend=W[:1])).sum(1)
    return (W * d.R).sum(1) + (1 - g) * d.C - np.maximum(g - 1, 0) * FIN - COST * turn


def weights(d, c):
    cols, W = c["cols"], np.zeros((d.T, len(UNI)))
    last = (np.arange(d.T) // c["reb"]) * c["reb"]  # hold weights between rebalances
    if c["fam"] == "mom":
        sc = np.nan_to_num(d.mom[c["m"]][:, cols], nan=-1.0)
        k = min(c["K"], len(cols))
        idx = np.argsort(-sc, 1)[:, :k]
        sub = np.zeros((d.T, len(cols)))
        np.put_along_axis(sub, idx, (np.take_along_axis(sc, idx, 1) > 0) / k, 1)
        W[:, cols] = sub
        return W[last]
    up = d.P[:, cols] > d.sma[c["L"]][:, cols]  # nan compares False
    if c["fam"] == "trend":
        W[:, cols] = up / len(cols)
        return W[last]
    iv = np.where(up, 1 / np.nan_to_num(d.vol[:, cols], nan=np.inf), 0.0)
    tot = iv.sum(1, keepdims=True)
    W[:, cols] = np.divide(iv, tot, out=np.zeros_like(iv), where=tot > 0)
    W0 = W[last]
    u = np.concatenate([[0.0], pnl(d, W0)])  # strategy return known by day t, so the scale is causal
    sd = rollstd(u[:, None], 60)[:, 0] * 252 ** 0.5
    scale = np.nan_to_num(np.minimum(c["lev"], c["tv"] / np.where(sd > 0, sd, np.inf)))
    return W0 * scale[last][:, None]


def rand_cfg(rng):
    fam, k = rng.choice(["trend", "mom", "voltrend"]), rng.randint(2, 8)
    c = {"fam": fam, "cols": sorted(rng.sample(range(len(UNI)), k))}
    if fam == "trend":
        c.update(L=rng.choice(LS), reb=rng.choice([1, 5, 21]))
    elif fam == "mom":
        c.update(m=rng.choice(MS), K=rng.randint(1, min(4, k)), reb=21)
    else:
        c.update(L=rng.choice(LS), tv=rng.choice([0.08, 0.10, 0.12, 0.15]), lev=rng.choice([1, 1.5, 2]), reb=21)
    return c


def plain(c):
    t = ", ".join(UNI[i] for i in c["cols"])
    when = {1: "daily", 5: "weekly", 21: "monthly"}[c["reb"]]
    if c["fam"] == "trend":
        return f"hold {t} in equal parts, each only while above its {c['L']}-day average, otherwise cash ({when} check)"
    if c["fam"] == "mom":
        return f"each month hold the top {c['K']} of {t} by {c['m']}-day gain, only if it is rising, otherwise cash"
    return f"{t}, each only while above its {c['L']}-day average, calmer ones weighted more, sized to {c['tv']:.0%} swings (up to {c['lev']}x)"


def label(c):
    p = {"trend": f"trend{c.get('L')}", "mom": f"mom{c.get('m')} top{c.get('K')}", "voltrend": f"voltrend{c.get('L')} vol{c.get('tv')} x{c.get('lev')}"}[c["fam"]]
    return f"{p} reb{c['reb']} " + ",".join(UNI[i] for i in c["cols"])


def deflated(sr, v, st):
    """Probability the daily Sharpe `sr` beats the best you'd expect from N trials of pure luck."""
    n, var = st["n"], st["m2"] / max(st["n"] - 1, 1)
    if n < 10:
        return 0.0
    sr0 = var ** 0.5 * ((1 - EULER) * Z.inv_cdf(1 - 1 / n) + EULER * Z.inv_cdf(1 - 1 / (n * 2.718281828)))
    return Z.cdf((sr - sr0) / v ** 0.5)


def trial(d, st, rng):
    c = rand_cfg(rng)
    r = pnl(d, weights(d, c))
    ex = r - d.C
    tr = ex[WARM:d.h]
    s = tr.std()
    st["trials"] += 1
    if s == 0:
        return
    sr = float(tr.mean() / s)
    st["n"] += 1  # Welford: variance of Sharpes across every trial
    delta = sr - st["mean"]
    st["mean"] += delta / st["n"]
    st["m2"] += delta * (sr - st["mean"])
    sh = [sharpe(ex[WARM:d.mid]), sharpe(ex[d.mid:d.h]), sharpe(tr), sharpe(ex[d.h:])]
    if not (sh[0] > d.spy[0] and sh[1] > d.spy[1]):
        return  # has to beat SPY in both halves of training
    z = (tr - tr.mean()) / s
    v = (1 - float((z ** 3).mean()) * sr + (float((z ** 4).mean()) - 1) / 4 * sr * sr) / (len(tr) - 1)
    eq = np.cumprod(1 + r[WARM:d.h])
    ho = r[d.h:]
    st["leaders"].append({"name": label(c), "cfg": c, "sr": sr, "v": v, "train": sh[2], "hold": sh[3],
                          "cagr_train": float(eq[-1] ** (252 / len(eq)) - 1), "cagr_hold": float(np.prod(1 + ho) ** (252 / len(ho)) - 1),
                          "mdd": float((eq / np.maximum.accumulate(eq) - 1).min()), "trial": st["trials"]})
    rank(st)


def rank(st):
    for l in st["leaders"]:
        l["dsr"] = deflated(l["sr"], l["v"], st)
    seen, keep = set(), []
    for l in sorted(st["leaders"], key=lambda l: -l["dsr"]):
        if l["name"] not in seen:
            seen.add(l["name"])
            keep.append(l)
    st["leaders"] = keep[:5]


def save(st, d):
    st.update(updated=time.time(), spy=d.spy, first=d.dates[WARM], last=d.dates[-1], holdout=HOLDOUT)
    st["leads"] = [l["name"] for l in st["leaders"] if l["dsr"] >= 0.95 and l["hold"] >= d.spy[3] + 0.1]
    for name in st["leads"]:
        if name not in st["logged"]:
            st["logged"].append(name)
            l = next(x for x in st["leaders"] if x["name"] == name)
            note(f"*** LEAD *** {plain(l['cfg'])}.\n    Scored {l['train']:.2f} in 2008-2022 and {l['hold']:.2f} on the 2023+ test years (the S&P scored {d.spy[3]:.2f}). Luck-adjusted confidence {l['dsr']:.0%} after {st['trials']:,} tries. Not proof. Next step is paper trading it forward.")
    tmp = STATE + ".tmp"
    json.dump(st, open(tmp, "w"))
    os.replace(tmp, STATE)


def main():
    os.nice(10)
    rng, once = random.Random(), "--once" in sys.argv
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    st = {"trials": 0, "n": 0, "mean": 0.0, "m2": 0.0, "leaders": [], "logged": [], **st}
    d, loaded, beat = None, 0, 0
    while True:
        try:
            if d is None or time.time() - loaded > 6 * 3600:
                d, loaded = Data(), time.time()
                note(f"Prices loaded, {d.dates[WARM]} to {d.dates[-1]}. Strategies are picked on data before {HOLDOUT} and graded on the years after. The S&P scores {d.spy[2]:.2f} before and {d.spy[3]:.2f} after (higher is better).")
                rank(st)
            for _ in range(300 if once else 100):
                trial(d, st, rng)
            save(st, d)
            if time.time() - beat > 1800:
                beat = time.time()
                top = st["leaders"][0] if st["leaders"] else None
                note(f"{st['trials']:,} strategies tried. " + (f"Closest so far: {plain(top['cfg'])}.\n    Scored {top['train']:.2f} in training, {top['hold']:.2f} on the test years, the S&P {st['spy'][3]:.2f}. Luck-adjusted confidence {top['dsr']:.0%}. " + ("Beating the S&P on the test years, still checking." if top['hold'] > st['spy'][3] else "Not beating the S&P on the test years, so no.") if top else "None has beaten the S&P in both halves of training yet."))
        except Exception:
            note(traceback.format_exc())
            d = None
            time.sleep(300)
            continue
        if once:
            print(json.dumps({k: st[k] for k in ("trials", "spy", "leads")}), *[f"{l['dsr']:.2f} train {l['train']:.2f} hold {l['hold']:.2f} cagr {l['cagr_hold']:.1%} {l['name']}" for l in st["leaders"]], sep="\n")
            return
        time.sleep(45)


if __name__ == "__main__":
    main()
