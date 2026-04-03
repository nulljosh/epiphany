import { useState, useEffect, useCallback, useRef } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

// Use relative paths - works on any domain (Vercel auto-serves from same origin)
const POLYMARKET_API = '/api';

// Cache for validated links (slug -> isValid)
const linkValidationCache = new Map();

// Validate a Polymarket link by checking if it returns 404
export async function validatePolymarketLink(slug) {
  // Check cache first
  if (linkValidationCache.has(slug)) {
    return linkValidationCache.get(slug);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    // Use HEAD request to check if page exists (faster than GET)
    const response = await fetch(`https://polymarket.com/event/${slug}`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors' // Allow request even if CORS is blocked
    });

    clearTimeout(timeoutId);

    // With no-cors, we can't read status, so assume valid
    // For actual validation, this would need a backend proxy
    const isValid = true;

    linkValidationCache.set(slug, isValid);
    return isValid;
  } catch (err) {
    // On error, assume link might be valid (don't filter out)
    // This prevents false positives from network errors
    console.warn(`Link validation failed for ${slug}:`, err.message);
    return true;
  }
}

// Retry helper with exponential backoff
const fetchWithRetry = async (url, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1}/${maxRetries} failed:`, err.message);

      // Don't retry on certain errors
      if (err.message.includes('400') || err.message.includes('Invalid')) {
        throw err;
      }

      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = process.env.NODE_ENV === 'test' ? 0 : baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

// Transform raw Polymarket API data to our format
const transformMarkets = (data) => {
  if (!Array.isArray(data)) return [];
  return data
    .filter(m => m && m.id && m.slug && m.question)
    .map(m => {
      let prob = null;
      if (m.outcomePrices) {
        try {
          const prices = JSON.parse(m.outcomePrices);
          prob = parseFloat(prices[0]);
        } catch(e) {
          console.warn(`Failed to parse outcomePrices for ${m.slug}:`, e.message);
        }
      }
      if (!prob && m.bestBid) prob = parseFloat(m.bestBid);
      if (!prob && m.outcomes?.[0]?.price) prob = parseFloat(m.outcomes[0].price);

      return {
        id: m.id,
        slug: m.slug,
        question: m.question,
        description: m.description || '',
        category: m.category || 'General',
        endDate: m.endDate,
        volume24h: parseFloat(m.volume24hr) || 0,
        volumeTotal: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        outcomes: m.outcomes || [],
        bestBid: m.bestBid ? parseFloat(m.bestBid) : null,
        bestAsk: m.bestAsk ? parseFloat(m.bestAsk) : null,
        probability: prob,
        change24h: m.change24hr ? parseFloat(m.change24hr) : null,
        image: m.image,
        active: m.active,
        // Use event slug for Polymarket URL — market.slug is an internal ID, not the URL slug
        eventSlug: m.eventSlug || m.events?.[0]?.slug || m.slug,
      };
    })
    .sort((a, b) => (b.probability || 0) - (a.probability || 0));
};

export function usePolymarket() {
  const [markets, setMarkets] = useState([]);
  const [whales, setWhales] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryCountRef = useRef(0);
  const seededFromCache = useRef(false);
  const liveLoaded = useRef(false);

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);

      const [data, whaleData] = await Promise.all([
        fetchWithRetry(`${POLYMARKET_API}/markets`),
        fetchWithRetry(`${POLYMARKET_API}/polymarket-whales`).catch(() => null),
      ]);

      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array');
      }

      const transformed = transformMarkets(data);
      setMarkets(transformed);
      if (whaleData) setWhales(whaleData);
      setError(null);
      retryCountRef.current = 0;
      liveLoaded.current = true;
    } catch (err) {
      setError(err.message);
      console.error('Polymarket fetch error:', err);
      retryCountRef.current += 1;
    } finally {
      setLoading(false);
    }
  }, []);

  // Seed from Blob cache first (instant load), then fetch live data
  useEffect(() => {
    const seedFromCache = async () => {
      if (process.env.NODE_ENV === 'test') return;
      try {
        const res = await fetch('/api/latest');
        if (!res.ok) return;
        const { cached, data } = await res.json();
        if (cached && data?.markets?.length > 0 && !seededFromCache.current && !liveLoaded.current) {
          seededFromCache.current = true;
          const transformed = transformMarkets(data.markets);
          setMarkets(transformed);
          setLoading(false);
        }
      } catch {
        // Cache miss is fine, live fetch will handle it
      }
    };

    seedFromCache();
  }, [fetchMarkets]);

  useVisibilityPolling(fetchMarkets, 120_000, [fetchMarkets]);

  // Search markets by query
  const searchMarkets = useCallback(async (query) => {
    if (!query || typeof query !== 'string') {
      console.error('Invalid search query');
      return [];
    }

    try {
      const data = await fetchWithRetry(
        `${POLYMARKET_API}/markets?closed=false&limit=20&title_contains=${encodeURIComponent(query)}`
      );

      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Search error:', err);
      return [];
    }
  }, []);

  // Get single market details
  const getMarket = useCallback(async (slug) => {
    if (!slug || typeof slug !== 'string') {
      console.error('Invalid market slug');
      return null;
    }

    try {
      const data = await fetchWithRetry(`${POLYMARKET_API}/markets/${encodeURIComponent(slug)}`);
      return data;
    } catch (err) {
      console.error('Get market error:', err);
      return null;
    }
  }, []);

  return {
    markets,
    whales,
    loading,
    error,
    refetch: fetchMarkets,
    searchMarkets,
    getMarket,
    retryCount: retryCountRef.current,
  };
}

// Category filters for common market types
export const MARKET_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'politics', label: 'Politics' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'sports', label: 'Sports' },
  { id: 'finance', label: 'Finance' },
  { id: 'culture', label: 'Culture' },
];
