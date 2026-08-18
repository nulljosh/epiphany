// CNN Fear & Greed Index proxy
// Source: production.dataviz.cnn.io (requires browser UA)
//
// CNN returns 418 to Cloudflare Workers egress even with a browser UA — it is
// IP-based, and there is no keyed tier or comparable free source for the *stock
// market* index. So a good response is cached in KV and served stale when CNN
// refuses. useFearGreed.js renders this as a widget, so stale beats broken and
// an empty state beats a 502.
import { getKv } from './_kv.js';

const KV_KEY = 'fear-greed:last';
const STALE_TTL_SEC = 7 * 24 * 3600;

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

    const payload = {
      score: Math.round(fg.score),
      rating: fg.rating,
      timestamp: fg.timestamp,
    };

    try {
      const kv = await getKv();
      await kv?.set(KV_KEY, JSON.stringify(payload), { ex: STALE_TTL_SEC });
    } catch { /* cache write is best-effort */ }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(payload);
  } catch (err) {
    console.warn('[FEAR-GREED] Live fetch failed, trying cache:', err.message);

    try {
      const kv = await getKv();
      const cached = await kv?.get(KV_KEY);
      if (cached) {
        const payload = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        return res.status(200).json({ ...payload, stale: true });
      }
    } catch (cacheErr) {
      console.error('[FEAR-GREED] Cache read failed:', cacheErr.message);
    }

    // Cold cache: hand the widget an explicit empty state rather than a 502.
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(200).json({ score: null, rating: null, timestamp: null, unavailable: true });
  }
}
