// Weather alerts: NOAA active alerts (US) + Open-Meteo severe weather codes (global)
// No auth required. NOAA requires User-Agent header only.
const NOAA_BASE = 'https://api.weather.gov/alerts/active';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();

// WMO severe weather codes: thunderstorm, heavy rain, heavy snow, blizzard, hail
const SEVERE_CODES = new Set([65, 67, 75, 77, 82, 85, 86, 95, 96, 99]);

async function timedFetch(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchNoaa(lat, lon) {
  try {
    const json = await timedFetch(
      `${NOAA_BASE}?point=${lat},${lon}`,
      { headers: { 'User-Agent': 'rise-financial-terminal/1.0 (contact@heyitsmejosh.com)' } }
    );
    return (json.features || []).slice(0, 5).map(f => ({
      source: 'noaa',
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      expires: f.properties.expires,
      lat,
      lon,
    }));
  } catch {
    return [];
  }
}

async function fetchOpenMeteo(lat, lon) {
  try {
    const json = await timedFetch(
      `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    const code = json.current_weather?.weathercode;
    if (SEVERE_CODES.has(code)) {
      return [{
        source: 'open-meteo',
        event: 'Severe Weather',
        severity: 'Moderate',
        headline: `Severe weather code ${code} at ${lat.toFixed(2)},${lon.toFixed(2)}`,
        expires: null,
        lat,
        lon,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lat, lon } = req.query;
  if (!lat || !lon || isNaN(+lat) || isNaN(+lon)) {
    return res.status(400).json({ error: 'lat and lon required' });
  }
  const key = `${(+lat).toFixed(2)},${(+lon).toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).json({
      ...cached.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cached.ts }),
    });
  }
  const [noaa, meteo] = await Promise.all([fetchNoaa(+lat, +lon), fetchOpenMeteo(+lat, +lon)]);
  const alerts = [...noaa, ...meteo];
  const sources = [...new Set(alerts.map(alert => alert.source))];
  const degraded = sources.length === 0;
  const data = {
    alerts,
    sources,
    meta: buildMeta(degraded ? 'degraded' : 'live', degraded
      ? { degraded: true, warning: 'No upstream weather alerts available for this location right now' }
      : {}),
  };
  cache.set(key, { ts: Date.now(), data });
  res.setHeader('Cache-Control', 'public, max-age=600');
  return res.status(200).json(data);
}
