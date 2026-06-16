import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePolymarket, validatePolymarketLink } from './usePolymarket';

// Mock fetch globally
global.fetch = vi.fn();

describe('usePolymarket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch markets successfully', async () => {
    const mockData = [
      {
        id: '1',
        slug: 'test-market',
        question: 'Will it rain tomorrow?',
        description: 'Test market description',
        category: 'Weather',
        endDate: '2024-12-31',
        volume24hr: 10000,
        volume: 50000,
        liquidity: 20000,
        outcomePrices: JSON.stringify([0.65, 0.35]),
        image: 'https://example.com/image.jpg',
        active: true
      },
      {
        id: '2',
        slug: 'another-market',
        question: 'Will BTC hit 100k?',
        category: 'Crypto',
        bestBid: 0.75,
        volume24hr: 50000,
        volume: 200000,
        liquidity: 75000,
        active: true
      }
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => usePolymarket());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markets.length).toBe(2);
    expect(result.current.markets[0].question).toBeTruthy();
    expect(result.current.markets[0].probability).toBeTruthy();
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePolymarket());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.markets).toEqual([]);
  });

  it('should filter out invalid markets', async () => {
    const mockData = [
      {
        id: '1',
        slug: 'valid-market',
        question: 'Valid question',
        bestBid: 0.5
      },
      {
        id: '2',
        // Missing slug and question - should be filtered
        bestBid: 0.6
      },
      {
        slug: 'invalid-no-id',
        question: 'No ID',
        // Missing id - should be filtered
      }
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => usePolymarket());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markets.length).toBe(1);
    expect(result.current.markets[0].slug).toBe('valid-market');
  });

  it('should sort markets by probability', async () => {
    const mockData = [
      { id: '1', slug: 'low', question: 'Low prob', bestBid: 0.2 },
      { id: '2', slug: 'high', question: 'High prob', bestBid: 0.9 },
      { id: '3', slug: 'mid', question: 'Mid prob', bestBid: 0.5 }
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => usePolymarket());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markets[0].probability).toBe(0.9); // Highest first
    expect(result.current.markets[1].probability).toBe(0.5);
    expect(result.current.markets[2].probability).toBe(0.2);
  });

  it('should search markets by query', async () => {
    const mockSearchResults = [
      { id: '1', slug: 'search-result', question: 'Search result' }
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ topTraders: [], recentMoves: [], totalWhaleTrades: 0 })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResults
    });

    const { result } = renderHook(() => usePolymarket());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const searchResults = await result.current.searchMarkets('test query');
    expect(searchResults.length).toBe(1);
  });

  it('should handle invalid search query', async () => {
    const { result } = renderHook(() => usePolymarket());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const results1 = await result.current.searchMarkets(null);
    const results2 = await result.current.searchMarkets('');

    expect(results1).toEqual([]);
    expect(results2).toEqual([]);
  });

  it('should get single market by slug', async () => {
    const mockMarket = {
      id: '1',
      slug: 'test-market',
      question: 'Test question'
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ topTraders: [], recentMoves: [], totalWhaleTrades: 0 })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMarket
    });

    const { result } = renderHook(() => usePolymarket());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const market = await result.current.getMarket('test-market');
    expect(market.slug).toBe('test-market');
  });

  it('should handle invalid market slug', async () => {
    const { result } = renderHook(() => usePolymarket());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const result1 = await result.current.getMarket(null);
    const result2 = await result.current.getMarket('');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });
});

describe('validatePolymarketLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate a link successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    });

    const result = await validatePolymarketLink('valid-slug');
    expect(result).toBe(true);
  });

  it('should cache validation results', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    });

    const result1 = await validatePolymarketLink('cached-slug');
    const result2 = await validatePolymarketLink('cached-slug');

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    // Should only fetch once due to caching
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await validatePolymarketLink('error-slug');
    // Should return true on error to avoid false positives
    expect(result).toBe(true);
  });
});
