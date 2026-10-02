#!/usr/bin/env python3
"""Probability of backtest overfitting (Bailey, Borwein, Lopez de Prado, Zhu) for the Trend 2x family.

The family is every plausible way to write the rule on the real SSO, BIL and SPY prices: average length
50 to 300 days, band 0%, 1% or 2%. Daily returns are cut into 16 equal slices. For every way of choosing 8 slices as
"the past" (12870 splits) we pick the variant that did best in the past, then see where it ranks on the
other 8 slices. PBO is how often that pick lands below the median there. Near 0 the choice carries over, near
50% picking the best variant is a coin flip, and above that it is anti-skill.

    python3 tradingview/pbo.py
"""
import json, os, itertools, numpy as np, pandas as pd

def load(s):
    d = json.load(open(os.path.expanduser(f"~/.cache/epiphany-bars/{s}.json")))
    return pd.Series([x[4] for x in d], index=pd.to_datetime([x[0] for x in d], unit="s").normalize())

px = pd.concat({"spy": load("SPY"), "sso": load("SSO"), "bil": load("BIL")}, axis=1).dropna()
r = px.pct_change().fillna(0)
cols = {}
for n in (50, 100, 150, 200, 250, 300):
    ma = px.spy.rolling(n).mean()
    for band in (0.0, 0.01, 0.02):
        s = pd.Series(np.nan, index=px.index)
        s[px.spy > ma * (1 + band)], s[px.spy < ma * (1 - band)] = 1.0, 0.0
        s = s.ffill().fillna(0).shift(1).fillna(0)
        cols[(n, band)] = s * r.sso + (1 - s) * r.bil - 0.0005 * s.diff().abs().fillna(0)
M = pd.DataFrame(cols).iloc[300:]          # every variant has a signal from here on
S = 16
slices = np.array_split(M.values, S)
def sharpe(parts):
    x = np.vstack(parts); return x.mean(0) / (x.std(0) + 1e-12)
below = total = 0
for past in itertools.combinations(range(S), S // 2):
    rest = [i for i in range(S) if i not in past]
    best = np.argmax(sharpe([slices[i] for i in past]))
    oos = sharpe([slices[i] for i in rest])
    below += (oos < oos[best]).mean() < 0.5   # best-in-past ranks in the lower half out of sample
    total += 1
print(f"{len(cols)} variants, {len(M)} days from {M.index[0].date()}, {total} splits")
print(f"PBO {below/total:.1%}")
sh = sharpe([M.values]); k = int(np.argmax(sh)); print(f"best variant on all days: average {list(cols)[k][0]}, band {list(cols)[k][1]:.0%}, Sharpe {sh[k]*np.sqrt(252):.2f}; the 200 day, no band rule: {sh[list(cols).index((200, 0.0))]*np.sqrt(252):.2f}")
spy = r.spy.reindex(M.index).values; ss = spy.mean() / spy.std() * np.sqrt(252)
print(f"SPY Sharpe over the same days {ss:.2f}; variants above it: {int((sh * np.sqrt(252) > ss).sum())} of {len(cols)}; lowest variant {sh.min()*np.sqrt(252):.2f}")
