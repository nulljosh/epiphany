import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

const KV_PREFIX = 'people-index';
const CROSSREF_PREFIX = 'people-crossref';
const CACHE_TTL = 3600; // 1 hour in seconds
const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

async function fetchGdeltMentions(name) {
  const params = new URLSearchParams({
    query: `"${name}"`,
    mode: 'artlist',
    maxrecords: '10',
    format: 'json',
    sort: 'datedesc',
    sourcelang: 'english',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${GDELT_BASE}?${params}`, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).map(a => {
      let source = a.domain || '';
      try { source = new URL(a.url).hostname.replace(/^www\./, ''); } catch {}
      return {
        title: a.title || '',
        url: a.url || '',
        source,
        image: a.socialimage || null,
        publishedAt: a.seendate ? gdeltDateToIso(a.seendate) : null,
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function gdeltDateToIso(seendate) {
  if (!seendate) return null;
  const s = seendate.replace('T', '').replace('Z', '');
  if (s.length < 14) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 405, 'GET required');

  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  const kv = await getKv();
  if (!kv) return errorResponse(res, 503, 'KV unavailable');

  const { personId } = req.query;

  // Single person crossref
  if (personId) {
    const kvKey = `${KV_PREFIX}:${session.userId}`;
    const data = await kv.get(kvKey);
    const people = data?.people || [];
    const person = people.find(p => p.id === personId);
    if (!person) return errorResponse(res, 404, 'Person not found');

    // Check cache
    const cacheKey = `${CROSSREF_PREFIX}:${session.userId}:${personId}`;
    const cached = await kv.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL * 1000) {
      return res.status(200).json({ mentions: cached.mentions, cached: true });
    }

    const mentions = await fetchGdeltMentions(person.name);
    await kv.set(cacheKey, { mentions, fetchedAt: Date.now() }, { ex: CACHE_TTL });

    return res.status(200).json({ mentions, cached: false });
  }

  // Batch crossref: check all indexed people
  const kvKey = `${KV_PREFIX}:${session.userId}`;
  const data = await kv.get(kvKey);
  const people = data?.people || [];

  if (people.length === 0) {
    return res.status(200).json({ results: [] });
  }

  const results = [];
  // Limit to 10 people per batch to avoid GDELT rate limits
  for (const person of people.slice(0, 10)) {
    const cacheKey = `${CROSSREF_PREFIX}:${session.userId}:${person.id}`;
    const cached = await kv.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL * 1000) {
      if (cached.mentions.length > 0) {
        results.push({ personId: person.id, name: person.name, mentions: cached.mentions });
      }
      continue;
    }

    const mentions = await fetchGdeltMentions(person.name);
    await kv.set(cacheKey, { mentions, fetchedAt: Date.now() }, { ex: CACHE_TTL });

    if (mentions.length > 0) {
      results.push({ personId: person.id, name: person.name, mentions });
    }
  }

  return res.status(200).json({ results });
}
