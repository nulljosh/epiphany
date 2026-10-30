import { describe, expect, it } from 'vitest';
import { allocation, isCrypto, holdingFilters, filterHoldings, yearlyDividends } from './allocation';

describe('allocation', () => {
  it('splits holdings into stocks and crypto, adds cash, drops empty buckets', () => {
    expect(allocation([{ symbol: 'AAPL', value: 300 }, { symbol: 'BTC-USD', value: 100 }, { symbol: 'X', value: 0 }], 50))
      .toEqual([{ label: 'Stocks', value: 300 }, { label: 'Crypto', value: 100 }, { label: 'Cash', value: 50 }]);
    expect(allocation([{ symbol: 'SHOP.TO', value: 10 }], 0)).toEqual([{ label: 'Stocks', value: 10 }]);
  });
  it('knows a coin ticker from a stock', () => {
    expect(isCrypto('ETH')).toBe(true);
    expect(isCrypto('COIN')).toBe(false);
  });
  it('offers only the chips that split the list', () => {
    const h = [{ symbol: 'AAPL' }, { symbol: 'SHOP.TO' }, { symbol: 'BTC-USD' }];
    expect(holdingFilters(h)).toEqual(['All', 'Stocks', 'Crypto', 'CAD', 'USD']);
    expect(holdingFilters([{ symbol: 'AAPL' }, { symbol: 'MSFT' }])).toEqual(['All']);
    expect(filterHoldings(h, 'CAD').map((x) => x.symbol)).toEqual(['SHOP.TO']);
    expect(filterHoldings(h, 'Stocks').map((x) => x.symbol)).toEqual(['AAPL', 'SHOP.TO']);
    expect(filterHoldings(h, 'All')).toBe(h);
  });
  it('estimates yearly dividends from trailing yield', () => {
    const h = [{ symbol: 'KO', value: 1000 }, { symbol: 'BTC-USD', value: 500 }];
    expect(yearlyDividends(h, { KO: { yield: 3 }, 'BTC-USD': { yield: null } })).toBeCloseTo(30);
    expect(yearlyDividends(h, {})).toBe(0);
  });
});
