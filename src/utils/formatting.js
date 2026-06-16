/**
 * Shared currency formatting utility.
 * Handles USD/CAD with compact notation for large values.
 */
export function formatCurrency(n, currency = 'USD') {
  if (typeof n !== 'number' || isNaN(n)) return '$0.00';
  const prefix = currency === 'CAD' ? 'CA$' : '$';
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${prefix}${n.toFixed(2)}`;
}

export function compactCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: value >= 1000 ? 'compact' : 'standard',
  }).format(value);
}

export const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function formatVolume(v) {
  if (!v && v !== 0) return '--';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

export function formatMarketCap(v) {
  if (!v) return '--';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

export const CAT_COLORS = {
  housing: '#0071e3',
  food: '#30D158',
  transport: '#FF9F0A',
  utilities: '#BF5AF2',
  entertainment: '#FF453A',
  health: '#64D2FF',
  shopping: '#FF375F',
  other: '#FFD60A',
  insurance: '#AC8E68',
  subscriptions: '#5E5CE6',
  vaping: '#ff453a',
};
