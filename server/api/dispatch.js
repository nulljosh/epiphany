// Emergency dispatch -- active police, fire, and EMS calls
// Sources:
//   1. PulsePoint (US fire/EMS, no auth required)
//   2. City open-data portals (US police calls-for-service, within 50km)
//   3. Google News RSS fallback (universal -- Canada/BC coverage)

const CACHE_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 8000;
const cache = new Map();

function buildMeta(status, extra = {}) {
  return { status, updatedAt: new Date().toISOString(), ...extra };
}

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchText(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PULSEPOINT_AGENCIES = [
  { id: 'SFFD',  name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { id: 'LAFD',  name: 'Los Angeles',   lat: 34.0522, lon: -118.2437 },
  { id: 'FDNY',  name: 'New York City', lat: 40.7128, lon: -74.0060  },
  { id: 'HFDON', name: 'Houston',       lat: 29.7604, lon: -95.3698  },
  { id: 'CFDIL', name: 'Chicago',       lat: 41.8781, lon: -87.6298  },
  { id: 'SEAFD', name: 'Seattle',       lat: 47.6062, lon: -122.3321 },
  { id: 'PFIRE', name: 'Portland',      lat: 45.5155, lon: -122.6789 },
  { id: 'AFD',   name: 'Austin',        lat: 30.2672, lon: -97.7431  },
  { id: 'DFD',   name: 'Denver',        lat: 39.7392, lon: -104.9903 },
];

async function fetchPulsePoint(agency) {
  const data = await fetchWithTimeout(
    `https://web.pulsepoint.org/DB/giba.php?agency_id=${agency.id}`
  );
  const active = data?.incidents?.active || data?.active || [];
  return active.map(inc => {
    const callType = (inc.CallType || '').toLowerCase();
    const type = callType.includes('medical') || callType.includes('ems') || callType.includes('ambulance') || callType.includes('cardiac') || callType.includes('breathing') ? 'ems' : 'fire';
    return {
      lat: inc.Latitude ? parseFloat(inc.Latitude) : agency.lat,
      lon: inc.Longitude ? parseFloat(inc.Longitude) : agency.lon,
      type,
      title: inc.CallType || 'Active Response',
      address: inc.FullDisplayAddress || inc.Address || null,
      timestamp: inc.ReceivedDateTime || new Date().toISOString(),
      severity: type === 'ems' ? 'critical' : 'elevated',
      source: `PulsePoint (${agency.name})`,
    };
  });
}

const US_POLICE_PORTALS = [
  {
    lat: 37.7749, lon: -122.4194,
    fetch: async (lat, lon) => {
      const data = await fetchWithTimeout(
        `https://data.sfgov.org/resource/gnap-fj3t.json?$limit=30&$order=received_datetime DESC`
      );
      return (Array.isArray(data) ? data : []).map(i => ({
        lat: i.intersection_point?.coordinates?.[1] ?? lat + (Math.random() - 0.5) * 0.02,
        lon: i.intersection_point?.coordinates?.[0] ?? lon + (Math.random() - 0.5) * 0.02,
        type: 'police',
        title: i.call_type_final_desc || i.call_type_original_desc || 'Police Call',
        address: i.intersection_name || null,
        timestamp: i.received_datetime || new Date().toISOString(),
        severity: policeSeverity(i.call_type_final_desc || ''),
        source: 'SF Police',
      }));
    },
  },
  {
    lat: 40.7128, lon: -74.0060,
    fetch: async () => {
      const since = new Date(Date.now() - 3600000).toISOString();
      const data = await fetchWithTimeout(
        `https://data.cityofnewyork.us/resource/panh-965b.json?$limit=30&$order=incident_datetime DESC&$where=incident_datetime > '${since}'`
      );
      return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
        lat: parseFloat(i.latitude),
        lon: parseFloat(i.longitude),
        type: classifyNYC(i.incident_type_description),
        title: i.incident_type_description || 'Emergency Call',
        address: i.incident_address || null,
        timestamp: i.incident_datetime || new Date().toISOString(),
        severity: 'elevated',
        source: 'NYC 911',
      }));
    },
  },
  {
    lat: 41.8781, lon: -87.6298,
    fetch: async (lat, lon) => {
      const data = await fetchWithTimeout(
        `https://data.cityofchicago.org/resource/rfdj-hdgn.json?$where=within_circle(location,${lat},${lon},10000)&$limit=30&$order=time_of_initial_type_change DESC`
      );
      return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
        lat: parseFloat(i.latitude),
        lon: parseFloat(i.longitude),
        type: 'police',
        title: i.current_iucr_description || i.initial_type_description || 'Police Call',
        address: i.street_address || null,
        timestamp: i.time_of_initial_type_change || new Date().toISOString(),
        severity: policeSeverity(i.current_iucr_description || ''),
        source: 'Chicago Police',
      }));
    },
  },
  {
    lat: 47.6062, lon: -122.3321,
    fetch: async () => {
      const data = await fetchWithTimeout(
        `https://data.seattle.gov/resource/kzjm-xkqj.json?$limit=30&$order=datetime DESC`
      );
      return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
        lat: parseFloat(i.latitude),
        lon: parseFloat(i.longitude),
        type: classifySeattle(i.type),
        title: i.type || 'Emergency Response',
        address: i.address || null,
        timestamp: i.datetime || new Date().toISOString(),
        severity: 'elevated',
        source: 'Seattle Fire/EMS',
      }));
    },
  },
];

