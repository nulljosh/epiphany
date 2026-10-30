import { describe, expect, it } from 'vitest';
import { allocation, isCrypto, holdingFilters, filterHoldings, yearlyDividends, unrealizedGain, position } from './allocation';

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
  it('sums unrealized gain over holdings with a cost basis', () => {
    const h = [{ shares: 2, costBasis: 50, gain: 20 }, { shares: 1, costBasis: 100, gain: -10 }, { shares: 5, costBasis: null, gain: null }];
    expect(unrealizedGain(h)).toEqual({ gain: 10, percent: 5 });
    expect(unrealizedGain([{ shares: 1, gain: null }])).toBeNull();
  });

  it('sums a position across accounts, skips cost when a row has none', () => {
    const h = [{ symbol: 'AAPL', shares: 2, costBasis: 100 }, { symbol: 'AAPL', shares: 2, costBasis: 150 }, { symbol: 'MSFT', shares: 9, costBasis: 1 }];
    const p = position(h, 'AAPL', 200, 25);
    expect(p).toMatchObject({ shares: 4, value: 800, today: 160, avgCost: 125, gain: 300, gainPercent: 60 });
    expect(position([{ symbol: 'BTC-USD', shares: 1, costBasis: null }], 'BTC-USD', 10).gain).toBeNull();
    expect(position(h, 'TSLA', 10)).toBeNull();
  });
});
