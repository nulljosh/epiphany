// Vercel serverless proxy for NewsAPI
const NEWS_API_BASE = 'https://newsapi.org/v2';

export default async function handler(req, res) {
  // Get API key from environment
  const apiKey = process.env.NEWS_API_KEY || process.env.VITE_NEWS_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'NEWS_API_KEY not configured' });
    return;
  }

  const { type = 'headlines', q, country = 'us', category, page = 1, pageSize = 10 } = req.query;

  try {
    let url;
    const params = new URLSearchParams({
      apiKey,
      pageSize: String(pageSize),
      page: String(page),
    });

    if (type === 'search' && q) {
      // Search endpoint
      params.append('q', q);
      params.append('language', 'en');
      params.append('sortBy', 'publishedAt');
      url = `${NEWS_API_BASE}/everything?${params}`;
    } else {
      // Headlines endpoint
      params.append('country', country);
      if (category) {
        params.append('category', category);
      }
      url = `${NEWS_API_BASE}/top-headlines?${params}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Stonks/1.0',
      },
    });

    const data = await response.json();

    if (data.status === 'error') {
      res.status(400).json({ error: data.message || 'NewsAPI error' });
      return;
    }

    // Transform articles to a cleaner format
    const articles = (data.articles || []).map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      urlToImage: article.urlToImage,
      source: article.source?.name || 'Unknown',
      publishedAt: article.publishedAt,
      author: article.author,
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300'); // Cache for 5 minutes
    res.status(200).json({
      articles,
      totalResults: data.totalResults || 0,
      page: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch news' });
  }
}
