// Flights proxy — OpenSky Network (free, no auth)
// Returns live flight states within a bounding box
// Cache: 15s in-memory keyed by bbox (matches OpenSky rate limits)

const OPENSKY_BASE = 'https://opensky-network.org/api';

const cache = new Map(); // key: bbox string → { data, ts }
const CACHE_TTL = 60_000; // 60 seconds (reduces OpenSky rate limit pressure)

function buildMeta(status, bbox, extra = {}) {
  return {
    status,
    bbox,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

function parseBbox(query) {
  const { lamin, lomin, lamax, lomax } = query;
  const nums = [lamin, lomin, lamax, lomax].map(Number);
  if (nums.some(isNaN)) return null;
  const [la1, lo1, la2, lo2] = nums;
  if (la1 >= la2 || lo1 >= lo2) return null;
  return { lamin: la1, lomin: lo1, lamax: la2, lomax: lo2 };
}

async function fetchOpenSky(bbox) {
  const params = new URLSearchParams({
    lamin: bbox.lamin,
    lomin: bbox.lomin,
    lamax: bbox.lamax,
    lomax: bbox.lomax,
  });
  try {
    const headers = { 'Accept': 'application/json' };
    const user = process.env.OPENSKY_USERNAME;
    const pass = process.env.OPENSKY_PASSWORD;
    if (user && pass) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    }
    const res = await fetch(`${OPENSKY_BASE}/states/all?${params}`, {
      signal: AbortSignal.timeout(8000),
      headers,
    });
    if (!res.ok) throw new Error(`OpenSky ${res.status}`);
    const json = await res.json();

    const states = (json.states ?? []).map(s => ({
      icao24:    s[0],
      callsign:  (s[1] ?? '').trim(),
      origin:    s[2],
      lastSeen:  s[4],
      lon:       s[5],
      lat:       s[6],
      altitude:  s[7] ? Math.round(s[7] * 3.28084) : null, // metres → feet
      onGround:  s[8],
      velocity:  s[9] ? Math.round(s[9] * 1.94384) : null, // m/s → knots
      heading:   s[10] ? Math.round(s[10]) : null,
      vertRate:  s[11],
    })).filter(f => f.lat !== null && f.lon !== null && !f.onGround);

    return {
      source: 'opensky',
      states,
      count: states.length,
      meta: buildMeta('live', bbox),
    };
  } catch (err) {
    throw err;
  }
}


function generateEstimatedFlights(bbox) {
  const latSpan = bbox.lamax - bbox.lamin;
  const lonSpan = bbox.lomax - bbox.lomin;
  const flights = [];
  // Generate 8-15 estimated flights scattered across the bbox
  const count = 8 + Math.floor(Math.random() * 8);
  const airlines = ['UAL', 'DAL', 'AAL', 'SWA', 'WJA', 'ACA', 'BAW', 'DLH', 'AFR', 'JBU'];
  for (let i = 0; i < count; i++) {
    const lat = bbox.lamin + Math.random() * latSpan;
    const lon = bbox.lomin + Math.random() * lonSpan;
    const heading = Math.round(Math.random() * 360);
    const altitude = 15000 + Math.round(Math.random() * 25000);
    const velocity = 200 + Math.round(Math.random() * 300);
    const airline = airlines[i % airlines.length];
    const flightNum = 100 + Math.floor(Math.random() * 900);
    flights.push({
      icao24: `est${i.toString(16).padStart(4, '0')}`,
      callsign: `${airline}${flightNum}`,
      origin: null,
      lastSeen: Math.floor(Date.now() / 1000),
      lon,
      lat,
      altitude,
      onGround: false,
      velocity,
      heading,
      vertRate: null,
      estimated: true,
    });
  }
  return flights;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bbox = parseBbox(req.query);
  if (!bbox) {
    return res.status(400).json({ error: 'Invalid bbox: provide lamin, lomin, lamax, lomax' });
  }

  const cacheKey = `${bbox.lamin},${bbox.lomin},${bbox.lamax},${bbox.lomax}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);

  // Serve from 15s in-memory cache when possible
  if (hit && now - hit.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({
      ...hit.data,
      meta: buildMeta('cache', bbox, { cached: true, cacheAgeMs: now - hit.ts }),
    });
  }

  let result;
  try {
    result = await fetchOpenSky(bbox);
  } catch (openSkyErr) {
    console.error('OpenSky failed:', openSkyErr.message);
    if (hit) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({
        ...hit.data,
        meta: buildMeta('stale', bbox, {
          cached: true,
          degraded: true,
          cacheAgeMs: now - hit.ts,
          warning: 'OpenSky unavailable; serving stale flight data',
        }),
      });
    }
    return res.status(200).json({
      source: 'unavailable',
      states: [],
      count: 0,
      meta: buildMeta('degraded', bbox, {
        degraded: true,
        warning: 'OpenSky unavailable and no cached flight data',
      }),
    });
  }

  cache.set(cacheKey, { data: result, ts: now });
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Cache', 'MISS');
  return res.status(200).json(result);
}
