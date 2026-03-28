import { applyCors } from './_cors.js';

// GDELT GDoc API — free, no auth, real-time global news
const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const CACHE_TTL = 5 * 60 * 1000;
const DEDUP_THRESHOLD = 0.6;

// Cache keyed by "query:lat:lon", capped at 100 entries
const MAX_CACHE = 100;
const cache = new Map();

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, value);
}

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

// City list for geo keyword matching and lat/lon -> city name lookup
const CITIES = [
  { name: 'New York',      lat: 40.7128,  lon: -74.0060  },
  { name: 'Los Angeles',   lat: 34.0522,  lon: -118.2437 },
  { name: 'Chicago',       lat: 41.8781,  lon: -87.6298  },
  { name: 'Boston',        lat: 42.3601,  lon: -71.0589  },
  { name: 'Miami',         lat: 25.7617,  lon: -80.1918  },
  { name: 'Dallas',        lat: 32.7767,  lon: -96.7970  },
  { name: 'San Francisco', lat: 37.7749,  lon: -122.4194 },
  { name: 'Washington DC', lat: 38.9072,  lon: -77.0369  },
  { name: 'London',        lat: 51.5074,  lon: -0.1278   },
  { name: 'Paris',         lat: 48.8566,  lon: 2.3522    },
  { name: 'Tokyo',         lat: 35.6762,  lon: 139.6503  },
  { name: 'Vancouver',     lat: 49.2827,  lon: -123.1207 },
  { name: 'Toronto',       lat: 43.6532,  lon: -79.3832  },
  { name: 'Sydney',        lat: -33.8688, lon: 151.2093  },
  { name: 'Berlin',        lat: 52.5200,  lon: 13.4050   },
  { name: 'Moscow',        lat: 55.7558,  lon: 37.6173   },
  { name: 'Beijing',       lat: 39.9042,  lon: 116.4074  },
  { name: 'Mumbai',        lat: 19.0760,  lon: 72.8777   },
  { name: 'Dubai',         lat: 25.2048,  lon: 55.2708   },
  { name: 'Sao Paulo',     lat: -23.5505, lon: -46.6333  },
  { name: 'Mexico City',   lat: 19.4326,  lon: -99.1332  },
  { name: 'Seoul',         lat: 37.5665,  lon: 126.9780  },
  { name: 'Singapore',     lat: 1.3521,   lon: 103.8198  },
  { name: 'Hong Kong',     lat: 22.3193,  lon: 114.1694  },
  { name: 'Istanbul',      lat: 41.0082,  lon: 28.9784   },
  { name: 'Cairo',         lat: 30.0444,  lon: 31.2357   },
  { name: 'Lagos',         lat: 6.5244,   lon: 3.3792    },
  { name: 'Nairobi',       lat: -1.2921,  lon: 36.8219   },
  { name: 'Buenos Aires',  lat: -34.6037, lon: -58.3816  },
  { name: 'Montreal',      lat: 45.5017,  lon: -73.5673  },
];

// Tracking params stripped from URLs for dedup
const TRACKING_PARAMS = /utm_[^&]+|fbclid|gclid|ref|source|campaign|medium|content|term/gi;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestCity(lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const city of CITIES) {
    const d = haversineKm(lat, lon, city.lat, city.lon);
    if (d < bestDist) {
      bestDist = d;
      best = city;
    }
  }
  return best;
}

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

function titleWords(title) {
  return new Set(normalizeTitle(title).split(/\s+/).filter(Boolean));
}

function jaccardSim(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    // Strip tracking params
    const keep = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (!k.match(/^utm_|^fbclid|^gclid|^ref$|^source$|^campaign$|^medium$|^content$|^term$/i)) {
        keep.push([k, v]);
      }
    }
    u.search = keep.length ? '?' + new URLSearchParams(keep).toString() : '';
    // Strip www prefix, trailing slash
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '') || '/';
    return `${host}${path}${u.search}`;
  } catch {
    return rawUrl;
  }
}

