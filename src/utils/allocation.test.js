import { describe, expect, it } from 'vitest';
import { allocation, isCrypto, holdingFilters, filterHoldings, yearlyDividends, unrealizedGain, position, dividendCalendar, groupAccounts, valuationLine, holdingsByCountry, concentration } from './allocation';

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

  it('spreads a quarterly payer across the next year from its pay date', () => {
    const now = new Date(2026, 9, 30);
    const ts = new Date(2026, 10, 15).getTime() / 1000;
    const { calendar, next } = dividendCalendar(
      [{ symbol: 'TD', value: 4000 }, { symbol: 'AAPL', value: 1000 }, { symbol: 'NONE', value: 500 }],
      { TD: { yield: 4, dividendDate: ts }, AAPL: { yield: 0.4 }, NONE: {} }, now);
    expect(calendar).toHaveLength(12);
    expect(calendar.filter((m) => m.amount > 0).map((m) => m.month)).toEqual(['2026-11', '2027-02', '2027-05', '2027-08']);
    expect(calendar[1].amount).toBe(40);
    expect(next).toEqual([{ symbol: 'TD', date: new Date(ts * 1000), amount: 40 }]);
  });

  it('groups accounts by type, cash first, with totals, skipping empty ones', () => {
    const g = groupAccounts([
      { name: 'TFSA', type: 'investment', balance: 250 }, { name: 'MSB', type: 'cash', balance: 1000 },
      { name: 'Gift', type: 'gift', balance: 5 }, { name: 'Spend', type: 'cash', balance: 0.32 }, { name: 'Old', type: 'cash', balance: 0 },
    ]);
    expect(g.map((x) => [x.type, x.total, x.accounts.length])).toEqual([['cash', 1000.32, 2], ['investment', 250, 1], ['gift', 5, 1]]);
  });

  it('puts a P/E against the market in one line', () => {
    expect(valuationLine(40, 24.4)).toBe("P/E 40.0 is 64% above the S&P 500's 24.4");
    expect(valuationLine(14.4, 24.4)).toBe("P/E 14.4 is 41% below the S&P 500's 24.4");
    expect(valuationLine(25, 24.4)).toBe("P/E 25.0 is about level with the S&P 500's 24.4");
    expect(valuationLine(null, 24.4)).toBeNull();
  });

  it('splits holdings by listing country', () => {
    expect(holdingsByCountry([{ symbol: 'AAPL', value: 600 }, { symbol: 'TD.TO', value: 300 }, { symbol: 'BTC-USD', value: 100 }, { symbol: 'X', value: 0 }]))
      .toEqual([{ sector: 'US', value: 600, share: 0.6 }, { sector: 'Canada', value: 300, share: 0.3 }, { sector: 'Crypto', value: 100, share: 0.1 }]);
  });

  it('flags one holding over a quarter, not a lone holding', () => {
    expect(concentration([{ symbol: 'AAPL', value: 60 }, { symbol: 'MSFT', value: 40 }])).toEqual({ symbol: 'AAPL', share: 0.6 });
    expect(concentration([{ symbol: 'A', value: 25 }, { symbol: 'B', value: 25 }, { symbol: 'C', value: 25 }, { symbol: 'D', value: 25 }])).toBeNull();
    expect(concentration([{ symbol: 'BTC-USD', value: 100 }])).toBeNull();
  });
});

import { vsMarket } from './allocation.js';

describe('vsMarket', () => {
  it('compares today\'s move with the S&P 500 in points', () => {
    expect(vsMarket(-1.2, -2.0)).toEqual({ text: 'Ahead of the S&P 500 by 0.8 pts today', ahead: true });
    expect(vsMarket(0.5, 1.75).text).toBe('Behind the S&P 500 by 1.3 pts today');
    expect(vsMarket(1.01, 1.0).text).toBe('Even with the S&P 500 today');
    expect(vsMarket(1, undefined)).toBeNull();
  });
});
