// Active tropical storms from the National Hurricane Center (Atlantic, East and Central Pacific):
// position and strength from CurrentStorms.json, forecast track and cone from NOAA's map service
// as GeoJSON, queried only for the storm slots (AT1, EP2, ...) that are active.
import { slimGeometry } from './weather-alerts.js';

const CURRENT = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const GIS = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer';
const KIND = { HU: 'Hurricane', MH: 'Major hurricane', TS: 'Tropical storm', TD: 'Tropical depression', STS: 'Subtropical storm', STD: 'Subtropical depression', PTC: 'Potential tropical cyclone', PC: 'Post-tropical cyclone' };
const CACHE_TTL = 30 * 60_000;
let cache = null;
let layerIds = null;

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (epiphany.jaybulb.com)' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/** Storms from CurrentStorms.json, without shapes. */
export function parseStorms(json) {
  return (json?.activeStorms || []).map((s) => ({
    id: s.id,
    name: s.name,
    kind: KIND[s.classification] || s.classification || 'Storm',
    windKt: Number(s.intensity) || null,
    pressureMb: Number(s.pressure) || null,
    lat: Number(s.latitudeNumeric),
    lon: Number(s.longitudeNumeric),
    movement: s.movementDir != null && s.movementSpeed != null ? `${s.movementDir}° at ${s.movementSpeed} mph` : null,
    updated: s.lastUpdate || null,
    bin: s.binNumber || null,
  })).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

const round = (line) => line.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);

async function shapes(bin) {
  if (!bin) return {};
  layerIds ??= Object.fromEntries(((await getJson(`${GIS}?f=json`)).layers || []).map((l) => [l.name, l.id]));
  const layer = async (suffix) => {
    const id = layerIds[`${bin} ${suffix}`];
    if (id == null) return null;
    return (await getJson(`${GIS}/${id}/query?where=1%3D1&outFields=&f=geojson`)).features?.[0]?.geometry ?? null;
  };
  const [track, cone] = await Promise.all([layer('Forecast Track'), layer('Forecast Cone')]);
  return {
    track: track?.type === 'LineString' ? round(track.coordinates) : track?.type === 'MultiLineString' ? round(track.coordinates.flat()) : null,
    cone: slimGeometry(cone),
  };
}

export default async function handler(req, res) {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.status(200).json(cache.data);
  }
  try {
    const storms = parseStorms(await getJson(CURRENT));
    const withShapes = await Promise.all(storms.map(async (s) => ({ ...s, ...(await shapes(s.bin).catch(() => ({}))) })));
    const data = { storms: withShapes, meta: { status: 'live', updatedAt: new Date().toISOString() } };
    cache = { ts: Date.now(), data };
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.status(200).json(data);
  } catch {
    return res.status(200).json({ storms: [], meta: { status: 'degraded', updatedAt: new Date().toISOString() } });
  }
}
