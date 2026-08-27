import { describe, it, expect, afterEach, vi } from 'vitest';
import { overpassQuery } from '../../server/api/_overpass.js';

const ok = (json) => ({ ok: true, status: 200, json: async () => json });
const bad = (status) => ({ ok: false, status, arrayBuffer: async () => new ArrayBuffer(0) });

afterEach(() => vi.unstubAllGlobals());

describe('overpassQuery', () => {
  it('returns the first mirror that answers', async () => {
    const fetchMock = vi.fn(async () => ok({ elements: [{ id: 1 }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await overpassQuery('[out:json];out;')).toEqual({ elements: [{ id: 1 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // The bug this exists for: overpass-api.de answers Cloudflare Workers with 521,
  // which used to empty the incidents and local-events map layers outright.
  it('falls through a mirror returning 521 to one that works', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(bad(521))
      .mockResolvedValueOnce(ok({ elements: [{ id: 2 }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await overpassQuery('[out:json];out;')).toEqual({ elements: [{ id: 2 }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls through a mirror that throws', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect timeout'))
      .mockResolvedValueOnce(ok({ elements: [] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await overpassQuery('[out:json];out;')).toEqual({ elements: [] });
  });

  it('drains the body of a failed response so Workers does not stall', async () => {
    const drained = vi.fn(async () => new ArrayBuffer(0));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 504, arrayBuffer: drained })
      .mockResolvedValueOnce(ok({ elements: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await overpassQuery('[out:json];out;');
    expect(drained).toHaveBeenCalled();
  });

  it('throws naming every mirror once they all fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => bad(521)));
    await expect(overpassQuery('[out:json];out;')).rejects.toThrow(/Overpass unavailable.*overpass-api\.de/s);
  });
});
