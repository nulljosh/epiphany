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
      { headers: { 'User-Agent': 'monica-intelligence/1.0 (contact@heyitsmejosh.com)' } }
    );
    return (json.features || []).slice(0, 5).map(f => ({
      source: 'noaa',
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      expires: f.properties.expires,
      description: f.properties.description?.slice(0, 300) || null,
      lat,
      lon,
    }));
  } catch {
    return [];
  }
}

// Environment Canada alerts via weather.gc.ca RSS feeds
// EC organizes alerts by region code; we look up the nearest city code
const EC_REGION_CODES = {
  // BC major regions
  'bc-vancouver': 'bc-74',
  'bc-surrey': 'bc-74',
  'bc-langley': 'bc-74',
  'bc-burnaby': 'bc-74',
  'bc-richmond': 'bc-74',
  'bc-victoria': 'bc-85',
  'bc-kelowna': 'bc-32',
  'bc-kamloops': 'bc-30',
  'bc-prince-george': 'bc-53',
  'bc-nanaimo': 'bc-44',
  // AB
  'ab-calgary': 'ab-52',
  'ab-edmonton': 'ab-50',
  // ON
  'on-toronto': 'on-143',
  'on-ottawa': 'on-118',
};

function getECRegionCode(lat, lon) {
  // Lower Mainland BC (Vancouver, Surrey, Langley, etc.)
  if (lat > 49.0 && lat < 49.5 && lon > -123.3 && lon < -122.3) return 'bc-74';
  // Victoria / Vancouver Island south
  if (lat > 48.3 && lat < 48.9 && lon > -124.0 && lon < -123.0) return 'bc-85';
  // Kelowna / Okanagan
  if (lat > 49.7 && lat < 50.1 && lon > -119.8 && lon < -119.2) return 'bc-32';
  // Kamloops
  if (lat > 50.5 && lat < 51.0 && lon > -120.8 && lon < -120.0) return 'bc-30';
  // Calgary
  if (lat > 50.8 && lat < 51.3 && lon > -114.4 && lon < -113.8) return 'ab-52';
  // Edmonton
  if (lat > 53.3 && lat < 53.8 && lon > -113.8 && lon < -113.2) return 'ab-50';
  // Toronto / GTA
  if (lat > 43.4 && lat < 44.0 && lon > -79.8 && lon < -79.0) return 'on-143';
  // Fallback: use province-level default
  const prov = getCanadianProvince(lat, lon);
  if (prov === 'bc') return 'bc-74';
  if (prov === 'ab') return 'ab-52';
  if (prov === 'on') return 'on-143';
  return null;
}

async function fetchEnvironmentCanada(lat, lon) {
  const regionCode = getECRegionCode(lat, lon);
  if (!regionCode) return [];

  const alerts = [];
  try {
    const rssUrl = `https://weather.gc.ca/rss/warning/${regionCode}_e.xml`;
    const rssText = await timedFetchText(rssUrl, 6000);
    if (!rssText) return [];

    const entries = rssText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const entry of entries.slice(0, 10)) {
      const titleMatch = entry.match(/<title[^>]*>(.*?)<\/title>/);
      const summaryMatch = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
      const updatedMatch = entry.match(/<updated>(.*?)<\/updated>/);
      const title = titleMatch?.[1]?.trim();
      if (!title || title.includes('No watches or warnings')) continue;

      const summary = summaryMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || null;

      alerts.push({
        source: 'environment_canada',
        event: title,
        severity: title.toLowerCase().includes('warning') ? 'Severe'
          : title.toLowerCase().includes('watch') ? 'Moderate'
          : 'Minor',
        headline: summary || title,
        description: summary?.slice(0, 300) || null,
        expires: null,
        updated: updatedMatch?.[1] || null,
        lat,
        lon,
      });
    }
  } catch { /* EC unavailable */ }
  return alerts;
}

function getCanadianProvince(lat, lon) {
  if (lat < 41 || lat > 84) return null;
  if (lon > -53 && lon < -52) return 'nl';
  if (lon >= -68 && lon < -59) return 'ns';
  if (lon >= -70 && lon < -63 && lat < 48) return 'nb';
  if (lon >= -65 && lon < -61 && lat > 45 && lat < 48) return 'pe';
  if (lon >= -80 && lon < -57 && lat > 45) return 'qc';
  if (lon >= -95 && lon < -74) return 'on';
  if (lon >= -102 && lon < -88) return 'mb';
  if (lon >= -110 && lon < -101) return 'sk';
  if (lon >= -120 && lon < -110) return 'ab';
  if (lon >= -139 && lon < -114 && lat < 60) return 'bc';
  if (lon >= -141 && lon < -114 && lat >= 60) return 'yt';
  if (lon >= -137 && lon < -102 && lat >= 60) return 'nt';
  if (lat >= 60 && lon < -60) return 'nu';
  return null;
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
