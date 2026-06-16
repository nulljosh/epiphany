import { applyCors } from './_cors.js';
export const BLOB_PREFIX = 'monica-cache/results.json';
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
  // Media / Telecom / Consumer
  'DIS', 'T', 'IBM', 'SHOO', 'APP',
  // Space -- SPCX = SpaceX (Nasdaq IPO 2026-06-12), RKLB = Rocket Lab
  'SPCX', 'RKLB',
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

// Yahoo gated its fundamentals endpoints (v7 quote, v10 quoteSummary) behind a
// cookie + crumb in 2024-25. Calling them without one returns 401 "Invalid
// Crumb". This fetches a session cookie from fc.yahoo.com, then exchanges it for
// a crumb, and caches the pair. Without this, marketCap/P/E are unobtainable.
// (Standard yfinance approach.)
const YAHOO_CRUMB_TTL_MS = 60 * 60 * 1000; // 1h
const YAHOO_CRUMB_KV_KEY = 'yahoo:crumb';
let _yahooSession = { cookie: null, crumb: null, ts: 0 };

function _crumbFresh(s) {
  return Boolean(s && s.crumb && (Date.now() - s.ts) < YAHOO_CRUMB_TTL_MS);
}

export async function getYahooCrumb({ force = false } = {}) {
  // L1: warm in-instance cache.
  if (!force && _crumbFresh(_yahooSession)) return _yahooSession;

  // L2: KV survives serverless cold starts, so we fetch a fresh crumb far less
  // often and stay clear of Yahoo's getcrumb 429. Non-fatal if KV is unavailable.
  if (!force) {
    try {
      const { getKv } = await import('./_kv.js');
      const kv = await getKv();
      const cached = kv && await kv.get(YAHOO_CRUMB_KV_KEY);
      if (_crumbFresh(cached)) {
        _yahooSession = cached;
        return _yahooSession;
      }
    } catch { /* fall through to a fresh fetch */ }
  }

  const ua = YAHOO_HEADERS['User-Agent'];
  try {
    // Step 1: get a session cookie (fc.yahoo.com 404s but still sets the cookie).
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': ua, Accept: '*/*' },
      redirect: 'manual',
    });
    const rawCookie = cookieRes.headers.get('set-cookie');
    const cookie = rawCookie ? rawCookie.split(';')[0] : null;
    if (!cookie) return _yahooSession;

    // Step 2: exchange the cookie for a crumb.
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': ua, Accept: '*/*', Cookie: cookie },
    });
    if (!crumbRes.ok) return _yahooSession;
    const crumb = (await crumbRes.text()).trim();
    // A valid crumb is a short opaque token, never JSON or an error sentence.
    if (!crumb || crumb.length > 40 || /[\s{}]/.test(crumb)) return _yahooSession;

    _yahooSession = { cookie, crumb, ts: Date.now() };
    // Persist for sibling instances; non-fatal if KV is down.
    try {
      const { getKv } = await import('./_kv.js');
      const kv = await getKv();
      if (kv) await kv.set(YAHOO_CRUMB_KV_KEY, _yahooSession, { ex: 3600 });
    } catch { /* ignore */ }
    return _yahooSession;
  } catch {
    return _yahooSession;
  }
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
