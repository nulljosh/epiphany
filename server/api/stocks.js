// Premium stock API: FMP batch (primary) + Yahoo v7 quote (fallback)
import { parseSymbols, setStockResponseHeaders, YAHOO_HEADERS, FMP_BASE, getFmpApiKey } from './stocks-shared.js';

const YAHOO_PROVIDERS = process.env.NODE_ENV === 'test'
  ? ['https://query1.finance.yahoo.com']
  : ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS_PER_PROVIDER = process.env.NODE_ENV === 'test' ? 1 : 2;
const RETRY_BASE_MS = 250;
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';
const CACHE_TTL_MS = 90000; // 90s for FMP quota management
const STALE_IF_ERROR_MS = 5 * 60 * 1000;
const cache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getCached(cacheKey, maxAgeMs) {
  if (!ENABLE_CACHE) return null;
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > maxAgeMs) return null;
  return cached.data;
}

// FMP batch quote
async function fetchFmpQuotes(symbolList) {
  const apiKey = getFmpApiKey();
  if (!apiKey) return null;

  const fmpSymbols = symbolList.map(s => s.replace('-', '.'));
  const url = `${FMP_BASE}/quote/${fmpSymbols.join(',')}?apikey=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data)) return null;

    const yahooSymbolMap = {};
    symbolList.forEach(s => { yahooSymbolMap[s.replace('-', '.')] = s; });

    return data
      .filter(q => q.symbol && typeof q.price === 'number')
      .map(q => ({
        symbol: yahooSymbolMap[q.symbol] || q.symbol,
        name: q.name || q.companyName || yahooSymbolMap[q.symbol] || q.symbol,
        price: q.price,
        change: q.change ?? 0,
        changePercent: q.changesPercentage ?? 0,
        volume: q.volume ?? 0,
        marketCap: q.marketCap ?? q.market_cap ?? q.marketCapitalization ?? null,
        peRatio: q.pe ?? q.priceEarningsRatio ?? q.trailingPE ?? null,
        eps: q.eps ?? q.epsTTM ?? null,
        fiftyTwoWeekHigh: q.yearHigh ?? null,
        fiftyTwoWeekLow: q.yearLow ?? null,
        open: q.open ?? null,
        prevClose: q.previousClose ?? null,
        high: q.dayHigh ?? null,
        low: q.dayLow ?? null,
      }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`FMP quote error: ${err.message}`);
    return null;
  }
}

// Yahoo v8 chart fallback (v7 quote endpoint now requires auth)
async function fetchYahooChartSingle(symbol, provider) {
  const url = `${provider}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;

    const prevClose = meta.chartPreviousClose ?? meta.regularMarketPrice;
    const change = meta.regularMarketPrice - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol,
      name: meta.shortName || meta.longName || symbol,
      price: meta.regularMarketPrice,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume: meta.regularMarketVolume ?? 0,
      marketCap: null,
      peRatio: null,
      eps: null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      open: meta.regularMarketOpen ?? null,
      prevClose: meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? null,
      high: meta.regularMarketDayHigh ?? null,
      low: meta.regularMarketDayLow ?? null,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

const YAHOO_BATCH_SIZE = 10;

async function fetchYahooQuotes(symbolList) {
  const provider = YAHOO_PROVIDERS[0];
  const results = [];

  for (let i = 0; i < symbolList.length; i += YAHOO_BATCH_SIZE) {
    const batch = symbolList.slice(i, i + YAHOO_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(sym => fetchYahooChartSingle(sym, provider))
    );
    results.push(...batchResults.filter(Boolean));

    if (i + YAHOO_BATCH_SIZE < symbolList.length) {
      await sleep(process.env.NODE_ENV === 'test' ? 0 : 100);
    }
  }

  if (results.length === 0) {
    // Try second provider if first returned nothing
    if (YAHOO_PROVIDERS.length > 1) {
      const fallbackResults = await Promise.all(
        symbolList.slice(0, 5).map(sym => fetchYahooChartSingle(sym, YAHOO_PROVIDERS[1]))
      );
      const filtered = fallbackResults.filter(Boolean);
      if (filtered.length > 0) {
        const remaining = symbolList.slice(5);
        for (let i = 0; i < remaining.length; i += YAHOO_BATCH_SIZE) {
          const batch = remaining.slice(i, i + YAHOO_BATCH_SIZE);
          const moreBatch = await Promise.all(
            batch.map(sym => fetchYahooChartSingle(sym, YAHOO_PROVIDERS[1]))
          );
          filtered.push(...moreBatch.filter(Boolean));
          if (i + YAHOO_BATCH_SIZE < remaining.length) await sleep(100);
        }
        return filtered;
      }
    }
    throw new Error('Yahoo Finance v8 chart API returned no data');
  }

  return results;
}

async function enrichWithFmpProfile(stocks) {
  const apiKey = getFmpApiKey();
  if (!apiKey) return stocks;

  const symbols = stocks.filter(s => s.marketCap == null || !s.name || s.name === s.symbol).map(s => s.symbol.replace('-', '.'));
  if (symbols.length === 0) return stocks;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${FMP_BASE}/profile/${symbols.join(',')}?apikey=${apiKey}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return stocks;

    const data = await response.json();
    if (!Array.isArray(data)) return stocks;

    const profileMap = {};
    for (const p of data) {
      if (p.symbol) profileMap[p.symbol] = p;
    }

    return stocks.map(s => {
      const p = profileMap[s.symbol.replace('-', '.')];
      if (!p) return s;
      return {
        ...s,
        name: s.name && s.name !== s.symbol ? s.name : (p.companyName || s.name),
        marketCap: s.marketCap ?? p.mktCap ?? null,
        peRatio: s.peRatio ?? p.pe ?? null,
        eps: s.eps ?? p.eps ?? null,
      };
    });
  } catch {
    clearTimeout(timeoutId);
    return stocks;
  }
}

