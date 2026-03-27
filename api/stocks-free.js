// 100% FREE stock API using Yahoo Finance (no key needed)
// Uses batch quote endpoint to minimize requests and avoid rate limiting

export default async function handler(req, res) {
  const symbols = req.query.symbols || 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA';
  const symbolList = symbols.split(',').filter(s => s.trim());

  if (symbolList.length > 50) {
    return res.status(400).json({ error: 'Too many symbols (max 50)' });
  }

  try {
    // Try batch via v6 quote endpoint first (single request for all symbols)
    const quoteBatchUrl = `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${symbolList.join(',')}`;
    let stocks = [];

    try {
      const batchRes = await fetch(quoteBatchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        const results = batchData?.quoteResponse?.result || [];
        stocks = results.map(q => ({
          symbol: q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChange || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          high: q.regularMarketDayHigh || q.regularMarketPrice,
          low: q.regularMarketDayLow || q.regularMarketPrice,
          open: q.regularMarketOpen || q.regularMarketPreviousClose,
          prevClose: q.regularMarketPreviousClose || 0,
          marketCap: q.marketCap || null,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || null,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow || null,
        })).filter(s => s.price);
      }
    } catch {
      // v6 batch failed, fall through to v8 individual
    }

    // Fallback: individual v8 chart requests with allSettled
    if (stocks.length === 0) {
      const promises = symbolList.map(async (symbol) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const meta = data.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return null;

        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose;
        const change = price - prevClose;
        const changePercent = (change / prevClose) * 100;

        return {
          symbol,
          price,
          change,
          changePercent,
          volume: meta.regularMarketVolume || 0,
          high: meta.regularMarketDayHigh || price,
          low: meta.regularMarketDayLow || price,
          open: meta.regularMarketOpen || prevClose,
          prevClose,
          marketCap: null,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
        };
      });

      const results = await Promise.allSettled(promises);
      stocks = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
    }

    if (stocks.length === 0) {
      throw new Error('No valid stock data received');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(stocks);
  } catch (error) {
    console.error('Yahoo API error:', error);
    res.status(500).json({
      error: 'Failed to fetch stock data',
      details: error.message
    });
  }
}
