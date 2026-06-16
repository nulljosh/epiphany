// Reddit trending via old.reddit.com JSON (free, no auth)

const CACHE_TTL = 5 * 60_000;
let cache = null;
let cacheTs = 0;

const SUBS = ['worldnews', 'technology', 'wallstreetbets', 'stocks', 'CryptoCurrency'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(cache);
  }

  try {
    const results = await Promise.all(
      SUBS.map(async (sub) => {
        try {
          const r = await fetch(`https://old.reddit.com/r/${sub}/hot.json?limit=5`, {
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': 'Monica/4.2 (intelligence platform)' },
          });
          if (!r.ok) return [];
          const data = await r.json();
          return (data?.data?.children || []).map(c => ({
            title: c.data.title,
            subreddit: c.data.subreddit,
            score: c.data.score,
            comments: c.data.num_comments,
            url: `https://reddit.com${c.data.permalink}`,
            created: c.data.created_utc,
          }));
        } catch { return []; }
      })
    );

    const posts = results.flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    cache = { posts, subreddits: SUBS, updatedAt: new Date().toISOString() };
    cacheTs = now;

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(cache);
  } catch (err) {
    console.warn('[reddit] Error:', err.message);
    if (cache) return res.status(200).json(cache);
    return res.status(502).json({ error: 'Reddit data unavailable', posts: [] });
  }
}
