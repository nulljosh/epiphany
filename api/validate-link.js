// API endpoint to validate Polymarket links
// Checks if a Polymarket event page exists (returns 404 or not)

export default async function handler(req, res) {
  const { slug } = req.query;

  // Validate slug parameter
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid slug parameter',
      details: 'Slug must be a non-empty string'
    });
  }

  // Validate slug format (alphanumeric, hyphens only)
  if (!/^[\w\-]+$/.test(slug)) {
    return res.status(400).json({
      error: 'Invalid slug format',
      details: 'Slug must contain only letters, numbers, and hyphens'
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`https://polymarket.com/event/${slug}`, {
      method: 'HEAD', // Use HEAD to avoid downloading full page
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    const isValid = response.ok; // 200-299 status codes
    const statusCode = response.status;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300'); // Cache for 5 minutes
    res.status(200).json({
      slug,
      isValid,
      statusCode,
      url: `https://polymarket.com/event/${slug}`
    });
  } catch (error) {
    console.error(`Link validation error for ${slug}:`, error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'Polymarket did not respond in time'
      });
    }

    res.status(500).json({
      error: 'Failed to validate link',
      details: error.message
    });
  }
}
