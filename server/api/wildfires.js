import { applyCors } from './_cors.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 min

let cache = { ts: 0, data: null, key: '' };

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon required' });
  }

  const cacheKey = `${Math.round(lat)}:${Math.round(lon)}`;
  if (cache.data && cache.key === cacheKey && (Date.now() - cache.ts) < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(200).json(cache.data);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const fires = await fetchEONET(lat, lon, controller.signal);
    clearTimeout(timer);

    const data = { fires, source: 'NASA_EONET', count: fires.length };
    cache = { ts: Date.now(), data, key: cacheKey };
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timer);
    console.error('Wildfires API error:', err.message);
    if (cache.data) return res.status(200).json(cache.data);
    return res.status(502).json({ error: 'Failed to fetch wildfire data', fires: [] });
  }
}

// NASA EONET (free, no key required)
async function fetchEONET(lat, lon, signal) {
  const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&days=7&limit=200';
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`EONET ${r.status}`);
  const data = await r.json();
  const delta = 5;
  return (data.events || []).flatMap(event => {
    const geom = event.geometry || [];
    return geom
      .filter(g => g.type === 'Point' && Array.isArray(g.coordinates))
      .filter(g => Math.abs(g.coordinates[1] - lat) <= delta && Math.abs(g.coordinates[0] - lon) <= delta)
      .map(g => ({
        lat: g.coordinates[1],
        lon: g.coordinates[0],
        confidence: null,
        brightness: null,
        date: g.date ? g.date.split('T')[0] : null,
        time: g.date ? g.date.split('T')[1]?.replace('Z', '') : null,
        title: event.title,
      }));
  }).slice(0, 200);
}
