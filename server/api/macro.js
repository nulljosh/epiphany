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

const FALLBACK_DATA = {
  fedFunds: [
    { date: '2026-03-01', value: 5.33 },
    { date: '2026-02-01', value: 5.25 },
  ],
  cpi: [
    { date: '2026-02-01', value: 314.0 },
    { date: '2026-01-01', value: 313.2 },
  ],
  gdp: [
    { date: '2025-12-01', value: 2.8 },
    { date: '2025-09-01', value: 2.6 },
  ],
  treasury2y: [
    { date: '2026-03-20', value: 4.25 },
    { date: '2026-03-19', value: 4.21 },
  ],
  treasury10y: [
    { date: '2026-03-20', value: 4.35 },
    { date: '2026-03-19', value: 4.31 },
  ],
  treasury30y: [
    { date: '2026-03-20', value: 4.55 },
    { date: '2026-03-19', value: 4.5 },
  ],
  deficit: [
    { date: '2025-12-01', value: -1832 },
    { date: '2025-09-01', value: -1765 },
  ],
};

function buildFallbackData() {
  return SERIES.map(spec => buildIndicator(spec, FALLBACK_DATA[spec.id] || []));
}

async function fetchMacroData(apiKey) {
  const settled = await Promise.allSettled(
    SERIES.map(spec => fetchSeries(spec.seriesId, apiKey).then(obs => ({ spec, obs })))
  );

  const results = settled.map((result, i) => {
    if (result.status === 'fulfilled' && result.value.obs.length > 0) {
      return buildIndicator(result.value.spec, result.value.obs);
    }
    // FRED call failed or returned empty -- use fallback for this indicator
    const fallback = FALLBACK_DATA[SERIES[i].id] || [];
    return buildIndicator(SERIES[i], fallback);
  });

  return results;
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    res.setHeader('X-Data-Stale', 'true');
    return res.status(200).json(buildFallbackData());
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
