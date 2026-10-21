import { applyCors } from './_cors.js';
import { getKv } from './_kv.js';

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
  { id: 'cpi',         seriesId: 'CPIAUCSL',        name: 'CPI',              unit: 'index', bls: 'CUSR0000SA0' },
  { id: 'gdp',         seriesId: 'A191RL1Q225SBEA', name: 'GDP Growth',        unit: '%' },
  { id: 'unemployment', seriesId: 'UNRATE',          name: 'Unemployment',      unit: '%', bls: 'LNS14000000' },
  { id: 'payrolls',    seriesId: 'PAYEMS',          name: 'Nonfarm Payrolls',  unit: 'K', bls: 'CES0000000001' },
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
      // ponytail: FRED sits behind Akamai, which refuses this request from
      // Cloudflare Workers egress — every series comes back 520 at the edge
      // while the same fetch works from a laptop. Browser
      // User-Agent, Referer and Accept-Language were all tried; none help, so
      // it is the egress IP, not the request shape. Until macro moves to a
      // reachable source (or gets populated into KV by something that can
      // reach FRED), this returns an empty set and the UI shows an honest gap.
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

// BLS is the fallback for the jobs report and CPI when FRED fails. Keyless calls
// from Workers egress get REQUEST_NOT_PROCESSED (shared IPs spend the daily quota),
// so it needs BLS_API_KEY (free, 500 a day). One call is cached in KV for six hours.
const BLS_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const BLS_TTL_S = 6 * 60 * 60;

async function fetchBls(ids) {
  const kv = await getKv().catch(() => null);
  const cached = kv ? await kv.get('macro:bls').catch(() => null) : null;
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

  const response = await fetch(BLS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesid: ids, ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY.trim() } : {}) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`BLS returned HTTP ${response.status}`);
  const json = await response.json();
  if (json.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS ${json.status}`);

  const out = {};
  for (const series of json.Results?.series || []) {
    out[series.seriesID] = series.data
      .filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period))
      .map(d => ({ date: `${d.year}-${d.period.slice(1)}-01`, value: Number(d.value) }))
      .filter(o => Number.isFinite(o.value))
      .slice(0, OBS_LIMIT); // BLS is already newest first
  }
  if (kv && Object.keys(out).length) await kv.set('macro:bls', JSON.stringify(out), { ex: BLS_TTL_S }).catch(() => {});
  return out;
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
  const failures = settled.filter(r => r.status === 'rejected');
  if (failures.length) {
    console.error(`[macro] ${failures.length}/${SERIES.length} FRED series failed:`, failures[0].reason?.message);
  }

  const ok = new Map(settled
    .filter(r => r.status === 'fulfilled' && r.value.obs.length > 0)
    .map(r => [r.value.spec.id, r.value.obs]));

  const needBls = SERIES.filter(spec => spec.bls && !ok.has(spec.id));
  if (needBls.length) {
    try {
      const bls = await fetchBls(needBls.map(spec => spec.bls));
      for (const spec of needBls) if (bls[spec.bls]?.length) ok.set(spec.id, bls[spec.bls]);
    } catch (err) {
      console.error('[macro] BLS fallback failed:', err.message);
    }
  }

  return SERIES.filter(spec => ok.has(spec.id)).map(spec => buildIndicator(spec, ok.get(spec.id)));
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
    // Only cache a result that actually has data. Caching an empty array — every
    // series failed — pinned the outage in place for the full hour and returned
    // it in 1ms, which is exactly what made this look like a config problem.
    if (fresh.length > 0) cache = { ts: now, data: fresh };
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
