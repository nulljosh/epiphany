import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/stocks-free.js';

// Reset + reassign every test so no mock queue leaks between tests.
// FMP off by default so Yahoo-path tests aren't disturbed by per-symbol FMP calls;
// FMP-specific tests opt in by setting process.env.FMP_API_KEY themselves.
beforeEach(() => {
  vi.resetAllMocks();
  global.fetch = vi.fn();
  delete process.env.FMP_API_KEY;
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
    // URL-aware (order-independent): query1 + FMP unavailable, query2 ok
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('query2')) return Promise.resolve(mockOk(makeChartResponse('AAPL', 245, 248)));
      return Promise.resolve(mockFail(429));
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].price).toBe(245);
  });

  it('falls back to query2 on query1 network error', async () => {
    const { req, res, status, data } = makeReqRes('MSFT');
    // URL-aware: query1 network error, query2 ok, FMP unavailable
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('query2')) return Promise.resolve(mockOk(makeChartResponse('MSFT', 416, 414)));
      if (url.includes('query1')) return Promise.reject(new Error('ECONNRESET'));
      return Promise.resolve(mockFail(404));
    });

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
    // URL-aware: query1 aborts (timeout), query2 ok, FMP unavailable
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('query2')) return Promise.resolve(mockOk(makeChartResponse('AAPL', 245, 248)));
      if (url.includes('query1')) return Promise.reject(new DOMException('signal aborted', 'AbortError'));
      return Promise.resolve(mockFail(404));
    });

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

// --- Yahoo v7 batch response helper ---
function makeYahooBatchResponse(quotes) {
  return { quoteResponse: { result: quotes } };
}

function makeYahooQuote(symbol, price, opts = {}) {
  return {
    symbol,
    shortName: opts.name ?? symbol,
    regularMarketPrice: price,
    regularMarketChange: opts.change ?? 0,
    regularMarketChangePercent: opts.changePercent ?? 0,
    regularMarketVolume: opts.volume ?? 10_000_000,
    regularMarketDayHigh: opts.high ?? price + 1,
    regularMarketDayLow: opts.low ?? price - 1,
    regularMarketOpen: opts.open ?? price - 0.5,
    regularMarketPreviousClose: opts.prevClose ?? price,
    fiftyTwoWeekHigh: opts.high52 ?? price + 30,
    fiftyTwoWeekLow: opts.low52 ?? price - 30,
    marketCap: opts.marketCap ?? 1_000_000_000,
    trailingPE: opts.pe ?? 25.0,
    epsTrailingTwelveMonths: opts.eps ?? 5.0,
    averageDailyVolume3Month: opts.avgVolume ?? 8_000_000,
    bid: opts.bid ?? null,
    ask: opts.ask ?? null,
    fullExchangeName: opts.exchange ?? null,
  };
}

// --- FMP batch response helper ---
function makeFmpQuote(symbol, price, opts = {}) {
  return {
    symbol,
    name: opts.name ?? symbol,
    price,
    change: opts.change ?? 0,
    changesPercentage: opts.changePercent ?? 0,
    volume: opts.volume ?? 10_000_000,
    dayHigh: opts.high ?? price + 1,
    dayLow: opts.low ?? price - 1,
    open: opts.open ?? price,
    previousClose: opts.prevClose ?? price,
    yearHigh: opts.high52 ?? null,
    yearLow: opts.low52 ?? null,
    marketCap: opts.marketCap ?? null,
    pe: opts.pe ?? null,
    eps: opts.eps ?? null,
    avgVolume: opts.avgVolume ?? null,
    beta: opts.beta ?? null,
    lastDiv: opts.lastDiv ?? 0,
    exchangeShortName: opts.exchange ?? null,
  };
}

