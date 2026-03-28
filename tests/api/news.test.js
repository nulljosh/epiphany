import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/news.js';

beforeEach(() => {
  vi.resetAllMocks();
  global.fetch = vi.fn();
});

const mockOk = (body) => ({ ok: true, json: async () => body });

function makeGdeltArticle(overrides = {}) {
  return {
    title: 'Test Article About the Markets in New York',
    url: 'https://example.com/test-article',
    domain: 'example.com',
    seendate: '20260228T120000Z',
    socialimage: 'https://example.com/img.jpg',
    sourcelat: '40.7128',
    sourcelon: '-74.0060',
    sourcecountry: 'United States',
    ...overrides,
  };
}

// Each test gets a unique category to avoid module-level cache collisions
let nextCat = 0;
function uniqueCategory() { return `test-cat-${++nextCat}`; }

function makeReqRes(query = {}) {
  let statusCode = 200;
  let jsonData = null;
  const res = {
    status: vi.fn((code) => { statusCode = code; return res; }),
    json: vi.fn((data) => { jsonData = data; return res; }),
    setHeader: vi.fn(),
  };
  if (!query.category) query.category = uniqueCategory();
  return {
    req: {
      method: 'GET',
      query,
      headers: { origin: 'http://localhost:5173' },
    },
    res,
    status: () => statusCode,
    data: () => jsonData,
  };
}

describe('news API handler', () => {

  it('returns 405 for non-GET requests', async () => {
    const { req, res, status, data } = makeReqRes();
    req.method = 'POST';

    await handler(req, res);

    expect(status()).toBe(405);
    expect(data().error).toMatch(/not allowed/i);
  });

  it('returns 200 with { articles: [] } shape on success', async () => {
    const { req, res, status, data } = makeReqRes();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle()],
    })));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveProperty('articles');
    expect(data().articles).toBeInstanceOf(Array);
    expect(data().articles.length).toBeGreaterThan(0);
    expect(data().meta.status).toBe('live');
  });

  it('sets Cache-Control s-maxage=300 header', async () => {
    const { req, res } = makeReqRes();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle()],
    })));

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 's-maxage=300');
  });

  it('returns articles with correct fields', async () => {
    const { req, res, data } = makeReqRes();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle()],
    })));

    await handler(req, res);

    const article = data().articles[0];
    expect(article).toHaveProperty('title');
    expect(article).toHaveProperty('url');
    expect(article).toHaveProperty('source');
    expect(article).toHaveProperty('image');
    expect(article).toHaveProperty('lat');
    expect(article).toHaveProperty('lon');
    expect(article).toHaveProperty('publishedAt');
  });

  it('deduplicates articles with similar titles', async () => {
    const { req, res, data } = makeReqRes();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [
        makeGdeltArticle({ title: 'Stock Market Rallies on the Fed News', url: 'https://a.com/1' }),
        makeGdeltArticle({ title: 'Stock Market Rallies on the Fed News Today', url: 'https://b.com/2' }),
        makeGdeltArticle({ title: 'This is a Completely Different Article About Sports', url: 'https://c.com/3' }),
      ],
    })));

    await handler(req, res);

    expect(data().articles.length).toBe(2);
  });

  it('normalizes URLs by stripping tracking params', async () => {
    const { req, res, data } = makeReqRes();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [
        makeGdeltArticle({
          title: 'The First Article on the Market Today',
          url: 'https://www.example.com/article?utm_source=twitter&utm_medium=social&id=123',
        }),
        makeGdeltArticle({
          title: 'The Second Unique Article About Markets',
          url: 'https://example.com/article?id=123',
        }),
      ],
    })));

    await handler(req, res);

    // Both URLs normalize to example.com/article?id=123, so second is deduped
    expect(data().articles.length).toBe(1);
  });

  it('extracts geo coordinates from GDELT sourcelat/sourcelon', async () => {
    const { req, res, data } = makeReqRes();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle({
        sourcelat: '51.5074',
        sourcelon: '-0.1278',
      })],
    })));

    await handler(req, res);

    expect(data().articles[0].lat).toBeCloseTo(51.5074, 3);
    expect(data().articles[0].lon).toBeCloseTo(-0.1278, 3);
  });

  it('falls back to keyword geo matching when GDELT has no coordinates', async () => {
    const { req, res, data } = makeReqRes();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle({
        title: 'The Major Event is Happening in Tokyo Today',
        sourcelat: '',
        sourcelon: '',
      })],
    })));

    await handler(req, res);

    expect(data().articles[0].lat).toBeCloseTo(35.6762, 3);
    expect(data().articles[0].lon).toBeCloseTo(139.6503, 3);
  });

  it('returns 502 when GDELT is unreachable', async () => {
    const { req, res, status, data } = makeReqRes();
    global.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    await handler(req, res);

    expect(status()).toBe(502);
    expect(data().error).toMatch(/unavailable/i);
    expect(data().articles).toEqual([]);
    expect(data().meta.status).toBe('degraded');
  });

  it('uses cache on second call within 5 minutes', async () => {
    const cat = uniqueCategory();
    const article = makeGdeltArticle();
    global.fetch = vi.fn(() => Promise.resolve(mockOk({ articles: [article] })));

    const call1 = makeReqRes({ category: cat });
    await handler(call1.req, call1.res);
    expect(call1.status()).toBe(200);
    const fetchCountAfterFirst = global.fetch.mock.calls.length;

    const call2 = makeReqRes({ category: cat });
    await handler(call2.req, call2.res);
    expect(call2.status()).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(fetchCountAfterFirst);
    expect(call2.data().articles.length).toBe(call1.data().articles.length);
    expect(call2.data().meta.status).toBe('cache');
  });
});

describe('stock news via ?q= param', () => {

  it('returns articles array for GET with ?q=AAPL', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle({ title: 'Apple Stock Rises on the Earnings Report' })],
    })));

    const { req, res, status, data } = makeReqRes({ q: 'AAPL', category: undefined });
    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveProperty('articles');
    expect(data().articles).toBeInstanceOf(Array);
    expect(data().articles.length).toBeGreaterThan(0);
    expect(data().meta.status).toBe('live');
  });

  it('falls through to normal category handling when q is absent', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle()],
    })));

    const { req, res, status, data } = makeReqRes({ category: uniqueCategory() });
    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveProperty('articles');
    // Verify the call used category-based flow (no stock: prefix in cache)
    expect(data().meta.status).toBe('live');
  });

  it('returns empty articles array when both sources return nothing', async () => {
    // Both GDELT and Google News return empty -- Promise.allSettled handles gracefully
    global.fetch = vi.fn(() => Promise.resolve(mockOk({ articles: [] })));

    const { req, res, status, data } = makeReqRes({ q: `EMPTY${++nextCat}`, category: undefined });
    await handler(req, res);

    expect(status()).toBe(200);
    expect(data().articles).toEqual([]);
  });

  it('caches stock news results on repeated queries', async () => {
    const ticker = `CACHE${++nextCat}`;
    global.fetch = vi.fn(() => Promise.resolve(mockOk({
      articles: [makeGdeltArticle({ title: 'Stock Cache Test Article is in the News Here' })],
    })));

    const call1 = makeReqRes({ q: ticker, category: undefined });
    await handler(call1.req, call1.res);
    expect(call1.status()).toBe(200);
    const fetchCountAfterFirst = global.fetch.mock.calls.length;

    const call2 = makeReqRes({ q: ticker, category: undefined });
    await handler(call2.req, call2.res);
    expect(call2.status()).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(fetchCountAfterFirst);
    expect(call2.data().meta.status).toBe('cache');
  });
});
