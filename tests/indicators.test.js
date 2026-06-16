import { describe, it, expect } from 'vitest';
import { sma, ema, rsi, macd, bollinger, signal } from '../src/utils/indicators.js';

// Accelerating uptrend so MACD histogram is clearly positive (a flat linear ramp
// drives it to ~0). Linear downtrend is enough for Sell (MA down + RSI weak).
const rising = Array.from({ length: 60 }, (_, i) => 100 * 1.01 ** i);
const falling = Array.from({ length: 60 }, (_, i) => 160 - i);

describe('sma/ema', () => {
  it('sma returns mean of last period', () => {
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5);
  });
  it('returns null when not enough data', () => {
    expect(sma([1], 5)).toBeNull();
    expect(ema([1], 5)).toBeNull();
  });
});

describe('rsi', () => {
  it('is 100 for a monotonic uptrend (no losses)', () => {
    expect(rsi(rising)).toBe(100);
  });
  it('is low for a monotonic downtrend', () => {
    expect(rsi(falling)).toBeLessThan(5);
  });
  it('returns null when not enough data', () => {
    expect(rsi([1, 2, 3])).toBeNull();
  });
});

describe('macd', () => {
  it('histogram is positive on an uptrend', () => {
    const m = macd(rising);
    expect(m).not.toBeNull();
    expect(m.histogram).toBeGreaterThan(0);
  });
});

describe('bollinger', () => {
  it('upper > middle > lower', () => {
    const b = bollinger(rising);
    expect(b.upper).toBeGreaterThan(b.middle);
    expect(b.middle).toBeGreaterThan(b.lower);
  });
});

describe('signal', () => {
  it('returns Buy on a strong uptrend', () => {
    expect(signal(rising).label).toBe('Buy');
  });
  it('returns Sell on a strong downtrend', () => {
    expect(signal(falling).label).toBe('Sell');
  });
  it('returns null without enough data', () => {
    expect(signal([1, 2, 3])).toBeNull();
  });
});
