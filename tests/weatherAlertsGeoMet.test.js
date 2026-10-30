import { describe, it, expect } from 'vitest';
import { parseGeoMet, slimGeometry } from '../server/api/weather-alerts.js';

const feature = (status, name = 'rainfall warning', area = 'Metro Vancouver') => ({
  geometry: { type: 'Polygon', coordinates: [[[-123.12345, 49.1], [-122.9, 49.1], [-122.9, 49.3], [-123.12345, 49.1]]] },
  properties: { status_en: status, alert_type: 'warning', alert_name_en: name, alert_short_name_en: 'Rainfall (warning)', feature_name_en: area, risk_colour_en: 'orange' },
});

describe('parseGeoMet', () => {
  it('keeps active alerts once per alert and area, with colour and a shape', () => {
    const out = parseGeoMet({ features: [feature('issued'), feature('continued'), feature('ended', 'fog advisory')] }, 49.2, -123.1);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ event: 'Rainfall (warning)', severity: 'Severe', colour: 'orange', area: 'Metro Vancouver' });
    expect(out[0].geometry.coordinates[0][0]).toEqual([-123.123, 49.1]);
  });
});

describe('slimGeometry', () => {
  it('thins a long ring and keeps it closed', () => {
    const ring = Array.from({ length: 1000 }, (_, i) => [i / 1000, 0]);
    const g = slimGeometry({ type: 'Polygon', coordinates: [ring] });
    expect(g.coordinates[0].length).toBeLessThanOrEqual(301);
    expect(g.coordinates[0].at(-1)).toEqual(g.coordinates[0][0]);
    expect(slimGeometry({ type: 'Point', coordinates: [0, 0] })).toBeNull();
  });
});
