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
