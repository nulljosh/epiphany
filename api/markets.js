export default async function handler(req, res) {
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const url = `https://gamma-api.polymarket.com/markets?closed=${closed}&limit=${limit}&order=${order}&ascending=${ascending}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Polymarket API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response is an array
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format: expected array');
    }

    // Filter out markets with missing critical data
    const validMarkets = data.filter(market =>
      market &&
      market.id &&
      market.question &&
      market.slug
    );

    if (validMarkets.length < data.length) {
      console.warn(`Filtered out ${data.length - validMarkets.length} invalid markets`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(validMarkets);
  } catch (error) {
    console.error('Markets API error:', error);

    if (error.name === 'AbortError') {
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
