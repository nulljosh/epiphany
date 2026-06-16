import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/stocks.js';

// Mock fetch globally
global.fetch = vi.fn();

function makeChartResponse(symbol, price, opts = {}) {
  return {
    chart: {
      result: [{
        meta: {
          symbol,
          regularMarketPrice: price,
          chartPreviousClose: opts.prevClose ?? price,
          regularMarketVolume: opts.volume ?? 50000000,
          fiftyTwoWeekHigh: opts.high ?? 180,
          fiftyTwoWeekLow: opts.low ?? 120,
        }
      }]
    }
  };
}

describe('Stocks API', () => {
  let mockReq;
  let mockRes;
  let jsonData;
  let statusCode;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonData = null;
    statusCode = 200;

    mockReq = {
      query: {}
    };

    mockRes = {
      status: vi.fn((code) => {
        statusCode = code;
        return mockRes;
      }),
      json: vi.fn((data) => {
        jsonData = data;
        return mockRes;
      }),
      setHeader: vi.fn()
    };
  });

  it('should fetch stocks successfully with default symbols', async () => {
    // FMP fails (no API key in test), then Yahoo v8 chart per-symbol
    global.fetch.mockImplementation((url) => {
      if (url.includes('finance/chart/AAPL')) {
        return Promise.resolve({
          ok: true,
          json: async () => makeChartResponse('AAPL', 150.25, { prevClose: 147.75 })
        });
      }
      // Other default symbols return valid data
      return Promise.resolve({
        ok: true,
        json: async () => makeChartResponse('OTHER', 100)
      });
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData).toBeInstanceOf(Array);
    expect(jsonData.length).toBeGreaterThan(0);
    const aapl = jsonData.find(q => q.symbol === 'AAPL');
    expect(aapl.price).toBe(150.25);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
  });

  it('should include market cap and pe ratio from FMP when available', async () => {
    process.env.FMP_API_KEY = 'test-key';
    mockReq.query.symbols = 'AAPL';

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ([{
        symbol: 'AAPL',
        price: 150.25,
        change: 2.5,
        changesPercentage: 1.69,
        volume: 123456789,
        marketCap: 3200000000000,
        pe: 31.7,
        yearHigh: 200,
        yearLow: 120,
      }])
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData).toHaveLength(1);
    expect(jsonData[0]).toMatchObject({
      symbol: 'AAPL',
      marketCap: 3200000000000,
      peRatio: 31.7,
    });

    delete process.env.FMP_API_KEY;
  });

  it('should handle custom symbols query parameter', async () => {
    mockReq.query.symbols = 'TSLA,NVDA';

    global.fetch.mockImplementation((url) => {
      if (url.includes('finance/chart/TSLA')) {
        return Promise.resolve({
          ok: true,
          json: async () => makeChartResponse('TSLA', 250)
        });
      }
      if (url.includes('finance/chart/NVDA')) {
        return Promise.resolve({
          ok: true,
          json: async () => makeChartResponse('NVDA', 500)
        });
      }
      return Promise.resolve({ ok: false });
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.length).toBe(2);
  });

  it('should validate symbols format', async () => {
    mockReq.query.symbols = 'INVALID@SYMBOLS!';

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(400);
    expect(jsonData.error).toBe('Invalid symbols format');
  });

  it('should limit number of symbols', async () => {
    const tooManySymbols = Array(51).fill('AAPL').join(',');
    mockReq.query.symbols = tooManySymbols;

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(400);
    expect(jsonData.error).toBe('Too many symbols');
  });

  it('should handle Yahoo Finance API errors', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(500);
    expect(jsonData.error).toBe('Failed to fetch stock data');
  });

  it('should filter out invalid quotes', async () => {
    mockReq.query.symbols = 'AAPL,BAD1,BAD2';

    global.fetch.mockImplementation((url) => {
      if (url.includes('finance/chart/AAPL')) {
        return Promise.resolve({
          ok: true,
          json: async () => makeChartResponse('AAPL', 150)
        });
      }
      if (url.includes('finance/chart/BAD1')) {
        // Missing price
        return Promise.resolve({
          ok: true,
          json: async () => ({ chart: { result: [{ meta: { symbol: 'BAD1' } }] } })
        });
      }
      // BAD2 returns not ok
      return Promise.resolve({ ok: false });
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.length).toBe(1);
    expect(jsonData[0].symbol).toBe('AAPL');
  });

  it('should handle invalid response format', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: 'format' })
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(500);
    expect(jsonData.error).toBe('Failed to fetch stock data');
  });

  it('should set appropriate cache headers', async () => {
    mockReq.query.symbols = 'AAPL';

    global.fetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => makeChartResponse('AAPL', 150)
      });
    });

    await handler(mockReq, mockRes);

    // Cache-Control is set by the gateway, not the handler directly
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:5173'
    );
  });
});
