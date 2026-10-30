import { describe, expect, it } from 'vitest';
import { sectorMoves, heatAlpha } from './sectors';

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
