// 100% FREE stock API using Yahoo Finance (no key needed)
// Uses yfinance scraping approach via serverless function

export default async function handler(req, res) {
  const symbols = req.query.symbols || 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA';
  const symbolList = symbols.split(',').filter(s => s.trim());

  if (symbolList.length > 50) {
    return res.status(400).json({ error: 'Too many symbols (max 50)' });
  }

  try {
    // Use Yahoo Finance Chart API (public, no auth needed)
    const promises = symbolList.map(async (symbol) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.warn(`Yahoo chart API error for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) return null;

      const meta = result.meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const change = price - prevClose;
      const changePercent = (change / prevClose) * 100;

      return {
        symbol: symbol,
        price: price,
        change: change,
        changePercent: changePercent,
        volume: meta.regularMarketVolume || 0,
        high: meta.regularMarketDayHigh || price,
        low: meta.regularMarketDayLow || price,
        open: meta.regularMarketOpen || prevClose,
        prevClose: prevClose,
        marketCap: null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
      };
    });

    const results = await Promise.all(promises);
    const stocks = results.filter(r => r !== null);

    if (stocks.length === 0) {
      throw new Error('No valid stock data received');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(stocks);
  } catch (error) {
    console.error('Yahoo Chart API error:', error);
    res.status(500).json({
      error: 'Failed to fetch stock data',
      details: error.message
    });
  }
}
