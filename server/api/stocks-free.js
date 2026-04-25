// Stock API: FMP batch quotes (primary) + Yahoo Finance chart (fallback)
// FMP handles up to 100 symbols in one batch call
import { getKv } from './_kv.js';
import {
  parseSymbols,
  setStockResponseHeaders,
  YAHOO_HEADERS,
  FMP_BASE,
  getFmpApiKey,
} from './stocks-shared.js';

// Inlined to avoid Vercel bundler cache issues with new exports in stocks-shared.js
function isMarketHours(now = new Date()) {
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
  return totalMinutes >= 570 && totalMinutes < 960;
}

const YAHOO_URLS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];
const REQUEST_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const RETRY_BASE_MS = 200;
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';
const L1_CACHE_TTL_MS = 15000;
const KV_MARKET_TTL_SEC = 300;
const KV_OFF_HOURS_TTL_SEC = 300;
const KV_STALE_IF_ERROR_TTL_SEC = 1800;
const cache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function chunkedFetch(items, fetchFn, batchSize = 10, delayMs = 100) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fetchFn));
    results.push(...batchResults);
    if (i + batchSize < items.length) await sleep(delayMs);
  }
  return results;
}

function getCached(cacheKey, maxAgeMs) {
  if (!ENABLE_CACHE) return null;
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > maxAgeMs) return null;
  return cached.data;
}

function getSymbolHash(symbolList) {
  const joined = symbolList.join(',');
  return joined.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 16) || 'default';
}

function getKvKeys(symbolList) {
  const hash = getSymbolHash(symbolList);
  return {
    fresh: `stocks:free:v2:${hash}`,
    stale: `stocks:free:v2:stale:${hash}`,
  };
}

async function getKvCached(key) {
  if (!ENABLE_CACHE) return null;
  const kvClient = await getKv();
  if (!kvClient) return null;
  try {
    return await kvClient.get(key);
  } catch (err) {
    console.warn(`KV get failed for ${key}: ${err.message}`);
    return null;
  }
}

async function setKvCached(key, data, ttlSec) {
  if (!ENABLE_CACHE) return;
  const kvClient = await getKv();
  if (!kvClient) return;
  try {
    await kvClient.set(key, data, { ex: ttlSec });
  } catch (err) {
    console.warn(`KV set failed for ${key}: ${err.message}`);
  }
}

// FMP batch quote: single call for all symbols
async function fetchFmpBatch(symbolList) {
  const apiKey = getFmpApiKey();
  if (!apiKey) return null;

  // FMP uses dots for BRK.B style, Yahoo uses BRK-B. Convert.
  const fmpSymbols = symbolList.map(s => s.replace('-', '.'));
  const url = `${FMP_BASE}/quote/${fmpSymbols.join(',')}?apikey=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`FMP batch error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // Map FMP symbols back to Yahoo-style (BRK.B -> BRK-B)
    const yahooSymbolMap = {};
    symbolList.forEach(s => {
      yahooSymbolMap[s.replace('-', '.')] = s;
    });

    return data
      .filter(q => q.symbol && typeof q.price === 'number')
      .map(q => ({
        symbol: yahooSymbolMap[q.symbol] || q.symbol,
        name: q.name || null,
        shortName: q.name || null,
        price: q.price,
        change: q.change ?? 0,
        changePercent: q.changesPercentage ?? 0,
        volume: q.volume ?? 0,
        high: q.dayHigh ?? q.price,
        low: q.dayLow ?? q.price,
        open: q.open ?? q.previousClose ?? q.price,
        prevClose: q.previousClose ?? q.price,
        fiftyTwoWeekHigh: q.yearHigh ?? null,
        fiftyTwoWeekLow: q.yearLow ?? null,
        marketCap: q.marketCap ?? null,
        peRatio: q.pe ?? null,
        eps: q.eps ?? null,
        avgVolume: q.avgVolume ?? null,
        beta: q.beta ?? null,
        yield: (q.lastDiv && q.price) ? ((q.lastDiv / q.price) * 100) : null,
        source: 'fmp',
      }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`FMP batch fetch error: ${err.message}`);
    return null;
  }
}