function classifyNYC(desc) {
  if (!desc) return 'ems';
  const d = desc.toLowerCase();
  if (d.includes('fire') || d.includes('smoke')) return 'fire';
  if (d.includes('medic') || d.includes('cardiac') || d.includes('unconscious') || d.includes('breathing')) return 'ems';
  return 'police';
}

function classifySeattle(type) {
  if (!type) return 'fire';
  const t = type.toLowerCase();
  if (t.includes('medic') || t.includes('aid') || t.includes('cardiac') || t.includes('breathing')) return 'ems';
  return 'fire';
}

function policeSeverity(desc) {
  const d = desc.toLowerCase();
  if (d.includes('shooting') || d.includes('stabbing') || d.includes('weapon') || d.includes('assault') || d.includes('robbery')) return 'critical';
  if (d.includes('burglary') || d.includes('theft') || d.includes('suspicious')) return 'elevated';
  return 'monitor';
}

async function reverseGeocode(lat, lon) {
  try {
    const data = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      5000
    );
    return data.address?.city || data.address?.town || data.address?.village || null;
  } catch {
    return null;
  }
}

async function fetchDispatchNews(lat, lon, cityName) {
  const calls = [];
  const query = encodeURIComponent(`${cityName} police fire ambulance paramedic emergency`);
  try {
    const rss = await fetchText(
      `https://news.google.com/rss/search?q=${query}&hl=en&gl=CA&ceid=CA:en`
    );
    const items = rss.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const item of items.slice(0, 12)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]>/);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const title = titleMatch ? titleMatch[1] : null;
      if (!title) continue;
      const lower = title.toLowerCase();
      const isEmergency = ['police', 'fire', 'ambulance', 'paramedic', 'rcmp', '911', 'rescue',
        'shooting', 'stabbing', 'structure fire', 'house fire', 'collision'].some(k => lower.includes(k));
      if (!isEmergency) continue;

      let type = 'police';
      if (lower.includes('fire') || lower.includes('blaze') || lower.includes('structure fire') || lower.includes('house fire')) type = 'fire';
      else if (lower.includes('ambulance') || lower.includes('paramedic') || lower.includes('medical') || lower.includes('overdose')) type = 'ems';

      calls.push({
        lat: lat + (Math.random() - 0.5) * 0.025,
        lon: lon + (Math.random() - 0.5) * 0.025,
        type,
        title: title.length > 80 ? title.slice(0, 77) + '...' : title,
        address: null,
        timestamp: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
        severity: type === 'ems' ? 'critical' : 'elevated',
        source: 'news_rss',
      });
    }
  } catch { /* news RSS unavailable */ }
  return calls;
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon required' });
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return res.status(200).json({
      calls: cached.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cached.ts }),
    });
  }

  try {
    const fetchers = [];

    for (const agency of PULSEPOINT_AGENCIES) {
      if (haversine(lat, lon, agency.lat, agency.lon) < 50) {
        fetchers.push(fetchPulsePoint(agency).catch(() => []));
      }
    }

    for (const portal of US_POLICE_PORTALS) {
      if (haversine(lat, lon, portal.lat, portal.lon) < 50) {
        fetchers.push(portal.fetch(lat, lon).catch(() => []));
      }
    }

    const cityName = await reverseGeocode(lat, lon);
    if (cityName) fetchers.push(fetchDispatchNews(lat, lon, cityName).catch(() => []));

    const results = await Promise.all(fetchers);
    const calls = results.flat().slice(0, 40);

    cache.set(cacheKey, { data: calls, ts: Date.now() });
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    const degraded = calls.length === 0;
    return res.status(200).json({
      calls,
      meta: buildMeta(degraded ? 'degraded' : 'live', degraded
        ? { degraded: true, warning: 'No dispatch feeds for this location' }
        : {}),
    });
  } catch (err) {
    console.error('Dispatch API error:', err);
    if (cached) {
      return res.status(200).json({
        calls: cached.data,
        meta: buildMeta('stale', { cached: true, degraded: true, cacheAgeMs: Date.now() - cached.ts }),
      });
    }
    return res.status(200).json({
      calls: [],
      meta: buildMeta('degraded', { degraded: true, warning: 'Dispatch providers failed' }),
    });
  }
}
