import { describe, expect, it } from 'vitest';
import { portfolioValue } from '../../server/api/portfolio-snapshot.js';

describe('portfolioValue', () => {
  it('prices holdings live, falls back to stored value, adds cash over balance', () => {
    const data = {
      holdings: [{ symbol: 'AAPL', shares: 2 }, { symbol: 'XYZ', shares: 1, marketValue: 40 }],
      accounts: [{ balance: 100 }, { balance: 500, cash: 250 }],
    };
    expect(portfolioValue(data, [{ symbol: 'AAPL', price: 200.005 }])).toBe(790.01);
    expect(portfolioValue({}, [])).toBe(0);
  });
});
