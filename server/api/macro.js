import { applyCors } from './_cors.js';

// Keyless FRED CSV download endpoint. The JSON observations API requires a
// registered api_key; this public graph CSV does not. Same underlying data,
// zero config, no key to rotate or break. (Switched 2026-05-30 after the
// api_key path went dead — empty in prod, unregistered locally.)
const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const OBS_LIMIT = 12;

const SERIES = [
  { id: 'fedFunds',    seriesId: 'FEDFUNDS',        name: 'Fed Funds Rate',    unit: '%' },
  { id: 'cpi',         seriesId: 'CPIAUCSL',        name: 'CPI',              unit: 'index' },
  { id: 'gdp',         seriesId: 'A191RL1Q225SBEA', name: 'GDP Growth',        unit: '%' },
  { id: 'unemployment', seriesId: 'UNRATE',          name: 'Unemployment',      unit: '%' },
  { id: 'joblessClaims', seriesId: 'ICSA',           name: 'Jobless Claims',    unit: 'K' },
  { id: 'consumerConf', seriesId: 'UMCSENT',         name: 'Consumer Confidence', unit: 'index' },
  { id: 'pce',         seriesId: 'PCEPI',            name: 'PCE Inflation',     unit: 'index' },
  { id: 'retailSales', seriesId: 'RSAFS',            name: 'Retail Sales',      unit: 'B USD' },
  { id: 'treasury2y',  seriesId: 'DGS2',            name: '2Y Treasury',       unit: '%' },
  { id: 'treasury10y', seriesId: 'DGS10',           name: '10Y Treasury',      unit: '%' },
  { id: 'treasury30y', seriesId: 'DGS30',           name: '30Y Treasury',      unit: '%' },
  { id: 'deficit',     seriesId: 'FYFSD',           name: 'Federal Deficit',   unit: 'B USD' },
];

let cache = { ts: 0, data: null };

async function fetchSeries(seriesId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${FRED_CSV}?id=${seriesId}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'text/csv' },
    });

    if (!response.ok) {
      throw new Error(`FRED ${seriesId} returned HTTP ${response.status}`);
    }

    // CSV is "DATE,value" rows in ascending date order; missing values are ".".
    // Keep the most recent valid observations and return them newest-first so
    // buildIndicator (which reads index 0 as current) keeps working unchanged.
    const text = await response.text();
    const observations = text
      .split('\n')
      .filter(line => /^\d{4}-\d{2}-\d{2},/.test(line))
      .map(line => {
        const [date, value] = line.split(',');
        return { date, value: Number(value) };
      })
      .filter(o => Number.isFinite(o.value))
      .slice(-OBS_LIMIT)
      .reverse();

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

async function fetchMacroData() {
  const settled = await Promise.allSettled(
    SERIES.map(spec => fetchSeries(spec.seriesId).then(obs => ({ spec, obs })))
  );

  // No fabricated fallback. A series that fails or returns empty is omitted
  // entirely so the UI shows an honest gap instead of invented numbers.
  return settled
    .filter(r => r.status === 'fulfilled' && r.value.obs.length > 0)
    .map(r => buildIndicator(r.value.spec, r.value.obs));
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL_MS) {
    return res.status(200).json(cache.data);
  }

  try {
    const fresh = await fetchMacroData();
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
