import { describe, expect, it } from 'vitest';
import { upcomingEvents } from './upcoming';

describe('upcomingEvents', () => {
  it('keeps followed symbols with an event in the next 14 days, soonest first', () => {
    const now = new Date(2026, 9, 29, 12).getTime();
    const s = (d) => new Date(2026, 9, d, 9).getTime() / 1000;
    const quotes = [
      { symbol: 'AAPL', nextEarnings: s(33), dividendDate: s(31) },
      { symbol: 'MSFT', nextEarnings: s(29) },
      { symbol: 'TD', dividendDate: s(60) },
      { symbol: 'NKE', nextEarnings: s(30) },
    ];
    expect(upcomingEvents(quotes, ['AAPL', 'MSFT', 'TD'], now).map((e) => `${e.symbol} ${e.kind}`))
      .toEqual(['MSFT Earnings', 'AAPL Dividend', 'AAPL Earnings']);
    expect(upcomingEvents(quotes, [], now)).toEqual([]);
  });
});

import { todayEvents } from './upcoming.js';

describe('todayEvents', () => {
  it('lists big moves and 52-week extremes for followed symbols, biggest first', () => {
    const quotes = [
      { symbol: 'AAPL', price: 350, changePercent: 4.2, high52: 351, low52: 240 },
      { symbol: 'MSFT', price: 400, changePercent: -1, high52: 500, low52: 300 },
      { symbol: 'TD', price: 70, changePercent: -3.5, high52: 90, low52: 69.8 },
      { symbol: 'NVDA', price: 100, changePercent: 9, high52: 120, low52: 50 },
    ];
    expect(todayEvents(quotes, ['AAPL', 'MSFT', 'TD']).map((e) => `${e.symbol} ${e.text}`))
      .toEqual(['AAPL Up 4.2% today', 'AAPL At a 52-week high', 'TD Down 3.5% today', 'TD At a 52-week low']);
  });
});