// Yahoo fallback: v7 batch quote (fundamentals) + v8 chart (price history)
async function fetchYahooBatch(symbolList) {
  for (const base of YAHOO_URLS) {
    const url = `${base}/v7/finance/quote?symbols=${symbolList.map(encodeURIComponent).join(',')}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow,regularMarketOpen,regularMarketPreviousClose,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap,trailingPE,epsTrailingTwelveMonths,averageDailyVolume3Month,beta,trailingAnnualDividendYield`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(url, { signal: controller.signal, headers: YAHOO_HEADERS });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const data = await response.json();
      const quotes = data.quoteResponse?.result;
      if (!Array.isArray(quotes) || quotes.length === 0) continue;
      return quotes
        .filter(q => typeof q.regularMarketPrice === 'number')
        .map(q => ({
          symbol: q.symbol,
          shortName: q.shortName || q.longName || null,
          price: q.regularMarketPrice,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
          volume: q.regularMarketVolume ?? 0,
          high: q.regularMarketDayHigh ?? q.regularMarketPrice,
          low: q.regularMarketDayLow ?? q.regularMarketPrice,
          open: q.regularMarketOpen ?? q.regularMarketPreviousClose ?? q.regularMarketPrice,
          prevClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
          marketCap: q.marketCap ?? null,
          peRatio: q.trailingPE ?? null,
          eps: q.epsTrailingTwelveMonths ?? null,
          avgVolume: q.averageDailyVolume3Month ?? null,
          beta: q.beta ?? null,
          yield: q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100 : null,
          source: 'yahoo',
        }));
    } catch (err) {
      // try next base URL
    }
  }
  return null;
}

