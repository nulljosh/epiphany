# Monica Trading Simulator - Implementation Notes

**Date:** 2026-02-16
**Task:** Extend simulator from $1B to $1T with Fibonacci checkpoints

## Current Implementation Summary

### Core Files
- **App.jsx (lines 96-427):** Main simulator loop, trading algorithm, risk management
- **App.test.jsx:** Test suite with 30+ test cases
- **utils/simBenchmark.js:** Headless benchmark tool for N-run testing
- **utils/math.js:** Fibonacci calculations, Monte Carlo engine

### Key Variables & Logic

**Target (App.jsx:211, 294, 322):**
```javascript
const target = targetTrillion ? 1000000000000 : 1000000000; // $1B or $1T
```

**Auto-Enable $1T (line 118):**
```javascript
const targetTrillion = balance >= 1e9; // Auto-switch at $1B
```

**Stop Condition (lines 309-312):**
```javascript
if (cappedBalance >= target) {
  setRunning(false); // STOPS HERE - need to change
}
```

**Fibonacci Levels (line 104):**
```javascript
const FIB_LEVELS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
  10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000,
  10000000, 20000000, 50000000, 100000000, 200000000, 500000000, 1000000000];
// Currently defined but NOT used in algorithm
```

### Position Sizing Tiers (App.jsx:337-385)

**Base Scaling:**
- $0-$2: 70% of balance per trade
- $2-$5: 50%
- $5-$10: 30%
- $10+: 15%

**$1T Mode Scaling (lines 366-376):**
- $1B-$2B: 25%
- $2B-$5B: 28%
- $5B-$10B: 30%
- $10B-$20B: 32%
- $20B-$50B: 33%
- $50B-$100B: 35%
- $100B-$200B: 38%
- $200B-$500B: 40%
- $500B-$1T: 45% (aggressive final push)

### Risk Management

**Stop Loss (line 415):**
```javascript
stop: best.price * 0.983, // 1.7% hard stop
```

**Trailing Stop (lines 316-318):**
```javascript
if (pnlPct > 0.02) { // +2% unrealized = trail activates
  setPosition(pos => ({ ...pos, stop: Math.max(pos.stop, current * 0.97) }));
}
```

**Take Profit (line 416):**
- Varies by balance: 5-8% target
- Lower balance = higher take profit multiplier

**Volatility Filter (lines 344-350):**
```javascript
const stddev = Math.sqrt(variance);
if (stddev > 0.025) return; // Skip if >2.5% volatility
```

**Momentum Filter (lines 352-358):**
```javascript
const minStrength = balance < 2 ? 0.008 :
                    balance < 10 ? 0.009 :
                    balance < 100 ? 0.010 : 0.012;
if (strength > minStrength) { /* enter trade */ }
```

### Performance Metrics
- **Tick Rate:** 50-100 simulation ticks per visual frame
- **Frame Rate:** 60fps via requestAnimationFrame
- **Asset Count:** 61 symbols (stocks, indices, crypto, commodities)
- **Price History Window:** Last 30 prices per symbol
- **Trade Log:** Last 100 trades retained

## User Requirements (2026-02-16)

1. **Extend to $1T:** Simulator reliably hits $1B, wants to reach $1T
2. **Fibonacci Caution:** Be "more careful" at key levels (2B, 5B, etc.)
3. **User Confirmation at $1T:** Pause and ask if user wants to continue
4. **Infinite Progression:** After $1T, pause at each fib level forever
5. **Testing:** Run on localhost first, update test suite
6. **Error Handling:** Professional error handling

## Bugs Found

**H1 Title Bug:**
- Project showed "bread" (old name) in h1 -- fixed to "monica"
- Need to find and fix in App.jsx or index.html

## Implementation Plan Status

**Phase 1: Exploration ✓**
- Analyzed all simulator code
- Identified key variables and logic flows
- Found existing fib levels array

**Phase 2: Design (In Progress)**
- Plan agent designing implementation approach
- Questions to resolve:
  - How to implement "more careful" behavior?
  - Extend fib levels beyond $1T?
  - UI for user confirmation?
  - State management for pausing at milestones?

**Phase 3: Implementation (Pending)**
**Phase 4: Testing (Pending)**
**Phase 5: Deployment (Pending)**

---

**Next Steps:**
1. Wait for Plan agent to complete design
2. Review and finalize implementation approach
3. Update App.jsx with new logic
4. Extend FIB_LEVELS array to include 2T, 5T, 10T
5. Update tests in App.test.jsx
6. Test on localhost
7. Fix "bread" → "monica" h1 bug (done)
