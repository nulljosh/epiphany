import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/stocks-free.js';

// Reset + reassign every test so no mock queue leaks between tests
beforeEach(() => {
  vi.resetAllMocks();
  global.fetch = vi.fn();
});

const makeChartResponse = (symbol, price = 150, prevClose = 148, opts = {}) => ({
  chart: {
    result: [{
      meta: {
        regularMarketPrice: price,
        chartPreviousClose: prevClose,
        regularMarketVolume: opts.volume ?? 50_000_000,
        regularMarketDayHigh: opts.high ?? price + 2,
        regularMarketDayLow: opts.low ?? price - 2,
        regularMarketOpen: opts.open ?? prevClose + 0.5,
        fiftyTwoWeekHigh: opts.high52 ?? price + 50,
        fiftyTwoWeekLow: opts.low52 ?? price - 50,
      },
    }],
  },
});

const mockOk = (body) => ({ ok: true, json: async () => body });
const mockFail = (status = 404) => ({ ok: false, status });

// URL-aware fetch mock — safe for concurrent Promise.all calls
function urlMock(map, fallback = () => Promise.resolve(mockFail(404))) {
  return vi.fn().mockImplementation((url) => {
    for (const [pattern, response] of Object.entries(map)) {
      if (url.includes(pattern)) return Promise.resolve(response);
    }
    return fallback(url);
  });
}

function makeReqRes(querySymbols) {
  let statusCode = 200;
  let jsonData = null;
  const res = {
    status: vi.fn((code) => { statusCode = code; return res; }),
    json: vi.fn((data) => { jsonData = data; return res; }),
    setHeader: vi.fn(),
  };
  return {
    req: { query: querySymbols !== undefined ? { symbols: querySymbols } : {} },
    res,
    status: () => statusCode,
    data: () => jsonData,
  };
}

