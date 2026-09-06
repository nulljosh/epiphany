// Contract test for every map layer endpoint: with the upstream dead, each
// handler must still resolve 200 with its array key present (the map merges
// null → keeps prior layer; a thrown error or 5xx blanks it). A bad/missing
// location must not crash either.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReqRes } from './_mocks.js';

const LAYERS = [
  ['earthquakes',    'earthquakes', { lat: '49.2', lon: '-123.1', radius: '500' }],
  ['incidents',      'incidents',   { lat: '49.2', lon: '-123.1', lamin: '48.2', lomin: '-124.1', lamax: '50.2', lomax: '-122.1' }],
  ['traffic',        'incidents',   { lat: '49.2', lon: '-123.1', lamin: '48.2', lomin: '-124.1', lamax: '50.2', lomax: '-122.1' }],
  ['events',         'events',      { lat: '49.2', lon: '-123.1' }],
  ['crime',          'incidents',   { lat: '49.2', lon: '-123.1' }],
  ['local-events',   'events',      { lat: '49.2', lon: '-123.1' }],
  ['weather-alerts', 'alerts',      { lat: '49.2', lon: '-123.1' }],
  ['wildfires',      'fires',       { lat: '49.2', lon: '-123.1' }],
  ['aqi',            'readings',    { lat: '49.2', lon: '-123.1' }],
  ['emergency',      'incidents',   { lat: '49.2', lon: '-123.1', lamin: '48.2', lomin: '-124.1', lamax: '50.2', lomax: '-122.1' }],
  ['flights',        'states',      { lamin: '48.2', lomin: '-124.1', lamax: '50.2', lomax: '-122.1' }],
];

beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

describe.each(LAYERS)('/api/%s', (name, key, query) => {
  const load = async () => (await import(`../../server/api/${name}.js`)).default;

  it('survives upstream network failure (200 + array)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const handler = await load();
    const { req, res } = createReqRes({ method: 'GET', query: { ...query, _t: Date.now() } });
    await expect(handler(req, res)).resolves.not.toThrow();
    expect(res.statusCode ?? 200).toBe(200);
    expect(Array.isArray(res.data?.[key])).toBe(true);
  });

  it('survives upstream 5xx / non-JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => { throw new Error('bad json'); }, text: async () => '<html>oops</html>' });
    const handler = await load();
    const { req, res } = createReqRes({ method: 'GET', query: { ...query, _t: Date.now() + 1 } });
    await expect(handler(req, res)).resolves.not.toThrow();
    expect(res.statusCode ?? 200).toBe(200);
    expect(Array.isArray(res.data?.[key])).toBe(true);
  });

  it('does not throw on missing location', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('should not be called'));
    const handler = await load();
    const { req, res } = createReqRes({ method: 'GET', query: {} });
    await expect(handler(req, res)).resolves.not.toThrow();
    expect([200, 400]).toContain(res.statusCode ?? 200);
  });
});