const ENGLISH_STOPS = new Set(['the', 'is', 'are', 'was', 'has', 'for', 'and', 'but', 'not', 'this', 'that', 'with', 'from', 'will', 'been', 'have', 'its', 'says', 'said', 'new', 'after', 'how', 'why', 'what', 'who', 'could', 'would', 'should', 'about', 'into', 'over', 'more', 'than', 'also', 'being', 'their', 'which', 'on', 'at', 'by', 'to', 'in', 'of', 'as', 'an', 'or', 'no', 'up']);

function isEnglishTitle(title) {
  if (!title || title.length < 10) return false;
  const latinCount = [...title].filter(c => c.charCodeAt(0) < 128).length;
  if ((latinCount / Math.max(title.length, 1)) <= 0.6) return false;
  const words = title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const matches = words.filter(w => ENGLISH_STOPS.has(w)).length;
  return matches >= 2;
}

function dedup(articles) {
  const seen = [];
  const seenUrls = new Set();
  const result = [];

  for (const article of articles) {
    const normUrl = normalizeUrl(article.url);
    if (seenUrls.has(normUrl)) continue;

    const words = titleWords(article.title);
    let isDup = false;
    for (const prev of seen) {
      if (jaccardSim(words, prev.words) >= DEDUP_THRESHOLD) {
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      seenUrls.add(normUrl);
      seen.push({ words });
      result.push(article);
    }
  }
  return result;
}

function extractGeo(article) {
  // Prefer GDELT's own geocoded fields
  if (article.sourcelat && article.sourcelon) {
    const lat = parseFloat(article.sourcelat);
    const lon = parseFloat(article.sourcelon);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  // Keyword match against title
  const titleLower = (article.title || '').toLowerCase();
  for (const city of CITIES) {
    if (titleLower.includes(city.name.toLowerCase())) {
      return { lat: city.lat, lon: city.lon };
    }
  }

  return { lat: null, lon: null };
}

function gdeltDateToIso(seendate) {
  // GDELT format: "20260228T120000Z" or "20260228120000"
  if (!seendate) return null;
  const s = seendate.replace('T', '').replace('Z', '');
  if (s.length < 14) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

async function fetchGdelt(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`GDELT ${r.status}`);
    const json = await r.json();

    return (json.articles || []).map(a => {
      const { lat: gLat, lon: gLon } = extractGeo(a);
      let source = a.domain || '';
      try {
        source = new URL(a.url).hostname.replace(/^www\./, '');
      } catch {}
      return {
        title: a.title || '',
        url: a.url || '',
        source,
        image: a.socialimage || null,
        lat: gLat,
        lon: gLon,
        publishedAt: gdeltDateToIso(a.seendate),
        newsSource: 'gdelt',
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGoogleNews(queryTerms, lat, lon) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const query = queryTerms.join(' ');
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`Google News ${r.status}`);
    const xml = await r.text();

    const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

    return items.map(item => {
      const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1]
        || item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
        || '')
        .trim();
      const articleUrl = (item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
      const sourceTag = (item.match(/<source\b[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/source>/i)?.[1]
        || item.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1]
        || '')
        .trim();
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();
      const { lat: gLat, lon: gLon } = extractGeo({ title });

      let source = sourceTag;
      if (!source) {
        try {
          source = new URL(articleUrl).hostname.replace(/^www\./, '');
        } catch {
          source = '';
        }
      }

      const publishedAt = pubDate && !Number.isNaN(Date.parse(pubDate))
        ? new Date(pubDate).toISOString()
        : null;

      return {
        title,
        url: articleUrl,
        source,
        image: null,
        lat: gLat ?? lat ?? null,
        lon: gLon ?? lon ?? null,
        publishedAt,
        newsSource: 'google',
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function handleStockNews(req, res, query) {
  const cacheKey = `stock:${query.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      ...hit.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - hit.ts }),
    });
  }

  // Search GDELT directly for the stock symbol/company name
  const gdeltParams = new URLSearchParams({
    query: `"${query}" business`,
    mode: 'artlist',
    maxrecords: '15',
    format: 'json',
    sort: 'datedesc',
    sourcelang: 'english',
  });
  const gdeltUrl = `${GDELT_BASE}?${gdeltParams}`;

  try {
    const [gdeltResult, googleResult] = await Promise.allSettled([
      fetchGdelt(gdeltUrl),
      fetchGoogleNews([query, 'stock'], null, null),
    ]);

    const gdeltArticles = gdeltResult.status === 'fulfilled' ? gdeltResult.value : [];
    const googleArticles = googleResult.status === 'fulfilled' ? googleResult.value : [];
    const articles = dedup([...gdeltArticles, ...googleArticles]).filter(a => isEnglishTitle(a.title));

    const data = { articles, meta: buildMeta('live') };
    cacheSet(cacheKey, { ts: Date.now(), data });
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(data);
  } catch (err) {
    try {
      const googleArticles = await fetchGoogleNews([query, 'stock'], null, null);
      const articles = dedup(googleArticles).filter(a => isEnglishTitle(a.title));
      if (articles.length > 0) {
        const data = { articles, meta: buildMeta('live', { degraded: true }) };
        cacheSet(cacheKey, { ts: Date.now(), data });
        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json(data);
      }
    } catch { /* Google News also failed */ }

    return res.status(200).json({ articles: [], meta: buildMeta('empty') });
  }
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { category = 'business', lat, lon, q } = req.query;

  // Stock-specific news query (e.g., ?q=HOOD or ?q=Robinhood)
  if (q && q.trim()) {
    return handleStockNews(req, res, q.trim());
  }

  // Build cache key
  const cacheKey = `${category}:${lat ?? ''}:${lon ?? ''}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      ...hit.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - hit.ts }),
    });
  }

  // Build GDELT query string
  let queryTerms = [category];
  let parsedLat = null;
  let parsedLon = null;

  if (lat && lon) {
    parsedLat = parseFloat(lat);
    parsedLon = parseFloat(lon);
    if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
      const city = nearestCity(parsedLat, parsedLon);
      if (city) queryTerms.push(`"${city.name}"`);
    } else {
      parsedLat = null;
      parsedLon = null;
    }
  }

  const queryStr = queryTerms.join(' ');
  const params = new URLSearchParams({
    query: queryStr,
    mode: 'artlist',
    maxrecords: '30',
    format: 'json',
    sort: 'datedesc',
    sourcelang: 'english',
  });
  const url = `${GDELT_BASE}?${params}`;
  let googleArticles = [];

  try {
    const [gdeltResult, googleResult] = await Promise.allSettled([
      fetchGdelt(url),
      fetchGoogleNews(queryTerms, parsedLat, parsedLon),
    ]);

    if (gdeltResult.status === 'rejected') {
      throw gdeltResult.reason;
    }

    const gdeltArticles = gdeltResult.value;
    googleArticles = googleResult.status === 'fulfilled' ? googleResult.value : [];
    const articles = dedup([...gdeltArticles, ...googleArticles]).filter(a => isEnglishTitle(a.title));
    const data = {
      articles,
      meta: buildMeta('live'),
    };
    cacheSet(cacheKey, { ts: Date.now(), data });
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(data);
  } catch (err) {
    console.warn('GDELT news error:', err.message);

    if (googleArticles.length === 0) {
      googleArticles = await fetchGoogleNews(queryTerms, parsedLat, parsedLon);
    }
    googleArticles = dedup(googleArticles).filter(a => isEnglishTitle(a.title));

    if (googleArticles.length > 0) {
      const data = {
        articles: googleArticles,
        meta: buildMeta('live', {
          degraded: true,
          warning: 'GDELT unavailable; serving Google News results',
        }),
      };
      cacheSet(cacheKey, { ts: Date.now(), data });
      res.setHeader('Cache-Control', 's-maxage=300');
      return res.status(200).json(data);
    }

    // Return stale cache on failure instead of empty array
    const stale = cache.get(cacheKey);
    if (stale) {
      res.setHeader('Cache-Control', 's-maxage=60');
      return res.status(200).json({
        ...stale.data,
        meta: buildMeta('stale', {
          cached: true,
          degraded: true,
          cacheAgeMs: Date.now() - stale.ts,
          warning: 'GDELT unavailable; serving stale cached news',
        }),
      });
    }

    return res.status(502).json({
      error: 'GDELT unavailable',
      articles: [],
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'GDELT unavailable and no cached news is available',
      }),
    });
  }
}
