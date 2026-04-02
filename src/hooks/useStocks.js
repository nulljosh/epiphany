import { useState, useEffect, useCallback, useRef } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

function isMarketHours() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return et.getHours() >= 9 && et.getHours() < 16;
}

// All tradeable stock/ETF symbols across 100-asset universe
// Excludes: indices (handled by commodities.js), meme coins (CoinGecko / not on Yahoo)
// Note: Block Inc rebranded SQ → XYZ (Jan 2025). Berkshire uses BRK-B on Yahoo.
const DEFAULT_SYMBOLS = [
  // MAG7
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  // Large cap US stocks
  'BRK-B', 'LLY', 'V', 'UNH', 'XOM', 'JPM', 'WMT', 'JNJ', 'MA', 'PG',
  'AVGO', 'HD', 'CVX', 'MRK', 'COST', 'ABBV', 'KO', 'PEP', 'AMD', 'ADBE',
  'CRM', 'NFLX', 'CSCO', 'TMO', 'ORCL', 'ACN', 'INTC', 'NKE', 'TXN',
  'QCOM', 'PM', 'DHR', 'INTU', 'UNP', 'RTX', 'HON', 'SPGI',
  // Financials
  'BAC', 'GS', 'MS', 'C', 'WFC', 'BLK', 'SCHW', 'AXP',
  // Healthcare
  'PFE', 'AMGN', 'BMY', 'MDT', 'BSX', 'ELV', 'CVS',
  // Industrials
  'UPS', 'FDX', 'BA', 'CAT', 'DE', 'LMT', 'GE',
  // Media & Telecom
  'DIS', 'CMCSA', 'VZ', 'T', 'TMUS',
  // Utilities
  'NEE', 'DUK', 'SO',
  // Consumer
  'TGT', 'LOW', 'SBUX', 'MCD', 'YUM', 'F', 'GM',
  // REITs & Other
  'AMT', 'PLD', 'CME', 'WM', 'XYZ',
  // Popular / high-vol
  'COIN', 'PLTR', 'HOOD', 'HIMS', 'SHOP', 'RKLB', 'SOFI', 'IBM', 'IWM',
  // Commodity futures
  'GC=F', 'SI=F', 'CL=F',
  // Cramer tracker ETFs + benchmark
  'SPY', 'SJIM', 'LJIM',
];
const STALE_AFTER_MS = 10 * 60 * 1000;
const MAX_SYMBOLS_PER_REQUEST = 50;

function chunkSymbols(symbolList, size = MAX_SYMBOLS_PER_REQUEST) {
  const chunks = [];
  for (let i = 0; i < symbolList.length; i += size) {
    chunks.push(symbolList.slice(i, i + size));
  }
  return chunks;
}

