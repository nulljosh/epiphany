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
export const DEFAULT_SYMBOLS = [
  // MAG7
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  // Large cap US stocks
  'BRK-B', 'LLY', 'V', 'UNH', 'XOM', 'JPM', 'WMT', 'JNJ', 'MA', 'PG',
  'AVGO', 'HD', 'CVX', 'MRK', 'COST', 'ABBV', 'KO', 'PEP', 'AMD', 'ADBE',
  'CRM', 'NFLX', 'CSCO', 'TMO', 'ORCL', 'ACN', 'INTC', 'NKE', 'TXN',
  'QCOM', 'PM', 'DHR', 'INTU', 'UNP', 'RTX', 'HON', 'SPGI',
  // Financials
  'BAC', 'GS', 'MS', 'C', 'WFC', 'BLK', 'SCHW', 'AXP',
  // Canadian banks (NYSE-listed big five)
  'RY', 'TD', 'BNS', 'BMO', 'CM',
  // Healthcare
  'PFE', 'MRNA', 'AMGN', 'BMY', 'MDT', 'BSX', 'ELV', 'CVS',
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
  'COIN', 'PLTR', 'HOOD', 'HIMS', 'SHOP', 'RKLB', 'SOFI', 'IBM', 'IWM', 'SHOO', 'APP', 'DUOL',
  // AI / memory & infra
  'DELL', 'PENG', 'DRAM', 'SNDK', 'IREN', 'MU', 'NBIS', 'CRDO',
  // Commodity futures
  'GC=F', 'SI=F', 'CL=F', 'HG=F', 'NG=F',
  // Phone watchlist
  'KODK', 'RL', 'IGV', 'IAU', 'XIC.TO',
  // Volatility
  '^VIX',
  // Cramer tracker ETFs + benchmark
  'SPY', 'SJIM', 'LJIM',
];
// Sector metadata for categorization
export const SECTOR_MAP = {
  // MAG7
  AAPL: 'Tech', MSFT: 'Tech', GOOGL: 'Tech', AMZN: 'Tech', NVDA: 'Tech', META: 'Tech', TSLA: 'Tech',
  // Tech
  AVGO: 'Tech', AMD: 'Tech', ADBE: 'Tech', CRM: 'Tech', NFLX: 'Tech', CSCO: 'Tech', ORCL: 'Tech',
  ACN: 'Tech', INTC: 'Tech', TXN: 'Tech', QCOM: 'Tech', INTU: 'Tech', IBM: 'Tech', PLTR: 'Tech',
  COIN: 'Tech', HOOD: 'Tech', HIMS: 'Tech', SHOP: 'Tech', RKLB: 'Tech', SOFI: 'Tech', XYZ: 'Tech', APP: 'Tech', SHOO: 'Consumer', DUOL: 'Tech',
  DELL: 'Tech', PENG: 'Tech', SNDK: 'Tech', IREN: 'Tech', MU: 'Tech', NBIS: 'Tech', CRDO: 'Tech', DRAM: 'ETFs',
  // Financials
  'BRK-B': 'Financials', V: 'Financials', JPM: 'Financials', MA: 'Financials', BAC: 'Financials',
  GS: 'Financials', MS: 'Financials', C: 'Financials', WFC: 'Financials', BLK: 'Financials',
  SCHW: 'Financials', AXP: 'Financials', SPGI: 'Financials', CME: 'Financials',
  RY: 'Financials', TD: 'Financials', BNS: 'Financials', BMO: 'Financials', CM: 'Financials',
  // Healthcare
  LLY: 'Healthcare', UNH: 'Healthcare', JNJ: 'Healthcare', MRK: 'Healthcare', ABBV: 'Healthcare',
  TMO: 'Healthcare', DHR: 'Healthcare', PFE: 'Healthcare', AMGN: 'Healthcare', BMY: 'Healthcare',
  MDT: 'Healthcare', BSX: 'Healthcare', ELV: 'Healthcare', CVS: 'Healthcare', MRNA: 'Healthcare',
  // Energy
  XOM: 'Energy', CVX: 'Energy', 'CL=F': 'Commodities',
  // Industrials
  HD: 'Industrials', COST: 'Industrials', UNP: 'Industrials', RTX: 'Industrials', HON: 'Industrials',
  UPS: 'Industrials', FDX: 'Industrials', BA: 'Industrials', CAT: 'Industrials', DE: 'Industrials',
  LMT: 'Industrials', GE: 'Industrials', WM: 'Industrials',
  // Consumer
  WMT: 'Consumer', PG: 'Consumer', KO: 'Consumer', PEP: 'Consumer', NKE: 'Consumer', PM: 'Consumer',
  DIS: 'Consumer', TGT: 'Consumer', LOW: 'Consumer', SBUX: 'Consumer', MCD: 'Consumer', YUM: 'Consumer',
  F: 'Consumer', GM: 'Consumer',
  // Telecom
  CMCSA: 'Telecom', VZ: 'Telecom', T: 'Telecom', TMUS: 'Telecom',
  // Utilities
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities',
  // REITs
  AMT: 'REITs', PLD: 'REITs',
  // Commodities
  'GC=F': 'Commodities', 'SI=F': 'Commodities', 'HG=F': 'Commodities', 'NG=F': 'Commodities',
  KODK: 'Industrials', RL: 'Consumer', IGV: 'ETFs', IAU: 'ETFs', 'XIC.TO': 'ETFs',
  // ETFs
  SPY: 'ETFs', SJIM: 'ETFs', LJIM: 'ETFs', IWM: 'ETFs',
  // Volatility
  '^VIX': 'Volatility',
};

export const SECTOR_ORDER = ['Tech', 'Financials', 'Healthcare', 'Energy', 'Industrials', 'Consumer', 'Telecom', 'Utilities', 'REITs', 'Commodities', 'Volatility', 'ETFs'];

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
        shortName: s.shortName || s.name || null,
        price,
        change: change ?? 0,
        changePercent: changePercent ?? 0,
        volume: volume ?? 0,
        high52: s.fiftyTwoWeekHigh ?? s.high52 ?? price,
        low52: s.fiftyTwoWeekLow ?? s.low52 ?? price,
        nextEarnings: s.nextEarnings ?? null,
        dividendDate: s.dividendDate ?? null,
      };
    }
  });
  return Object.keys(stockMap).length > 0 ? stockMap : null;
};

// Instant open: the last real prices this browser saw, shown at launch while the network catches up.
const STOCK_CACHE_KEY = 'epiphany_stocks_last';
function loadStockCache() {
  try { const c = JSON.parse(localStorage.getItem(STOCK_CACHE_KEY) || 'null'); return c && Object.keys(c).length ? c : null; } catch { return null; }
}

export function useStocks(symbols = DEFAULT_SYMBOLS, { enabled = true, realtime = false } = {}) {
  // No typed-in prices: the last real ones this browser saw, or nothing until the network answers.
  const [stocks, setStocks] = useState(() => loadStockCache() || {});
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

      setStocks(prev => {
        const next = { ...prev, ...stockMap };
        try { localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(stockMap)); } catch { /* private mode or full */ }
        return next;
      });
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
      setStocks(prev => prev || {});
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

  // Premium is real-time (30s); Free is the delayed feed (5 minutes).
  const pollInterval = isMarketHours() ? (realtime ? 30_000 : 300_000) : 600_000;
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