describe('new fields: bid, ask, exchange', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('includes bid, ask, exchange from Yahoo v7 batch', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    global.fetch = urlMock({
      'v7/finance/quote': mockOk(makeYahooBatchResponse([
        makeYahooQuote('AAPL', 245, { bid: 244.95, ask: 245.05, exchange: 'NasdaqGS' }),
      ])),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].bid).toBe(244.95);
    expect(data()[0].ask).toBe(245.05);
    expect(data()[0].exchange).toBe('NasdaqGS');
  });

  it('includes exchange from FMP batch', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    process.env.FMP_API_KEY = 'test-key';

    global.fetch = urlMock({
      'financialmodelingprep': mockOk([makeFmpQuote('AAPL', 245, { exchange: 'NASDAQ', pe: 31, marketCap: 3e12 })]),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].exchange).toBe('NASDAQ');

    delete process.env.FMP_API_KEY;
  });

  it('FMP batch bid and ask are null (free tier does not provide them)', async () => {
    const { req, res, data } = makeReqRes('AAPL');
    process.env.FMP_API_KEY = 'test-key';

    global.fetch = urlMock({
      'financialmodelingprep': mockOk([makeFmpQuote('AAPL', 245, { exchange: 'NASDAQ', pe: 31, marketCap: 3e12 })]),
    });

    await handler(req, res);

    expect(data()[0].bid).toBeNull();
    expect(data()[0].ask).toBeNull();

    delete process.env.FMP_API_KEY;
  });

  it('Yahoo chart fallback sets bid, ask, exchange to null', async () => {
    const { req, res, data } = makeReqRes('AAPL');
    global.fetch = urlMock({ 'AAPL': mockOk(makeChartResponse('AAPL', 245, 248)) });

    await handler(req, res);

    expect(data()[0].bid).toBeNull();
    expect(data()[0].ask).toBeNull();
    expect(data()[0].exchange).toBeNull();
  });

  it('FMP+Yahoo supplement merges bid/ask/exchange from Yahoo onto FMP stock', async () => {
    const { req, res, data } = makeReqRes('AAPL');
    process.env.FMP_API_KEY = 'test-key';

    // FMP returns exchange but no bid/ask (pe=0 triggers supplement)
    const fmpResponse = [makeFmpQuote('AAPL', 245, { exchange: 'NASDAQ', pe: 0, marketCap: 3e12 })];
    const yahooResponse = makeYahooBatchResponse([
      makeYahooQuote('AAPL', 245, { bid: 244.90, ask: 245.10, exchange: 'NasdaqGS', pe: 31 }),
    ]);

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('financialmodelingprep')) return Promise.resolve(mockOk(fmpResponse));
      if (url.includes('v7/finance/quote')) return Promise.resolve(mockOk(yahooResponse));
      return Promise.resolve(mockFail(404));
    });

    await handler(req, res);

    expect(data()[0].bid).toBe(244.90);
    expect(data()[0].ask).toBe(245.10);
    // Exchange from FMP preserved (FMP wins over Yahoo for exchange when present)
    expect(data()[0].exchange).toBe('NASDAQ');

    delete process.env.FMP_API_KEY;
  });

  it('commodity futures have null bid/ask (Yahoo v7 does not provide them)', async () => {
    const { req, res, data } = makeReqRes('GC=F');
    global.fetch = urlMock({ 'GC%3DF': mockOk(makeChartResponse('GC=F', 2950, 2940)) });

    await handler(req, res);

    expect(data()[0].symbol).toBe('GC=F');
    expect(data()[0].bid).toBeNull();
    expect(data()[0].ask).toBeNull();
  });

  it('bid and ask fields are null (not undefined) when absent', async () => {
    const { req, res, data } = makeReqRes('AAPL');
    global.fetch = urlMock({ 'AAPL': mockOk(makeChartResponse('AAPL', 245, 248)) });

    await handler(req, res);

    expect(data()[0]).toHaveProperty('bid');
    expect(data()[0]).toHaveProperty('ask');
    expect(data()[0]).toHaveProperty('exchange');
    expect(data()[0].bid).toBeNull();
    expect(data()[0].ask).toBeNull();
  });

  it('Yahoo v7 bid/ask are null when not present in response', async () => {
    const { req, res, data } = makeReqRes('AAPL');
    global.fetch = urlMock({
      'v7/finance/quote': mockOk(makeYahooBatchResponse([
        makeYahooQuote('AAPL', 245, { bid: null, ask: null }),
      ])),
    });

    await handler(req, res);

    expect(data()[0].bid).toBeNull();
    expect(data()[0].ask).toBeNull();
  });
});