// Yahoo fallback: per-symbol chart endpoint (last resort)
async function fetchYahooSymbol(symbol) {
  for (const base of YAHOO_URLS) {
    const url = `${base}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(url, { signal: controller.signal, headers: YAHOO_HEADERS });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (!result) continue;

        const meta = result.meta;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose;

        if (typeof price !== 'number' || typeof prevClose !== 'number' || prevClose === 0) continue;

        const change = price - prevClose;
        const changePercent = (change / prevClose) * 100;

        return {
          symbol,
          price,
          change,
          changePercent,
          volume: meta.regularMarketVolume ?? 0,
          high: meta.regularMarketDayHigh ?? price,
          low: meta.regularMarketDayLow ?? price,
          open: meta.regularMarketOpen ?? prevClose,
          prevClose,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
          marketCap: meta.marketCap ?? null,
          peRatio: null,
          eps: null,
          avgVolume: null,
          beta: null,
          yield: null,
          source: 'yahoo-chart',
        };
      } catch (err) {
        // retry
      }

      if (attempt < MAX_ATTEMPTS_PER_PROVIDER - 1) {
        const delay = process.env.NODE_ENV === 'test' ? 0 : RETRY_BASE_MS * (2 ** attempt);
        await sleep(delay);
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  const parsed = parseSymbols(req.query.symbols, { max: 100, validate: false });
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const { symbolList } = parsed;
  const cacheKey = symbolList.join(',');
  const kvKeys = getKvKeys(symbolList);
  const inMarketHours = isMarketHours();
  const kvFreshTtlSec = inMarketHours ? KV_MARKET_TTL_SEC : KV_OFF_HOURS_TTL_SEC;

  const freshCached = getCached(cacheKey, L1_CACHE_TTL_MS);
  if (freshCached) {
    setStockResponseHeaders(req, res);
    res.setHeader('X-Monica-Data-Status', 'cache');
    res.setHeader('X-Monica-Cache-Level', 'L1');
    return res.status(200).json(freshCached);
  }

  const kvCached = await getKvCached(kvKeys.fresh);
  if (kvCached) {
    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: kvCached });
    }
    setStockResponseHeaders(req, res);
    res.setHeader('X-Monica-Data-Status', 'cache');
    res.setHeader('X-Monica-Cache-Level', 'L2');
    return res.status(200).json(kvCached);
  }

  try {
    // Try FMP batch first (single API call for all symbols)
    let stocks = await fetchFmpBatch(symbolList);
    let source = 'fmp';

    // Supplement FMP fundamentals from Yahoo v7 when FMP omits them (free tier)
    if (stocks && stocks.length > 0) {
      const needsFundamentals = stocks.filter(s => s.peRatio === null && s.marketCap === null).map(s => s.symbol);
      if (needsFundamentals.length > 0) {
        const supplement = await fetchYahooBatch(needsFundamentals);
        if (supplement) {
          const suppMap = new Map(supplement.map(s => [s.symbol, s]));
          stocks = stocks.map(s => {
            const y = suppMap.get(s.symbol);
            if (!y) return s;
            return {
              ...s,
              shortName: s.shortName ?? y.shortName,
              peRatio: s.peRatio ?? y.peRatio,
              marketCap: s.marketCap ?? y.marketCap,
              eps: s.eps ?? y.eps,
              avgVolume: s.avgVolume ?? y.avgVolume,
              beta: s.beta ?? y.beta,
              yield: s.yield ?? y.yield,
            };
          });
          source = 'mixed';
        }
      }
    }

    // Fallback to Yahoo if FMP fails or returns too few
    if (!stocks || stocks.length < symbolList.length * 0.5) {
      console.warn(`FMP returned ${stocks?.length ?? 0}/${symbolList.length}, falling back to Yahoo`);
      const fmpMap = {};
      if (stocks) stocks.forEach(s => { fmpMap[s.symbol] = s; });

      const missing = symbolList.filter(s => !fmpMap[s]);

      // Try Yahoo batch quote first (returns fundamentals)
      const yahooBatch = await fetchYahooBatch(missing);
      let yahooStocks = yahooBatch || [];

      // For any still missing, fall back to per-symbol chart endpoint
      if (yahooStocks.length < missing.length * 0.5) {
        const batchSymbols = new Set(yahooStocks.map(s => s.symbol));
        const stillMissing = missing.filter(s => !batchSymbols.has(s));
        const chartResults = await chunkedFetch(stillMissing, fetchYahooSymbol, 10, 100);
        yahooStocks = [...yahooStocks, ...chartResults.filter(r => r !== null)];
      }

      stocks = [...Object.values(fmpMap), ...yahooStocks];
      source = stocks.length > 0 ? 'mixed' : 'none';
    }

    if (!stocks || stocks.length === 0) {
      const staleCached = await getKvCached(kvKeys.stale);
      if (staleCached) {
        setStockResponseHeaders(req, res);
        res.setHeader('X-Monica-Data-Status', 'stale');
        res.setHeader('X-Monica-Cache-Level', 'L2');
        return res.status(200).json(staleCached);
      }
      return res.status(500).json({ error: 'No valid stock data received' });
    }

    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: stocks });
    }
    await Promise.all([
      setKvCached(kvKeys.fresh, stocks, kvFreshTtlSec),
      setKvCached(kvKeys.stale, stocks, KV_STALE_IF_ERROR_TTL_SEC),
    ]);

    setStockResponseHeaders(req, res);
    res.setHeader('X-Monica-Data-Status', 'live');
    res.setHeader('X-Monica-Data-Source', source);
    return res.status(200).json(stocks);
  } catch (err) {
    console.error('stocks-free handler error:', err);
    const staleCached = await getKvCached(kvKeys.stale);
    if (staleCached) {
      setStockResponseHeaders(req, res);
      res.setHeader('X-Monica-Data-Status', 'stale');
      res.setHeader('X-Monica-Cache-Level', 'L2');
      return res.status(200).json(staleCached);
    }
    return res.status(500).json({ error: 'Failed to fetch stock data' });
  }
}
