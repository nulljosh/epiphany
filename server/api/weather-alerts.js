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

// Environment Canada alerts via CAP Atom feed (Canadian locations)
async function fetchEnvironmentCanada(lat, lon) {
  try {
    // EC provides province-level CAP feeds; determine province from longitude
    const province = getCanadianProvince(lat, lon);
    if (!province) return [];

    const url = `https://dd.weather.gc.ca/alerts/cap/${province}/index.json`;
    const json = await timedFetch(url, {}, 6000).catch(() => null);

    if (!json) {
      // Fallback: use the ATOM battleboard feed
      return await fetchECAtom(lat, lon);
    }

    // index.json returns list of CAP file paths -- too heavy to parse all.
    // Use the ATOM RSS feed instead for a summary.
    return await fetchECAtom(lat, lon);
  } catch {
    return [];
  }
}

async function fetchECAtom(lat, lon) {
  try {
    // Use the weather.gc.ca RSS warnings page -- returns XML
    const cityUrl = `https://weather.gc.ca/warnings/index_e.html`;
    // Better: use the Open-Meteo alerts endpoint which aggregates EC data
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code&timezone=auto&forecast_days=1`;
    const json = await timedFetch(url, {}, 6000);

    // Also try the EC alert RSS for the nearest city
    const rssUrl = `https://weather.gc.ca/rss/warning/bc-74_e.xml`;
    const rssText = await timedFetch(rssUrl, {}, 6000)
      .then(r => { throw new Error('json endpoint'); })
      .catch(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
          const res = await fetch(rssUrl, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) return '';
          return res.text();
        } catch {
          clearTimeout(timer);
          return '';
        }
      });

    const alerts = [];
    if (rssText) {
      const entries = rssText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      for (const entry of entries.slice(0, 10)) {
        const titleMatch = entry.match(/<title[^>]*>(.*?)<\/title>/);
        const summaryMatch = entry.match(/<summary[^>]*>(.*?)<\/summary>/s);
        const updatedMatch = entry.match(/<updated>(.*?)<\/updated>/);
        const title = titleMatch?.[1]?.trim();
        if (!title || title.includes('No watches or warnings')) continue;

        alerts.push({
          source: 'environment_canada',
          event: title,
          severity: title.toLowerCase().includes('warning') ? 'Severe'
            : title.toLowerCase().includes('watch') ? 'Moderate'
            : 'Minor',
          headline: summaryMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || title,
          expires: null,
          lat,
          lon,
        });
      }
    }
    return alerts;
  } catch {
    return [];
  }
}

function getCanadianProvince(lat, lon) {
  // Rough province detection from coordinates
  if (lat < 41 || lat > 84) return null; // not Canada
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
