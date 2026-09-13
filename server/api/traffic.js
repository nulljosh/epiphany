// Traffic proxy. Flow is a clearly labelled estimate; BC road events come
// from the official DriveBC Open511 feed when the map is in British Columbia.

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

async function fetchBCRoadEvents(bbox, center) {
  if (bbox.lamax < 48 || bbox.lamin > 60 || bbox.lomax < -139 || bbox.lomin > -114) return [];
  const bounds = `${bbox.lomin},${bbox.lamin},${bbox.lomax},${bbox.lamax}`;
  const url = `https://api.open511.gov.bc.ca/events?status=ACTIVE&bbox=${bounds}&limit=500&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`DriveBC HTTP ${response.status}`);
  const data = await response.json();
  return (data.events || []).flatMap(event => {
    const geometry = event.geography;
    const coordinates = geometry?.type === 'Point'
      ? [geometry.coordinates]
      : geometry?.type === 'LineString' ? geometry.coordinates : [];
    const point = coordinates
      .filter(([lon, lat]) => lon >= bbox.lomin && lon <= bbox.lomax && lat >= bbox.lamin && lat <= bbox.lamax)
      .sort((a, b) => (a[0] - center.lon) ** 2 + (a[1] - center.lat) ** 2 -
        ((b[0] - center.lon) ** 2 + (b[1] - center.lat) ** 2))[0];
    if (!point) return [];
    return [{
      id: event.id,
      title: event.headline,
      type: event.event_type?.toLowerCase() || 'road event',
      description: event.description || event.headline,
      severity: event.severity?.toLowerCase() || 'unknown',
      lat: point[1], lon: point[0],
      position: { lat: point[1], lon: point[0] },
      source: 'DriveBC Open511',
      url: event.url,
      updated: event.updated,
    }];
  });
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

  let incidents = [];
  try {
    incidents = await fetchBCRoadEvents(bbox, center);
  } catch (error) {
    console.warn('DriveBC road events unavailable:', error.message);
  }

  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=240');
  return res.status(200).json({
    flow: estimateCongestion(center.lon),
    incidents,
    center,
  });
}
