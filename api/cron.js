import { put } from '@vercel/blob';

const BLOB_FILENAME = 'bread-cache/results.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // ms

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

async function fetchStocks() {
  const startTime = Date.now();
  const syms = 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA,CRM,PLTR,HOOD,COST,JPM,WMT,TGT,PG,HIMS,COIN,SQ,SHOP,RKLB,SOFI,T,IBM,DIS,IWM,GC=F,SI=F,CL=F';
  try {
    const res = await timedFetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${syms}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = (data.quoteResponse?.result || [])
      .filter(q => q?.symbol && q?.regularMarketPrice !== undefined)
      .map(q => ({
        symbol: q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
      }));
    console.log(`[CRON] Stocks fetched: ${result.length}/${(data.quoteResponse?.result || []).length} in ${Date.now() - startTime}ms`);
    return result;
  } catch (e) { 
    console.error(`[CRON] Stocks fetch failed after ${Date.now() - startTime}ms:`, e.message); 
    return []; 
  }
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
