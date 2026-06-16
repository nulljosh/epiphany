// Air quality readings from OpenAQ v2 (free, no auth required)
const OPENAQ_URL = 'https://api.openaq.org/v2/latest';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();

async function fetchAQI(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const url = `${OPENAQ_URL}?coordinates=${lat},${lon}&radius=30000&limit=10&parameter=pm25&order_by=lastUpdated&sort=desc`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OpenAQ ${res.status}`);
    const json = await res.json();

    const readings = (json.results || []).map((loc) => {
      const pm25 = (loc.measurements || []).find(m => m.parameter === 'pm25');
      if (!pm25) return null;
      const aqi = pm25ToAQI(pm25.value || 0);
      return {
        id: loc.id,
        lat: loc.coordinates?.latitude,
        lon: loc.coordinates?.longitude,
        city: loc.city || loc.location || 'Station',
        parameter: 'PM2.5',
        value: Math.round(pm25.value * 10) / 10,
        unit: pm25.unit || 'µg/m³',
        aqi,
        lastUpdated: pm25.lastUpdated,
      };
    }).filter(r => r && r.lat != null && r.lon != null);

    cache.set(key, { ts: Date.now(), data: readings });
    return readings;
  } catch (err) {
    clearTimeout(timer);
    console.warn('[aqi] OpenAQ fetch failed:', err.message);
    if (cached) return cached.data;
    return [];
  }
}

// EPA standard PM2.5 -> AQI conversion
function pm25ToAQI(pm25) {
  const breakpoints = [
    [0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ];
  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (pm25 >= cLow && pm25 <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (pm25 - cLow) + iLow);
    }
  }
  return pm25 > 500 ? 500 : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  const readings = await fetchAQI(parseFloat(lat), parseFloat(lon));
  res.setHeader('Cache-Control', 'public, max-age=600');
  return res.status(200).json({ readings, count: readings.length });
}
