// CNN Fear & Greed Index proxy
// Source: production.dataviz.cnn.io (requires browser UA)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`CNN API returned ${response.status}`);

    const data = await response.json();
    const fg = data.fear_and_greed;

    if (!fg || typeof fg.score !== 'number') {
      throw new Error('Unexpected response shape');
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      score: Math.round(fg.score),
      rating: fg.rating,
      timestamp: fg.timestamp,
    });
  } catch (err) {
    console.error('[FEAR-GREED] Error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
