import { describe, expect, it } from 'vitest';
import { routeProgress, routeHTML } from '../src/utils/flightRoute.js';
import { parseRoute } from '../server/api/flight-route.js';

const ap = (iata, city, latitude, longitude) => ({ iata_code: iata, municipality: city, latitude, longitude });

describe('flight route', () => {
  it('parses adsbdb and measures the share flown', () => {
    const route = parseRoute({ response: { flightroute: { airline: { name: 'Air Canada' }, origin: ap('YYZ', 'Toronto', 43.68, -79.63), destination: ap('YVR', 'Vancouver', 49.19, -123.18) } } });
    expect(route.origin.code).toBe('YYZ');
    expect(routeProgress(route, { lat: 43.68, lon: -79.63 })).toBe(0);
    expect(routeProgress(route, { lat: 49.19, lon: -123.18 })).toBeCloseTo(1);
    const mid = routeProgress(route, { lat: 47.5, lon: -101 });
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(routeHTML(route, { lat: 47.5, lon: -101 })).toContain('YYZ Toronto');
    expect(parseRoute({ response: 'unknown callsign' })).toBeNull();
  });
});
