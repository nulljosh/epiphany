// Traffic proxy — TomTom Flow (tiles key) + HERE Incidents
// Returns traffic flow status and incident list for a bounding box

const TOMTOM_BASE = 'https://api.tomtom.com/traffic/services/4';
const HERE_BASE = 'https://data.traffic.hereapi.com/v7';

function estimateCongestion(lon) {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const localHour = (utcHour + Math.round(lon / 15) + 24) % 24;
  const isWeekend = [0, 6].includes(now.getUTCDay());

  let congestion;
  if (isWeekend) {
    congestion = (localHour >= 10 && localHour < 14) ? 'moderate' : 'clear';
  } else {
    if ((localHour >= 7 && localHour < 9) || (localHour >= 17 && localHour < 19)) {
      congestion = 'heavy';
    } else if (localHour >= 9 && localHour < 17) {
      congestion = 'moderate';
    } else {
      congestion = 'clear';
    }
  }

  return { source: 'estimated', congestion, currentSpeed: null, freeFlowSpeed: null, confidence: null };
}

async function fetchTomTomFlow(lat, lon) {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) {
    return estimateCongestion(lon);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // Flow segment data at the given point (zoom 10)
    const res = await fetch(
      `${TOMTOM_BASE}/flowSegmentData/relative0/10/json?key=${key}&point=${lat},${lon}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`TomTom ${res.status}`);
    const json = await res.json();
    const seg = json.flowSegmentData;
    if (!seg) return null;
    const ratio = seg.currentSpeed / seg.freeFlowSpeed;
    let congestion = 'clear';
    if (ratio < 0.4) congestion = 'heavy';
    else if (ratio < 0.7) congestion = 'moderate';
    return {
      source: 'tomtom',
      currentSpeed: Math.round(seg.currentSpeed),
      freeFlowSpeed: Math.round(seg.freeFlowSpeed),
      congestion,
      confidence: seg.confidence ?? null,
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn('TomTom flow error:', err.message);
    return null;
  }
}

function estimateIncidents(bbox) {
  const midLat = (bbox.lamin + bbox.lamax) / 2;
  const midLon = (bbox.lomin + bbox.lomax) / 2;
  const spread = 0.02;
  return [
    { type: 'ESTIMATED', description: 'Estimated congestion zone', severity: 'MINOR', position: { lat: midLat + spread, lon: midLon - spread }, startTime: null },
    { type: 'ESTIMATED', description: 'Estimated slow traffic area', severity: 'MINOR', position: { lat: midLat - spread, lon: midLon + spread }, startTime: null },
  ];
}

async function fetchHereIncidents(bbox) {
  const key = process.env.HERE_API_KEY;
  if (!key) {
    return estimateIncidents(bbox);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const { lamin, lomin, lamax, lomax } = bbox;
    const res = await fetch(
      `${HERE_BASE}/incidents?in=bbox:${lomin},${lamin},${lomax},${lamax}&apiKey=${key}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HERE ${res.status}`);
    const json = await res.json();
    return (json.results ?? []).slice(0, 10).map(i => {
      const lat = i.location?.shape?.links?.[0]?.points?.[0]?.lat ?? null;
      const lon = i.location?.shape?.links?.[0]?.points?.[0]?.lng ?? null;
      return {
        type:        i.incidentDetails?.type ?? 'UNKNOWN',
        description: i.incidentDetails?.description?.value ?? '',
        severity:    i.incidentDetails?.criticality ?? 'MINOR',
        position:    { lat, lon },
        startTime:   i.incidentDetails?.startTime ?? null,
      };
    });
  } catch (err) {
    clearTimeout(timeout);
    console.warn('HERE incidents error:', err.message);
    return [];
  }
}

function parseBbox(query) {
  const { lamin, lomin, lamax, lomax, lat, lon } = query;
  const center = {
    lat: lat ? Number(lat) : null,
    lon: lon ? Number(lon) : null,
  };
  if (lamin !== undefined) {
    const nums = [lamin, lomin, lamax, lomax].map(Number);
    if (nums.some(isNaN)) return null;
    return {
      bbox: { lamin: nums[0], lomin: nums[1], lamax: nums[2], lomax: nums[3] },
      center: { lat: (nums[0] + nums[2]) / 2, lon: (nums[1] + nums[3]) / 2 },
    };
  }
  if (!center.lat || !center.lon || isNaN(center.lat) || isNaN(center.lon)) return null;
  const delta = 0.5;
  return {
    bbox: { lamin: center.lat - delta, lomin: center.lon - delta, lamax: center.lat + delta, lomax: center.lon + delta },
    center,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = parseBbox(req.query);
  if (!parsed) {
    return res.status(400).json({ error: 'Provide lat/lon or lamin/lomin/lamax/lomax' });
  }

  const { bbox, center } = parsed;

  const [flow, incidents] = await Promise.all([
    fetchTomTomFlow(center.lat, center.lon),
    fetchHereIncidents(bbox),
  ]);

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json({
    flow: flow ?? { source: 'unavailable', congestion: 'unknown', currentSpeed: null, freeFlowSpeed: null, confidence: null },
    incidents: incidents || [],
    center,
  });
}
