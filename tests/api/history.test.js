import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/history.js';

global.fetch = vi.fn();

function makeYahooResponse(timestamps, closes) {
  return {
    chart: {
      result: [{
        meta: { currency: 'USD' },
        timestamp: timestamps,
        indicators: {
          quote: [{
            open: closes,
            high: closes,
            low: closes,
            close: closes,
            volume: closes.map(() => 1000000),
          }]
        }
      }]
    }
  };
}

describe('History API', () => {
  let mockReq;
  let mockRes;
  let jsonData;
  let statusCode;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonData = null;
    statusCode = 200;

    mockReq = {
      query: { symbol: 'AAPL', range: '1y', interval: '1d' },
      headers: {}
    };

    mockRes = {
      status: vi.fn((code) => { statusCode = code; return mockRes; }),
      json: vi.fn((data) => { jsonData = data; return mockRes; }),
      setHeader: vi.fn()
    };
  });

  it('returns daily history with date-only format', async () => {
    const ts = [1700000000, 1700086400];
    const closes = [150.0, 155.0];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeYahooResponse(ts, closes))
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.history.length).toBe(2);
    // Daily range should have date-only format (no T)
    expect(jsonData.history[0].date).not.toContain('T');
  });

  it('returns intraday history with full ISO format for 1d range', async () => {
    mockReq.query = { symbol: 'AAPL', range: '1d', interval: '5m' };
    const ts = [1700000000, 1700000300];
    const closes = [150.0, 150.5];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeYahooResponse(ts, closes))
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.history.length).toBe(2);
    // 1d range should have full ISO timestamps with T
    expect(jsonData.history[0].date).toContain('T');
  });

  it('returns intraday history with full ISO format for 5d range', async () => {
    mockReq.query = { symbol: 'AAPL', range: '5d', interval: '15m' };
    const ts = [1700000000];
    const closes = [150.0];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeYahooResponse(ts, closes))
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.history[0].date).toContain('T');
  });

  it('rejects invalid symbol format', async () => {
    mockReq.query = { symbol: 'AAPL; DROP TABLE', range: '1y', interval: '1d' };

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(400);
    expect(jsonData.error).toContain('Invalid symbol');
  });

  it('rejects invalid range', async () => {
    mockReq.query = { symbol: 'AAPL', range: 'invalid', interval: '1d' };

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(400);
    expect(jsonData.error).toContain('Invalid range');
  });

  it('rejects invalid interval', async () => {
    mockReq.query = { symbol: 'AAPL', range: '1y', interval: 'invalid' };

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(400);
    expect(jsonData.error).toContain('Invalid interval');
  });

  it('handles Yahoo API returning no data', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ chart: { result: [{ timestamp: [], indicators: { quote: [{}] }, meta: {} }] } })
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(404);
    expect(jsonData.error).toContain('No valid data');
  });

  it('handles Yahoo API returning error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ chart: { error: { description: 'No data found' } } })
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(404);
  });

  it('handles fetch timeout', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch.mockRejectedValueOnce(abortError);

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(504);
  });

  it('filters out null close values', async () => {
    const ts = [1700000000, 1700086400, 1700172800];
    const closes = [150.0, null, 155.0];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeYahooResponse(ts, closes))
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.history.length).toBe(2);
  });

  it('defaults symbol to AAPL when missing', async () => {
    mockReq.query = {};
    const ts = [1700000000];
    const closes = [150.0];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeYahooResponse(ts, closes))
    });

    await handler(mockReq, mockRes);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('AAPL'),
      expect.any(Object)
    );
  });
});
