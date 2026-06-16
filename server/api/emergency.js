// Real-time emergency services: police activity, fire/EMS dispatch
// Sources: Waze Live Map, PulsePoint (US fire/EMS), city CAD open data, news RSS fallback

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

async function fetchWithTimeout(url, ms = 7000, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Waze Live Map -- real-time crowd-sourced police, accidents, hazards, closures
async function fetchWazeAlerts(lamin, lomin, lamax, lomax) {
  const url = `https://www.waze.com/live-map/api/georss?top=${lamax}&bottom=${lamin}&left=${lomin}&right=${lomax}&env=row&types=alerts,traffic`;
  const data = await fetchWithTimeout(url, 6000, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Epiphany/1.0)', 'Accept': 'application/json' },
  });
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  return alerts
    .filter(a => a.location?.y && a.location?.x && (a.reliability ?? 0) >= 2)
    .map(a => {
      const type = (a.type || '').toLowerCase();
      const sub = (a.subtype || '').toLowerCase();
      return {
        lat: a.location.y,
        lng: a.location.x,
        type: 'emergency',
        category: type === 'police' ? 'police' : type === 'accident' ? 'accident' : type === 'hazard' ? 'hazard' : type === 'road_closed' ? 'road_closed' : 'alert',
        title: wazeTitle(type, sub),
        severity: type === 'accident' && sub.includes('major') ? 'high' : type === 'accident' ? 'medium' : 'low',
        timestamp: a.pubMillis ? new Date(a.pubMillis).toISOString() : new Date().toISOString(),
        source: 'waze',
      };
    });
}

function wazeTitle(type, sub) {
  const map = {
    police: 'Police Activity', police_visible: 'Police -- Visible', police_hiding: 'Speed Trap',
    accident: 'Accident', accident_minor: 'Minor Accident', accident_major: 'Major Accident',
    hazard: 'Road Hazard', hazard_on_road: 'Object on Road', hazard_on_shoulder: 'Shoulder Hazard',
    hazard_weather: 'Weather Hazard', road_closed: 'Road Closed',
    road_closed_construction: 'Road Closed -- Construction', road_closed_event: 'Road Closed -- Event',
  };
  return map[sub] || map[type] || (type || 'Alert').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// NYC FDNY fire incident dispatch (Socrata open data)
async function fetchNYCFire(lat, lon) {
  if (dist(lat, lon, 40.7128, -74.0060) > 60) return [];
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const data = await fetchWithTimeout(
    `https://data.cityofnewyork.us/resource/8m42-w767.json?$where=incident_datetime>'${since}'&$limit=20&$order=incident_datetime DESC`,
    6000
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude),
    type: 'emergency', category: 'fire',
    title: `Fire -- ${i.incident_classification_group || 'Incident'}`,
    severity: 'high',
    timestamp: i.incident_datetime || new Date().toISOString(),
    source: 'nyc_fire',
  }));
}

// SF Fire/EMS dispatch (Socrata)
async function fetchSFFire(lat, lon) {
  if (dist(lat, lon, 37.7749, -122.4194) > 60) return [];
  const data = await fetchWithTimeout(
    `https://data.sfgov.org/resource/nuek-vuh3.json?$where=within_circle(point,${lat},${lon},8000)&$limit=20&$order=entry_dttm DESC`,
    6000
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => {
    const grp = (i.call_type_group || '').toLowerCase();
    return {
      lat: parseFloat(i.latitude), lng: parseFloat(i.longitude),
      type: 'emergency', category: grp.includes('fire') ? 'fire' : 'ems',
      title: `${i.call_type_final_desc || i.call_type_group || 'Emergency'}`,
      severity: i.priority === '1' ? 'high' : 'medium',
      timestamp: i.entry_dttm || new Date().toISOString(),
      source: 'sf_fire',
    };
  });
}

// Chicago CFD fire/EMS dispatch (Socrata)
async function fetchChicagoFire(lat, lon) {
  if (dist(lat, lon, 41.8781, -87.6298) > 60) return [];
  const data = await fetchWithTimeout(
    `https://data.cityofchicago.org/resource/j3fp-2gp3.json?$where=within_circle(location,${lat},${lon},8000)&$limit=20&$order=entry_date_time DESC`,
    6000
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude),
    type: 'emergency', category: 'fire',
    title: i.type_description || 'Fire/EMS Incident',
    severity: 'high',
    timestamp: i.entry_date_time || new Date().toISOString(),
    source: 'chicago_fire',
  }));
}

// Austin/Travis County EMS dispatch (Socrata)
async function fetchAustinEMS(lat, lon) {
  if (dist(lat, lon, 30.2672, -97.7431) > 60) return [];
  const data = await fetchWithTimeout(
    `https://data.austintexas.gov/resource/fdj4-gpfu.json?$limit=20&$order=incident_start_date_time DESC`,
    6000
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude),
    type: 'emergency', category: 'ems',
    title: i.incident_type || 'EMS Incident',
    severity: 'medium',
    timestamp: i.incident_start_date_time || new Date().toISOString(),
    source: 'austin_ems',
  }));
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const lamin = parseFloat(req.query.lamin);
  const lomin = parseFloat(req.query.lomin);
  const lamax = parseFloat(req.query.lamax);
  const lomax = parseFloat(req.query.lomax);

  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat and lon required' });

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=180');
    return res.status(200).json({ incidents: cached.data, cached: true });
  }

  const bboxValid = !isNaN(lamin) && !isNaN(lomin) && !isNaN(lamax) && !isNaN(lomax);
  const fl = bboxValid ? lamin : lat - 0.25;
  const fn = bboxValid ? lomin : lon - 0.25;
  const ft = bboxValid ? lamax : lat + 0.25;
  const fr = bboxValid ? lomax : lon + 0.25;

  try {
    const [waze, nycFire, sfFire, chicagoFire, austinEMS] = await Promise.all([
      fetchWazeAlerts(fl, fn, ft, fr).catch(() => []),
      fetchNYCFire(lat, lon).catch(() => []),
      fetchSFFire(lat, lon).catch(() => []),
      fetchChicagoFire(lat, lon).catch(() => []),
      fetchAustinEMS(lat, lon).catch(() => []),
    ]);

    const incidents = [...waze, ...nycFire, ...sfFire, ...chicagoFire, ...austinEMS];
    cache.set(cacheKey, { data: incidents, ts: Date.now() });
    res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=180');
    return res.status(200).json({
      incidents,
      sources: [...new Set(incidents.map(i => i.source))],
    });
  } catch (err) {
    console.error('Emergency API error:', err);
    const stale = cache.get(cacheKey);
    if (stale) return res.status(200).json({ incidents: stale.data, stale: true });
    return res.status(200).json({ incidents: [] });
  }
}
