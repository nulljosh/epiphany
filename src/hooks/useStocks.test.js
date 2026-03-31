import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStocks, useStockHistory } from './useStocks';

// Mock fetch globally
global.fetch = vi.fn();

describe('useStocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(); // fresh mock — prevents mockResolvedValue bleed between tests
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

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

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
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'format' })
    });

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

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => useStocks(['AAPL', 'INVALID']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stocks).toHaveProperty('AAPL');
    expect(result.current.stocks).not.toHaveProperty('INVALID');
  });

  it('should only expose symbols returned by the live response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ symbol: 'AAPL', price: 150.25, change: 2.5, changePercent: 1.69 }]
    });

    const { result } = renderHook(() => useStocks(['AAPL']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(Object.keys(result.current.stocks)).toEqual(['AAPL']);
  });

  it('should split oversized symbol lists into multiple requests and merge the results', async () => {
    const symbols = Array.from({ length: 101 }, (_, index) => `SYM${index}`);

    // 101 symbols / 50 per chunk = 3 chunks
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ symbol: 'SYM0', price: 100, change: 1, changePercent: 1 }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ symbol: 'SYM50', price: 150, change: 0, changePercent: 0 }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ symbol: 'SYM100', price: 200, change: -1, changePercent: -0.5 }]
      });

    const { result } = renderHook(() => useStocks(symbols));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const stockCalls = global.fetch.mock.calls.filter(c => c[0].includes('/api/stocks-free'));
    expect(stockCalls.length).toBe(3);
    expect(result.current.stocks.SYM0.price).toBe(100);
    expect(result.current.stocks.SYM100.price).toBe(200);
  });

  it('should refetch data when refetch is called', async () => {
    const mockData = [
      { symbol: 'AAPL', price: 150.25, change: 2.5, changePercent: 1.69 }
    ];

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => useStocks(['AAPL']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Call refetch
    result.current.refetch();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle HTTP error responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Server error' })
    });

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
