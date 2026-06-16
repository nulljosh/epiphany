// Seeded random for reproducible Monte Carlo
export const sRand = s => {
  const x = Math.sin(s + 1) * 10000;
  return x - Math.floor(x);
};

// Box-Muller for normal distribution
export const nRand = s => {
  const u = Math.max(0.0001, sRand(s));
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * sRand(s + 0.5));
};

// Normal CDF approximation
export const nCDF = x => {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x) / 1.414;
  const t = 1 / (1 + 0.3275911 * a);
  return 0.5 * (1 + s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)));
};

// Black-Scholes probability of finishing above strike
export const bsProb = (S, K, r, v, T) => {
  if (T <= 0) return S > K ? 1 : 0;
  const d2 = (Math.log(S / K) + (r - 0.5 * v * v) * T) / (v * Math.sqrt(T));
  return nCDF(d2);
};

// Fibonacci extensions calculator
export const calcFibTargets = (spot, low52, high52) => {
  const range = high52 - low52;
  return {
    fib236: spot + range * 0.236,
    fib382: spot + range * 0.382,
    fib500: spot + range * 0.5,
    fib618: spot + range * 0.618,
    fib786: spot + range * 0.786,
    fib100: spot + range * 1.0,
    fib1272: spot + range * 1.272,
    fib1618: spot + range * 1.618,
  };
};

// Format price for display
export const formatPrice = p => {
  const abs = Math.abs(p);
  const sign = p < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  if (abs >= 100)  return `${sign}${abs.toFixed(0)}`;
  if (abs >= 10)   return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toFixed(4)}`;
};

// Run Monte Carlo simulation
export const runMonteCarlo = (spot, vol, drift, volMult, targets, horizons, simSeed, N = 5000) => {
  const v = vol * volMult;
  const dt = 1 / 365;
  const maxD = Math.max(...horizons);
  const paths = [];
  const finals = horizons.map(() => []);

  for (let i = 0; i < N; i++) {
    let p = spot;
    const path = [{ d: 0, p }];

    for (let d = 1; d <= maxD; d++) {
      p *= Math.exp((drift - 0.5 * v * v) * dt + v * Math.sqrt(dt) * nRand(simSeed + i * maxD + d));
      if (i < 50) path.push({ d, p });
      horizons.forEach((h, j) => {
        if (d === h) finals[j].push(p);
      });
    }
    if (i < 50) paths.push(path);
  }

  // Build percentile data
  const pctData = [];
  for (let d = 0; d <= maxD; d += 5) {
    const ps = paths.map(x => x[Math.floor(d / 5)]?.p || spot).sort((a, b) => a - b);
    pctData.push({
      d,
      p5: ps[Math.floor(ps.length * 0.05)],
      p50: ps[Math.floor(ps.length * 0.5)],
      p95: ps[Math.floor(ps.length * 0.95)]
    });
  }

  // Calculate probabilities
  const probs = targets.map((tgt, i) => {
    const f = finals[i];
    if (!f.length) return { tgt, mc: 0, bs: 0, mean: spot, p5: spot, p95: spot };
    const sorted = [...f].sort((a, b) => a - b);
    return {
      tgt,
      mc: f.filter(x => x >= tgt).length / f.length,
      bs: bsProb(spot, tgt, 0.045, v, horizons[i] / 365),
      mean: f.reduce((a, b) => a + b, 0) / f.length,
      p5: sorted[Math.floor(sorted.length * 0.05)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  });

  return { pctData, probs, finals };
};
