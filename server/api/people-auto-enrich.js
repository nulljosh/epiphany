import Anthropic from '@anthropic-ai/sdk';
import { getKv } from './_kv.js';
import { errorResponse } from './auth-helpers.js';
import { buildPrompt } from './people-enrich.js';
import { fetchGdeltMentions } from './people-crossref.js';

const MODEL = 'claude-haiku-4-5-20241022';
const KV_PREFIX = 'people-index';
const CROSSREF_PREFIX = 'people-crossref';
const MAX_ENRICHMENTS_PER_RUN = 5;
const STALE_DAYS = 7;

function isStale(enrichment) {
  if (!enrichment?.enrichedAt) return true;
  const age = Date.now() - new Date(enrichment.enrichedAt).getTime();
  return age > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 405, 'GET required');

  // Auth: cron secret via query param or Authorization header
  const secret = process.env.CRON_SECRET;
  if (!secret) return errorResponse(res, 503, 'CRON_SECRET not configured');

  const provided = req.query.key || (req.headers.authorization || '').replace('Bearer ', '');
  if (provided !== secret) return errorResponse(res, 401, 'Invalid cron secret');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return errorResponse(res, 503, 'AI not configured');

  const kv = await getKv();
  if (!kv) return errorResponse(res, 503, 'KV unavailable');

  const summary = { processed: 0, enriched: 0, skipped: 0, errors: 0, details: [] };

  // Scan all user keys matching the people-index prefix
  const allKeys = [];
  let cursor = '0';
  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: `${KV_PREFIX}:*`, count: 100 });
    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== '0');

  const client = new Anthropic({ apiKey });
  let enrichCount = 0;

  for (const kvKey of allKeys) {
    if (enrichCount >= MAX_ENRICHMENTS_PER_RUN) break;

    const data = await kv.get(kvKey);
    const people = data?.people || [];
    let modified = false;

    for (const person of people) {
      if (enrichCount >= MAX_ENRICHMENTS_PER_RUN) break;
      summary.processed++;

      if (!isStale(person.enrichment)) {
        summary.skipped++;
        continue;
      }

      try {
        // Fetch GDELT mentions
        const mentions = await fetchGdeltMentions(person.name);
        const cacheKey = `${CROSSREF_PREFIX}:${kvKey.split(':')[1]}:${person.id}`;
        await kv.set(cacheKey, { mentions, fetchedAt: Date.now() }, { ex: 3600 });

        if (mentions.length === 0 && !person.searchData?.results?.length) {
          summary.skipped++;
          summary.details.push({ id: person.id, name: person.name, status: 'no_data' });
          continue;
        }

        // Build search data from GDELT mentions if no existing search data
        const searchData = person.searchData?.results?.length
          ? person.searchData
          : { results: mentions.map(m => ({ title: m.title, snippet: m.source })) };

        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: buildPrompt(person.name, searchData),
          }],
        });

        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('');

        let enrichment;
        try {
          enrichment = JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            enrichment = JSON.parse(jsonMatch[0]);
          } else {
            summary.errors++;
            summary.details.push({ id: person.id, name: person.name, status: 'parse_error' });
            continue;
          }
        }

        person.enrichment = {
          role: enrichment.role || null,
          company: enrichment.company || null,
          location: enrichment.location || null,
          keyFacts: Array.isArray(enrichment.keyFacts) ? enrichment.keyFacts.slice(0, 5) : [],
          associates: Array.isArray(enrichment.associates) ? enrichment.associates.slice(0, 5) : [],
          industryTags: Array.isArray(enrichment.industryTags) ? enrichment.industryTags.slice(0, 4) : [],
          sentiment: enrichment.sentiment || null,
          enrichedAt: new Date().toISOString(),
        };
        person.updatedAt = new Date().toISOString();
        modified = true;
        enrichCount++;
        summary.enriched++;
        summary.details.push({ id: person.id, name: person.name, status: 'enriched' });

        console.log(`[auto-enrich] Enriched: ${person.name} (${person.id})`);
      } catch (err) {
        summary.errors++;
        summary.details.push({ id: person.id, name: person.name, status: 'error', error: err.message });
        console.error(`[auto-enrich] Error enriching ${person.name}:`, err.message);
      }
    }

    if (modified) {
      await kv.set(kvKey, { people });
    }
  }

  console.log(`[auto-enrich] Run complete: ${JSON.stringify({ ...summary, details: undefined })}`);
  return res.status(200).json(summary);
}
