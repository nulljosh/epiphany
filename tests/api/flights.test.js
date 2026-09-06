import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler, { parseBbox, normalize, radiusQuery, fetchFlights, clearCache } from '../../server/api/flights.js';
import { createReqRes } from './_mocks.js';

const BBOX = { lamin: 49, lomin: -124, lamax: 50, lomax: -122 };
const Q = { lamin: '49', lomin: '-124', lamax: '50', lomax: '-122' };
const ok = (body) => ({ ok: true, json: async () => body });
const ac = (o = {}) => ({ hex: 'c07516', flight: 'ACA123 ', lat: 49.5, lon: -123, alt_baro: 30000, gs: 450.4, track: 270.6, r: 'C-GSIV', t: 'A320', ...o });

beforeEach(() => { vi.restoreAllMocks(); clearCache(); global.fetch = vi.fn(); });

describe('parseBbox', () => {
  it('accepts a valid bbox', () => expect(parseBbox(Q)).toEqual(BBOX));
  it('rejects missing / NaN / inverted / oversized / out-of-range', () => {
    expect(parseBbox({})).toBeNull();
    expect(parseBbox({ ...Q, lamin: 'x' })).toBeNull();
    expect(parseBbox({ ...Q, lamin: '51' })).toBeNull();
    expect(parseBbox({ ...Q, lamax: '52' })).toBeNull();
    expect(parseBbox({ ...Q, lomin: '-181', lomax: '-180' })).toBeNull();
  });
});

describe('normalize', () => {
  it('reads adsb.lol `ac` and adsb.fi `aircraft` identically', () => {
    const a = normalize({ ac: [ac()] }, BBOX);
    const b = normalize({ aircraft: [ac()] }, BBOX);
    expect(a).toEqual(b);
    expect(a[0]).toMatchObject({ icao24: 'c07516', callsign: 'ACA123', altitude: 30000, velocity: 450, heading: 271, registration: 'C-GSIV', aircraftType: 'A320', onGround: false });
  });
  it('drops ground, low, positionless, and out-of-bbox aircraft', () => {
    const out = normalize({ ac: [
      ac({ alt_baro: 'ground' }),
      ac({ alt_baro: 200 }),
      ac({ lat: undefined }),
      ac({ lat: 51 }),
      ac({ alt_baro: undefined }), // unknown altitude is kept
    ] }, BBOX);
    expect(out).toHaveLength(1);
    expect(out[0].altitude).toBeNull();
  });
  it('tolerates an empty or malformed body', () => {
    expect(normalize(null, BBOX)).toEqual([]);
    expect(normalize({}, BBOX)).toEqual([]);
  });
});

describe('radiusQuery', () => {
  it('clamps radius to 10..250 nm', () => {
    expect(radiusQuery(BBOX).nm).toBeGreaterThanOrEqual(10);
    expect(radiusQuery({ lamin: 0, lomin: 0, lamax: 0.01, lomax: 0.01 }).nm).toBe(10);
    expect(radiusQuery({ lamin: -90, lomin: -180, lamax: -88, lomax: -178 }).nm).toBeLessThanOrEqual(250);
  });
});

describe('fetchFlights failover', () => {
  it('uses the primary when it answers', async () => {
    fetch.mockResolvedValueOnce(ok({ ac: [ac()] }));
    const r = await fetchFlights(BBOX);
    expect(r.source).toBe('adsb.lol');
    expect(r.count).toBe(1);
    expect(r.meta.fallback).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('falls back to adsb.fi when adsb.lol errors, and says so', async () => {
    fetch.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(ok({ aircraft: [ac()] }));
    const r = await fetchFlights(BBOX);
    expect(r.source).toBe('adsb.fi');
    expect(r.meta.fallback).toBe(true);
    expect(r.meta.failures).toEqual(['adsb.lol: timeout']);
  });
  it('falls back on non-2xx too', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce(ok({ aircraft: [] }));
    const r = await fetchFlights(BBOX);
    expect(r.source).toBe('adsb.fi');
    expect(r.noFlights).toBe(true);
  });
  it('throws with every failure when all sources die', async () => {
    fetch.mockRejectedValue(new Error('down'));
    await expect(fetchFlights(BBOX)).rejects.toThrow('adsb.lol: down; adsb.fi: down');
  });
});

describe('handler', () => {
  it('405 on POST', async () => {
    const { req, res } = createReqRes({ method: 'POST', query: Q });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
  it('400 on bad bbox', async () => {
    const { req, res } = createReqRes({ method: 'GET', query: { ...Q, lamax: '60' } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
  it('MISS then HIT, HIT skips upstream', async () => {
    fetch.mockResolvedValue(ok({ ac: [ac()] }));
    const a = createReqRes({ method: 'GET', query: Q });
    await handler(a.req, a.res);
    expect(a.res.headers['X-Cache']).toBe('MISS');
    expect(a.res.headers['X-Flights-Source']).toBe('adsb.lol');
    const b = createReqRes({ method: 'GET', query: Q });
    await handler(b.req, b.res);
    expect(b.res.headers['X-Cache']).toBe('HIT');
    expect(b.res.data.meta.status).toBe('cache');
    expect(b.res.data.states).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('serves stale cache when every source fails', async () => {
    fetch.mockResolvedValueOnce(ok({ ac: [ac()] }));
    const a = createReqRes({ method: 'GET', query: Q });
    await handler(a.req, a.res);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    fetch.mockRejectedValue(new Error('down'));
    const b = createReqRes({ method: 'GET', query: Q });
    await handler(b.req, b.res);
    expect(b.res.statusCode).toBe(200);
    expect(b.res.headers['X-Cache']).toBe('STALE');
    expect(b.res.data.meta.degraded).toBe(true);
    expect(b.res.data.states).toHaveLength(1);
  });
  it('returns 200 degraded-empty when nothing cached and all sources fail', async () => {
    fetch.mockRejectedValue(new Error('down'));
    const { req, res } = createReqRes({ method: 'GET', query: Q });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.data).toMatchObject({ source: 'none', states: [], noFlights: true });
    expect(res.data.meta.status).toBe('error');
    expect(res.headers['X-Adsb-Error']).toContain('adsb.fi: down');
  });
});
