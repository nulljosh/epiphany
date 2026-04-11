import Anthropic from '@anthropic-ai/sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { checkRateLimit } from './_ratelimit.js';

const execFileAsync = promisify(execFile);

async function runClaudeCLI(prompt) {
  const { stdout } = await execFileAsync('claude', ['--print', '-p', prompt], {
    env: { ...process.env, CLAUDECODE: '' },
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

const MODEL = 'claude-haiku-4-5-20251001';
const KV_PREFIX = 'people-index';

export function buildPrompt(name, searchData) {
  const snippets = (searchData?.results || [])
    .slice(0, 8)
    .map(r => `${r.title}\n${r.snippet}`)
    .join('\n\n');

  return `Analyze the following search results about "${name}" and extract structured intelligence.

Search Results:
${snippets}

Return a JSON object with exactly these fields:
- role: their primary role/title (string, or null if unknown)
- company: their company or organization (string, or null)
- location: their location (string, or null)
- keyFacts: array of 3-5 key facts as short strings
- associates: array of names of known associates/connections (just names, max 5)
- industryTags: array of industry/domain tags (max 4)
- sentiment: one-line public sentiment summary (string)

Return ONLY valid JSON, no markdown fences or extra text.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'POST required');

  const apiKey = process.env.ANTHROPIC_API_KEY;

  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  if (!(await checkRateLimit(req, { prefix: 'rl:enrich', window: 60000, max: 5 }))) {
    return errorResponse(res, 429, 'Rate limit: max 5 enrichments per minute');
  }

  const kv = await getKv();
  if (!kv) return errorResponse(res, 503, 'KV unavailable');

  const { personId } = req.body;
  if (!personId) return errorResponse(res, 400, 'personId required');

  const kvKey = `${KV_PREFIX}:${session.userId}`;
  const data = await kv.get(kvKey);
  const people = data?.people || [];
  const personIdx = people.findIndex(p => p.id === personId);
  if (personIdx < 0) return errorResponse(res, 404, 'Person not found');

  const person = people[personIdx];

  if (!person.searchData?.results?.length) {
    return errorResponse(res, 400, 'No search data to enrich from');
  }

  try {
    const prompt = buildPrompt(person.name, person.searchData);
    let text;
    if (apiKey) {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    } else {
      text = await runClaudeCLI(prompt);
    }

    let enrichment;
    try {
      enrichment = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        enrichment = JSON.parse(jsonMatch[0]);
      } else {
        return errorResponse(res, 502, 'Failed to parse AI response');
      }
    }

    // Validate and normalize
    const normalized = {
      role: enrichment.role || null,
      company: enrichment.company || null,
      location: enrichment.location || null,
      keyFacts: Array.isArray(enrichment.keyFacts) ? enrichment.keyFacts.slice(0, 5) : [],
      associates: Array.isArray(enrichment.associates) ? enrichment.associates.slice(0, 5) : [],
      industryTags: Array.isArray(enrichment.industryTags) ? enrichment.industryTags.slice(0, 4) : [],
      sentiment: enrichment.sentiment || null,
      enrichedAt: new Date().toISOString(),
    };

    // Save enrichment to person record
    people[personIdx] = { ...person, enrichment: normalized, updatedAt: new Date().toISOString() };
    await kv.set(kvKey, { people });

    // Auto-detect relationships with existing indexed people
    const linkedAssociates = [];
    if (normalized.associates.length > 0) {
      for (const assocName of normalized.associates) {
        const assocLower = assocName.toLowerCase();
        const match = people.find(p =>
          p.id !== personId && p.name.toLowerCase().includes(assocLower)
        );
        if (match) {
          // Create ontology relationship
          const ontPrefix = `ont:${session.userId}`;
          const sourceOntId = `person:${person.name.toLowerCase()}`;
          const targetOntId = `person:${match.name.toLowerCase()}`;

          const rel = {
            type: 'related_to',
            sourceId: sourceOntId,
            targetId: targetOntId,
            properties: { via: 'enrichment', associateName: assocName },
            createdAt: new Date().toISOString(),
          };

          // Store forward
          const fwdKey = `${ontPrefix}:rel:${sourceOntId}`;
          const fwdRels = await kv.get(fwdKey) || [];
          if (!fwdRels.some(r => r.targetId === targetOntId && r.type === 'related_to')) {
            fwdRels.push(rel);
            await kv.set(fwdKey, fwdRels);
          }

          // Store reverse
          const revKey = `${ontPrefix}:rev:${targetOntId}`;
          const revRels = await kv.get(revKey) || [];
          if (!revRels.some(r => r.sourceId === sourceOntId && r.type === 'related_to')) {
            revRels.push(rel);
            await kv.set(revKey, revRels);
          }

          linkedAssociates.push({ name: assocName, matchedId: match.id, matchedName: match.name });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      enrichment: normalized,
      linkedAssociates,
    });
  } catch (err) {
    console.error('[people-enrich] Error:', err.message);
    return errorResponse(res, 500, 'Enrichment failed');
  }
}
