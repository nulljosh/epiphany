import { put } from '@vercel/blob';
import { getKv } from './_kv.js';
import { YAHOO_HEADERS, FMP_BASE, getFmpApiKey } from './stocks-shared.js';

const BLOB_FILENAME = 'rise-cache/results.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // ms

// Full symbol list matching useStocks.js DEFAULT_SYMBOLS
const ALL_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'BRK-B', 'LLY', 'V', 'UNH', 'XOM', 'JPM', 'WMT', 'JNJ', 'MA', 'PG',
  'AVGO', 'HD', 'CVX', 'MRK', 'COST', 'ABBV', 'KO', 'PEP', 'AMD', 'ADBE',
  'CRM', 'NFLX', 'CSCO', 'TMO', 'ORCL', 'ACN', 'INTC', 'NKE', 'TXN',
  'QCOM', 'PM', 'DHR', 'INTU', 'UNP', 'RTX', 'HON', 'SPGI',
  'BAC', 'GS', 'MS', 'C', 'WFC', 'BLK', 'SCHW', 'AXP',
  'PFE', 'AMGN', 'BMY', 'MDT', 'BSX', 'ELV', 'CVS',
  'UPS', 'FDX', 'BA', 'CAT', 'DE', 'LMT', 'GE',
  'DIS', 'CMCSA', 'VZ', 'T', 'TMUS',
  'NEE', 'DUK', 'SO',
  'TGT', 'LOW', 'SBUX', 'MCD', 'YUM', 'F', 'GM',
  'AMT', 'PLD', 'CME', 'WM', 'XYZ',
  'COIN', 'PLTR', 'HOOD', 'HIMS', 'SHOP', 'RKLB', 'SOFI', 'IBM', 'IWM',
  'GC=F', 'SI=F', 'CL=F',
  'SPY', 'SJIM', 'LJIM',
];

/**
 * Fetch with timeout and automatic retry logic
 */
const timedFetch = async (url, opts = {}, ms = 10000, retries = 0) => {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const res = await fetch(url, { ...opts, signal: c.signal });
    clearTimeout(t);
    return res;
  } catch (err) {
    if (retries < MAX_RETRIES && (err.name === 'AbortError' || err.code === 'ECONNRESET')) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return timedFetch(url, opts, ms, retries + 1);
    }
    throw err;
  }
};

async function fetchMarkets() {
  const startTime = Date.now();
  try {
    const res = await timedFetch(
      'https://gamma-api.polymarket.com/markets?closed=false&limit=50&order=volume24hr&ascending=false',
      { headers: { Accept: 'application/json' } }, 15000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const filtered = Array.isArray(data) ? data.filter(m => m?.id && m?.question && m?.slug) : [];
    console.log(`[CRON] Markets fetched: ${filtered.length}/${Array.isArray(data) ? data.length : 0} in ${Date.now() - startTime}ms`);
    return filtered;
  } catch (e) { 
    console.error(`[CRON] Markets fetch failed after ${Date.now() - startTime}ms:`, e.message); 
    return []; 
  }
}

async function fetchYahooSymbol(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const res = await timedFetch(url, { headers: YAHOO_HEADERS }, 8000);
    if (!res.ok) return null;
    const meta = (await res.json()).chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice || typeof meta.regularMarketPrice !== 'number') return null;
    const prev = meta.chartPreviousClose || meta.previousClose;
    return {
      symbol,
      price: meta.regularMarketPrice,
      change: prev ? meta.regularMarketPrice - prev : 0,
      changePercent: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0,
      volume: meta.regularMarketVolume ?? 0,
    };
  } catch { return null; }
}

async function chunkedFetch(items, fetchFn, batchSize = 10, delayMs = 100) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fetchFn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

async function fetchStocks() {
  const startTime = Date.now();
  const results = [];

  // Try FMP batch first (single API call for all symbols)
  const apiKey = getFmpApiKey();
  if (apiKey) {
    try {
      const fmpSymbols = ALL_SYMBOLS.map(s => s.replace('-', '.'));
      const url = `${FMP_BASE}/quote/${fmpSymbols.join(',')}?apikey=${apiKey}`;
      const res = await timedFetch(url, {}, 15000);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const yahooMap = {};
          ALL_SYMBOLS.forEach(s => { yahooMap[s.replace('-', '.')] = s; });
          data.filter(q => q.symbol && typeof q.price === 'number').forEach(q => {
            results.push({
              symbol: yahooMap[q.symbol] || q.symbol,
              price: q.price,
              change: q.change ?? 0,
              changePercent: q.changesPercentage ?? 0,
              volume: q.volume ?? 0,
            });
          });
        }
      }
    } catch (e) {
      console.warn(`[CRON] FMP batch failed: ${e.message}`);
    }
  }

  // Yahoo chunked fallback for any symbols FMP missed
  const have = new Set(results.map(r => r.symbol));
  const missing = ALL_SYMBOLS.filter(s => !have.has(s));
  if (missing.length > 0) {
    console.log(`[CRON] FMP returned ${results.length}/${ALL_SYMBOLS.length}, fetching ${missing.length} from Yahoo`);
    const yahooResults = await chunkedFetch(missing, fetchYahooSymbol, 10, 100);
    yahooResults.filter(Boolean).forEach(r => results.push(r));
  }

  console.log(`[CRON] Stocks fetched: ${results.length}/${ALL_SYMBOLS.length} in ${Date.now() - startTime}ms`);
  return results;
}

