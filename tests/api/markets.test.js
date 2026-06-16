import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/markets.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Markets API', () => {
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

  it('should fetch markets successfully with default parameters', async () => {
    const mockPolymarketResponse = [
      {
        id: '1',
        slug: 'test-market',
        question: 'Will it rain?',
        description: 'Test description',
        volume24hr: 10000,
        volume: 50000,
        liquidity: 20000
      }
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPolymarketResponse
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData).toBeInstanceOf(Array);
    expect(jsonData.length).toBe(1);
    expect(jsonData[0].id).toBe('1');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
  });

  it('should handle custom query parameters', async () => {
    mockReq.query = {
      limit: '20',
      closed: 'true',
      order: 'volume',
      ascending: 'true'
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    await handler(mockReq, mockRes);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=20'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('closed=true'),
      expect.any(Object)
    );
  });

  it('should validate order parameter', async () => {
    mockReq.query.order = 'invalid_order';

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(400);
    expect(jsonData.error).toBe('Invalid order parameter');
  });

  it('should limit maximum results to 100', async () => {
    mockReq.query.limit = '200';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    await handler(mockReq, mockRes);

    // Should cap at 100
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=100'),
      expect.any(Object)
    );
  });

  it('should handle Polymarket API errors', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable'
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(500);
    expect(jsonData.error).toBe('Failed to fetch markets');
  });

  it('should handle network timeouts', async () => {
    global.fetch.mockImplementationOnce((url, options) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ ok: true, json: async () => [] }), 20000);
        options?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
    );

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(504);
    expect(jsonData.error).toBe('Request timeout');
  }, 20000);

  it('should filter out invalid markets', async () => {
    const mockResponse = [
      {
        id: '1',
        slug: 'valid-market',
        question: 'Valid question',
        volume: 10000
      },
      {
        id: '2',
        // Missing slug and question
        volume: 5000
      },
      {
        slug: 'invalid-no-id',
        question: 'No ID'
        // Missing id
      }
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.length).toBe(1);
    expect(jsonData[0].id).toBe('1');
  });

  it('should handle invalid response format', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'not an array' })
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(500);
    expect(jsonData.error).toBe('Failed to fetch markets');
  });

  it('should set appropriate cache headers', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    await handler(mockReq, mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      's-maxage=30, stale-while-revalidate=60'
    );
  });
});
