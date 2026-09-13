import { describe, expect, it, vi } from 'vitest';
import { createReqRes } from './_mocks.js';

describe('/api/traffic', () => {
  it('maps official BC road events into web and native incident fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [{
        id: 'drivebc.ca/123', headline: 'Road closure', event_type: 'INCIDENT',
        description: 'Highway closed', severity: 'MAJOR',
        geography: { type: 'Point', coordinates: [-122.65, 49.05] },
      }] }),
    }));
    const { default: handler } = await import('../../server/api/traffic.js');
    const { req, res } = createReqRes({ method: 'GET', query: {
      lamin: '49.0', lomin: '-122.7', lamax: '49.1', lomax: '-122.6',
    } });
    await handler(req, res);
    expect(res.data.incidents).toEqual([expect.objectContaining({
      id: 'drivebc.ca/123', lat: 49.05, lon: -122.65,
      position: { lat: 49.05, lon: -122.65 }, source: 'DriveBC Open511',
    })]);
  });
});
