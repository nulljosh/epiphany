import { applyCors } from './_cors.js';
import { FMP_BASE, getFmpApiKey } from './stocks-shared.js';

// Commodity + index symbol mapping
const SYMBOLS = {
  gold: { fmp: 'GCUSD', yahoo: 'GC=F' },
  silver: { fmp: 'SIUSD', yahoo: 'SI=F' },
  platinum: { fmp: 'PLUSD', yahoo: 'PL=F' },
  palladium: { fmp: 'PAUSD', yahoo: 'PA=F' },
  copper: { fmp: 'HGUSD', yahoo: 'HG=F' },
  oil: { fmp: 'CLUSD', yahoo: 'CL=F' },
  natgas: { fmp: 'NGUSD', yahoo: 'NG=F' },
  nas100: { fmp: '%5EIXIC', yahoo: '^NDX' },
  us500: { fmp: '%5EGSPC', yahoo: '^GSPC' },
  us30: { fmp: '%5EDJI', yahoo: '^DJI' },
  dxy: { fmp: 'DX-Y.NYB', yahoo: 'DX-Y.NYB' },
};

// FMP batch fetch for commodities
async function fetchFmpCommodities() {
  const apiKey = getFmpApiKey();
  if (!apiKey) return null;

  const results = {};

  // Fetch commodity futures via FMP quote endpoint
  const fmpSymbols = Object.values(SYMBOLS).map(s => s.fmp);
  const url = `${FMP_BASE}/quote/${fmpSymbols.join(',')}?apikey=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data)) return null;

    // Map FMP symbols back to keys
    const fmpToKey = {};
    Object.entries(SYMBOLS).forEach(([key, { fmp }]) => {
      fmpToKey[fmp] = key;
    });

    data.forEach(q => {
      const key = fmpToKey[q.symbol];
      if (key && q.price && typeof q.price === 'number') {
        results[key] = {
          price: q.price,
          change: q.change ?? 0,
          changePercent: q.changesPercentage ?? 0,
          high52: q.yearHigh ?? null,
          low52: q.yearLow ?? null,
          source: 'fmp',
        };
      }
    });

    return Object.keys(results).length > 0 ? results : null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`FMP commodities error: ${err.message}`);
    return null;
  }
}

// Yahoo fallback for individual commodities
async function fetchYahooCommodity(key, symbol) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.chart?.error) return null;

    const meta = data.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice || typeof meta.regularMarketPrice !== 'number') return null;

    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const price = meta.regularMarketPrice;
    const change = prevClose && typeof prevClose === 'number' ? price - prevClose : 0;
    const changePercent = prevClose && typeof prevClose === 'number'
      ? ((price - prevClose) / prevClose) * 100
      : 0;

    return {
      price,
      change,
      changePercent,
      high52: meta.fiftyTwoWeekHigh ?? null,
      low52: meta.fiftyTwoWeekLow ?? null,
      source: 'yahoo',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

export default async function handler(req, res) {
  applyCors(req, res);

  try {
    // Try FMP batch first
    let results = await fetchFmpCommodities();

    // If FMP failed or incomplete, fill gaps with Yahoo
    if (!results || Object.keys(results).length < Object.keys(SYMBOLS).length * 0.5) {
      const existing = results || {};
      const missing = Object.entries(SYMBOLS).filter(([key]) => !existing[key]);

      const yahooResults = await Promise.all(
        missing.map(async ([key, { yahoo }]) => {
          const data = await fetchYahooCommodity(key, yahoo);
          return data ? [key, data] : null;
        })
      );

      results = { ...existing };
      yahooResults.forEach(r => {
        if (r) results[r[0]] = r[1];
      });
    }

    if (Object.keys(results).length === 0) {
      return res.status(503).json({
        error: 'No commodity data available',
        details: 'Failed to fetch data from all sources'
      });
    }

    const failedCount = Object.keys(SYMBOLS).length - Object.keys(results).length;
    if (failedCount > 0) {
      console.warn(`Fetched ${Object.keys(results).length}/${Object.keys(SYMBOLS).length} commodities (${failedCount} failed)`);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(results);
  } catch (error) {
    console.error('Commodities API error:', error);
    res.status(500).json({
      error: 'Failed to fetch commodity data',
    });
  }
}
