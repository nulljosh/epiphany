import { applyCors } from './_cors.js';
import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    );
  }
  if (net.isIPv6(ip)) {
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  }
  return false;
}

async function assertPublicUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }
  if (parsed.hostname === 'localhost') {
    throw new Error('Blocked host');
  }
  const records = await dns.lookup(parsed.hostname, { all: true });
  for (const { address } of records) {
    if (isPrivateIp(address)) {
      throw new Error('Blocked host');
    }
  }
}

export default async function handler(req, res) {
  applyCors(req, res);

  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    await assertPublicUrl(url);
  } catch {
    return res.status(400).json({ error: 'Invalid or disallowed URL' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'error',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch: ${response.status}` });
    }

    const html = await response.text();
    const { JSDOM } = await import('jsdom');
    const { Readability } = await import('@mozilla/readability');
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return res.status(422).json({ error: 'Could not extract article content' });
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
    res.status(200).json({
      title: article.title || '',
      content: article.textContent || '',
      htmlContent: article.content || '',
      author: article.byline || '',
      siteName: article.siteName || '',
      excerpt: article.excerpt || '',
      length: article.length || 0,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error('[DEFUDDLE] Error:', error.message);
    res.status(500).json({ error: 'Failed to process URL' });
  }
}
