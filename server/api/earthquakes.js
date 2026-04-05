// USGS Earthquake Feed — M2.5+ past 24h (free, no auth, global)
// Accepts optional lat, lon, radius (km) query params to filter by distance
const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_RADIUS_KM = 500;
let cache = null;

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userLat = parseFloat(req.query.lat);
  const userLon = parseFloat(req.query.lon);
  const radiusKm = parseFloat(req.query.radius) || DEFAULT_RADIUS_KM;
  const hasLocation = !isNaN(userLat) && !isNaN(userLon);

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    const filtered = hasLocation
      ? cache.data.earthquakes.filter(eq => haversineKm(userLat, userLon, eq.lat, eq.lon) <= radiusKm)
      : cache.data.earthquakes;
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      earthquakes: filtered,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cache.ts, radiusKm: hasLocation ? radiusKm : null }),
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(USGS_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`USGS ${r.status}`);
    const json = await r.json();
    const allEarthquakes = (json.features || []).map(f => ({
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
    }));
    cache = { ts: Date.now(), data: { earthquakes: allEarthquakes } };
    const filtered = hasLocation
      ? allEarthquakes.filter(eq => haversineKm(userLat, userLon, eq.lat, eq.lon) <= radiusKm)
      : allEarthquakes;
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      earthquakes: filtered,
      meta: buildMeta('live', { radiusKm: hasLocation ? radiusKm : null }),
    });
  } catch (err) {
    clearTimeout(timer);
    console.warn('USGS error:', err.message);
    if (cache) {
      const filtered = hasLocation
        ? cache.data.earthquakes.filter(eq => haversineKm(userLat, userLon, eq.lat, eq.lon) <= radiusKm)
        : cache.data.earthquakes;
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({
        earthquakes: filtered,
        meta: buildMeta('stale', {
          cached: true,
          degraded: true,
          cacheAgeMs: Date.now() - cache.ts,
          warning: 'USGS unavailable; serving stale cached earthquakes',
        }),
      });
    }
    return res.status(502).json({
      error: 'USGS feed unavailable',
      earthquakes: [],
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'USGS feed unavailable and no cached earthquakes are available',
      }),
    });
  }
}
