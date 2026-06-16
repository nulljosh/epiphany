// Premium stock API: FMP batch (primary) + Yahoo v7 quote (fallback)
import { parseSymbols, setStockResponseHeaders, YAHOO_HEADERS, FMP_BASE, getFmpApiKey, getYahooCrumb } from './stocks-shared.js';

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

// FMP stable API. The legacy v3 batch `/quote/{symbols}` endpoint was retired Aug 31 2025;
// the free stable tier has no batch quote, so fetch per-symbol: `/stable/quote` (price +
// marketCap) and `/stable/ratios-ttm` (P/E via priceToEarningsRatioTTM).
const FMP_STABLE = 'https://financialmodelingprep.com/stable';

async function fmpStableGet(path, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const sep = path.includes('?') ? '&' : '?';
    const response = await fetch(`${FMP_STABLE}${path}${sep}apikey=${apiKey}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function fetchFmpSymbol(yahooSym) {
  const apiKey = getFmpApiKey();
  if (!apiKey) return null;
  const fmpSym = yahooSym.replace('-', '.');
  const q = await fmpStableGet(`/quote?symbol=${fmpSym}`, apiKey);
  if (!q || typeof q.price !== 'number') return null;
  const ratios = await fmpStableGet(`/ratios-ttm?symbol=${fmpSym}`, apiKey);
  return {
    symbol: yahooSym,
    name: q.name || q.companyName || yahooSym,
    price: q.price,
    change: q.change ?? 0,
    changePercent: q.changePercentage ?? q.changesPercentage ?? 0,
    volume: q.volume ?? 0,
    marketCap: q.marketCap ?? q.market_cap ?? q.marketCapitalization ?? null,
    peRatio: q.pe ?? q.priceEarningsRatio ?? ratios?.priceToEarningsRatioTTM ?? null,
    eps: q.eps ?? q.epsTTM ?? ratios?.netIncomePerShareTTM ?? null,
    beta: q.beta ?? null,
    avgVolume: q.avgVolume ?? q.averageVolume ?? null,
    yield: (q.lastDiv && q.price) ? ((q.lastDiv / q.price) * 100) : null,
    fiftyTwoWeekHigh: q.yearHigh ?? null,
    fiftyTwoWeekLow: q.yearLow ?? null,
    open: q.open ?? null,
    prevClose: q.previousClose ?? null,
    high: q.dayHigh ?? null,
    low: q.dayLow ?? null,
  };
}

async function fetchFmpQuotes(symbolList) {
  if (!getFmpApiKey()) return null;
  const results = await Promise.all(symbolList.map(fetchFmpSymbol));
  const out = results.filter(Boolean);
  return out.length ? out : null;
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
  const needsEnrich = stocks.filter(s =>
    s.marketCap == null || s.peRatio == null || s.beta == null || s.eps == null || s.avgVolume == null || s.yield == null
  );
  if (needsEnrich.length === 0) return stocks;

  // Try FMP profile first (more reliable than Yahoo v7)
  const fmpEnriched = await enrichWithFmpProfile(stocks);

  // Fallback to Yahoo v10/quoteSummary for remaining gaps
  const remaining = fmpEnriched.filter(s =>
    s.marketCap == null || s.peRatio == null || s.beta == null || s.eps == null || s.avgVolume == null || s.yield == null
  ).map(s => s.symbol);
  if (remaining.length === 0) return fmpEnriched;

  const provider = YAHOO_PROVIDERS[0];
  const summaryMap = {};

  // Yahoo v10 requires a cookie+crumb (401 "Invalid Crumb" without it). Fetch the
  // fundamentals one symbol at a time with crumb + a refresh-on-401 retry. Sequential
  // (not Promise.all) to stay under Yahoo's 429 rate limit.
  const fetchSummary = async (symbol) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await getYahooCrumb({ force: attempt > 0 });
      const crumbParam = session.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
      const url = `${provider}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail,defaultKeyStatistics${crumbParam}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const headers = session.cookie ? { ...YAHOO_HEADERS, Cookie: session.cookie } : YAHOO_HEADERS;
        const response = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.status === 401 && attempt === 0) continue; // refresh crumb, retry
        if (!response.ok) return;
        const data = await response.json();
        const price = data?.quoteSummary?.result?.[0]?.price;
        const sd = data?.quoteSummary?.result?.[0]?.summaryDetail;
        const stats = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
        if (price || sd || stats) summaryMap[symbol] = { price, sd, stats };
        return;
      } catch {
        clearTimeout(timeoutId);
        return;
      }
    }
  };

  for (let i = 0; i < remaining.length; i += 5) {
    await Promise.all(remaining.slice(i, i + 5).map(fetchSummary));
    if (i + 5 < remaining.length) await sleep(process.env.NODE_ENV === 'test' ? 0 : 150);
  }

  return fmpEnriched.map(s => {
    const info = summaryMap[s.symbol];
    if (!info) return s;
    const { price, sd, stats } = info;
    return {
      ...s,
      name: s.name || price?.shortName || price?.longName || s.symbol,
      marketCap: s.marketCap ?? price?.marketCap?.raw ?? null,
      peRatio: s.peRatio ?? stats?.trailingPE?.raw ?? stats?.forwardPE?.raw ?? null,
      eps: s.eps ?? stats?.trailingEps?.raw ?? null,
      beta: s.beta ?? stats?.beta?.raw ?? null,
      avgVolume: s.avgVolume ?? sd?.averageVolume?.raw ?? null,
      yield: s.yield ?? (sd?.dividendYield?.raw != null ? sd.dividendYield.raw * 100 : null),
    };
  });
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

    // Enrich with fundamentals if missing. Treat 0 as missing: FMP free tier returns
    // marketCap/peRatio of 0 for some stocks, which is always a data error, not a real value.
    const needsEnrichment = stocks.some(s => !s.marketCap || !s.peRatio || !s.name || s.name === s.symbol);
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
