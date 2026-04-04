// Multi-source commodity prices API
// Uses Yahoo Finance chart endpoint (more reliable than quote endpoint)

export default async function handler(req, res) {
  const results = {};

  const symbols = {
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

  try {
    // Fetch each symbol using chart endpoint (more reliable)
    const fetches = Object.entries(symbols).map(async ([key, symbol]) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per request

        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Yahoo API returned ${response.status} for ${symbol}`);
        }

        const data = await response.json();

        // Check for API errors in response
        if (data.chart?.error) {
          throw new Error(`API error for ${symbol}: ${data.chart.error.description}`);
        }

        const meta = data.chart?.result?.[0]?.meta;

        if (meta?.regularMarketPrice && typeof meta.regularMarketPrice === 'number') {
          // Calculate change from previous close
          const prevClose = meta.chartPreviousClose || meta.previousClose;
          const price = meta.regularMarketPrice;
          const change = prevClose && typeof prevClose === 'number' ? price - prevClose : 0;
          const changePercent = prevClose && typeof prevClose === 'number'
            ? ((price - prevClose) / prevClose) * 100
            : 0;

          results[key] = {
            price,
            change,
            changePercent,
            high52: meta.fiftyTwoWeekHigh ?? null,
            low52: meta.fiftyTwoWeekLow ?? null,
            source: 'yahoo_chart',
          };
        } else {
          console.warn(`No valid price data for ${key} (${symbol})`);
        }
      } catch (err) {
        console.error(`Error fetching ${key} (${symbol}):`, err.message);
        // Don't add to results - this symbol will be missing from response
      }
    });

    await Promise.all(fetches);

    // Check if we got at least some data
    if (Object.keys(results).length === 0) {
      return res.status(503).json({
        error: 'No commodity data available',
        details: 'Failed to fetch data from all sources'
      });
    }

    // Log how many symbols failed
    const failedCount = Object.keys(symbols).length - Object.keys(results).length;
    if (failedCount > 0) {
      console.warn(`Successfully fetched ${Object.keys(results).length}/${Object.keys(symbols).length} commodities (${failedCount} failed)`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(results);
  } catch (error) {
    console.error('Commodities API error:', error);
    res.status(500).json({
      error: 'Failed to fetch commodity data',
      details: error.message
    });
  }
}
