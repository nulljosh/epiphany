// Flights proxy — adsb.lol only.
// Returns live flight states within a bounding box
// Cache: 60s in-memory keyed by bbox
// OpenSky (the original fallback) blocks both Vercel (AWS) and Cloudflare
// egress IPs — confirmed dead end (a Cloudflare Worker relay was tried
// 2026-06-12 and still 522s, since OpenSky's own origin is behind Cloudflare
// and drops Worker subrequests). Keeping it as a fallback only added latency:
// the client's 8s fetch timeout would abort before the OAuth token fetch +
// states call (up to ~12s) ever returned, surfacing as "Flights temporarily
// unavailable" even with valid keys. Removed 2026-06-21 — adsb.lol (free,
// no auth, not datacenter-blocked) is the only source now.
const MAX_LAT_SPAN = 2.0;
const MAX_LON_SPAN = 2.0;
const MIN_ALTITUDE_FT = 500;

const cache = new Map(); // key: bbox string → { data, ts }
const CACHE_TTL = 60_000; // 60 seconds

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

  const latSpan = la2 - la1;
  const lonSpan = lo2 - lo1;
  if (latSpan > MAX_LAT_SPAN || lonSpan > MAX_LON_SPAN) return null;

  return { lamin: la1, lomin: lo1, lamax: la2, lomax: lo2 };
}

// adsb.lol serves the same ADS-B data with no auth and no datacenter blocking.
// API is point+radius, so approximate the bbox with its circumscribed circle
// and re-filter results to the exact bbox.
async function fetchAdsbLol(bbox) {
  const lat = (bbox.lamin + bbox.lamax) / 2;
  const lon = (bbox.lomin + bbox.lomax) / 2;
  const latNm = ((bbox.lamax - bbox.lamin) * 60) / 2;
  const lonNm = ((bbox.lomax - bbox.lomin) * 60 * Math.cos((lat * Math.PI) / 180)) / 2;
  const dist = Math.min(250, Math.max(10, Math.ceil(Math.sqrt(latNm ** 2 + lonNm ** 2))));

  const res = await fetch(`https://api.adsb.lol/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${dist}`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/json', 'User-Agent': 'epiphany.heyitsmejosh.com flights layer' },
  });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const json = await res.json();

  const states = (json.ac ?? []).map((a) => ({
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
    f.lat != null && f.lon != null &&
    !f.onGround &&
    (f.altitude === null || f.altitude >= MIN_ALTITUDE_FT) &&
    f.lat >= bbox.lamin && f.lat <= bbox.lamax &&
    f.lon >= bbox.lomin && f.lon <= bbox.lomax
  );

  return {
    source: 'adsb.lol',
    states,
    count: states.length,
    noFlights: states.length === 0,
    meta: buildMeta('live', bbox),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bbox = parseBbox(req.query);
  if (!bbox) {
    return res.status(400).json({
      error: `Invalid bbox: provide lamin, lomin, lamax, lomax (max span ${MAX_LAT_SPAN}° lat × ${MAX_LON_SPAN}° lon)`,
    });
  }

  const cacheKey = `${bbox.lamin},${bbox.lomin},${bbox.lamax},${bbox.lomax}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);

  if (hit && now - hit.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({
      ...hit.data,
      meta: buildMeta('cache', bbox, { cached: true, cacheAgeMs: now - hit.ts }),
    });
  }

  // OpenSky is confirmed unreachable from both Vercel and Cloudflare egress
  // (see header comment), so falling back to it just burns the client's
  // FETCH_TIMEOUT (8s) waiting on an OAuth token fetch + states call that
  // can never succeed in this deployment — that wait is what was surfacing
  // as "Flights temporarily unavailable" client-side even with valid keys.
  // Go straight to stale-cache/empty on adsb.lol failure instead.
  let result;
  try {
    result = await fetchAdsbLol(bbox);
  } catch (adsbErr) {
    console.error('adsb.lol failed:', adsbErr.message);
    res.setHeader('X-Adsb-Error', adsbErr.message.slice(0, 100).replace(/[^\x20-\x7e]/g, '?'));
    if (hit) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({
        ...hit.data,
        meta: buildMeta('stale', bbox, {
          cached: true,
          degraded: true,
          cacheAgeMs: now - hit.ts,
          warning: 'Flight data sources unavailable; serving stale flight data',
        }),
      });
    }
    // No cache, no fallback — return empty with error flag
    return res.status(200).json({
      source: 'none',
      states: [],
      count: 0,
      noFlights: true,
      meta: buildMeta('error', bbox, {
        degraded: true,
        warning: 'Flight data sources unavailable; no flight data',
        detail: `adsb.lol: ${adsbErr.message}`,
      }),
    });
  }

  cache.set(cacheKey, { data: result, ts: now });
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Cache', 'MISS');
  return res.status(200).json(result);
}
