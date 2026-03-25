// Road incidents from OpenStreetMap Overpass API (free, no auth)
// Returns construction zones, road works, emergency services, police stations within bbox
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

async function fetchIncidents(bbox) {
  const key = `${bbox.lamin},${bbox.lomin},${bbox.lamax},${bbox.lomax}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { incidents: cached.data, state: 'cache', cacheAgeMs: Date.now() - cached.ts };
  }

  const { lamin, lomin, lamax, lomax } = bbox;
  const query = `[out:json][timeout:10];(way["highway"="construction"](${lamin},${lomin},${lamax},${lomax});node["highway"="construction"](${lamin},${lomin},${lamax},${lomax});node["highway"="road_works"](${lamin},${lomin},${lamax},${lomax});node["emergency"](${lamin},${lomin},${lamax},${lomax});node["amenity"="police"](${lamin},${lomin},${lamax},${lomax}););out center 20;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = await res.json();
    const junkNames = new Set(['no', 'yes', 'none', 'null', 'n/a', '']);
    const data = (json.elements || [])
      .map(el => {
        const rawName = el.tags?.name || el.tags?.description || null;
        const name = rawName && !junkNames.has(rawName.toLowerCase().trim()) ? rawName : null;
        return {
          type: el.tags?.highway || el.tags?.emergency || el.tags?.amenity || 'incident',
          lat: el.center?.lat ?? el.lat,
          lon: el.center?.lon ?? el.lon,
          description: name,
        };
      })
      .filter(e => e.lat != null && e.lon != null);
    cache.set(key, { ts: Date.now(), data });
    return { incidents: data, state: 'live' };
  } catch (err) {
    clearTimeout(timer);
    console.warn('Overpass error:', err.message);
    if (cached) {
      return {
        incidents: cached.data,
        state: 'stale',
        cacheAgeMs: Date.now() - cached.ts,
      };
    }
    return { incidents: [], state: 'degraded' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lamin, lomin, lamax, lomax, lat, lon } = req.query;
  let bbox;
  if (lamin !== undefined) {
    bbox = { lamin: +lamin, lomin: +lomin, lamax: +lamax, lomax: +lomax };
  } else if (lat && lon) {
    const d = 0.15;
    bbox = { lamin: +lat - d, lomin: +lon - d, lamax: +lat + d, lomax: +lon + d };
  } else {
    return res.status(400).json({ error: 'Provide lat/lon or bbox params' });
  }
  let result = await fetchIncidents(bbox);
  if (result.incidents.length === 0 && lat && lon) {
    const dWide = 0.5;
    const wideBbox = { lamin: +lat - dWide, lomin: +lon - dWide, lamax: +lat + dWide, lomax: +lon + dWide };
    result = await fetchIncidents(wideBbox);
  }
  res.setHeader('Cache-Control', 'public, max-age=600');
  return res.status(200).json({
    incidents: result.incidents,
    meta: buildMeta(result.state, result.state === 'degraded'
      ? { degraded: true, warning: 'Overpass unavailable and no cached incident data is available' }
      : result.state === 'stale'
        ? {
            cached: true,
            degraded: true,
            cacheAgeMs: result.cacheAgeMs,
            warning: 'Overpass unavailable; serving stale cached incidents',
          }
        : result.state === 'cache'
          ? { cached: true, cacheAgeMs: result.cacheAgeMs }
          : {}),
  });
}