async function enrichWithFundamentals(stocks) {
  const symbols = stocks.filter(s => s.marketCap == null).map(s => s.symbol);
  if (symbols.length === 0) return stocks;

  // Try FMP profile first (more reliable than Yahoo v7)
  const fmpEnriched = await enrichWithFmpProfile(stocks);
  if (fmpEnriched.every(s => s.marketCap != null)) return fmpEnriched;

  // Fallback to Yahoo v7 for remaining
  const remaining = fmpEnriched.filter(s => s.marketCap == null).map(s => s.symbol);
  if (remaining.length === 0) return fmpEnriched;

  const provider = YAHOO_PROVIDERS[0];
  const url = `${provider}/v7/finance/quote?symbols=${remaining.join(',')}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return fmpEnriched;

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    const quoteMap = {};
    for (const q of quotes) {
      if (q.symbol) quoteMap[q.symbol] = q;
    }

    return fmpEnriched.map(s => {
      const q = quoteMap[s.symbol];
      if (!q) return s;
      return {
        ...s,
        name: s.name || q.shortName || q.longName || s.symbol,
        marketCap: s.marketCap ?? q.marketCap ?? null,
        peRatio: s.peRatio ?? q.trailingPE ?? q.forwardPE ?? null,
        eps: s.eps ?? q.epsTrailingTwelveMonths ?? null,
      };
    });
  } catch {
    clearTimeout(timeoutId);
    return fmpEnriched;
  }
}

export default async function handler(req, res) {
  const parsed = parseSymbols(req.query.symbols, {
    max: 50,
    validate: true,
    tooManyMessage: 'Too many symbols',
  });
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const { symbolList } = parsed;
  const cacheKey = symbolList.join(',');
  const cached = getCached(cacheKey, CACHE_TTL_MS);
  if (cached) {
    setStockResponseHeaders(req, res);
    res.setHeader('X-Monica-Data-Status', 'cache');
    return res.status(200).json(cached);
  }

  try {
    // Try FMP first
    let stocks = await fetchFmpQuotes(symbolList);
    let source = 'fmp';

    // Fallback to Yahoo if FMP fails
    if (!stocks || stocks.length === 0) {
      stocks = await fetchYahooQuotes(symbolList);
      source = 'yahoo';
    }

    stocks = stocks.filter(q => q.symbol && typeof q.price === 'number');

    // Enrich with fundamentals if missing
    const needsEnrichment = stocks.some(s => s.marketCap == null || !s.name || s.name === s.symbol);
    if (needsEnrichment) {
      try {
        const enriched = await enrichWithFundamentals(stocks);
        stocks = enriched;
      } catch { /* non-critical */ }
    }

    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: stocks });
    }

    setStockResponseHeaders(req, res);
    res.setHeader('X-Monica-Data-Status', 'live');
    res.setHeader('X-Monica-Data-Source', source);
    return res.status(200).json(stocks);
  } catch (err) {
    const staleCached = getCached(cacheKey, STALE_IF_ERROR_MS);
    if (staleCached) {
      setStockResponseHeaders(req, res);
      res.setHeader('X-Monica-Data-Status', 'stale');
      return res.status(200).json(staleCached);
    }

    if (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message === 'Request timeout') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'APIs did not respond in time across providers',
      });
    }
    return res.status(500).json({
      error: 'Failed to fetch stock data',
      details: err.message,
    });
  }
}
