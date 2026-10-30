// Stocks, crypto and cash for the allocation donut. Mirrors Shared/Allocation.swift.
// ponytail: crypto by symbol shape ("BTC-USD") plus the big coin tickers; no funds bucket until
// holdings carry an asset type. Values mix listing currencies like the holdings pie does.
const COINS = new Set(['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'LTC', 'AVAX', 'DOT', 'LINK']);
export const isCrypto = (symbol = '') => /-(USD|CAD|USDT)$/i.test(symbol) || COINS.has(symbol.toUpperCase());

export function allocation(holdings = [], cash = 0) {
  let stocks = 0, crypto = 0;
  for (const h of holdings) {
    if (!(h.value > 0)) continue;
    if (isCrypto(h.symbol)) crypto += h.value; else stocks += h.value;
  }
  return [['Stocks', stocks], ['Crypto', crypto], ['Cash', cash]]
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value }));
}

// Holdings filter chips. ponytail: listing currency by symbol suffix (.TO, .V, .NE, -CAD is CAD,
// everything else USD); no ETF chip until holdings carry an asset type.
export const isCad = (symbol = '') => /\.(TO|V|NE|CN)$|-CAD$/i.test(symbol);
const FILTERS = { Stocks: (s) => !isCrypto(s), Crypto: isCrypto, CAD: isCad, USD: (s) => !isCad(s) };

export const holdingFilters = (holdings = []) =>
  ['All', ...Object.keys(FILTERS).filter((f) => {
    const n = holdings.filter((h) => FILTERS[f](h.symbol)).length;
    return n > 0 && n < holdings.length;
  })];

export const filterHoldings = (holdings = [], filter = 'All') =>
  FILTERS[filter] ? holdings.filter((h) => FILTERS[filter](h.symbol)) : holdings;

// Estimated yearly dividends: each holding's value times its trailing yield. Mirrors Allocation.yearlyDividends.
// ponytail: trailing yield, no payment months, so no per-month bars until quotes carry a dividend schedule.
export const yearlyDividends = (holdings = [], quotes = {}) =>
  holdings.reduce((sum, h) => sum + (h.value > 0 && quotes[h.symbol]?.yield > 0 ? h.value * quotes[h.symbol].yield / 100 : 0), 0);

// Unrealized gain across holdings that have a cost basis (broker rows without one are skipped). Mirrors Allocation.unrealizedGain.
export function unrealizedGain(holdings = []) {
  const known = holdings.filter((h) => h.gain != null && h.shares * h.costBasis > 0);
  if (!known.length) return null;
  const gain = known.reduce((sum, h) => sum + h.gain, 0);
  const cost = known.reduce((sum, h) => sum + h.shares * h.costBasis, 0);
  return { gain, percent: (gain / cost) * 100 };
}

// Today's move in dollars for a value that moved `changePercent` today. Mirrors Allocation.todayGain.
export const todayGain = (value, changePercent = 0) => (changePercent > -100 ? value - value / (1 + changePercent / 100) : 0);

// Your position in one symbol, summed across accounts. Mirrors Allocation.position.
// Cost and total gain stay null for broker rows with no cost basis.
export function position(holdings = [], symbol, price, changePercent = 0) {
  const rows = holdings.filter((h) => h.symbol === symbol && h.shares > 0);
  if (!rows.length || !(price > 0)) return null;
  const shares = rows.reduce((s, h) => s + h.shares, 0);
  const value = shares * price;
  const today = todayGain(value, changePercent);
  const costed = rows.every((h) => h.costBasis > 0);
  const cost = costed ? rows.reduce((s, h) => s + h.shares * h.costBasis, 0) : null;
  return {
    shares, value, today,
    avgCost: cost != null ? cost / shares : null,
    gain: cost != null ? value - cost : null,
    gainPercent: cost != null ? ((value - cost) / cost) * 100 : null,
  };
}

// Dividend calendar: estimated payments per month for the next `months`, from each holding's next pay date
// and trailing yield. Mirrors Allocation.dividendCalendar.
// ponytail: assumes quarterly payers (most US and Canadian stocks); monthly and yearly payers read a bit off.
export function dividendCalendar(holdings = [], quotes = {}, now = new Date(), months = 12) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const byMonth = {};
  const next = [];
  for (const h of holdings) {
    const q = quotes[h.symbol];
    if (!(h.value > 0) || !(q?.yield > 0) || typeof q.dividendDate !== 'number') continue;
    const each = (h.value * q.yield) / 100 / 4;
    const first = new Date(q.dividendDate * 1000);
    for (let i = 0; i < 4; i++) {
      const d = new Date(first.getFullYear(), first.getMonth() + i * 3, first.getDate());
      if (d >= start && d < end) byMonth[key(d)] = (byMonth[key(d)] || 0) + each;
    }
    if (first >= start) next.push({ symbol: h.symbol, date: first, amount: each });
  }
  const calendar = Array.from({ length: months }, (_, i) => {
    const m = key(new Date(start.getFullYear(), start.getMonth() + i, 1));
    return { month: m, amount: byMonth[m] || 0 };
  });
  return { calendar, next: next.sort((a, b) => a.date - b.date) };
}

// Accounts with money in them, grouped by type with a total each: cash first, then chequing, investment, the rest.
// Mirrors Allocation.groupAccounts. Totals add balances as net worth does (already in CAD).
const ACCOUNT_ORDER = ['cash', 'chequing', 'investment'];
export function groupAccounts(accounts = []) {
  const groups = {};
  for (const a of accounts) {
    if (!(a.balance > 0)) continue;
    const type = a.type || 'other';
    (groups[type] ||= []).push(a);
  }
  const rank = (t) => (ACCOUNT_ORDER.includes(t) ? ACCOUNT_ORDER.indexOf(t) : ACCOUNT_ORDER.length);
  return Object.keys(groups)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((type) => ({ type, total: groups[type].reduce((s, a) => s + a.balance, 0), accounts: groups[type] }));
}

// A stock's P/E against the S&P 500's (SPY's), as one plain line. Mirrors Valuation.line in Shared/Position.swift.
export function valuationLine(pe, marketPE) {
  if (!(pe > 0) || !(marketPE > 0)) return null;
  const diff = Math.round((pe / marketPE - 1) * 100);
  const where = Math.abs(diff) < 5 ? 'about level with' : `${Math.abs(diff)}% ${diff > 0 ? 'above' : 'below'}`;
  return `P/E ${pe.toFixed(1)} is ${where} the S&P 500's ${marketPE.toFixed(1)}`;
}
