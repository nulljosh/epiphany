// Vercel serverless proxy for Yahoo Finance historical data
export default async function handler(req, res) {
  const symbol = req.query.symbol || 'AAPL';
  const range = req.query.range || '1y'; // 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
  const interval = req.query.interval || '1d'; // 1m, 5m, 15m, 1d, 1wk, 1mo

  // Validate symbol format (alphanumeric, hyphens, dots, equals, carets only)
  if (!/^[\w\-\.=\^]+$/.test(symbol)) {
    return res.status(400).json({
      error: 'Invalid symbol format',
      details: 'Symbol must contain only letters, numbers, hyphens, dots, equals, and carets'
    });
  }

  // Validate range
  const validRanges = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'];
  if (!validRanges.includes(range)) {
    return res.status(400).json({
      error: 'Invalid range parameter',
      details: `Range must be one of: ${validRanges.join(', ')}`
    });
  }

  // Validate interval
  const validIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
  if (!validIntervals.includes(interval)) {
    return res.status(400).json({
      error: 'Invalid interval parameter',
      details: `Interval must be one of: ${validIntervals.join(', ')}`
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for API error in response
    if (data.chart?.error) {
      return res.status(404).json({
        error: 'Symbol not found',
        details: data.chart.error.description || 'Invalid symbol'
      });
    }

    const result = data.chart?.result?.[0];

    if (!result) {
      return res.status(404).json({
        error: 'No data found',
        details: `No historical data available for symbol ${symbol}`
      });
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    // Map and filter invalid data points
    const history = timestamps
      .map((t, i) => ({
        date: new Date(t * 1000).toISOString().split('T')[0],
        open: quotes.open?.[i] ?? null,
        high: quotes.high?.[i] ?? null,
        low: quotes.low?.[i] ?? null,
        close: quotes.close?.[i] ?? null,
        volume: quotes.volume?.[i] ?? null,
      }))
      .filter(h => h.close !== null && !isNaN(h.close));

    if (history.length === 0) {
      return res.status(404).json({
        error: 'No valid data points',
        details: 'All data points were invalid or missing'
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200'); // Cache for 1 hour
    res.status(200).json({
      symbol,
      currency: result.meta?.currency || 'USD',
      history
    });
  } catch (error) {
    console.error('History API error:', error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'Yahoo Finance API did not respond in time'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch historical data',
      details: error.message
    });
  }
}
