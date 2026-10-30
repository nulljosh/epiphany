import { SECTOR_MAP, SECTOR_ORDER } from '../hooks/useStocks';

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
