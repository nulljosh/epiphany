import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from '../../server/api/search.js';

function call(q) {
  const res = { statusCode: 0, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return handler({ method: 'GET', query: { q }, headers: {} }, res).then(() => res);
}

describe('/api/search', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps tradeable quotes and drops the rest', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ quotes: [
        { symbol: 'SHOP.TO', shortname: 'Shopify Inc.', exchDisp: 'Toronto', quoteType: 'EQUITY' },
        { symbol: 'X', quoteType: 'OPTION' },
      ] }),
    })));
    const res = await call('shopify');
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toEqual([{ symbol: 'SHOP.TO', name: 'Shopify Inc.', exchange: 'Toronto', type: 'EQUITY' }]);
  });

  it('returns nothing for an empty query without calling out', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = await call('  ');
    expect(res.body.results).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