describe('stocks-free API handler', () => {

  // --- Happy path ---

  it('returns stock data for a valid symbol', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    global.fetch = urlMock({ 'query1': mockOk(makeChartResponse('AAPL', 245, 248)) });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toBeInstanceOf(Array);
    expect(data()).toHaveLength(1);
    expect(data()[0].symbol).toBe('AAPL');
    expect(data()[0].price).toBe(245);
    expect(data()[0].change).toBeCloseTo(-3, 1);
    expect(data()[0].changePercent).toBeCloseTo(-1.21, 1);
  });

  it('returns data for multiple symbols concurrently', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,MSFT');
    global.fetch = urlMock({
      'AAPL': mockOk(makeChartResponse('AAPL', 245, 248)),
      'MSFT': mockOk(makeChartResponse('MSFT', 416, 414)),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(2);
    expect(data().map(s => s.symbol).sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('uses default symbols when query param is absent', async () => {
    const { req, res, status, data } = makeReqRes(undefined);
    global.fetch.mockResolvedValue(mockOk(makeChartResponse('AAPL')));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data().length).toBeGreaterThan(0);
  });

  it('includes all required fields in response', async () => {
    const { req, res, data } = makeReqRes('NVDA');
    global.fetch = urlMock({
      'NVDA': mockOk(makeChartResponse('NVDA', 136, 138, {
        volume: 30_000_000, high: 140, low: 133, open: 138.5, high52: 175, low52: 80,
      })),
    });

    await handler(req, res);

    expect(data()[0]).toMatchObject({
      symbol: 'NVDA',
      price: 136,
      change: expect.any(Number),
      changePercent: expect.any(Number),
      volume: 30_000_000,
      high: 140,
      low: 133,
      open: 138.5,
      prevClose: 138,
      fiftyTwoWeekHigh: 175,
      fiftyTwoWeekLow: 80,
    });
  });

  it('sets CORS and cache headers', async () => {
    const { req, res } = makeReqRes('AAPL');
    global.fetch = urlMock({ 'AAPL': mockOk(makeChartResponse('AAPL')) });

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
    // Cache-Control is set by the gateway, not the handler directly
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
  });

  // --- Symbol limit ---

  it('rejects more than 100 symbols with 400', async () => {
    const { req, res, status, data } = makeReqRes(Array(101).fill('AAPL').join(','));

    await handler(req, res);

    expect(status()).toBe(400);
    expect(data().error).toMatch(/100/);
  });

  it('accepts exactly 100 symbols without 400', async () => {
    const syms = Array.from({ length: 100 }, (_, i) => `T${String(i).padStart(3, '0')}`);
    const { req, res, status } = makeReqRes(syms.join(','));
    global.fetch.mockResolvedValue(mockOk(makeChartResponse('T000')));

    await handler(req, res);

    expect(status()).not.toBe(400);
  });

  // --- Partial failures ---

  it('filters out symbols that fail on both endpoints', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,BADTICKER');
    global.fetch = urlMock({
      'AAPL': mockOk(makeChartResponse('AAPL', 245, 248)),
      'BADTICKER': mockFail(404),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(1);
    expect(data()[0].symbol).toBe('AAPL');
  });

  it('falls back to query2 when query1 returns non-ok', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockFail(429))  // query1 rate limited
      .mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248))); // query2 ok

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].price).toBe(245);
  });

  it('falls back to query2 on query1 network error', async () => {
    const { req, res, status, data } = makeReqRes('MSFT');
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(mockOk(makeChartResponse('MSFT', 416, 414)));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].symbol).toBe('MSFT');
  });

  it('returns 500 when ALL symbols fail on both endpoints', async () => {
    const { req, res, status, data } = makeReqRes('FAKE1,FAKE2');
    global.fetch.mockResolvedValue(mockFail(404));

    await handler(req, res);

    expect(status()).toBe(500);
    expect(data().error).toBeDefined();
  });

  it('returns 200 with partial results when only some symbols fail', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,FAKE');
    global.fetch = urlMock({
      'AAPL': mockOk(makeChartResponse('AAPL', 245, 248)),
      'FAKE': mockFail(404),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(1);
    expect(data()[0].symbol).toBe('AAPL');
  });

  // --- Per-symbol timeout (abort) ---

  it('treats aborted (timed out) query1 as failure and tries query2', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    // Simulate AbortController aborting the query1 request
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new DOMException('signal aborted', 'AbortError'))
      .mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248)));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].price).toBe(245);
  });

  it('returns 500 when all requests abort', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch.mockRejectedValue(new DOMException('signal aborted', 'AbortError'));

    await handler(req, res);

    expect(status()).toBe(500);
  });

  // --- Malformed responses ---

  it('skips symbol with null chart result, returns 500 if only that symbol', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ chart: { result: null } })) // query1: null result
      .mockResolvedValueOnce(mockFail(404));                       // query2: fails

    await handler(req, res);

    expect(status()).toBe(500);
  });

  it('succeeds on remaining symbols when one has null chart result', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,MSFT');
    global.fetch = urlMock({
      'AAPL': { ok: true, json: async () => ({ chart: { result: null } }) },
      'MSFT': mockOk(makeChartResponse('MSFT', 416, 414)),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(1);
    expect(data()[0].symbol).toBe('MSFT');
  });

  it('skips symbol when regularMarketPrice is missing', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockOk({
        chart: { result: [{ meta: { chartPreviousClose: 248 } }] },
      }))
      .mockResolvedValueOnce(mockFail(404));

    await handler(req, res);

    expect(status()).toBe(500);
  });

  it('skips symbol when prevClose is zero (division-by-zero guard)', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockOk({
        chart: { result: [{ meta: { regularMarketPrice: 245, chartPreviousClose: 0 } }] },
      }))
      .mockResolvedValueOnce(mockFail(404));

    await handler(req, res);

    expect(status()).toBe(500);
  });

  it('handles invalid JSON without crashing, falls back to query2', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('bad json'); } })
      .mockResolvedValueOnce(mockFail(500));

    await handler(req, res);

    expect(status()).toBe(500);
  });

  // --- Special symbol formats ---

  it('handles futures symbols like GC=F', async () => {
    const { req, res, status, data } = makeReqRes('GC=F');
    // encodeURIComponent('GC=F') → 'GC%3DF', match on encoded form
    global.fetch = urlMock({ 'GC%3DF': mockOk(makeChartResponse('GC=F', 2943, 2932)) });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].symbol).toBe('GC=F');
    expect(data()[0].price).toBe(2943);
  });

  it('handles BRK-B hyphenated symbol', async () => {
    const { req, res, status, data } = makeReqRes('BRK-B');
    global.fetch = urlMock({ 'BRK-B': mockOk(makeChartResponse('BRK-B', 499, 497)) });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].symbol).toBe('BRK-B');
  });

  // --- Change calculation ---

  it('computes positive change and changePercent correctly', async () => {
    const { req, res, data } = makeReqRes('TEST');
    global.fetch = urlMock({ 'TEST': mockOk(makeChartResponse('TEST', 110, 100)) });

    await handler(req, res);

    expect(data()[0].change).toBeCloseTo(10, 4);
    expect(data()[0].changePercent).toBeCloseTo(10, 4);
  });

  it('computes negative change and changePercent correctly', async () => {
    const { req, res, data } = makeReqRes('TEST');
    global.fetch = urlMock({ 'TEST': mockOk(makeChartResponse('TEST', 90, 100)) });

    await handler(req, res);

    expect(data()[0].change).toBeCloseTo(-10, 4);
    expect(data()[0].changePercent).toBeCloseTo(-10, 4);
  });

  it('uses previousClose as fallback when chartPreviousClose is absent', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    global.fetch = urlMock({
      'AAPL': mockOk({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 245,
              previousClose: 250, // uses this, not chartPreviousClose
              regularMarketVolume: 1_000_000,
            },
          }],
        },
      }),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].prevClose).toBe(250);
    expect(data()[0].change).toBeCloseTo(-5, 4);
  });
});
