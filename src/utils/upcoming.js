// Earnings and dividend dates in the next `days` for the symbols you follow. Mirrors Shared/Upcoming.swift.
// Quotes carry `nextEarnings` and `dividendDate` as unix seconds (server/api/stocks.js).
export function upcomingEvents(quotes = [], symbols = [], now = Date.now(), days = 14) {
  const follow = new Set(symbols);
  const start = new Date(now).setHours(0, 0, 0, 0) / 1000;
  const end = now / 1000 + days * 86400;
  const events = [];
  for (const q of quotes) {
    if (!follow.has(q.symbol)) continue;
    for (const [kind, ts] of [['Earnings', q.nextEarnings], ['Dividend', q.dividendDate]]) {
      if (typeof ts === 'number' && ts >= start && ts <= end) events.push({ symbol: q.symbol, kind, ts });
    }
  }
  return events.sort((a, b) => a.ts - b.ts || a.symbol.localeCompare(b.symbol));
}
