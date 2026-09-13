// Browsable OpenStreetMap inventory around the map centre. This is a snapshot
// of mapped, named places, not a claim that every real-world location is in OSM.
import { overpassQuery } from './_overpass.js';

const TAGS = ['amenity', 'shop', 'tourism', 'leisure', 'historic', 'healthcare', 'office', 'craft'];
const RADIUS_KM = 6;

function category(tags) {
  if (['school', 'college', 'university', 'kindergarten'].includes(tags.amenity)) return 'Education';
  if (tags.amenity === 'grave_yard' || tags.landuse === 'cemetery') return 'Cemetery';
  if (tags.shop) return 'Shopping';
  if (tags.tourism || tags.historic) return 'Attraction';
  if (tags.leisure) return 'Recreation';
  if (tags.healthcare || ['hospital', 'clinic', 'doctors', 'pharmacy'].includes(tags.amenity)) return 'Health';
  if (tags.office || tags.craft) return 'Business';
  if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(tags.amenity)) return 'Food & drink';
  return 'Services';
}

export default async function handler(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || req.query.lat == null || req.query.lon == null) {
    return res.status(400).json({ error: 'Valid lat and lon are required' });
  }

  const deltaLat = RADIUS_KM / 111;
  const deltaLon = RADIUS_KM / (111 * Math.max(Math.cos(lat * Math.PI / 180), 0.2));
  const bbox = `${lat - deltaLat},${lon - deltaLon},${lat + deltaLat},${lon + deltaLon}`;
  const selectors = TAGS.map(tag => `nwr["${tag}"]["name"](${bbox});`).join('') +
    `nwr["landuse"="cemetery"]["name"](${bbox});`;
  const query = `[out:json][timeout:20];(${selectors});out center;`;

  try {
    const data = await overpassQuery(query, 25000);
    const seen = new Set();
    const places = (data.elements || []).flatMap(el => {
      const pLat = el.center?.lat ?? el.lat;
      const pLon = el.center?.lon ?? el.lon;
      const name = el.tags?.name?.trim();
      if (!name || !Number.isFinite(pLat) || !Number.isFinite(pLon)) return [];
      const key = `${name.toLocaleLowerCase()}|${pLat.toFixed(3)}|${pLon.toFixed(3)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id: `${el.type}/${el.id}`, title: name, category: category(el.tags),
        lat: pLat, lon: pLon, source: 'OpenStreetMap' }];
    }).sort((a, b) => a.title.localeCompare(b.title));
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({ places, radiusKm: RADIUS_KM, source: 'OpenStreetMap' });
  } catch (error) {
    console.error('Places lookup failed:', error);
    return res.status(503).json({ error: 'Places are temporarily unavailable' });
  }
}
