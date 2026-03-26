# Monica: Technical Whitepaper

**Version**: 2.0
**Date**: February 2026
**Author**: Joshua Trommel ([@nulljosh](https://github.com/nulljosh))
**License**: MIT

---

## Abstract

Monica is a low-latency financial terminal combining quantitative simulation, prediction market analysis, and live market data in under 10MB of runtime memory. This paper documents the core algorithms - trading simulator, Monte Carlo engine, Kelly sizing, and edge detection - along with the system architecture that makes extreme efficiency possible.

---

## 1. Trading Simulator

The simulator models autonomous trading from $1 to $1T across 61 assets spanning indices, equities, crypto, and memecoins.

### 1.1 Price Model

Each tick, asset prices update using a bounded random walk with drift and trend components:

```
move     = drift + trend[sym] + (rand − 0.5) × noise
newPrice = clamp(lastPrice × (1 + move), base × 0.7, base × 1.5)
```

Parameters:
- `drift = 0.0001` — persistent upward bias
- `trend[sym]` — resets with p = 0.05 per tick: `(rand − 0.45) × 0.006`
- `noise = 0.008` — peak-to-peak random component
- Price clamped to [70%, 150%] of base

Three ticks are generated per simulation step to smooth the signal.

### 1.2 Entry Signal

Each step, the algorithm scans all assets and selects the highest-quality entry via six sequential filters:

| Filter | Condition |
|--------|-----------|
| Cooldown | Skip symbols traded within last 50 ticks |
| Volatility | Reject if 10-bar realized stddev > 2.5% |
| Momentum | Reject if price-to-MA deviation below minimum (scales with balance) |
| Trend consistency | Require ≥ 5 rising bars in last 10 |
| Dual MA | Current price must be above 20-bar MA |
| Continuity | Previous bar must also show positive strength |

Momentum minimum thresholds by balance:

| Balance | Min Strength |
|---------|-------------|
| < $2 | 0.80% |
| < $10 | 0.90% |
| < $100 | 1.00% |
| $100+ | 1.20% |

The asset with the highest strength score that clears all filters is selected.

### 1.3 Position Sizing

Size scales down as balance grows, preventing runaway compounding:

| Balance | Size % |
|---------|--------|
| < $10 | 65% |
| < $100 | 50% |
| < $10,000 | 35% |
| < $1M | 25% |
| < $100M | 15% |
| $100M+ | 10% |

```
shares = (balance × sizePercent) / entryPrice
```

This is fractional Kelly at variable fractions — aggressive early, conservative at scale.

### 1.4 Exit Rules

| Condition | Trigger |
|-----------|---------|
| Stop loss | `price ≤ entry × 0.983` (−1.7%), floor at $0.50 |
| Take profit | `price ≥ entry × 1.05` (+5%) |
| Trailing stop | If up >2%, ratchet stop to `max(stop, price × 0.97)` |

The trailing stop locks in a 3% minimum gain once in profit.

### 1.5 Expected Value Per Trade

```
EV = (winRate × reward) − (lossRate × risk)
EV = (0.70 × 5%) − (0.30 × 1.7%)
EV = 3.5% − 0.51% = +2.99% per trade
```

Asymmetric R:R of ~3:1. Combined with a target win rate of 70%+, this produces positive EV per trade.

---

## 2. Monte Carlo Engine

### 2.1 Geometric Brownian Motion

Price paths follow the GBM SDE discretized over daily steps:

```
S(t+dt) = S(t) × exp((μ − 0.5σ²) × dt + σ × √dt × Z)
```

Where `Z ~ N(0,1)` drawn via Box-Muller transform, and `dt = 1/365`.

### 2.2 Box-Muller Transform

Standard normals are generated from a seeded pseudo-random source:

```
u = max(0.0001, sRand(s))
Z = √(−2 × ln(u)) × cos(2π × sRand(s + 0.5))
```

The seed is a function of `(simSeed, pathIndex, day)`, making results reproducible across sessions.

### 2.3 Simulation Parameters

- **Paths (N)**: 5,000
- **Horizon**: User-configurable (default 30 days)
- **Output**: 5th, 50th, 95th percentile bands

### 2.4 Probability Estimates

For each target price and horizon, two methods are computed and cross-validated:

**Monte Carlo**:
```
P_mc = count(finalPrice ≥ target) / N
```

**Black-Scholes** (d2 term):
```
d2 = [ln(S/K) + (r − 0.5σ²)T] / (σ√T)
P_bs = N(d2)     where r = 0.045
```

### 2.5 Normal CDF Approximation

Abramowitz & Stegun rational approximation (max error < 7.5 × 10⁻⁸):

```
t = 1 / (1 + 0.3275911 × |x| / √2)
erf ≈ 1 − poly(t) × exp(−x²/2)
N(x) = 0.5 × (1 + sign(x) × erf)
```

---

## 3. Kelly Criterion

Position sizing for prediction market bets uses fractional Kelly:

```
f* = (b × p − q) / b
f_applied = min(f* × 0.25, 0.10)
```

Where:
- `b = odds − 1` (net odds)
- `p` = win probability, `q = 1 − p`
- 0.25 factor = quarter-Kelly (reduces variance by ~75%, retains ~75% growth rate)
- Hard cap of 10% of bankroll per bet

---

## 4. Prediction Market Edge Detection

For each Polymarket contract, edge is computed relative to a coin flip:

```
edge   = max(yesProb, noProb) − 0.50
side   = argmax(yesProb, noProb)
hasEdge = edge > 0.40     // implied probability > 90%
```

Contracts flagged `hasEdge = true` represent near-certainty outcomes — candidates for Kelly-sized deployment.

---

## 5. Fibonacci Milestones

The simulator uses Fibonacci ratios as balance checkpoints:

```
fib_N = spot + range × ratio
```

| Ratio | Milestone |
|-------|-----------|
| 0.236 | Fib 23.6% |
| 0.382 | Fib 38.2% |
| 0.618 | Golden Ratio |
| 1.000 | 100% extension |
| 1.618 | Golden Extension |

Applied to balance progression: $1 → $1.618 → $2.618 → ... → $1B → $1T.

---

## 6. Delta-Threshold Update Algorithm

UI re-renders only when price moves beyond a threshold, minimizing bandwidth and render cost:

```
update = |P_curr − P_prev| / P_prev > δ     where δ = 0.5%
```

This reduces unnecessary renders by ~80% during low-volatility sessions.

| Dimension | Complexity |
|-----------|------------|
| Memory | O(n) — one stored price per asset |
| Check cost | O(1) per asset per tick |
| Render cost | O(k) where k << n |

---

## 7. Data Pipeline

```
Vercel Cron (08:00 UTC daily)
    ├── Polymarket API    → 50 markets by 24h volume
    ├── Yahoo Finance     → 24 stocks + 11 commodities
    └── CoinGecko         → BTC + ETH spot

          ↓
    Vercel Blob Storage (~50KB JSON)
          ↓
    /api/latest  (<100ms p50 latency)
          ↓
    React client (5-min refresh + Delta-Threshold updates)
```

Fallback: If the Blob cache is stale (>24h), the client falls back to direct API calls with a staleness warning.

---

## 8. Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Bundle size | <500KB | 233KB |
| Runtime memory | <10MB | ~177KB |
| API latency | <100ms | ~200ms |
| Tick rate | 50ms | 50ms |
| Monte Carlo (5K paths) | <500ms | <200ms |

---

## 9. Monetization

Monica is freemium.

**Free**: All simulation, Monte Carlo, prediction market, and live data features. No account required.

**Pro ($49/month)**:
- cTrader auto-trading integration (CFD execution from sim signals)
- TradingView webhook receiver (alert-to-order pipeline)
- Priority API access

The free tier is complete by design. Pro is for users who want to act on signals in real markets.

---

## 10. Roadmap

- **Black-Scholes options pricer** — Full options chain with Greeks
- **Historical backtesting** — Replay real OHLCV data through entry logic
- **WebSocket feeds** — Replace polling with streaming tick data
- **Kalshi integration** — US-regulated prediction markets alongside Polymarket
- **C++ core via WASM** — 10x Monte Carlo speedup, sub-millisecond path generation

---

## Disclaimer

Monica is a simulation and research tool. Nothing in this document or the software constitutes financial advice. All simulations use synthetic price data. Past simulated performance does not predict real market outcomes.

---

*MIT License | Built by Joshua Trommel | Not financial advice*
