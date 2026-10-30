import { describe, expect, it, vi } from 'vitest';
import { createReqRes } from './_mocks.js';
import { category } from '../../server/api/places.js';

vi.mock('../../server/api/_overpass.js', () => ({
  overpassQuery: vi.fn(async query => {
    expect(query).toContain('nwr["shop"]["name"]');
    expect(query).toContain('nwr["landuse"="cemetery"]["name"]');
    return { elements: [
      { type: 'way', id: 1, center: { lat: 49.07, lon: -122.64 }, tags: { name: 'Brookswood Secondary School', amenity: 'school' } },
      { type: 'node', id: 2, lat: 49.05, lon: -122.66, tags: { name: 'Local Pizza', amenity: 'restaurant' } },
      { type: 'way', id: 3, center: { lat: 49.08, lon: -122.65 }, tags: { name: 'Local Cemetery', landuse: 'cemetery' } },
    ] };
  }),
}));

describe('/api/places', () => {
  it('lists mapped schools, businesses, and cemeteries dynamically', async () => {
    const { default: handler } = await import('../../server/api/places.js');
    const { req, res } = createReqRes({ method: 'GET', query: { lat: '49.05', lon: '-122.66' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.data.places).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Brookswood Secondary School', category: 'Education' }),
      expect.objectContaining({ title: 'Local Pizza', category: 'Food & drink' }),
      expect.objectContaining({ title: 'Local Cemetery', category: 'Cemetery' }),
    ]));
  });
  it('buckets places the map chips search for', () => {
    expect(category({ amenity: 'fuel' })).toBe('Gas station');
    expect(category({ shop: 'supermarket' })).toBe('Grocery');
    expect(category({ amenity: 'cafe' })).toBe('Coffee');
    expect(category({ leisure: 'park' })).toBe('Park');
    expect(category({ shop: 'clothes' })).toBe('Shopping');
  });
});
