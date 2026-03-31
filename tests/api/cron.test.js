import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/cron.js';
import { put } from '@vercel/blob';

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (filename, content, opts) => ({
    url: `https://blob.vercel-storage.com/${filename}`,
    pathname: `/${filename}`,
  })),
  list: vi.fn(async (opts) => ({
    blobs: [
      {
        url: 'https://blob.vercel-storage.com/monica-cache/results.json',
        pathname: '/monica-cache/results.json',
      },
    ],
  })),
}));

describe('Cron API', () => {
  let req, res;

  beforeEach(() => {
    req = {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET || 'mock-credential'}`,
      },
    };

    res = {
      status: vi.fn(function() { return this; }),
      json: vi.fn(function(data) { 
        this.data = data;
        return this; 
      }),
      statusCode: null,
      data: null,
    };

    // Mock res.status to properly chain
    res.status = vi.fn((code) => {
      res.statusCode = code;
      return res;
    });

    // Set CRON_SECRET for testing
    process.env.CRON_SECRET = 'mock-credential';
  });

  it('should reject unauthorized requests', async () => {
    const badReq = { headers: { authorization: 'Bearer wrong-credential' } };
    await handler(badReq, res);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('should require Bearer token format', async () => {
    const badReq = { headers: { authorization: 'mock-credential' } }; // Missing "Bearer"
    await handler(badReq, res);
    
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should handle missing authorization header', async () => {
    const noAuthReq = { headers: {} };
    await handler(noAuthReq, res);
    
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should have proper response structure on success', async () => {
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    
    const response = res.json.mock.calls[0][0];
    expect(response).toHaveProperty('ok');
    expect(response).toHaveProperty('counts');
    expect(response).toHaveProperty('blobUrl');
    expect(response).toHaveProperty('updatedAt');
    expect(response).toHaveProperty('timings');
  });

  it('should include timing metrics', async () => {
    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.timings).toBeDefined();
    expect(response.timings).toHaveProperty('fetch');
    expect(response.timings).toHaveProperty('upload');
    expect(response.timings).toHaveProperty('total');
    expect(typeof response.timings.total).toBe('number');
    expect(response.timings.total > 0).toBe(true);
  });

  it('should return counts object with all data sources', async () => {
    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.counts).toHaveProperty('markets');
    expect(response.counts).toHaveProperty('stocks');
    expect(response.counts).toHaveProperty('commodities');
    expect(response.counts).toHaveProperty('crypto');
    
    // Values should be numbers >= 0
    expect(typeof response.counts.markets).toBe('number');
    expect(response.counts.markets >= 0).toBe(true);
  });

  it('should set updatedAt timestamp', async () => {
    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.updatedAt).toBeDefined();
    
    // Verify it's a valid ISO timestamp
    const date = new Date(response.updatedAt);
    expect(date instanceof Date && !isNaN(date)).toBe(true);
  });

  it('should include blob URL in response', async () => {
    await handler(req, res);
    
    const response = res.json.mock.calls[0][0];
    expect(response.blobUrl).toBeDefined();
    expect(response.blobUrl.includes('vercel')).toBe(true);
  });
});

describe('Cron Error Handling', () => {
  let req, res;

  beforeEach(() => {
    req = {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET || 'mock-credential'}`,
      },
    };

    res = {
      status: vi.fn(function() { return this; }),
      json: vi.fn(function(data) { 
        this.data = data;
        return this; 
      }),
      statusCode: null,
    };

    res.status = vi.fn((code) => {
      res.statusCode = code;
      return res;
    });

    process.env.CRON_SECRET = 'mock-credential';
  });

  it('should handle errors gracefully', async () => {
    // Make put throw so the main catch block is triggered
    put.mockRejectedValueOnce(new Error('Blob upload failed'));

    await handler(req, res);

    // Should return 200 with error info for proper Vercel logging
    expect(res.status).toHaveBeenCalledWith(200);

    const response = res.json.mock.calls[0][0];
    expect(response.ok).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.totalTime >= 0).toBe(true);
  });

  it('should include timing on error', async () => {
    put.mockRejectedValueOnce(new Error('Blob upload failed'));

    await handler(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.totalTime).toBeDefined();
    expect(typeof response.totalTime).toBe('number');
  });
});
