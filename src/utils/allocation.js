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
