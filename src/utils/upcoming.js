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

// What happened today to the symbols you follow: moves of 3% or more and new 52-week highs or lows,
// biggest move first. Mirrors Upcoming.today in Shared/Upcoming.swift.
export function todayEvents(quotes = [], symbols = [], minMove = 3) {
  const follow = new Set(symbols);
  const events = [];
  for (const q of quotes) {
    if (!follow.has(q.symbol) || !(q.price > 0)) continue;
    const move = q.changePercent || 0;
    if (Math.abs(move) >= minMove) events.push({ symbol: q.symbol, text: `${move > 0 ? 'Up' : 'Down'} ${Math.abs(move).toFixed(1)}% today`, up: move > 0, size: Math.abs(move) });
    if (q.high52 > q.low52 && q.price >= q.high52 * 0.995) events.push({ symbol: q.symbol, text: 'At a 52-week high', up: true, size: Math.abs(move) - 0.1 });
    else if (q.high52 > q.low52 && q.price <= q.low52 * 1.005) events.push({ symbol: q.symbol, text: 'At a 52-week low', up: false, size: Math.abs(move) - 0.1 });
  }
  return events.sort((a, b) => b.size - a.size).slice(0, 6);
}
