import { useState, useEffect, useCallback } from 'react';

const MANIFOLD_API = 'https://api.manifold.markets/v0';

export function useManifold() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch trending markets sorted by liquidity
      const response = await fetch(`${MANIFOLD_API}/markets?limit=50&sort=liquidity`);

      if (!response.ok) throw new Error('Failed to fetch Manifold markets');

      const data = await response.json();

      // Transform to match our format (similar to Polymarket)
      const transformed = data
        .filter(m => m.isResolved === false && m.closeTime > Date.now())
        .map(m => ({
          id: m.id,
          slug: m.slug,
          question: m.question,
          description: m.textDescription || '',
          category: m.groupSlugs?.[0] || 'general',
          endDate: m.closeTime ? new Date(m.closeTime).toISOString() : null,
          volume24h: m.volume24Hours || 0,
          volumeTotal: m.volume || 0,
          liquidity: m.totalLiquidity || 0,
          probability: m.probability,
          image: m.coverImageUrl,
          url: `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
          source: 'manifold',
        }))
        .slice(0, 20);

      // Sort by probability (highest first)
      transformed.sort((a, b) => (b.probability || 0) - (a.probability || 0));
      setMarkets(transformed);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Manifold fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  return {
    markets,
    loading,
    error,
    refetch: fetchMarkets,
  };
}
