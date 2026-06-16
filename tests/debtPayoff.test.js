import { describe, it, expect } from 'vitest';
import { debtMonthsToPayoff, debtPayoffLabel } from '../src/utils/debtPayoff.js';

describe('debtMonthsToPayoff', () => {
  it('returns 0 for zero balance', () => {
    expect(debtMonthsToPayoff(0, 100, 20)).toBe(0);
  });

  it('returns 0 when balance <= minPayment (payable now)', () => {
    expect(debtMonthsToPayoff(50, 100, 20)).toBe(0);
    expect(debtMonthsToPayoff(100, 100, 20)).toBe(0);
  });

  it('returns exact months for zero interest rate', () => {
    expect(debtMonthsToPayoff(1000, 100, 0)).toBe(10);
  });

  it('returns slightly more than 10 months with 20% interest', () => {
    const months = debtMonthsToPayoff(1000, 100, 20);
    expect(months).toBeGreaterThan(10);
    expect(months).toBeLessThan(12);
    // ~11.something
    expect(Math.floor(months)).toBe(11);
  });

  it('returns Infinity when payment cannot cover interest', () => {
    // 120% rate on 1000 = 100/mo interest, payment is only 10
    expect(debtMonthsToPayoff(1000, 10, 120)).toBe(Infinity);
  });

  it('returns Infinity when minPayment is 0', () => {
    expect(debtMonthsToPayoff(1000, 0, 20)).toBe(Infinity);
  });

  it('returns 0 for negative balance', () => {
    expect(debtMonthsToPayoff(-500, 100, 20)).toBe(0);
  });
});

describe('debtPayoffLabel', () => {
  it('returns "now" for 0 months', () => {
    expect(debtPayoffLabel(0)).toBe('now');
  });

  it('returns "now" for very small values (< 0.1)', () => {
    expect(debtPayoffLabel(0.05)).toBe('now');
  });

  it('returns days for sub-month values', () => {
    // 0.5 months * 30.44 = ~15 days
    expect(debtPayoffLabel(0.5)).toBe('15d');
  });

  it('returns approximate months for larger values', () => {
    expect(debtPayoffLabel(3)).toBe('~3mo');
  });

  it('returns "n/a" for Infinity', () => {
    expect(debtPayoffLabel(Infinity)).toBe('n/a');
  });

  it('returns "n/a" for negative Infinity', () => {
    expect(debtPayoffLabel(-Infinity)).toBe('n/a');
  });
});
