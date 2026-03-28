import { applyCors } from './_cors.js';

// NASA FIRMS (Fire Information for Resource Management System)
// Free, no API key needed for CSV endpoint. Global active fire data.
const FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const MAP_KEY = 'DEMO'; // Public demo key works for low-volume requests
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

  // Bounding box: ~500km radius
  const delta = 5;
  const west = lon - delta;
  const east = lon + delta;
  const south = lat - delta;
  const north = lat + delta;
  const cacheKey = `${Math.round(lat)}:${Math.round(lon)}`;

  if (cache.data && cache.key === cacheKey && (Date.now() - cache.ts) < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(200).json(cache.data);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    // Use VIIRS_SNPP_NRT source, last 24 hours
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_SNPP_NRT/${west},${south},${east},${north}/1`;
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!r.ok) {
      // Fallback: try the open data CSV
      const fallbackUrl = `https://firms.modaps.eosdis.nasa.gov/active_fire/c6/text/MODIS_C6_Global_24h.csv`;
      const fr = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
      if (!fr.ok) throw new Error(`FIRMS ${r.status}`);
      const text = await fr.text();
      const fires = parseCSV(text, lat, lon, delta);
      const data = { fires, source: 'MODIS_fallback', count: fires.length };
      cache = { ts: Date.now(), data, key: cacheKey };
      res.setHeader('Cache-Control', 's-maxage=1800');
      return res.status(200).json(data);
    }

    const text = await r.text();
    const fires = parseCSV(text, lat, lon, delta);
    const data = { fires, source: 'VIIRS_SNPP_NRT', count: fires.length };
    cache = { ts: Date.now(), data, key: cacheKey };
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timer);
    console.error('Wildfires API error:', err.message);
    if (cache.data) return res.status(200).json(cache.data);
    return res.status(502).json({ error: 'Failed to fetch wildfire data' });
  }
}

function parseCSV(text, centerLat, centerLon, delta) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const latIdx = header.indexOf('latitude');
  const lonIdx = header.indexOf('longitude');
  const confIdx = header.indexOf('confidence');
  const brightIdx = header.indexOf('bright_ti4') !== -1 ? header.indexOf('bright_ti4') : header.indexOf('brightness');
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
