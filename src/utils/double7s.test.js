import { describe, it, expect } from 'vitest';
import { double7s } from './indicators.js';

const climb = (n) => Array.from({ length: n }, (_, i) => 100 + i * 0.5);

describe('double7s', () => {
  it('needs 200 closes', () => {
    expect(double7s(climb(150))).toBeNull();
  });

  it('buys a 10 day low inside an uptrend', () => {
    const v = climb(250);
    v.push(v[v.length - 1] - 5); // sharp dip, still far above the 200 day average
    expect(double7s(v).label).toBe('Buy');
  });

  it('sells a 10 day high', () => {
    expect(double7s(climb(250)).label).toBe('Sell');
  });

  it('holds in a downtrend even at a 10 day low', () => {
    const v = climb(250).reverse(); // falling, below its 200 day average at a fresh low
    expect(double7s(v).label).toBe('Hold');
  });
});
