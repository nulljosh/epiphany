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
