// Weather alerts: NOAA active alerts (US) + Environment Canada (CA) + Open-Meteo severe weather (global)
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

async function timedFetchText(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchNoaa(lat, lon) {
  try {
    const json = await timedFetch(
      `${NOAA_BASE}?point=${lat},${lon}`,
      { headers: { 'User-Agent': 'monica-intelligence/1.0 (contact@jaybulb.com)' } }
    );
    return (json.features || []).slice(0, 5).map(f => ({
      source: 'noaa',
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      expires: f.properties.expires,
      sent: f.properties.sent || f.properties.effective || null,
      description: f.properties.description?.slice(0, 300) || null,
      colour: NWS_COLOUR[f.properties.severity] || 'yellow',
      area: f.properties.areaDesc || null,
      geometry: slimGeometry(f.geometry),
      lat,
      lon,
    }));
  } catch {
    return [];
  }
}

// Environment Canada alerts from MSC GeoMet: polygons with a risk colour, queried by a small box
// around the point. The old weather.gc.ca/rss/warning feeds 404 since 2026 and the battleboard
// region codes were renumbered, so this needs no region table.
const GEOMET = 'https://api.weather.gc.ca/collections/weather-alerts/items';
const NWS_COLOUR = { Extreme: 'red', Severe: 'orange' };
const MAX_RING = 300;

// Round to ~100 m and thin long rings so a payload stays small; the map draws it as a shaded area.
// ponytail: every-nth thinning, swap for Douglas-Peucker if an area edge ever looks jagged.
export function slimGeometry(g) {
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) return null;
  const ring = (r) => {
    const step = Math.ceil(r.length / MAX_RING);
    const kept = r.filter((_, i) => i % step === 0).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
    kept.push(kept[0]);
    return kept;
  };
  return g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: g.coordinates.map(ring) }
    : { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map(ring)) };
}

/** Active alerts from a GeoMet weather-alerts response, one per alert and area. */
export function parseGeoMet(json, lat, lon) {
  const seen = new Set();
  return (json?.features || []).filter((f) => {
    const p = f.properties || {};
    const id = `${p.alert_name_en}|${p.feature_name_en}`;
    if (p.status_en === 'ended' || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 10).map((f) => {
    const p = f.properties;
    return {
      source: 'environment_canada',
      event: p.alert_short_name_en || p.alert_name_en,
      severity: p.alert_type === 'warning' ? 'Severe' : p.alert_type === 'watch' ? 'Moderate' : 'Minor',
      colour: p.risk_colour_en || 'yellow',
      area: p.feature_name_en || null,
      headline: `${p.alert_name_en} in effect for ${p.feature_name_en}`,
      description: p.alert_text_en?.slice(0, 300) || null,
      expires: p.event_end_datetime || p.expiration_datetime || null,
      sent: p.publication_datetime || null,
      geometry: slimGeometry(f.geometry),
      lat,
      lon,
    };
  });
}

async function fetchEnvironmentCanada(lat, lon) {
  try {
    const d = 0.05;
    return parseGeoMet(await timedFetch(`${GEOMET}?f=json&limit=50&bbox=${lon - d},${lat - d},${lon + d},${lat + d}`, {}, 6000), lat, lon);
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
  const isCanada = +lat > 41 && +lon > -141 && +lon < -52;
  const [noaa, meteo, ec] = await Promise.all([
    fetchNoaa(+lat, +lon),
    fetchOpenMeteo(+lat, +lon),
    isCanada ? fetchEnvironmentCanada(+lat, +lon) : Promise.resolve([]),
  ]);
  const alerts = [...noaa, ...meteo, ...ec];
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
