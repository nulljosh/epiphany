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

import { trend2x } from './indicators.js';

describe('trend2x', () => {
  it('needs 200 closes', () => {
    expect(trend2x(climb(150))).toBeNull();
  });
  it('holds SSO above the 200 day average', () => {
    const t = trend2x(climb(250));
    expect([t.symbol, t.other, t.side, t.above]).toEqual(['SSO', 'BIL', '2x S&P', true]);
  });
  it('holds BIL below it', () => {
    const t = trend2x(climb(250).reverse());
    expect([t.symbol, t.other, t.side, t.above]).toEqual(['BIL', 'SSO', 'T-bills', false]);
  });
  it('a close exactly at the average is not above', () => {
    expect(trend2x(Array(250).fill(100)).symbol).toBe('BIL');
  });
});
