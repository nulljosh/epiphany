import { useState, useEffect, useCallback } from 'react';
import { FETCH_TIMEOUT } from '../utils/helpers';

// Yahoo Finance symbols for commodities & indices
const YAHOO_SYMBOLS = {
  gold: 'GC=F',
  silver: 'SI=F',
  platinum: 'PL=F',
  palladium: 'PA=F',
  copper: 'HG=F',
  oil: 'CL=F',
  natgas: 'NG=F',
  nas100: '^NDX',
  us500: '^GSPC',
  us30: '^DJI',
  dxy: 'DX-Y.NYB',
};

// Reverse lookup: symbol -> asset key
const SYMBOL_TO_KEY = Object.fromEntries(
  Object.entries(YAHOO_SYMBOLS).map(([k, v]) => [v, k])
);

export function useLivePrices(initialAssets) {
  const [prices, setPrices] = useState(initialAssets);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCryptoPrices = useCallback(async () => {
    try {
      const response = await fetch('/api/prices', { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (!response.ok) throw new Error('CoinGecko API error');
      const data = await response.json();

      return {
        btc: {
          spot: data.btc?.spot,
          chgPct: data.btc?.chgPct || 0,
        },
        eth: {
          spot: data.eth?.spot,
          chgPct: data.eth?.chgPct || 0,
        },
      };
    } catch (err) {
      console.error('Crypto price fetch error:', err);
      return null;
    }
  }, []);

  const fetchCommodityPrices = useCallback(async () => {
    try {
      // Use new multi-source commodities API
      const response = await fetch('/api/commodities', { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (!response.ok) throw new Error('Commodities API error');
      const data = await response.json();

      const updates = {};
      Object.entries(data).forEach(([key, q]) => {
        if (q.price) {
          updates[key] = {
            spot: q.price,
            chgPct: q.changePercent || 0,
            chg: q.change || 0,
            hi52: q.high52,
            lo52: q.low52,
          };
        }
      });
      return updates;
    } catch (err) {
      console.error('Commodity price fetch error:', err);
      return null;
    }
  }, []);

  const fetchAllPrices = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch crypto and commodities in parallel
      const [cryptoPrices, commodityPrices] = await Promise.all([
        fetchCryptoPrices(),
        fetchCommodityPrices(),
      ]);

      setPrices(prev => {
        const updated = { ...prev };
        let changed = false;

        // Update crypto
        if (cryptoPrices) {
          for (const key of ['btc', 'eth']) {
            const src = cryptoPrices[key];
            if (src?.spot && src.spot !== prev[key]?.spot) {
              changed = true;
              updated[key] = {
                ...prev[key],
                spot: src.spot,
                chgPct: src.chgPct,
                chg: src.spot * (src.chgPct / 100),
              };
            }
          }
        }

        // Update commodities & indices
        if (commodityPrices) {
          for (const [key, data] of Object.entries(commodityPrices)) {
            if (prev[key] && data.spot !== prev[key].spot) {
              changed = true;
              updated[key] = {
                ...prev[key],
                spot: data.spot,
                chgPct: data.chgPct,
                chg: data.chg,
                hi52: data.hi52 || prev[key].hi52,
                lo52: data.lo52 || prev[key].lo52,
              };
            }
          }
        }

        return changed ? updated : prev;
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Price fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchCryptoPrices, fetchCommodityPrices]);

  // Fetch on mount and every 60 seconds (was 5s -- burned ~17K invocations/user/day)
  useEffect(() => {
    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchAllPrices]);

  return {
    prices,
    loading,
    lastUpdated,
    refetch: fetchAllPrices,
  };
}

// Format relative time
export function formatLastUpdated(date) {
  if (!date) return 'Never';
  const seconds = Math.floor((new Date() - date) / 1000);

  // If recent, show actual time
  if (seconds < 3600) {
    return `at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  // For older updates, show relative time
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
