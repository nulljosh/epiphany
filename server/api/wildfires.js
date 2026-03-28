import { applyCors } from './_cors.js';

const FIRMS_KEY = process.env.FIRMS_MAP_KEY || '';
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
    let fires;
    if (FIRMS_KEY) {
      fires = await fetchFIRMS(lat, lon, controller.signal);
    } else {
      fires = await fetchEONET(lat, lon, controller.signal);
    }
    clearTimeout(timer);

    const data = { fires, source: FIRMS_KEY ? 'VIIRS_SNPP_NRT' : 'NASA_EONET', count: fires.length };
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

// FIRMS API (requires FIRMS_MAP_KEY env var -- free at https://firms.modaps.eosdis.nasa.gov/api/area/)
async function fetchFIRMS(lat, lon, signal) {
  const delta = 5;
  const west = lon - delta, east = lon + delta;
  const south = lat - delta, north = lat + delta;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/${west},${south},${east},${north}/1`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`FIRMS ${r.status}`);
  return parseFIRMSCSV(await r.text(), lat, lon, delta);
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

function parseFIRMSCSV(text, centerLat, centerLon, delta) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const latIdx = header.indexOf('latitude');
  const lonIdx = header.indexOf('longitude');
  const confIdx = header.indexOf('confidence');
  const bi4 = header.indexOf('bright_ti4');
  const brightIdx = bi4 !== -1 ? bi4 : header.indexOf('brightness');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');

  if (latIdx === -1 || lonIdx === -1) return [];

  const fires = [];
  for (let i = 1; i < lines.length && fires.length < 200; i++) {
    const cols = lines[i].split(',');
    if (cols.length < Math.max(latIdx, lonIdx) + 1) continue;

    const fireLat = parseFloat(cols[latIdx]);
    const fireLon = parseFloat(cols[lonIdx]);
    if (isNaN(fireLat) || isNaN(fireLon)) continue;
    if (Math.abs(fireLat - centerLat) > delta || Math.abs(fireLon - centerLon) > delta) continue;

    fires.push({
      lat: fireLat,
      lon: fireLon,
      confidence: confIdx !== -1 ? cols[confIdx]?.trim() : null,
      brightness: brightIdx !== -1 ? parseFloat(cols[brightIdx]) || null : null,
      date: dateIdx !== -1 ? cols[dateIdx]?.trim() : null,
      time: timeIdx !== -1 ? cols[timeIdx]?.trim() : null,
    });
  }

  return fires;
}
