// GDELT Project — global news events, geocoded, real-time 15min updates (free, no auth)
const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

// ISO2 country code → [lat, lon] centroid for map placement
const COUNTRY_CENTROIDS = {
  US:[37.1,-95.7],CA:[56.1,-106.3],GB:[55.4,-3.4],DE:[51.2,10.4],FR:[46.2,2.2],
  IT:[41.9,12.6],ES:[40.5,-3.7],RU:[61.5,105.3],CN:[35.9,104.2],JP:[36.2,138.3],
  IN:[20.6,79.0],BR:[14.2,-51.9],AU:[-25.3,133.8],MX:[23.6,-102.6],KR:[35.9,127.8],
  ZA:[-30.6,22.9],EG:[26.8,30.8],NG:[9.1,8.7],AR:[-38.4,-63.6],UA:[48.4,31.2],
  TR:[38.9,35.2],SA:[24.0,45.0],IR:[32.4,53.7],IL:[31.0,34.9],PK:[30.4,69.3],
  AF:[33.9,67.7],IQ:[33.2,43.7],SY:[35.0,38.0],KP:[40.3,127.5],LY:[26.3,17.2],
  VE:[6.4,-66.6],CO:[4.6,-74.1],CL:[-35.7,-71.5],PH:[12.9,121.8],ID:[-0.8,113.9],
  TH:[15.9,100.9],VN:[14.1,108.3],SE:[60.1,18.6],NO:[60.5,8.5],PL:[51.9,19.1],
  NL:[52.1,5.3],BE:[50.5,4.5],CH:[46.8,8.2],AT:[47.5,14.6],PT:[39.4,-8.2],
  GR:[39.1,21.8],HU:[47.2,19.5],RO:[45.9,25.0],CZ:[49.8,15.5],NZ:[-40.9,174.9],
};

function countryCoords(code) {
  if (!code) return null;
  return COUNTRY_CENTROIDS[code.toUpperCase()] || null;
}
const CACHE_TTL = 5 * 60 * 1000;
let cache = null;

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  // Use location-specific cache key
  const cacheKey = (!isNaN(lat) && !isNaN(lon)) ? `${lat.toFixed(1)},${lon.toFixed(1)}` : 'global';

  if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      ...cache.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cache.ts }),
    });
  }

  // Make GDELT query location-aware when coordinates provided
  let query;
  if (!isNaN(lat) && !isNaN(lon)) {
    query = encodeURIComponent(`sourcelat:${lat.toFixed(1)} sourcelong:${lon.toFixed(1)} news OR politics OR economy OR technology OR health OR environment OR conflict OR disaster`);
  } else {
    query = encodeURIComponent('world OR breaking OR politics OR economy OR technology OR conflict OR disaster');
  }
  const url = `${GDELT_BASE}?query=${query}&mode=artlist&maxrecords=50&format=json&sort=datedesc`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`GDELT ${r.status}`);
    const json = await r.json();
    const events = (json.articles || []).slice(0, 25).map(a => {
      const coords = countryCoords(a.sourcecountry);
      return {
        title: a.title,
        url: a.url,
        domain: a.domain,
        date: a.seendate,
        country: a.sourcecountry,
        ...(coords ? { lat: coords[0], lon: coords[1] } : {}),
      };
    });
    const data = {
      events,
      meta: buildMeta('live'),
    };
    cache = { ts: Date.now(), data, key: cacheKey };
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timer);
    console.error('GDELT error:', err.message);
    if (cache && cache.key === cacheKey) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({
        ...cache.data,
        meta: buildMeta('stale', {
          cached: true,
          degraded: true,
          cacheAgeMs: Date.now() - cache.ts,
          warning: 'GDELT unavailable; serving stale cached events',
        }),
      });
    }
    return res.status(502).json({
      error: 'GDELT unavailable',
      events: [],
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'GDELT unavailable and no cached events are available',
      }),
    });
  }
}
