import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

const KV_PREFIX = 'people-index';

function validatePerson(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid data' };
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  if (data.tags && !Array.isArray(data.tags)) return { valid: false, error: 'Tags must be an array' };
  if (data.socials && !Array.isArray(data.socials)) return { valid: false, error: 'Socials must be an array' };
  if (data.relationships && !Array.isArray(data.relationships)) return { valid: false, error: 'Relationships must be an array' };
  return { valid: true };
}

function personId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default async function handler(req, res) {
  const kv = await getKv();
  if (!kv) return errorResponse(res, 503, 'KV unavailable');

  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  const kvKey = `${KV_PREFIX}:${session.userId}`;

  // GET -- list all indexed people
  if (req.method === 'GET') {
    const data = await kv.get(kvKey);
    const people = data?.people || [];
    const { q } = req.query;
    if (q) {
      const lower = q.toLowerCase();
      const filtered = people.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(lower))
      );
      return res.status(200).json({ people: filtered });
    }
    return res.status(200).json({ people });
  }

  // POST -- create or update a person
  if (req.method === 'POST') {
    const body = req.body;
    const { valid, error } = validatePerson(body);
    if (!valid) return errorResponse(res, 400, error);

    const data = await kv.get(kvKey) || { people: [] };
    const people = data.people || [];
    const id = body.id || personId(body.name);
    const now = new Date().toISOString();

    const existing = people.findIndex(p => p.id === id);
    const prev = existing >= 0 ? people[existing] : {};
    const record = {
      id,
      name: body.name.trim(),
      image: body.image || prev.image || null,
      bio: body.bio || prev.bio || null,
      tags: (body.tags || prev.tags || []).map(t => t.trim()).filter(Boolean),
      notes: body.notes !== undefined ? body.notes : (prev.notes || ''),
      socials: body.socials || prev.socials || [],
      relationships: body.relationships || prev.relationships || [],
      searchData: body.searchData || prev.searchData || null,
      enrichment: body.enrichment || prev.enrichment || null,
      createdAt: existing >= 0 ? people[existing].createdAt : now,
      updatedAt: now,
    };

    if (existing >= 0) {
      people[existing] = record;
    } else {
      people.unshift(record);
    }

    await kv.set(kvKey, { people });
    return res.status(200).json({ ok: true, person: record });
  }

  // DELETE -- remove a person by id
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return errorResponse(res, 400, 'Missing id parameter');

    const data = await kv.get(kvKey) || { people: [] };
    const people = (data.people || []).filter(p => p.id !== id);
    await kv.set(kvKey, { people });
    return res.status(200).json({ ok: true });
  }

  return errorResponse(res, 405, 'Method not allowed');
}
