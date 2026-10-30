import { describe, expect, it } from 'vitest';
import { sectorMoves, heatAlpha, holdingsBySector } from './sectors';

describe('sectorMoves', () => {
  it('averages each sector and skips funds, futures and unknowns', () => {
    const items = [
      { symbol: 'AAPL', changePercent: 2 }, { symbol: 'MSFT', changePercent: -1 },
      { symbol: 'JPM', changePercent: -0.5 }, { symbol: 'SPY', changePercent: 1 },
      { symbol: 'GC=F', changePercent: 3 }, { symbol: 'ZZZZ', changePercent: 9 },
      { symbol: 'XOM', changePercent: NaN },
    ];
    expect(sectorMoves(items)).toEqual([
      { sector: 'Tech', change: 0.5, count: 2 },
      { sector: 'Financials', change: -0.5, count: 1 },
    ]);
  });
  it('caps tile colour at a 3 percent day', () => {
    expect(heatAlpha(0)).toBeCloseTo(0.12);
    expect(heatAlpha(-6)).toBeCloseTo(0.82);
  });
});

describe('holdingsBySector', () => {
  it('sums holdings per sector, coins as Crypto, unknown as Other, biggest first', () => {
    const rows = holdingsBySector([
      { symbol: 'AAPL', value: 300 }, { symbol: 'MSFT', value: 100 }, { symbol: 'JPM', value: 200 },
      { symbol: 'BTC-USD', value: 250 }, { symbol: 'ZZZZ', value: 150 }, { symbol: 'NVDA', value: 0 }, { symbol: 'JPM.TO', value: 0 },
    ], { AAPL: 'Tech', MSFT: 'Tech', JPM: 'Financials' });
    expect(rows.map((r) => r.sector)).toEqual(['Tech', 'Crypto', 'Financials', 'Other']);
    expect(rows[0]).toEqual({ sector: 'Tech', value: 400, share: 0.4 });
  });
});

describe('holdingsBySector suffixes', () => {
  it('maps a Canadian listing by its bare symbol', () => {
    expect(holdingsBySector([{ symbol: 'TD.TO', value: 1 }, { symbol: 'AAPL', value: 1 }], { TD: 'Financials', AAPL: 'Tech' }).map((r) => r.sector).sort()).toEqual(['Financials', 'Tech']);
  });
});
