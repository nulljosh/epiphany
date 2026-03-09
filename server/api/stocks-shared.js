import { applyCors } from './_cors.js';
export const DEFAULT_SYMBOLS = [
  // Mag 7
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA',
  // ETFs
  'SPY', 'QQQ', 'DIA', 'IWM',
  // Tech / Growth
  'PLTR', 'HOOD', 'COIN', 'SQ', 'SHOP', 'SNOW', 'NET', 'CRWD',
  // Commodities / Energy
  'XOM', 'CVX', 'OXY', 'COP',
  // Precious Metals / Mining
  'GLD', 'SLV', 'NEM', 'FCX', 'COPX',
  // Finance
  'JPM', 'GS', 'V', 'MA',
  // Healthcare / Defense
  'UNH', 'LMT', 'RTX',
].join(',');

export const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

export const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

export function getFmpApiKey() {
  return process.env.FMP_API_KEY || '';
}

export function parseSymbols(raw, { max = 50, validate = false, tooManyMessage } = {}) {
  const symbolList = (raw || DEFAULT_SYMBOLS)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (validate && symbolList.some(s => !/^[A-Za-z0-9.\-=^]+$/.test(s))) {
    return { error: 'Invalid symbols format' };
  }

  if (symbolList.length > max) {
    return { error: tooManyMessage || `Too many symbols${max === 100 ? ' (max 100)' : ''}` };
  }

  return { symbolList };
}

export function setStockResponseHeaders(req, res) {
  applyCors(req, res);
  if (isMarketHours()) {
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return;
  }
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
}

export function isMarketHours(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value);

  if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) return false;
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const totalMinutes = (hour * 60) + minute;
  const openMinutes = (9 * 60) + 30;
  const closeMinutes = 16 * 60;
  return totalMinutes >= openMinutes && totalMinutes < closeMinutes;
}
