import { describe, it, expect } from 'vitest';
import { alertHere } from './alertHere.js';

const square = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });

describe('alertHere', () => {
  it('returns the worst warning covering the point, null outside', () => {
    const alerts = [
      { event: 'Fog', colour: 'yellow', geometry: square(-124, 49, 2) },
      { event: 'Wind', colour: 'orange', geometry: { type: 'MultiPolygon', coordinates: [square(-123.5, 49.1, 0.5).coordinates] } },
      { event: 'Pin only', colour: 'red' },
    ];
    expect(alertHere(alerts, -123.2, 49.3).event).toBe('Wind');
    expect(alertHere(alerts, -122.5, 49.5).event).toBe('Fog');
    expect(alertHere(alerts, -100, 40)).toBeNull();
  });
});
