export const ALPACA_BASE = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';

export function alpacaHeaders(json = false) {
  const headers = {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || '',
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export function hasAlpacaKey() {
  return Boolean(process.env.ALPACA_API_KEY);
}
