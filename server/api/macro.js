import { applyCors } from './_cors.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const SERIES = [
  { id: 'fedFunds',    seriesId: 'FEDFUNDS',        name: 'Fed Funds Rate',    unit: '%' },
  { id: 'cpi',         seriesId: 'CPIAUCSL',        name: 'CPI',              unit: 'index' },
  { id: 'gdp',         seriesId: 'A191RL1Q225SBEA', name: 'GDP Growth',        unit: '%' },
  { id: 'treasury2y',  seriesId: 'DGS2',            name: '2Y Treasury',       unit: '%' },
  { id: 'treasury10y', seriesId: 'DGS10',           name: '10Y Treasury',      unit: '%' },
  { id: 'treasury30y', seriesId: 'DGS30',           name: '30Y Treasury',      unit: '%' },
  { id: 'deficit',     seriesId: 'FYFSD',           name: 'Federal Deficit',   unit: 'B USD' },
];

let cache = { ts: 0, data: null };

async function fetchSeries(seriesId, apiKey) {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    sort_order: 'desc',
    limit: '12',
    file_type: 'json',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${FRED_BASE}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`FRED ${seriesId} returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const observations = (payload?.observations || [])
      .filter(o => o.value !== '.' && Number.isFinite(Number(o.value)))
      .map(o => ({ date: o.date, value: Number(o.value) }));

    return observations;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildIndicator(spec, observations) {
  // observations are desc order (newest first)
  const current = observations[0] || null;
  const previous = observations[1] || null;
  const sparkline = [...observations].reverse(); // asc for sparkline

  const value = current?.value ?? 0;
  const prevValue = previous?.value ?? value;
  const change = value - prevValue;
  const changePercent = prevValue !== 0 ? (change / Math.abs(prevValue)) * 100 : 0;

  return {
    id: spec.id,
    name: spec.name,
    value: Math.round(value * 100) / 100,
    unit: spec.unit,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    date: current?.date ?? '',
    series: sparkline,
  };
}

async function fetchMacroData(apiKey) {
  const settled = await Promise.allSettled(
    SERIES.map(spec => fetchSeries(spec.seriesId, apiKey).then(obs => ({ spec, obs })))
  );

  return settled.map((result, i) => {
    if (result.status === 'fulfilled') {
      return buildIndicator(result.value.spec, result.value.obs);
    }
    return buildIndicator(SERIES[i], []);
  });
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'FRED API key not configured' });
  }

  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL_MS) {
    return res.status(200).json(cache.data);
  }

  try {
    const fresh = await fetchMacroData(apiKey);
    cache = { ts: now, data: fresh };
    return res.status(200).json(fresh);
  } catch (error) {
    console.error('Macro API error:', error);

    if (cache.data) {
      return res.status(200).json(cache.data);
    }

    const status = error?.name === 'AbortError' ? 504 : 502;
    return res.status(status).json({
      error: 'Failed to fetch macroeconomic data',
      details: error?.message || 'Unknown error',
    });
  }
}
