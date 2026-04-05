// Road incidents + nearby infrastructure from OpenStreetMap Overpass API (free, no auth)
// Returns active incidents (construction, road works) separately from static infrastructure
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

function categorize(el) {
  const tags = el.tags || {};
  const highway = tags.highway;
  const emergency = tags.emergency;
  const amenity = tags.amenity;
  const barrier = tags.barrier;

  // Active incidents -- things that are temporary or in-progress
  if (highway === 'construction' || highway === 'road_works') {
    return { category: 'construction', type: highway };
  }
  if (tags.railway === 'construction') {
    return { category: 'construction', type: 'railway_construction' };
  }

  // Emergency services -- permanent but high-signal
  if (emergency === 'ambulance_station' || emergency === 'fire_station' || emergency === 'ses_station') {
    return { category: 'emergency_service', type: emergency };
  }
  if (amenity === 'fire_station') {
    return { category: 'emergency_service', type: 'fire_station' };
  }
  if (amenity === 'hospital') {
    return { category: 'emergency_service', type: 'hospital' };
  }

  // Enforcement
  if (amenity === 'police') {
    return { category: 'enforcement', type: 'police' };
  }

  // Barriers / checkpoints
  if (barrier === 'toll_booth' || barrier === 'border_control') {
    return { category: 'barrier', type: barrier };
  }

  // Low-signal infrastructure -- filter these out
  if (highway === 'speed_camera' || tags.traffic_calming) {
    return { category: 'low_signal', type: highway || 'traffic_calming' };
  }

  return { category: 'infrastructure', type: highway || emergency || amenity || 'unknown' };
}

function friendlyTitle(category, type, name) {
  if (name) return name;
  const titles = {
    construction: 'Construction',
    road_works: 'Road Works',
    railway_construction: 'Railway Construction',
    ambulance_station: 'Ambulance Station',
    fire_station: 'Fire Station',
    ses_station: 'Emergency Services',
    hospital: 'Hospital',
    police: 'Police Station',
    toll_booth: 'Toll Booth',
    border_control: 'Border Crossing',
  };
  return titles[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchIncidents(bbox) {
  const key = `${bbox.lamin},${bbox.lomin},${bbox.lamax},${bbox.lomax}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { data: cached.data, state: 'cache', cacheAgeMs: Date.now() - cached.ts };
  }

  const { lamin, lomin, lamax, lomax } = bbox;
  const bb = `${lamin},${lomin},${lamax},${lomax}`;
  const query = `[out:json][timeout:10];(` +
    `way["highway"="construction"](${bb});` +
    `node["highway"="construction"](${bb});` +
    `node["highway"="road_works"](${bb});` +
    `way["railway"="construction"](${bb});` +
    `node["railway"="construction"](${bb});` +
    `node["emergency"~"^(ambulance_station|fire_station|ses_station)$"](${bb});` +
    `node["amenity"="police"](${bb});` +
    `node["amenity"="fire_station"](${bb});` +
    `way["amenity"="fire_station"](${bb});` +
    `node["amenity"="hospital"](${bb});` +
    `way["amenity"="hospital"](${bb});` +
    `node["barrier"~"^(toll_booth|border_control)$"](${bb});` +
    `);out center 40;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = await res.json();
    const junkNames = new Set(['no', 'yes', 'none', 'null', 'n/a', '']);

    const incidents = [];
    const infrastructure = [];

    for (const el of (json.elements || [])) {
      const lat = el.center?.lat ?? el.lat;
      const lon = el.center?.lon ?? el.lon;
      if (lat == null || lon == null) continue;

      const { category, type } = categorize(el);
      if (category === 'low_signal') continue;

      const rawName = el.tags?.name || el.tags?.description || null;
      const name = rawName && !junkNames.has(rawName.toLowerCase().trim()) ? rawName : null;

      const item = {
        type,
        category,
        title: friendlyTitle(category, type, name),
        lat,
        lon,
        description: name,
      };

      if (category === 'construction') {
        incidents.push(item);
      } else {
        infrastructure.push(item);
      }
    }

    const data = {
      incidents: incidents.slice(0, 30),
      infrastructure: infrastructure.slice(0, 20),
    };
    cache.set(key, { ts: Date.now(), data });
    return { data, state: 'live' };
  } catch (err) {
    clearTimeout(timer);
    console.warn('Overpass error:', err.message);
    if (cached) {
      return {
        data: cached.data,
        state: 'stale',
        cacheAgeMs: Date.now() - cached.ts,
      };
    }
    return { data: { incidents: [], infrastructure: [] }, state: 'degraded' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lamin, lomin, lamax, lomax, lat, lon } = req.query;
  let bbox;
  if (lamin !== undefined) {
    bbox = { lamin: +lamin, lomin: +lomin, lamax: +lamax, lomax: +lomax };
  } else if (lat && lon) {
    const d = 0.3;
    bbox = { lamin: +lat - d, lomin: +lon - d, lamax: +lat + d, lomax: +lon + d };
  } else {
    return res.status(400).json({ error: 'Provide lat/lon or bbox params' });
  }
  let result = await fetchIncidents(bbox);
  const totalCount = result.data.incidents.length + result.data.infrastructure.length;
  if (totalCount === 0 && lat && lon) {
    const dWide = 1.0;
    const wideBbox = { lamin: +lat - dWide, lomin: +lon - dWide, lamax: +lat + dWide, lomax: +lon + dWide };
    result = await fetchIncidents(wideBbox);
  }
  res.setHeader('Cache-Control', 'public, max-age=600');

  // Backwards-compatible: flatten into single incidents array with category field
  const allIncidents = [...result.data.incidents, ...result.data.infrastructure];

  return res.status(200).json({
    incidents: allIncidents,
    meta: buildMeta(result.state, result.state === 'degraded'
      ? { degraded: true, warning: 'Overpass unavailable and no cached incident data is available' }
      : result.state === 'stale'
        ? {
            cached: true,
            degraded: true,
            cacheAgeMs: result.cacheAgeMs,
            warning: 'Overpass unavailable; serving stale cached incidents',
          }
        : result.state === 'cache'
          ? { cached: true, cacheAgeMs: result.cacheAgeMs }
          : {}),
  });
}
