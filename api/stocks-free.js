// 100% FREE stock API using Yahoo Finance (no key needed)
export default async function handler(req, res) {
  const symbols = req.query.symbols || 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA';
  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

  if (symbolList.length > 50) {
    return res.status(400).json({ error: 'Too many symbols (max 50)' });
  }

  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

  try {
    // Fetch chart data (price/OHLC) + quote data (fundamentals) in parallel per symbol
    const promises = symbolList.map(async (symbol) => {
      const [chartRes, quoteRes] = await Promise.allSettled([
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { headers }),
        fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&fields=trailingPE,epsTrailingTwelveMonths,beta,marketCap,trailingAnnualDividendYield,averageDailyVolume3Month`, { headers }),
      ]);

      if (chartRes.status !== 'fulfilled' || !chartRes.value.ok) return null;
      const chartData = await chartRes.value.json();
      const result = chartData.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const change = price - prevClose;
      const changePercent = (change / prevClose) * 100;

      // Parse fundamentals from v7 quote if available
      let pe = null, eps = null, beta = null, marketCap = null, yieldVal = null, avgVol = null;
      if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
        try {
          const qData = await quoteRes.value.json();
          const q = qData?.quoteResponse?.result?.[0];
          if (q) {
            pe = q.trailingPE ?? null;
            eps = q.epsTrailingTwelveMonths ?? null;
            beta = q.beta ?? null;
            marketCap = q.marketCap ?? null;
            yieldVal = q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100 : null;
            avgVol = q.averageDailyVolume3Month ?? null;
          }
        } catch { /* non-critical */ }
      }

      return {
        symbol,
        price,
        change,
        changePercent,
        volume: meta.regularMarketVolume || 0,
        avgVolume: avgVol,
        high: meta.regularMarketDayHigh || price,
        low: meta.regularMarketDayLow || price,
        open: meta.regularMarketOpen || prevClose,
        prevClose,
        marketCap,
        peRatio: pe,
        eps,
        beta,
        yield: yieldVal,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
      };
    });

    const results = await Promise.all(promises);
    const stocks = results.filter(Boolean);

    if (stocks.length === 0) throw new Error('No valid stock data received');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(stocks);
  } catch (error) {
    console.error('Yahoo Finance API error:', error);
    res.status(500).json({ error: 'Failed to fetch stock data', details: error.message });
  }
}
