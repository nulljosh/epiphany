// Headless simulator benchmark. Usage: node src/utils/simBenchmark.js [runs]

// Copy of ASSETS from App.jsx (prices only)
const ASSETS = {
  NAS100: 22950, SP500: 6920, US30: 48780, XAU: 4890, XAG: 94,
  AAPL: 247, MSFT: 454, GOOGL: 323, AMZN: 220, NVDA: 185, META: 595,
  TSLA: 421, BRK: 465, LLY: 785, V: 305, UNH: 520, XOM: 115, JPM: 245,
  WMT: 95, JNJ: 155, MA: 535, PG: 170, AVGO: 230, HD: 420, CVX: 165,
  MRK: 98, COST: 1020, ABBV: 195, KO: 63, PEP: 155, AMD: 135, ADBE: 465,
  CRM: 340, NFLX: 895, CSCO: 58, TMO: 520, ORCL: 185, ACN: 385, INTC: 20,
  NKE: 72, TXN: 205, QCOM: 155, PM: 140, DHR: 245, INTU: 695, UNP: 235,
  RTX: 115, HON: 225, SPGI: 520, COIN: 265, PLTR: 71, HOOD: 38,
  FARTCOIN: 0.85, WIF: 1.92, BONK: 0.00002, PEPE: 0.000012, DOGE: 0.31, SHIB: 0.000021,
};
const SYMS = Object.keys(ASSETS);

function runSim(target = 1e9) {
  let balance = 1;
  let position = null;
  let lastTraded = null;
  let tick = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  const cooldown = {};
  const trends = Object.fromEntries(SYMS.map(s => [s, 0]));
  const prices = Object.fromEntries(SYMS.map(s => [s, [ASSETS[s]]]));

  const maxTicks = 500000; // safety cap

  while (tick < maxTicks && balance > 0.5 && balance < target) {
    // Generate prices (3 ticks per step like the real sim)
    for (let t = 0; t < 3; t++) {
      SYMS.forEach(sym => {
        if (Math.random() < 0.05) trends[sym] = (Math.random() - 0.45) * 0.006;
        const drift = 0.0001;
        const move = drift + trends[sym] + (Math.random() - 0.5) * 0.008;
        const prev = prices[sym];
        const last = prev[prev.length - 1];
        const base = ASSETS[sym];
        const newPrice = Math.max(base * 0.7, Math.min(base * 1.5, last * (1 + move)));
        if (prev.length >= 30) prev.shift();
        prev.push(newPrice);
      });
      tick++;
    }

    // Check position exit
    if (position) {
      const p = prices[position.sym];
      const current = p[p.length - 1];
      const pnl = (current - position.entry) * position.size;
      const pnlPct = (current - position.entry) / position.entry;

      if (current <= position.stop) {
        balance = Math.max(0.5, balance + pnl);
        losses++;
        trades++;
        cooldown[position.sym] = tick + 50;
        position = null;
        continue;
      }
      if (current >= position.target) {
        const cappedBalance = Math.min(balance + pnl, target);
        balance = cappedBalance;
        wins++;
        trades++;
        position = null;
        if (balance >= target) break;
        continue;
      }
      // Trailing stop
      if (pnlPct > 0.02) {
        position.stop = Math.max(position.stop, current * 0.97);
      }
      continue; // Don't open new position while one is open
    }

    // Find entry
    let best = null;
    SYMS.forEach(sym => {
      if (sym === lastTraded) return;
      if (cooldown[sym] && tick < cooldown[sym]) return;
      const p = prices[sym];
      if (p.length < 10) return;
      const current = p[p.length - 1];

      // Volatility filter
      const recent = p.slice(-10);
      const avg = recent.reduce((a, b) => a + b, 0) / 10;
      const variance = recent.reduce((a, b) => a + Math.pow((b - avg) / avg, 2), 0) / 10;
      const stddev = Math.sqrt(variance);
      if (stddev > 0.025) return;

      const strength = (current - avg) / avg;
      const minStrength = balance < 2 ? 0.008 : balance < 10 ? 0.009 : balance < 100 ? 0.010 : 0.012;

      // Trend consistency: need at least 5 up-bars in last 10
      const risingBars = recent.filter((price, i) => i > 0 && price > recent[i - 1]).length;
      if (risingBars < 5) return;

      // Dual MA confirmation: current must be above 20-bar avg
      if (p.length >= 20) {
        const longAvg = p.slice(-20).reduce((a, b) => a + b, 0) / 20;
        if (current <= longAvg) return;
      }

      // Momentum continuity: prev bar also positive
      const prevStrength = (p[p.length - 2] - avg) / avg;
      if (prevStrength <= 0) return;

      if (strength > minStrength && (!best || strength > best.strength)) {
        best = { sym, price: current, strength };
      }
    });

    if (best) {
      const sizePercent = balance < 10 ? 0.65 :
                         balance < 100 ? 0.50 :
                         balance < 10000 ? 0.35 :
                         balance < 1000000 ? 0.25 :
                         balance < 100000000 ? 0.15 :
                         0.10;
      const sizeDollars = balance * sizePercent;
      const shares = sizeDollars / best.price; // Convert to shares
      if (shares < 0.0000001) continue;

      position = {
        sym: best.sym,
        entry: best.price,
        size: shares, // SHARES not dollars
        stop: best.price * 0.983,
        target: best.price * 1.05,
      };
      lastTraded = best.sym;
    }
  }

  return {
    won: balance >= target,
    balance,
    ticks: tick,
    trades,
    wins,
    losses,
    winRate: trades > 0 ? (wins / trades * 100).toFixed(1) : '0',
  };
}

// Main
const numRuns = parseInt(process.argv[2]) || 50;
console.log(`Running ${numRuns} simulations...\n`);

const results = [];
const start = Date.now();

for (let i = 0; i < numRuns; i++) {
  const r = runSim();
  results.push(r);
  const status = r.won ? 'WIN ' : 'BUST';
  process.stdout.write(`  ${String(i + 1).padStart(3)} ${status} | $${r.balance >= 1e9 ? '1B' : r.balance.toFixed(2).padStart(8)} | ${String(r.trades).padStart(5)} trades | ${r.winRate}% WR | ${r.ticks} ticks\n`);
}

const elapsed = Date.now() - start;
const winCount = results.filter(r => r.won).length;
const lossCount = results.length - winCount;
const avgTrades = Math.round(results.reduce((a, r) => a + r.trades, 0) / numRuns);
const avgWR = (results.reduce((a, r) => a + parseFloat(r.winRate), 0) / numRuns).toFixed(1);
const avgTicks = Math.round(results.reduce((a, r) => a + r.ticks, 0) / numRuns);

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULTS: ${numRuns} runs in ${(elapsed / 1000).toFixed(1)}s`);
console.log(`  Run Win Rate:   ${winCount}/${numRuns} = ${(winCount / numRuns * 100).toFixed(0)}%`);
console.log(`  Avg Trade WR:   ${avgWR}%`);
console.log(`  Avg Trades:     ${avgTrades}`);
console.log(`  Avg Ticks:      ${avgTicks}`);
console.log(`${'='.repeat(60)}`);