// Retry helper with exponential backoff
const fetchWithRetry = async (url, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1}/${maxRetries} failed:`, err.message);

      if (err.message.includes('400') || err.message.includes('Invalid')) {
        throw err;
      }

      if (i < maxRetries - 1) {
        const delay = process.env.NODE_ENV === 'test' ? 0 : baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

// Fallback static data -- used only when all live APIs fail (Feb 21, 2026)
const FALLBACK_DATA = {
  // MAG7
  AAPL:   { symbol: 'AAPL',   price: 264.58, changePercent: -0.32 },
  MSFT:   { symbol: 'MSFT',   price: 397.23, changePercent:  0.18 },
  GOOGL:  { symbol: 'GOOGL',  price: 314.98, changePercent: -0.41 },
  AMZN:   { symbol: 'AMZN',   price: 210.11, changePercent:  0.24 },
  NVDA:   { symbol: 'NVDA',   price: 189.82, changePercent: -0.67 },
  META:   { symbol: 'META',   price: 655.66, changePercent:  0.35 },
  TSLA:   { symbol: 'TSLA',   price: 411.82, changePercent: -1.22 },
  // Large cap
  'BRK-B':{ symbol: 'BRK-B', price: 498.20, changePercent:  0.08 },
  LLY:    { symbol: 'LLY',    price: 1009.52,changePercent: -0.55 },
  V:      { symbol: 'V',      price: 320.95, changePercent:  0.12 },
  UNH:    { symbol: 'UNH',    price: 290.00, changePercent: -0.38 },
  XOM:    { symbol: 'XOM',    price: 147.28, changePercent:  0.44 },
  JPM:    { symbol: 'JPM',    price: 310.79, changePercent:  0.19 },
  WMT:    { symbol: 'WMT',    price: 122.99, changePercent: -0.61 },
  JNJ:    { symbol: 'JNJ',    price: 242.49, changePercent:  0.11 },
  MA:     { symbol: 'MA',     price: 526.41, changePercent:  0.05 },
  PG:     { symbol: 'PG',     price: 160.78, changePercent:  0.28 },
  AVGO:   { symbol: 'AVGO',   price: 332.65, changePercent: -0.72 },
  HD:     { symbol: 'HD',     price: 382.25, changePercent:  0.14 },
  CVX:    { symbol: 'CVX',    price: 183.93, changePercent:  0.52 },
  MRK:    { symbol: 'MRK',    price: 122.26, changePercent: -0.33 },
  COST:   { symbol: 'COST',   price: 985.27, changePercent: -0.25 },
  ABBV:   { symbol: 'ABBV',   price: 224.81, changePercent:  0.47 },
  KO:     { symbol: 'KO',     price: 79.84,  changePercent:  0.13 },
  PEP:    { symbol: 'PEP',    price: 164.94, changePercent: -0.18 },
  AMD:    { symbol: 'AMD',    price: 200.15, changePercent: -1.44 },
  ADBE:   { symbol: 'ADBE',   price: 258.61, changePercent: -0.36 },
  CRM:    { symbol: 'CRM',    price: 185.16, changePercent:  0.31 },
  NFLX:   { symbol: 'NFLX',   price: 78.67,  changePercent:  0.48 },
  CSCO:   { symbol: 'CSCO',   price: 79.20,  changePercent:  0.07 },
  TMO:    { symbol: 'TMO',    price: 520.40, changePercent: -0.28 },
  ORCL:   { symbol: 'ORCL',   price: 148.08, changePercent:  0.37 },
  ACN:    { symbol: 'ACN',    price: 215.35, changePercent: -0.15 },
  INTC:   { symbol: 'INTC',   price: 44.11,  changePercent: -0.74 },
  NKE:    { symbol: 'NKE',    price: 74.30,  changePercent: -0.22 },
  TXN:    { symbol: 'TXN',    price: 220.80, changePercent:  0.19 },
  QCOM:   { symbol: 'QCOM',   price: 155.40, changePercent: -0.43 },
  PM:     { symbol: 'PM',     price: 142.50, changePercent:  0.30 },
  DHR:    { symbol: 'DHR',    price: 200.10, changePercent: -0.17 },
  INTU:   { symbol: 'INTU',   price: 640.20, changePercent:  0.10 },
  UNP:    { symbol: 'UNP',    price: 245.60, changePercent:  0.06 },
  RTX:    { symbol: 'RTX',    price: 150.30, changePercent:  0.25 },
  HON:    { symbol: 'HON',    price: 220.40, changePercent: -0.11 },
  SPGI:   { symbol: 'SPGI',   price: 480.50, changePercent:  0.22 },
  // Financials
  BAC:    { symbol: 'BAC',    price: 53.06,  changePercent:  0.38 },
  GS:     { symbol: 'GS',     price: 922.24, changePercent:  0.27 },
  MS:     { symbol: 'MS',     price: 175.41, changePercent:  0.16 },
  C:      { symbol: 'C',      price: 116.00, changePercent:  0.34 },
  WFC:    { symbol: 'WFC',    price: 88.70,  changePercent:  0.22 },
  BLK:    { symbol: 'BLK',    price: 1093.64,changePercent:  0.12 },
  SCHW:   { symbol: 'SCHW',   price: 85.40,  changePercent:  0.42 },
  AXP:    { symbol: 'AXP',    price: 320.80, changePercent:  0.06 },
  // Healthcare
  PFE:    { symbol: 'PFE',    price: 28.40,  changePercent: -0.31 },
  AMGN:   { symbol: 'AMGN',   price: 305.60, changePercent: -0.50 },
  BMY:    { symbol: 'BMY',    price: 60.20,  changePercent:  0.13 },
  MDT:    { symbol: 'MDT',    price: 90.80,  changePercent:  0.19 },
  BSX:    { symbol: 'BSX',    price: 100.30, changePercent:  0.44 },
  ELV:    { symbol: 'ELV',    price: 360.40, changePercent: -0.75 },
  CVS:    { symbol: 'CVS',    price: 58.90,  changePercent: -0.44 },
  // Industrials
  UPS:    { symbol: 'UPS',    price: 118.60, changePercent: -0.36 },
  FDX:    { symbol: 'FDX',    price: 275.40, changePercent:  0.15 },
  BA:     { symbol: 'BA',     price: 232.03, changePercent:  0.68 },
  CAT:    { symbol: 'CAT',    price: 759.74, changePercent:  0.35 },
  DE:     { symbol: 'DE',     price: 662.49, changePercent: -0.25 },
  LMT:    { symbol: 'LMT',    price: 658.26, changePercent:  0.09 },
  GE:     { symbol: 'GE',     price: 343.22, changePercent:  0.30 },
  // Media & Telecom
  DIS:    { symbol: 'DIS',    price: 105.58, changePercent: -0.46 },
  CMCSA:  { symbol: 'CMCSA',  price: 38.80,  changePercent: -0.22 },
  VZ:     { symbol: 'VZ',     price: 40.60,  changePercent:  0.21 },
  T:      { symbol: 'T',      price: 24.80,  changePercent:  0.14 },
  TMUS:   { symbol: 'TMUS',   price: 270.40, changePercent:  0.36 },
  // Utilities
  NEE:    { symbol: 'NEE',    price: 70.20,  changePercent:  0.50 },
  DUK:    { symbol: 'DUK',    price: 118.40, changePercent:  0.18 },
  SO:     { symbol: 'SO',     price: 82.60,  changePercent:  0.11 },
  // Consumer
  TGT:    { symbol: 'TGT',    price: 132.80, changePercent: -0.25 },
  LOW:    { symbol: 'LOW',    price: 250.60, changePercent:  0.06 },
  SBUX:   { symbol: 'SBUX',   price: 102.40, changePercent:  0.42 },
  MCD:    { symbol: 'MCD',    price: 310.20, changePercent:  0.14 },
  YUM:    { symbol: 'YUM',    price: 148.30, changePercent: -0.22 },
  F:      { symbol: 'F',      price: 10.20,  changePercent: -0.35 },
  GM:     { symbol: 'GM',     price: 56.40,  changePercent:  0.31 },
  // REITs & Other
  AMT:    { symbol: 'AMT',    price: 210.60, changePercent: -0.27 },
  PLD:    { symbol: 'PLD',    price: 115.40, changePercent:  0.11 },
  CME:    { symbol: 'CME',    price: 242.80, changePercent:  0.07 },
  WM:     { symbol: 'WM',     price: 235.60, changePercent:  0.17 },
  XYZ:    { symbol: 'XYZ',    price: 72.40,  changePercent:  0.36 },
  // Popular
  COIN:   { symbol: 'COIN',   price: 171.35, changePercent:  0.98 },
  PLTR:   { symbol: 'PLTR',   price: 135.24, changePercent: -1.82 },
  HOOD:   { symbol: 'HOOD',   price: 76.11,  changePercent:  0.63 },
  HIMS:   { symbol: 'HIMS',   price: 15.63,  changePercent:  1.18 },
  SHOP:   { symbol: 'SHOP',   price: 126.20, changePercent:  0.76 },
  RKLB:   { symbol: 'RKLB',   price: 70.86,  changePercent:  2.54 },
  SOFI:   { symbol: 'SOFI',   price: 19.02,  changePercent: -0.55 },
  IBM:    { symbol: 'IBM',    price: 257.16, changePercent:  0.07 },
  IWM:    { symbol: 'IWM',    price: 232.40, changePercent: -0.33 },
  // Commodity futures
  'GC=F': { symbol: 'GC=F',  price: 2960.40, changePercent: 0.32 },
  'SI=F': { symbol: 'SI=F',  price: 33.60,   changePercent: 0.52 },
  'CL=F': { symbol: 'CL=F',  price: 74.20,   changePercent: 0.22 },
  // Cramer tracker ETFs + benchmark
  SPY:    { symbol: 'SPY',   price: 689.43,  changePercent: 0.11 },
  SJIM:   { symbol: 'SJIM',  price: 22.80,   changePercent: 0.25 },
  LJIM:   { symbol: 'LJIM',  price: 21.40,   changePercent: -0.38 },
};

// Parse stock data from either serverless array or Yahoo quoteResponse format
const parseStockData = (raw) => {
  const data = Array.isArray(raw) ? raw : (raw?.quoteResponse?.result ?? []);
  if (!Array.isArray(data) || data.length === 0) return null;

  const stockMap = {};
  data.forEach(s => {
    const symbol = s.symbol;
    const price = s.price ?? s.regularMarketPrice;
    const change = s.change ?? s.regularMarketChange;
    const changePercent = s.changePercent ?? s.regularMarketChangePercent;
    const volume = s.volume ?? s.regularMarketVolume;

    if (symbol && typeof price === 'number') {
      stockMap[symbol] = {
        symbol,
        price,
        change: change ?? 0,
        changePercent: changePercent ?? 0,
        volume: volume ?? 0,
        high52: s.fiftyTwoWeekHigh ?? s.high52 ?? price,
        low52: s.fiftyTwoWeekLow ?? s.low52 ?? price,
      };
    }
  });
  return Object.keys(stockMap).length > 0 ? stockMap : null;
};

export function useStocks(symbols = DEFAULT_SYMBOLS, { enabled = true } = {}) {
  const [stocks, setStocks] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reliability, setReliability] = useState({
    status: 'loading',
    source: 'loading',
    lastSuccessAt: null,
    lastAttemptAt: null,
  });
  const retryCountRef = useRef(0);
  const seededFromCache = useRef(false);
  const cacheAttempted = useRef(false);
  const lastLiveSuccessRef = useRef(null);

  const fetchStocks = useCallback(async () => {
    try {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new Error('Invalid symbols: must be a non-empty array');
      }

      const chunks = chunkSymbols(symbols);
      const chunkResponses = await Promise.all(
        chunks.map((chunk) => fetchWithRetry(`/api/stocks-free?symbols=${chunk.join(',')}`))
      );
      const stockMap = chunkResponses.reduce((merged, raw) => {
        const parsed = parseStockData(raw);
        if (parsed) Object.assign(merged, parsed);
        return merged;
      }, {});

      if (!stockMap) throw new Error('No valid stock data received from any API');
      if (Object.keys(stockMap).length === 0) {
        throw new Error('No valid stock data received from any API');
      }

      setStocks(prev => ({ ...prev, ...stockMap }));
      setError(null);
      const now = Date.now();
      lastLiveSuccessRef.current = now;
      setReliability({
        status: 'live',
        source: 'live',
        lastSuccessAt: now,
        lastAttemptAt: now,
      });
      retryCountRef.current = 0;
    } catch (err) {
      setError(err.message);
      console.error('Stock fetch error (all APIs failed):', err);
      retryCountRef.current += 1;
      const now = Date.now();
      const hadLiveSuccess = !!lastLiveSuccessRef.current;
      const age = hadLiveSuccess ? (now - lastLiveSuccessRef.current) : 0;
      setReliability(prev => {
        // Don't downgrade to fallback if cache seed loaded fresh data
        if (hadLiveSuccess) {
          return {
            status: age > STALE_AFTER_MS ? 'stale' : prev.status,
            source: prev.source === 'live' ? 'cache' : prev.source,
            lastSuccessAt: prev.lastSuccessAt,
            lastAttemptAt: now,
          };
        }
        // Don't downgrade to fallback until cache seed attempt has completed
        // Prevents FALLBACK flash during cold start / transient API issues
        if (!cacheAttempted.current || retryCountRef.current < 3) {
          return { ...prev, lastAttemptAt: now };
        }
        return {
          status: 'fallback',
          source: prev.source === 'live' ? 'cache' : prev.source,
          lastSuccessAt: prev.lastSuccessAt,
          lastAttemptAt: now,
        };
      });
      setStocks(prev => (Object.keys(prev || {}).length > 0 ? prev : FALLBACK_DATA));
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  // Seed from Blob cache first (instant load), then fetch live data
  useEffect(() => {
    const seedFromCache = async () => {
      if (process.env.NODE_ENV === 'test') return;
      try {
        const res = await fetch('/api/latest');
        if (!res.ok) return;
        const { cached, data } = await res.json();
        if (cached && data?.stocks?.length > 0 && !seededFromCache.current) {
          seededFromCache.current = true;
          const stockMap = parseStockData(data.stocks);
          if (stockMap) {
            const cachedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now();
            const cacheAge = Date.now() - cachedAt;
            lastLiveSuccessRef.current = cachedAt;
            setStocks(prev => ({ ...prev, ...stockMap }));
            setReliability({
              status: cacheAge > STALE_AFTER_MS ? 'stale' : 'live',
              source: 'cache',
              lastSuccessAt: cachedAt,
              lastAttemptAt: Date.now(),
            });
            setLoading(false);
          }
        }
      } catch {
        // Cache miss is fine — live fetch follows immediately
      } finally {
        cacheAttempted.current = true;
      }
    };

    if (!enabled) return;
    const init = async () => {
      await seedFromCache();
      await fetchStocks();
    };
    init();
  }, [fetchStocks, enabled]);

  const pollInterval = isMarketHours() ? 120_000 : 600_000;
  useVisibilityPolling(fetchStocks, pollInterval, [fetchStocks, enabled]);

  return {
    stocks,
    loading,
    error,
    reliability,
    refetch: fetchStocks,
    retryCount: retryCountRef.current
  };
}

export function useStockHistory(symbol, range = '1y') {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWithRetry(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`);

        if (!data || !Array.isArray(data.history)) {
          throw new Error('Invalid history data format');
        }

        setHistory(data.history);
      } catch (err) {
        console.error('History fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [symbol, range]);

  return { history, loading, error };
}
