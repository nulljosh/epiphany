// Flights proxy — live ADS-B positions within a bounding box.
//
// Sources are readsb-style point+radius APIs tried in order; the first that
// answers wins. OpenSky is deliberately absent: it blocks Vercel and Cloudflare
// egress (confirmed 2026-06-12, relay tried and still 522s). airplanes.live
// 403s until you email them for access. adsb.lol and adsb.fi are free,
// no-auth, and not datacenter-blocked.
// ponytail: plain ordered failover like _overpass.js, no health tracking —
// add that only if the primary starts costing a visible delay most requests.
const MAX_LAT_SPAN = 2.0;
const MAX_LON_SPAN = 2.0;
const MIN_ALTITUDE_FT = 500;
const SOURCE_TIMEOUT_MS = 4000; // client aborts at 6s; two sources must fit

export const SOURCES = [
  { name: 'adsb.lol', url: (lat, lon, nm) => `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${nm}` },
  { name: 'adsb.fi',  url: (lat, lon, nm) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${nm}` },
];

const cache = new Map(); // key: bbox string → { data, ts }
const CACHE_TTL = 60_000;

function buildMeta(status, bbox, extra = {}) {
  return { status, bbox, updatedAt: new Date().toISOString(), ...extra };
}

export function parseBbox(query = {}) {
  const { lamin, lomin, lamax, lomax } = query;
  const nums = [lamin, lomin, lamax, lomax].map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [la1, lo1, la2, lo2] = nums;
  if (la1 >= la2 || lo1 >= lo2) return null;
  if (la1 < -90 || la2 > 90 || lo1 < -180 || lo2 > 180) return null;
  if (la2 - la1 > MAX_LAT_SPAN || lo2 - lo1 > MAX_LON_SPAN) return null;
  return { lamin: la1, lomin: lo1, lamax: la2, lomax: lo2 };
}

// Both sources emit readsb aircraft records (adsb.lol under `ac`, adsb.fi under
// `aircraft`). The API is point+radius, so we query the bbox's circumscribed
// circle and re-filter to the exact bbox.
export function normalize(json, bbox) {
  const raw = json?.ac ?? json?.aircraft ?? [];
  return raw.map((a) => ({
    icao24:   a.hex,
    callsign: (a.flight ?? '').trim(),
    origin:   null,
    lastSeen: null,
    lon:      a.lon,
    lat:      a.lat,
    altitude: typeof a.alt_baro === 'number' ? Math.round(a.alt_baro) : null,
    onGround: a.alt_baro === 'ground',
    velocity: a.gs != null ? Math.round(a.gs) : null,
    heading:  a.track != null ? Math.round(a.track) : null,
    registration: a.r ?? null,
    aircraftType: a.t ?? null,
    vertRate: a.baro_rate ?? null,
  })).filter((f) =>
    typeof f.lat === 'number' && typeof f.lon === 'number' &&
    !f.onGround &&
    (f.altitude === null || f.altitude >= MIN_ALTITUDE_FT) &&
    f.lat >= bbox.lamin && f.lat <= bbox.lamax &&
    f.lon >= bbox.lomin && f.lon <= bbox.lomax
  );
}

export function radiusQuery(bbox) {
  const lat = (bbox.lamin + bbox.lamax) / 2;
  const lon = (bbox.lomin + bbox.lomax) / 2;
  const latNm = ((bbox.lamax - bbox.lamin) * 60) / 2;
  const lonNm = ((bbox.lomax - bbox.lomin) * 60 * Math.cos((lat * Math.PI) / 180)) / 2;
  const nm = Math.min(250, Math.max(10, Math.ceil(Math.sqrt(latNm ** 2 + lonNm ** 2))));
  return { lat: lat.toFixed(4), lon: lon.toFixed(4), nm };
}

async function fetchSource(source, bbox) {
  const { lat, lon, nm } = radiusQuery(bbox);
  const res = await fetch(source.url(lat, lon, nm), {
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    headers: { Accept: 'application/json', 'User-Agent': 'epiphany.heyitsmejosh.com flights layer' },
  });
  if (!res.ok) throw new Error(`${source.name} ${res.status}`);
  return normalize(await res.json(), bbox);
}

// Try each source in order; resolve with the first that answers.
// Throws with every failure joined if none do.
export async function fetchFlights(bbox, sources = SOURCES) {
  const failures = [];
  for (const source of sources) {
    try {
      const states = await fetchSource(source, bbox);
      return { source: source.name, states, count: states.length, noFlights: states.length === 0, meta: buildMeta('live', bbox, failures.length ? { fallback: true, failures } : {}) };
    } catch (err) {
      failures.push(`${source.name}: ${err.message}`);
    }
  }
  throw new Error(failures.join('; '));
}

export function clearCache() { cache.clear(); }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const bbox = parseBbox(req.query);
  if (!bbox) {
    return res.status(400).json({
      error: `Invalid bbox: provide lamin, lomin, lamax, lomax (max span ${MAX_LAT_SPAN}° lat × ${MAX_LON_SPAN}° lon)`,
    });
  }

  const cacheKey = `${bbox.lamin},${bbox.lomin},${bbox.lamax},${bbox.lomax}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (hit && now - hit.ts < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ ...hit.data, meta: buildMeta('cache', bbox, { cached: true, cacheAgeMs: now - hit.ts }) });
  }

  try {
    const result = await fetchFlights(bbox);
    cache.set(cacheKey, { data: result, ts: now });
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Flights-Source', result.source);
    return res.status(200).json(result);
  } catch (err) {
    console.error('flights: all sources failed:', err.message);
    res.setHeader('X-Adsb-Error', err.message.slice(0, 200).replace(/[^\x20-\x7e]/g, '?'));
    if (hit) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({
        ...hit.data,
        meta: buildMeta('stale', bbox, { cached: true, degraded: true, cacheAgeMs: now - hit.ts, warning: 'Flight data sources unavailable; serving stale flight data' }),
      });
    }
    return res.status(200).json({
      source: 'none', states: [], count: 0, noFlights: true,
      meta: buildMeta('error', bbox, { degraded: true, warning: 'Flight data sources unavailable; no flight data', detail: err.message }),
    });
  }
}
