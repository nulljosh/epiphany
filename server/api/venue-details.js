// Venue photos + reviews via Yelp Fusion (free, no billing). Gated on YELP_API_KEY.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const cache = new Map();

async function fetchWithTimeout(url, headers = {}, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ available: false });
  }

  const name = req.query.name || req.body?.name;
  const lat = parseFloat(req.query.lat ?? req.body?.lat);
  const lon = parseFloat(req.query.lon ?? req.body?.lon);
  if (!name || Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'name, lat, lon required' });
  }

  const cacheKey = `${name.toLowerCase()}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  const headers = { Authorization: `Bearer ${apiKey}` };
  try {
    const search = await fetchWithTimeout(
      `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(name)}&latitude=${lat}&longitude=${lon}&limit=1`,
      headers
    );
    const business = search.businesses?.[0];
    if (!business) {
      const data = { available: false };
      cache.set(cacheKey, { time: Date.now(), data });
      return res.status(200).json(data);
    }

    const [detail, reviews] = await Promise.all([
      fetchWithTimeout(`https://api.yelp.com/v3/businesses/${business.id}`, headers),
      fetchWithTimeout(`https://api.yelp.com/v3/businesses/${business.id}/reviews`, headers).catch(() => ({ reviews: [] })),
    ]);

    const data = {
      available: true,
      photos: detail.photos || [],
      rating: detail.rating ?? null,
      reviewCount: detail.review_count ?? 0,
      reviews: (reviews.reviews || []).slice(0, 3).map((r) => ({
        text: r.text,
        rating: r.rating,
        user: r.user?.name || 'Anonymous',
      })),
      yelpUrl: detail.url || business.url || null,
    };
    cache.set(cacheKey, { time: Date.now(), data });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(200).json({ available: false, error: err.message });
  }
}
