// Technical indicators computed client-side from a close-price series.
// Pure functions, no deps. Used by StockDetail + the Buy/Hold/Sell badge.

export function sma(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

export function ema(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values, then walk forward.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) prev = values[i] * k + prev * (1 - k);
  return prev;
}

// Full EMA series (needed for MACD signal line).
function emaSeries(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// Wilder's RSI. Returns 0-100 or null.
export function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + down) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// MACD line, signal line, histogram (12/26/9 default).
export function macd(values, fast = 12, slow = 26, signal = 9) {
  if (!Array.isArray(values) || values.length < slow + signal) return null;
  const fastSeries = emaSeries(values, fast);
  const slowSeries = emaSeries(values, slow);
  // Align tails (slow series is shorter by slow-fast).
  const offset = fastSeries.length - slowSeries.length;
  const macdLine = slowSeries.map((s, i) => fastSeries[i + offset] - s);
  const signalLine = emaSeries(macdLine, signal);
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalLine[signalLine.length - 1];
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}

// Bollinger Bands (20-period, 2 stddev default).
export function bollinger(values, period = 20, mult = 2) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(values.length - period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { middle: mean, upper: mean + mult * sd, lower: mean - mult * sd };
}

// Composite Buy/Hold/Sell signal from RSI + MACD + 50/200 MA trend.
// Returns { label: 'Buy'|'Hold'|'Sell', score, reasons: [] }.
export function signal(values) {
  if (!Array.isArray(values) || values.length < 35) return null;
  let score = 0;
  const reasons = [];

  const r = rsi(values);
  if (r != null) {
    // Momentum reading: above 55 = strength, below 45 = weakness. Flag the
    // extremes as a caution in the reasons text without flipping the score.
    if (r > 55) { score += 1; reasons.push(r > 70 ? `RSI ${r.toFixed(0)} (strong, overbought)` : `RSI ${r.toFixed(0)} strong`); }
    else if (r < 45) { score -= 1; reasons.push(r < 30 ? `RSI ${r.toFixed(0)} (weak, oversold)` : `RSI ${r.toFixed(0)} weak`); }
  }

  const m = macd(values);
  if (m) {
    const eps = 1e-6;
    if (m.histogram > eps) { score += 1; reasons.push('MACD bullish'); }
    else if (m.histogram < -eps) { score -= 1; reasons.push('MACD bearish'); }
  }

  const fast = sma(values, 50);
  const slow = values.length >= 200 ? sma(values, 200) : sma(values, Math.min(100, values.length - 1));
  if (fast != null && slow != null) {
    if (fast > slow) { score += 1; reasons.push('Uptrend (MA)'); }
    else if (fast < slow) { score -= 1; reasons.push('Downtrend (MA)'); }
  }

  const label = score >= 2 ? 'Buy' : score <= -2 ? 'Sell' : 'Hold';
  return { label, score, reasons };
}
