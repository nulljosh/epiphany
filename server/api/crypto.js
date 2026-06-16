// Crypto prices via CoinGecko (free, no auth, 30 calls/min)

const CACHE_TTL = 60_000;
let cache = null;
let cacheTs = 0;

const COINS = 'bitcoin,ethereum,solana,dogecoin,cardano,ripple,polkadot,avalanche-2,chainlink,litecoin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(cache);
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
    const data = await r.json();

    const coins = data.map(c => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap,
      volume: c.total_volume,
      image: c.image,
    }));

    cache = { coins, updatedAt: new Date().toISOString() };
    cacheTs = now;

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(cache);
  } catch (err) {
    console.warn('[crypto] CoinGecko error:', err.message);
    if (cache) return res.status(200).json(cache);
    return res.status(502).json({ error: 'Crypto data unavailable', coins: [] });
  }
}
