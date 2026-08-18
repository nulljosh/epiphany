import { applyCors } from './_cors.js';

// node:net only supplied isIPv4/isIPv6, which are pure predicates — regex covers
// them without pulling a Node polyfill into the Worker bundle.
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const isIPv4 = (ip) => IPV4.test(ip) && ip.split('.').every((o) => Number(o) <= 255);
const isIPv6 = (ip) => ip.includes(':');

// Cloudflare DoH stands in for dns.lookup, which Workers does not provide.
// Returns [] on any failure so callers treat unresolvable hosts as blocked.
async function resolveViaDoh(hostname) {
  const out = [];
  for (const type of ['A', 'AAAA']) {
    try {
      const r = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
        { headers: { Accept: 'application/dns-json' } },
      );
      if (!r.ok) continue;
      const j = await r.json();
      for (const ans of j.Answer || []) {
        if (ans.type === 1 || ans.type === 28) out.push(ans.data);
      }
    } catch { /* treated as unresolvable */ }
  }
  return out;
}

function isPrivateIp(ip) {
  if (isIPv4(ip)) {
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
  if (isIPv6(ip)) {
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
  // Workers has no DNS resolver, so resolve over DoH to keep this guard honest
  // rather than dropping it. A hostname that won't resolve is treated as blocked.
  const addresses = await resolveViaDoh(parsed.hostname);
  if (addresses.length === 0) throw new Error('Blocked host');
  for (const address of addresses) {
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
    // linkedom instead of jsdom: same DOM surface for Readability, but ~100KB
    // instead of ~20MB, which is the difference between fitting in a Worker
    // and not. Readability itself is unchanged, so extraction is identical.
    const { parseHTML } = await import('linkedom');
    const { Readability } = await import('@mozilla/readability');
    const { document } = parseHTML(html);
    const reader = new Readability(document);
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
