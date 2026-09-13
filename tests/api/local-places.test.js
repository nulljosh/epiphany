import { describe, expect, it, vi } from 'vitest';
import { createReqRes } from './_mocks.js';

vi.mock('../../server/api/_overpass.js', () => ({
  overpassQuery: vi.fn(async query => {
    expect(query).toContain('way["amenity"~');
    expect(query).toContain('relation["landuse"="cemetery"]');
    expect(query).not.toContain('out center 30');
    return { elements: [
      { type: 'way', id: 1, center: { lat: 49.05, lon: -122.66 }, tags: { name: 'Brookswood Secondary School', amenity: 'school' } },
      { type: 'relation', id: 2, center: { lat: 49.06, lon: -122.67 }, tags: { name: 'Local Cemetery', landuse: 'cemetery' } },
    ] };
  }),
}));

describe('local places', () => {
  it('keeps schools mapped as areas and cemeteries in the shared map feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('other feeds unavailable')));
    const { default: handler } = await import('../../server/api/local-events.js');
    const { req, res } = createReqRes({ method: 'GET', query: { lat: '49.05', lon: '-122.66' } });
    await handler(req, res);
    expect(res.data.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Brookswood Secondary School', category: 'education' }),
      expect.objectContaining({ title: 'Local Cemetery', category: 'cemetery' }),
    ]));
  });
});
