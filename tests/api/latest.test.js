import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/latest.js';
import { list } from '@vercel/blob';

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
  list: vi.fn(async (opts) => ({
    blobs: [
      {
        url: 'https://blob.vercel-storage.com/monica-cache/results.json',
        pathname: '/monica-cache/results.json',
      },
    ],
  })),
}));

describe('Latest API', () => {
  let req, res;
  const mockCacheData = {
    markets: [{ id: '1', question: 'Test', slug: 'test' }],
    stocks: [{ symbol: 'AAPL', price: 150 }],
    commodities: { gold: { price: 2000 } },
    crypto: { btc: { spot: 45000 }, eth: { spot: 3000 } },
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    req = { method: 'GET' };

    res = {
      status: vi.fn(function() { return this; }),
      json: vi.fn(function(data) {
        this.data = data;
        return this;
      }),
      setHeader: vi.fn(),
      statusCode: null,
    };

    res.status = vi.fn((code) => {
      res.statusCode = code;
      return res;
    });

    // Mock successful fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCacheData),
      })
    );
  });

  it('should set CORS headers', async () => {
    await handler(req, res);
    
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:5173'
    );
  });

  it('should set cache control headers', async () => {
    await handler(req, res);
    
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=600'
    );
  });

  it('should return cached data successfully', async () => {
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    
    const response = res.json.mock.calls[0][0];
    expect(response.cached).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toEqual(mockCacheData);
  });

  it('should include blob age in response', async () => {
    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.blobAge).toBeDefined();
    expect(typeof response.blobAge).toBe('number');
    expect(response.blobAge >= 0).toBe(true);
  });

  it('should include blob URL in response', async () => {
    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.blobUrl).toBeDefined();
    expect(response.blobUrl.includes('vercel')).toBe(true);
  });

  it('should parse and validate cache data structure', async () => {
    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.data).toHaveProperty('markets');
    expect(response.data).toHaveProperty('stocks');
    expect(response.data).toHaveProperty('commodities');
    expect(response.data).toHaveProperty('crypto');
    expect(response.data).toHaveProperty('updatedAt');
  });
});

describe('Latest API - No Cache', () => {
  let req, res;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    req = { method: 'GET' };

    res = {
      status: vi.fn(function() { return this; }),
      json: vi.fn(function(data) {
        this.data = data;
        return this;
      }),
      setHeader: vi.fn(),
      statusCode: null,
    };

    res.status = vi.fn((code) => {
      res.statusCode = code;
      return res;
    });

    // Mock @vercel/blob to return no blobs
    vi.resetModules();
  });

  it('should handle missing cache gracefully', async () => {
    list.mockResolvedValueOnce({ blobs: [] });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const response = res.json.mock.calls[0][0];
    expect(response.cached).toBe(false);
    expect(response.data).toBeNull();
    expect(response.message).toBeDefined();
  });

  it('should handle null blobs array', async () => {
    list.mockResolvedValueOnce({ blobs: null });

    await handler(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.cached).toBe(false);
  });
});

describe('Latest API - Error Handling', () => {
  let req, res;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    req = { method: 'GET' };

    res = {
      status: vi.fn(function() { return this; }),
      json: vi.fn(function(data) {
        this.data = data;
        return this;
      }),
      setHeader: vi.fn(),
      statusCode: null,
    };

    res.status = vi.fn((code) => {
      res.statusCode = code;
      return res;
    });
  });

  it('should handle blob fetch timeout', async () => {
    global.fetch = vi.fn(() => {
      const c = new AbortController();
      c.abort();
      return Promise.reject(new Error('AbortError'));
    });

    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    
    const response = res.json.mock.calls[0][0];
    expect(response.cached).toBe(false);
    expect(response.error).toBeDefined();
  });

  it('should handle blob HTTP errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      })
    );

    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.cached).toBe(false);
    expect(response.error).toContain('404');
  });

  it('should handle invalid JSON in cache', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })
    );

    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.cached).toBe(false);
    expect(response.error).toBeDefined();
  });

  it('should include timestamp on error', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.timestamp).toBeDefined();
    
    // Verify it's a valid ISO timestamp
    const date = new Date(response.timestamp);
    expect(date instanceof Date && !isNaN(date)).toBe(true);
  });
});