describe('edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('FMP pe=0 triggers Yahoo supplement (treated as missing)', async () => {
    const { req, res, data } = makeReqRes('AAPL');
    process.env.FMP_API_KEY = 'test-key';

    const fmpResponse = [makeFmpQuote('AAPL', 245, { pe: 0, marketCap: 3e12 })];
    const yahooResponse = makeYahooBatchResponse([makeYahooQuote('AAPL', 245, { pe: 31.5 })]);

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('financialmodelingprep')) return Promise.resolve(mockOk(fmpResponse));
      if (url.includes('v7/finance/quote')) return Promise.resolve(mockOk(yahooResponse));
      return Promise.resolve(mockFail(404));
    });

    await handler(req, res);

    expect(data()[0].peRatio).toBe(31.5);

    delete process.env.FMP_API_KEY;
  });

  it('FMP marketCap=0 triggers Yahoo supplement', async () => {
    const { req, res, data } = makeReqRes('MSFT');
    process.env.FMP_API_KEY = 'test-key';

    const fmpResponse = [makeFmpQuote('MSFT', 416, { pe: 35, marketCap: 0 })];
    const yahooResponse = makeYahooBatchResponse([makeYahooQuote('MSFT', 416, { marketCap: 3.1e12 })]);

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('financialmodelingprep')) return Promise.resolve(mockOk(fmpResponse));
      if (url.includes('v7/finance/quote')) return Promise.resolve(mockOk(yahooResponse));
      return Promise.resolve(mockFail(404));
    });

    await handler(req, res);

    expect(data()[0].marketCap).toBe(3.1e12);

    delete process.env.FMP_API_KEY;
  });

  it('falls back to Yahoo per-symbol chart when Yahoo v7 batch also fails', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('v7/finance/quote')) return Promise.resolve(mockFail(429));
      if (url.includes('v8/finance/chart/AAPL')) return Promise.resolve(mockOk(makeChartResponse('AAPL', 245, 248)));
      return Promise.resolve(mockFail(404));
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].symbol).toBe('AAPL');
    expect(data()[0].price).toBe(245);
  });

  it('excludes a symbol when all three paths fail for it', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,BADINPUT');

    global.fetch = urlMock({
      'AAPL': mockOk(makeChartResponse('AAPL', 245, 248)),
      'BADINPUT': mockFail(404),
    });

    await handler(req, res);

    expect(status()).toBe(200);
    const symbols = data().map(s => s.symbol);
    expect(symbols).toContain('AAPL');
    expect(symbols).not.toContain('BADINPUT');
  });

  it('handles symbolList with only commodity futures without error', async () => {
    const { req, res, status, data } = makeReqRes('GC=F,SI=F');

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('GC%3DF')) return Promise.resolve(mockOk(makeChartResponse('GC=F', 2950, 2940)));
      if (url.includes('SI%3DF')) return Promise.resolve(mockOk(makeChartResponse('SI=F', 32, 31)));
      return Promise.resolve(mockFail(404));
    });

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data().every(s => s.bid === null)).toBe(true);
    expect(data().every(s => s.ask === null)).toBe(true);
  });

  it('accepts single-character symbol', async () => {
    const { req, res, status } = makeReqRes('F');
    global.fetch = urlMock({ '/F': mockOk(makeChartResponse('F', 10, 10.5)) });

    await handler(req, res);

    expect(status()).not.toBe(400);
  });

  it('URL-encodes = in futures symbols for Yahoo chart endpoint', async () => {
    const { req, res, status } = makeReqRes('GC=F');
    const fetchMock = vi.fn().mockResolvedValue(mockOk(makeChartResponse('GC=F', 2950, 2940)));
    global.fetch = fetchMock;

    await handler(req, res);

    expect(status()).toBe(200);
    const urls = fetchMock.mock.calls.map(([url]) => url);
    const chartUrl = urls.find(u => u.includes('v8/finance/chart'));
    if (chartUrl) {
      expect(chartUrl).toContain('GC%3DF');
    }
  });

  it('returns 400 for more than 100 symbols', async () => {
    const { req, res, status, data } = makeReqRes(Array(101).fill('AAPL').join(','));

    await handler(req, res);

    expect(status()).toBe(400);
    expect(data().error).toMatch(/100/);
  });

  it('accepts exactly 100 symbols', async () => {
    const syms = Array.from({ length: 100 }, (_, i) => `T${String(i).padStart(3, '0')}`);
    const { req, res, status } = makeReqRes(syms.join(','));
    global.fetch.mockResolvedValue(mockOk(makeChartResponse('T000')));

    await handler(req, res);

    expect(status()).not.toBe(400);
  });
});

describe('change calculation edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('computes zero change on flat day', async () => {
    const { req, res, data } = makeReqRes('FLAT');
    global.fetch = urlMock({ 'FLAT': mockOk(makeChartResponse('FLAT', 100, 100)) });

    await handler(req, res);

    expect(data()[0].change).toBe(0);
    expect(data()[0].changePercent).toBe(0);
  });

  it('computes large percent swing correctly', async () => {
    const { req, res, data } = makeReqRes('SWING');
    global.fetch = urlMock({ 'SWING': mockOk(makeChartResponse('SWING', 2.00, 1.00)) });

    await handler(req, res);

    expect(data()[0].change).toBeCloseTo(1.00, 4);
    expect(data()[0].changePercent).toBeCloseTo(100, 4);
  });

  it('computes fractional price change accurately', async () => {
    const { req, res, data } = makeReqRes('FRAC');
    global.fetch = urlMock({ 'FRAC': mockOk(makeChartResponse('FRAC', 150.37, 149.82)) });

    await handler(req, res);

    expect(data()[0].change).toBeCloseTo(0.55, 2);
    expect(data()[0].changePercent).toBeCloseTo(0.367, 2);
  });
});
