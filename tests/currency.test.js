import { describe, it, expect } from 'vitest';
import { quoteCurrency, toCad } from '../src/utils/currency.js';

describe('net worth currency', () => {
  it('knows Canadian listings from US ones', () => {
    expect(quoteCurrency('XIC.TO')).toBe('CAD');
    expect(quoteCurrency('SHOP.TO')).toBe('CAD');
    expect(quoteCurrency('SPY')).toBe('USD');
    expect(quoteCurrency('BTC-USD')).toBe('USD');
  });

  it('converts US dollars to Canadian with CADUSD=X', () => {
    // 0.6259 SPY at 764 USD, CAD worth 0.703 USD -> about 680 CAD, not 478
    expect(toCad(0.6259 * 764, 'USD', 0.703)).toBeCloseTo(680.2, 1);
    expect(toCad(100, 'CAD', 0.703)).toBe(100);
  });

  it('refuses to guess before the rate arrives', () => {
    expect(toCad(100, 'USD', null)).toBeNull();
    expect(toCad(null, 'USD', 0.7)).toBeNull();
  });
});
