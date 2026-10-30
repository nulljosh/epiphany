// The weather warning whose shape covers a point, worst first (red, orange, yellow). Mirrors WeatherAlert.covers in Swift.
const RANK = { red: 3, orange: 2, yellow: 1 };

// Ray casting on one ring of [lon, lat] pairs.
function inRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function covers(geometry, lon, lat) {
  if (geometry?.type === 'Polygon') return inRing(geometry.coordinates[0] || [], lon, lat);
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.some((p) => inRing(p[0] || [], lon, lat));
  return false;
}

export function alertHere(alerts = [], lon, lat) {
  return alerts.filter((a) => covers(a.geometry, lon, lat))
    .sort((a, b) => (RANK[b.colour] || 0) - (RANK[a.colour] || 0))[0] || null;
}
