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
    const [eonet, firms] = await Promise.all([
      fetchEONET(lat, lon, controller.signal).catch(() => []),
      fetchFIRMS(lat, lon, controller.signal).catch(() => []),
    ]);
    clearTimeout(timer);

    // Deduplicate: if an EONET fire is within 0.1 deg of a FIRMS hotspot, keep EONET (has title)
    const seen = new Set();
    for (const f of eonet) {
      seen.add(`${f.lat.toFixed(1)},${f.lon.toFixed(1)}`);
    }
    const uniqueFirms = firms.filter(f => !seen.has(`${f.lat.toFixed(1)},${f.lon.toFixed(1)}`));
    const fires = [...eonet, ...uniqueFirms];

    const sources = [...new Set(fires.map(f => f.source).filter(Boolean))];
    const data = { fires, sources, count: fires.length };
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

// NASA EONET -- named wildfire events (free, no key required)
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
        source: 'NASA_EONET',
      }));
  }).slice(0, 200);
}

// NASA FIRMS -- thermal hotspot detections (free, no key for CSV endpoint)
async function fetchFIRMS(lat, lon, signal) {
  const delta = 3;
  const west = lon - delta;
  const east = lon + delta;
  const south = lat - delta;
  const north = lat + delta;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/VIIRS_SNPP_NRT/${west},${south},${east},${north}/2`;

  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const text = await r.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const header = lines[0].split(',');
    const latIdx = header.indexOf('latitude');
    const lonIdx = header.indexOf('longitude');
    const confIdx = header.indexOf('confidence');
    const brtIdx = header.indexOf('bright_ti4');
    const dateIdx = header.indexOf('acq_date');
    const timeIdx = header.indexOf('acq_time');

    if (latIdx === -1 || lonIdx === -1) return [];

    return lines.slice(1, 201).map(line => {
      const cols = line.split(',');
      return {
        lat: parseFloat(cols[latIdx]),
        lon: parseFloat(cols[lonIdx]),
        confidence: cols[confIdx] || null,
        brightness: cols[brtIdx] ? parseFloat(cols[brtIdx]) : null,
        date: cols[dateIdx] || null,
        time: cols[timeIdx] || null,
        title: 'Thermal Hotspot',
        source: 'NASA_FIRMS',
      };
    }).filter(f => !isNaN(f.lat) && !isNaN(f.lon));
  } catch {
    return [];
  }
}
