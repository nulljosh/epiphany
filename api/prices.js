export default async function handler(req, res) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    // Fetch crypto from CoinGecko
    const cryptoRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    clearTimeout(timeoutId);

    if (!cryptoRes.ok) {
      throw new Error(`CoinGecko API returned ${cryptoRes.status}: ${cryptoRes.statusText}`);
    }

    const crypto = await cryptoRes.json();

    // Validate response structure
    if (!crypto || typeof crypto !== 'object') {
      throw new Error('Invalid response format from CoinGecko API');
    }

    // Build prices object with validation
    const prices = {
      btc: {
        spot: crypto.bitcoin?.usd ?? null,
        chgPct: crypto.bitcoin?.usd_24h_change ?? null
      },
      eth: {
        spot: crypto.ethereum?.usd ?? null,
        chgPct: crypto.ethereum?.usd_24h_change ?? null
      },
    };

    // Check if we got at least some valid data
    const hasValidData = Object.values(prices).some(p => p.spot !== null);
    if (!hasValidData) {
      throw new Error('No valid price data received from API');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(prices);
  } catch (error) {
    console.error('Prices API error:', error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'CoinGecko API did not respond in time'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch prices',
      details: error.message
    });
  }
}