async function fetchCommodities() {
  const startTime = Date.now();
  const syms = { gold: 'GC=F', silver: 'SI=F', platinum: 'PL=F', palladium: 'PA=F', copper: 'HG=F', oil: 'CL=F', natgas: 'NG=F', nas100: '^NDX', us500: '^GSPC', us30: '^DJI', dxy: 'DX-Y.NYB' };
  const results = {};
  
  await Promise.all(Object.entries(syms).map(async ([key, sym]) => {
    try {
      const res = await timedFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`,
        { headers: { 'User-Agent': UA } }, 8000
      );
      if (!res.ok) {
        console.warn(`[CRON] Commodity ${key} returned HTTP ${res.status}`);
        return;
      }
      const meta = (await res.json()).chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice && typeof meta.regularMarketPrice === 'number') {
        const prev = meta.chartPreviousClose || meta.previousClose;
        results[key] = {
          price: meta.regularMarketPrice,
          change: prev ? meta.regularMarketPrice - prev : 0,
          changePercent: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0,
        };
      }
    } catch (e) { 
      console.warn(`[CRON] Commodity ${key} fetch failed:`, e.message); 
    }
  }));
  
  console.log(`[CRON] Commodities fetched: ${Object.keys(results).length}/${Object.keys(syms).length} in ${Date.now() - startTime}ms`);
  return results;
}

async function fetchCrypto() {
  try {
    const res = await timedFetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return {
      btc: { spot: d.bitcoin?.usd ?? null, chgPct: d.bitcoin?.usd_24h_change ?? 0 },
      eth: { spot: d.ethereum?.usd ?? null, chgPct: d.ethereum?.usd_24h_change ?? 0 },
    };
  } catch (e) { 
    console.error('Cron crypto fetch failed:', e.message); 
    return { btc: null, eth: null }; // Return safe default instead of null
  }
}

export default async function handler(req, res) {
  // Verify authorization
  const authHeader = req.headers.authorization || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader !== expected) {
    console.warn(`[CRON] Unauthorized access attempt`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log(`[CRON] Starting cache update...`);

  try {
    // Fetch all data sources in parallel
    const [markets, stocks, commodities, crypto] = await Promise.all([
      fetchMarkets(), 
      fetchStocks(), 
      fetchCommodities(), 
      fetchCrypto(),
    ]);

    const fetchTime = Date.now() - startTime;
    const results = { markets, stocks, commodities, crypto, updatedAt: new Date().toISOString() };
    const payload = JSON.stringify(results);

    console.log(`[CRON] Fetched data in ${fetchTime}ms - Markets: ${markets.length}, Stocks: ${stocks.length}, Commodities: ${Object.keys(commodities).length}`);

    // Upload to Vercel Blob
    const uploadStart = Date.now();
    const blob = await put(BLOB_FILENAME, payload, {
      access: 'public',
      addRandomSuffix: false,
    });
    const uploadTime = Date.now() - uploadStart;

    // Write stocks to KV (same keys stocks-free reads from)
    // This means stocks-free almost always serves cron-populated KV data
    // instead of burning FMP quota on live API calls
    const KV_CRON_TTL_SEC = 360; // 6 min (covers 5-min cron gap + buffer)
    const KV_STALE_TTL_SEC = 1800;
    if (stocks.length > 0) {
      try {
        const kvClient = await getKv();
        if (!kvClient) throw new Error('@vercel/kv not available');
        const hash = ALL_SYMBOLS.join(',').replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 16) || 'default';
        const kvFreshKey = `stocks:free:v1:${hash}`;
        const kvStaleKey = `stocks:free:v1:stale:${hash}`;
        // Format stock data to match what stocks-free.js stores
        const kvStocks = stocks.map(s => ({
          symbol: s.symbol,
          price: s.price,
          change: s.change ?? 0,
          changePercent: s.changePercent ?? 0,
          volume: s.volume ?? 0,
          source: 'cron',
        }));
        await Promise.all([
          kvClient.set(kvFreshKey, kvStocks, { ex: KV_CRON_TTL_SEC }),
          kvClient.set(kvStaleKey, kvStocks, { ex: KV_STALE_TTL_SEC }),
        ]);
        console.log(`[CRON] KV updated: ${kvFreshKey} (${kvStocks.length} symbols, ${KV_CRON_TTL_SEC}s TTL)`);
      } catch (kvErr) {
        console.warn(`[CRON] KV write failed: ${kvErr.message}`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[CRON] Blob uploaded in ${uploadTime}ms (total: ${totalTime}ms)`);

    res.status(200).json({
      ok: true,
      counts: { 
        markets: markets.length, 
        stocks: stocks.length, 
        commodities: Object.keys(commodities).length,
        crypto: crypto?.btc && crypto?.eth ? 2 : 0,
      },
      blobUrl: blob.url,
      updatedAt: results.updatedAt,
      timings: { fetch: fetchTime, upload: uploadTime, total: totalTime },
    });
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`[CRON] Failed after ${totalTime}ms:`, err.message);
    
    // Even on error, return 200 so Vercel logs the failure properly
    res.status(200).json({ 
      ok: false,
      error: err.message,
      totalTime,
    });
  }
}
