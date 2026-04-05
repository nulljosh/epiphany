// Traffic proxy — estimation-only (TomTom/HERE keys expired)
// Returns estimated traffic flow and incident data for a bounding box

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

function estimateIncidents(bbox) {
  const midLat = (bbox.lamin + bbox.lamax) / 2;
  const midLon = (bbox.lomin + bbox.lomax) / 2;
  const spread = 0.02;
  return [
    { type: 'ESTIMATED', description: 'Estimated congestion zone', severity: 'MINOR', position: { lat: midLat + spread, lon: midLon - spread }, startTime: null },
    { type: 'ESTIMATED', description: 'Estimated slow traffic area', severity: 'MINOR', position: { lat: midLat - spread, lon: midLon + spread }, startTime: null },
  ];
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

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json({
    flow: estimateCongestion(center.lon),
    incidents: estimateIncidents(bbox),
    center,
  });
}
