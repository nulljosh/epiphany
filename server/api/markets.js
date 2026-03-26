import { applyCors } from './_cors.js';
const POLYMARKET_URL = 'https://gamma-api.polymarket.com/markets';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = process.env.NODE_ENV === 'test' ? 1 : 3;
const RETRY_BASE_MS = 300;
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';
const CACHE_TTL_MS = 30000;
const STALE_IF_ERROR_MS = 5 * 60 * 1000;
const cache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getCached(cacheKey, maxAgeMs) {
  if (!ENABLE_CACHE) return null;
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > maxAgeMs) return null;
  return cached.data;
}

export default async function handler(req, res) {
  applyCors(req, res);
  // Validate query parameters
  const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
  const closed = req.query.closed === 'true';
  const order = req.query.order || 'volume24hr';
  const ascending = req.query.ascending === 'true';

  // Validate order parameter
  const validOrders = ['volume24hr', 'volume', 'liquidity', 'endDate'];
  if (!validOrders.includes(order)) {
    return res.status(400).json({
      error: 'Invalid order parameter',
      details: `Order must be one of: ${validOrders.join(', ')}`
    });
  }

  const cacheKey = `${closed}:${limit}:${order}:${ascending}`;
  const freshCached = getCached(cacheKey, CACHE_TTL_MS);
  if (freshCached) {
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.setHeader('X-Monica-Data-Status', 'cache');
    return res.status(200).json(freshCached);
  }

  try {
    let data = null;
    let lastError = null;
    const url = `${POLYMARKET_URL}?closed=${closed}&limit=${limit}&order=${order}&ascending=${ascending}`;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      let timeoutId;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            const timeoutError = new Error('Request timeout');
            timeoutError.name = 'TimeoutError';
            reject(timeoutError);
          }, REQUEST_TIMEOUT_MS);
        });

        const response = await Promise.race([
          fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          }),
          timeoutPromise,
        ]);

        if (!response.ok) {
          throw new Error(`Polymarket API returned ${response.status}: ${response.statusText}`);
        }

        data = await response.json();
        break;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS - 1) {
          const delay = process.env.NODE_ENV === 'test' ? 0 : RETRY_BASE_MS * (2 ** attempt);
          await sleep(delay);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!data) throw lastError || new Error('No data returned from Polymarket');

    // Validate response is an array
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format: expected array');
    }

    // Filter out markets with missing critical data
    const validMarkets = data
      .filter(market =>
        market &&
        market.id &&
        market.question &&
        market.slug
      )
      .map(market => ({
        ...market,
        // Use the event slug for the Polymarket URL (market.slug is an internal ID)
        eventSlug: market.events?.[0]?.slug || market.slug
      }));

    if (validMarkets.length < data.length) {
      console.warn(`Filtered out ${data.length - validMarkets.length} invalid markets`);
    }

    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: validMarkets });
    }

        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.setHeader('X-Monica-Data-Status', 'live');
    return res.status(200).json(validMarkets);
  } catch (error) {
    console.error('Markets API error:', error);

    const staleCached = getCached(cacheKey, STALE_IF_ERROR_MS);
    if (staleCached) {
            res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      res.setHeader('X-Monica-Data-Status', 'stale');
      return res.status(200).json(staleCached);
    }

    if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message === 'Request timeout') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'Polymarket API did not respond in time'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch markets',
      details: error.message
    });
  }
}
