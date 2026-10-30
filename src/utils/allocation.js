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

// Your position in one symbol, summed across accounts. Mirrors Allocation.position.
// Cost and total gain stay null for broker rows with no cost basis.
export function position(holdings = [], symbol, price, changePercent = 0) {
  const rows = holdings.filter((h) => h.symbol === symbol && h.shares > 0);
  if (!rows.length || !(price > 0)) return null;
  const shares = rows.reduce((s, h) => s + h.shares, 0);
  const value = shares * price;
  const today = changePercent > -100 ? value - value / (1 + changePercent / 100) : 0;
  const costed = rows.every((h) => h.costBasis > 0);
  const cost = costed ? rows.reduce((s, h) => s + h.shares * h.costBasis, 0) : null;
  return {
    shares, value, today,
    avgCost: cost != null ? cost / shares : null,
    gain: cost != null ? value - cost : null,
    gainPercent: cost != null ? ((value - cost) / cost) * 100 : null,
  };
}
