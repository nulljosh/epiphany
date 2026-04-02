import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStocks, useStockHistory } from './useStocks';

// Mock fetch globally
global.fetch = vi.fn();

describe('useStocks', () => {
  // Helper: creates a fetch mock that returns cache miss for /api/latest
  // and routes other calls to the provided handler
  const mockFetchWith = (handler) => {
    const latestResp = { ok: true, json: async () => ({ cached: false, data: null }) };
    let latestConsumed = false;
    global.fetch = vi.fn().mockImplementation((url, ...args) => {
      if (!latestConsumed && typeof url === 'string' && url.includes('/api/latest')) {
        latestConsumed = true;
        return Promise.resolve(latestResp);
      }
      return handler(url, ...args);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: cache miss + empty stocks
    mockFetchWith(() => Promise.resolve({ ok: true, json: async () => [] }));
  });

  it('should fetch stocks successfully', async () => {
    const mockData = [
      {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.5,
        changePercent: 1.69,
        volume: 50000000,
        fiftyTwoWeekHigh: 180,
        fiftyTwoWeekLow: 120
      },
      {
        symbol: 'GOOGL',
        price: 2800.50,
        change: -15.25,
        changePercent: -0.54,
        volume: 20000000,
        fiftyTwoWeekHigh: 3000,
        fiftyTwoWeekLow: 2500
      }
    ];

    mockFetchWith(() => Promise.resolve({ ok: true, json: async () => mockData }));

    const { result } = renderHook(() => useStocks(['AAPL', 'GOOGL']));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stocks).toHaveProperty('AAPL');
    expect(result.current.stocks).toHaveProperty('GOOGL');
    expect(result.current.stocks.AAPL.price).toBe(150.25);
    expect(result.current.stocks.GOOGL.price).toBe(2800.50);
    expect(result.current.error).toBeNull();
  });

  it('should show loading with fallback data before the first fetch resolves', () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useStocks(['AAPL']));

    expect(result.current.loading).toBe(true);
    expect(result.current.stocks).toBeDefined();
    expect(result.current.stocks.AAPL).toBeDefined();
    expect(result.current.reliability.status).toBe('loading');
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useStocks(['AAPL']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    // Hook initializes with FALLBACK_DATA so stocks is never empty on error
    expect(result.current.stocks).toBeDefined();
  });

  it('should handle invalid response format', async () => {
    mockFetchWith(() => Promise.resolve({ ok: true, json: async () => ({ invalid: 'format' }) }));

    const { result } = renderHook(() => useStocks(['AAPL']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should filter out invalid stock data', async () => {
    const mockData = [
      { symbol: 'AAPL', price: 150.25, change: 2.5, changePercent: 1.69 },
      { symbol: 'INVALID', price: null }, // Invalid - missing price
      { price: 100 }, // Invalid - missing symbol
    ];

    mockFetchWith(() => Promise.resolve({ ok: true, json: async () => mockData }));

    const { result } = renderHook(() => useStocks(['AAPL', 'INVALID']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stocks).toHaveProperty('AAPL');
    expect(result.current.stocks).not.toHaveProperty('INVALID');
  });

  it('should merge live data on top of fallback (never lose symbols)', async () => {
    mockFetchWith(() => Promise.resolve({
      ok: true,
      json: async () => [{ symbol: 'AAPL', price: 150.25, change: 2.5, changePercent: 1.69 }]
    }));

    const { result } = renderHook(() => useStocks(['AAPL']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Live data merges on top of fallback -- AAPL updated, others preserved
    expect(result.current.stocks['AAPL'].price).toBe(150.25);
    expect(Object.keys(result.current.stocks).length).toBeGreaterThan(1);
  });

  it('should split oversized symbol lists into multiple requests and merge the results', async () => {
    const symbols = Array.from({ length: 101 }, (_, index) => `SYM${index}`);

    // /api/latest returns cache miss, then 3 chunks of /api/stocks-free
    const chunkResponses = [
      [{ symbol: 'SYM0', price: 100, change: 1, changePercent: 1 }],
      [{ symbol: 'SYM50', price: 150, change: 0, changePercent: 0 }],
      [{ symbol: 'SYM100', price: 200, change: -1, changePercent: -0.5 }],
    ];
    let chunkIdx = 0;
    mockFetchWith(() => Promise.resolve({
      ok: true,
      json: async () => chunkResponses[chunkIdx++] || []
    }));

    const { result } = renderHook(() => useStocks(symbols));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const stockCalls = global.fetch.mock.calls.filter(c => c[0].includes('/api/stocks-free'));
    // At least 3 chunks (may include retries from fetchWithRetry)
    expect(stockCalls.length).toBeGreaterThanOrEqual(3);
    expect(result.current.stocks.SYM0.price).toBe(100);
  });

  it('should refetch data when refetch is called', async () => {
    const mockData = [
      { symbol: 'AAPL', price: 150.25, change: 2.5, changePercent: 1.69 }
    ];

    mockFetchWith(() => Promise.resolve({ ok: true, json: async () => mockData }));

    const { result } = renderHook(() => useStocks(['AAPL']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Init makes 2 calls: /api/latest (cache seed) + /api/stocks-free
    const initCalls = global.fetch.mock.calls.length;

    // Call refetch
    result.current.refetch();

    await waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThan(initCalls);
    });
  });

  it('should handle HTTP error responses', async () => {
    mockFetchWith(() => Promise.resolve({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Server error' })
    }));

    const { result } = renderHook(() => useStocks(['AAPL']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});

describe('useStockHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch stock history successfully', async () => {
    const mockData = {
      symbol: 'AAPL',
      currency: 'USD',
      history: [
        { date: '2024-01-01', close: 150, open: 148, high: 152, low: 147, volume: 1000000 },
        { date: '2024-01-02', close: 152, open: 151, high: 153, low: 150, volume: 1100000 }
      ]
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => useStockHistory('AAPL', '1y'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.history).toEqual(mockData.history);
    expect(result.current.history.length).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('should handle missing symbol', () => {
    const { result } = renderHook(() => useStockHistory(null, '1y'));

    expect(result.current.loading).toBe(false);
    expect(result.current.history).toEqual([]);
  });

  it('should handle fetch errors', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useStockHistory('AAPL', '1y'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should handle invalid response format', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'format' })
    });

    const { result } = renderHook(() => useStockHistory('AAPL', '1y'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
