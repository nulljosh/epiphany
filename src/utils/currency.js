// Net worth is shown in Canadian dollars: the cash accounts are CAD, while most quotes are USD.
// Yahoo's CADUSD=X is US dollars per one Canadian dollar.
export const FX_SYMBOL = 'CADUSD=X';

// Toronto, Venture, NEO and CSE listings trade in CAD; everything else the feeds return (US stocks, -USD crypto) is USD.
export function quoteCurrency(symbol) {
  return /\.(TO|V|NE|CN)$/i.test(symbol || '') ? 'CAD' : 'USD';
}

// Converts an amount to CAD. Returns null when a USD amount arrives before the rate does,
// so callers never add an unconverted number to CAD cash.
export function toCad(amount, currency, usdPerCad) {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (currency === 'CAD') return amount;
  return usdPerCad > 0 ? amount / usdPerCad : null;
}
