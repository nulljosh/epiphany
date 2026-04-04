import { applyCors } from './_cors.js';

const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();

const SOCIAL_PLATFORMS = {
  'linkedin.com': { platform: 'linkedin', icon: 'link' },
  'twitter.com': { platform: 'twitter', icon: 'at' },
  'x.com': { platform: 'twitter', icon: 'at' },
  'github.com': { platform: 'github', icon: 'chevron.left.forwardslash.chevron.right' },
  'facebook.com': { platform: 'facebook', icon: 'person.2' },
  'instagram.com': { platform: 'instagram', icon: 'camera' },
  'youtube.com': { platform: 'youtube', icon: 'play.rectangle' },
  'reddit.com': { platform: 'reddit', icon: 'bubble.left' },
  'medium.com': { platform: 'medium', icon: 'doc.text' },
  'tiktok.com': { platform: 'tiktok', icon: 'music.note' },
};

function extractUsername(url, platform) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (platform === 'linkedin' && parts[0] === 'in' && parts[1]) return parts[1];
    if (parts[0] && !['search', 'explore', 'settings', 'about'].includes(parts[0])) return parts[0].replace('@', '');
  } catch {}
  return null;
}

function detectSocialLinks(results) {
  const seen = new Set();
  const links = [];

  for (const r of results) {
    try {
      const hostname = new URL(r.link).hostname.replace('www.', '');
      const match = SOCIAL_PLATFORMS[hostname];
      if (match && !seen.has(match.platform)) {
        seen.add(match.platform);
        links.push({
          platform: match.platform,
          url: r.link,
          username: extractUsername(r.link, match.platform),
          icon: match.icon,
        });
      }
    } catch {}
  }

  return links;
}

function findPrimaryImage(results) {
  for (const r of results) {
    if (r.pagemap?.cse_image?.[0]?.src) return r.pagemap.cse_image[0].src;
    if (r.pagemap?.cse_thumbnail?.[0]?.src) return r.pagemap.cse_thumbnail[0].src;
  }
  return null;
}

function structureResults(query, rawItems) {
  const results = (rawItems || []).map((item) => ({
    title: item.title || '',
    snippet: item.snippet || '',
    url: item.link || '',
    displayUrl: item.displayLink || '',
    imageUrl: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || null,
  }));

  return {
    query,
    results,
    socialLinks: detectSocialLinks(rawItems || []),
    primaryImage: findPrimaryImage(rawItems || []),
    resultCount: results.length,
  };
}

async function googleSearch(query) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;

  if (!key || !cx) {
    return wikiSearch(query);
  }

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: '10',
  });

  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[people] Google CSE error: ${res.status}`);
      return duckDuckGoSearch(query);
    }
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.warn(`[people] Google CSE failed: ${err.message}`);
    return duckDuckGoSearch(query);
  }
}

async function duckDuckGoSearch(query) {
  try {
    const params = new URLSearchParams({ q: query, format: 'json', no_redirect: '1' });
    const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return wikiSearch(query);
    const data = await res.json();

    const results = [];

    // Only use DDG if it has a real abstract with a real URL
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        snippet: data.Abstract,
        link: data.AbstractURL,
        displayLink: data.AbstractSource || '',
        pagemap: data.Image ? { cse_image: [{ src: data.Image.startsWith('http') ? data.Image : `https://duckduckgo.com${data.Image}` }] } : {},
      });
    }

    // RelatedTopics have duckduckgo.com internal URLs -- skip them,
    // fall through to Wikipedia which has real content
    if (results.length === 0) return wikiSearch(query);
    return results;
  } catch (err) {
    console.warn('[people] DuckDuckGo fallback failed:', err.message);
    return wikiSearch(query);
  }
}

async function wikiSearch(query) {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      utf8: '1',
      srlimit: '10',
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const search = data.query?.search || [];

    // Also fetch image for the first result
    let image = null;
    if (search.length > 0) {
      try {
        const imgParams = new URLSearchParams({
          action: 'query',
          titles: search[0].title,
          prop: 'pageimages',
          format: 'json',
          pithumbsize: '200',
        });
        const imgRes = await fetch(`https://en.wikipedia.org/w/api.php?${imgParams}`);
        const imgData = await imgRes.json();
        const pages = imgData.query?.pages || {};
        const firstPage = Object.values(pages)[0];
        image = firstPage?.thumbnail?.source || null;
      } catch {}
    }

    return search.map((item, i) => ({
      title: item.title,
      snippet: item.snippet.replace(/<[^>]+>/g, ''),
      link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      displayLink: 'en.wikipedia.org',
      pagemap: i === 0 && image ? { cse_image: [{ src: image }] } : {},
    }));
  } catch (err) {
    console.warn('[people] Wikipedia fallback failed:', err.message);
    return [];
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const rawResults = await googleSearch(q);
    const profile = structureResults(q, rawResults);

    cache.set(cacheKey, { data: profile, time: Date.now() });

    // Evict old entries
    if (cache.size > 200) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time);
      for (let i = 0; i < 50; i++) cache.delete(oldest[i][0]);
    }

    return res.json(profile);
  } catch (err) {
    console.error('[people] Search error:', err);
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Search timed out. Try again.' : 'Search failed',
    });
  }
}
