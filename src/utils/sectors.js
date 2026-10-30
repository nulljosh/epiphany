import { SECTOR_MAP, SECTOR_ORDER } from '../hooks/useStocks';
import { isCrypto } from './allocation';

// Funds, futures and the VIX aren't sectors, so the heat map leaves them out.
const NOT_SECTORS = new Set(['ETFs', 'Commodities', 'Volatility']);

// Today's move per sector: the plain average of its stocks' percent change.
// ponytail: equal weight, not cap weight; weight by marketCap if a megacap day reads wrong.
export function sectorMoves(items, map = SECTOR_MAP) {
  const sums = {};
  for (const item of items) {
    const sector = map[item.symbol];
    if (!sector || NOT_SECTORS.has(sector) || !Number.isFinite(item.changePercent)) continue;
    const s = (sums[sector] ||= { total: 0, count: 0 });
    s.total += item.changePercent;
    s.count += 1;
  }
  return SECTOR_ORDER.filter((name) => sums[name])
    .map((name) => ({ sector: name, change: sums[name].total / sums[name].count, count: sums[name].count }));
}

// Tile strength: a 3 percent day is full colour.
export const heatAlpha = (change) => Math.min(Math.abs(change) / 3, 1) * 0.7 + 0.12;

// Holdings value per sector, biggest first; coins are Crypto, unmapped stocks Other. Mirrors SectorHeat.holdings.
export function holdingsBySector(holdings = [], map = SECTOR_MAP) {
  const sums = {};
  for (const h of holdings) {
    if (!(h.value > 0)) continue;
    // TD.TO is TD in the map: try the symbol without its Canadian exchange suffix.
    const mapped = map[h.symbol] ?? map[h.symbol.replace(/\.(TO|V|NE|CN)$/i, '')];
    const sector = isCrypto(h.symbol) ? 'Crypto' : (mapped && !NOT_SECTORS.has(mapped) ? mapped : 'Other');
    sums[sector] = (sums[sector] || 0) + h.value;
  }
  const total = Object.values(sums).reduce((a, b) => a + b, 0);
  return Object.entries(sums).map(([sector, value]) => ({ sector, value, share: value / total })).sort((a, b) => b.value - a.value);
}
