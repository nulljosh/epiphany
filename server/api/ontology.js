import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { checkRateLimit } from './_ratelimit.js';

const OBJECT_TYPES = ['asset', 'person', 'event', 'place', 'account', 'transaction', 'note', 'alert', 'decision'];
const RELATIONSHIP_TYPES = ['owns', 'located_at', 'mentions', 'related_to', 'caused_by', 'part_of'];
const MAX_OBJECTS_PER_TYPE = 500;
const EVENT_TTL_DAYS = 30;

function kvPrefix(userId) {
  return `ont:${userId}`;
}

function isExpired(obj) {
  if (obj.type !== 'event') return false;
  const age = Date.now() - new Date(obj.createdAt).getTime();
  return age > EVENT_TTL_DAYS * 86400000;
}

export default async function handler(req, res) {
  const kv = await getKv();
  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  const { action } = req.query;
  const prefix = kvPrefix(session.userId);

  if (req.method === 'GET' && action === 'get') {
    const { id } = req.query;
    if (!id) return errorResponse(res, 400, 'id required');
    const obj = await kv.get(`${prefix}:obj:${id}`);
    if (!obj) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(obj);
  }

  if (req.method === 'GET' && action === 'list') {
    const { type, limit = '50', offset = '0' } = req.query;
    if (type && !OBJECT_TYPES.includes(type)) return errorResponse(res, 400, `Invalid type: ${type}`);

    const indexKey = type ? `${prefix}:type:${type}` : `${prefix}:all`;
    const ids = await kv.get(indexKey) || [];
    const start = parseInt(offset);
    const end = start + parseInt(limit);
    const pageIds = ids.slice(start, end);

    const objects = [];
    for (const id of pageIds) {
      const obj = await kv.get(`${prefix}:obj:${id}`);
      if (obj && !isExpired(obj)) objects.push(obj);
    }

    return res.status(200).json({ objects, total: ids.length, offset: start, limit: parseInt(limit) });
  }

  if (req.method === 'POST' && action === 'upsert') {
    if (!(await checkRateLimit(req, { prefix: 'rl:ont' }))) {
      return errorResponse(res, 429, 'Too many requests');
    }

    const obj = req.body;
    if (!obj?.id || !obj?.type || !obj?.name) {
      return errorResponse(res, 400, 'id, type, and name required');
    }
    if (!OBJECT_TYPES.includes(obj.type)) return errorResponse(res, 400, `Invalid type: ${obj.type}`);

    obj.updatedAt = new Date().toISOString();
    if (!obj.createdAt) obj.createdAt = obj.updatedAt;

    await kv.set(`${prefix}:obj:${obj.id}`, obj);

    // Update type index
    const typeKey = `${prefix}:type:${obj.type}`;
    const typeIds = await kv.get(typeKey) || [];
    if (!typeIds.includes(obj.id)) {
      typeIds.unshift(obj.id);
      if (typeIds.length > MAX_OBJECTS_PER_TYPE) typeIds.length = MAX_OBJECTS_PER_TYPE;
      await kv.set(typeKey, typeIds);
    }

    // Update global index
    const allKey = `${prefix}:all`;
    const allIds = await kv.get(allKey) || [];
    if (!allIds.includes(obj.id)) {
      allIds.unshift(obj.id);
      if (allIds.length > MAX_OBJECTS_PER_TYPE * OBJECT_TYPES.length) allIds.length = MAX_OBJECTS_PER_TYPE * OBJECT_TYPES.length;
      await kv.set(allKey, allIds);
    }

    return res.status(200).json({ ok: true, id: obj.id });
  }

  if (req.method === 'POST' && action === 'batch') {
    if (!(await checkRateLimit(req, { prefix: 'rl:ont-batch' }))) {
      return errorResponse(res, 429, 'Too many requests');
    }

    const { objects } = req.body;
    if (!Array.isArray(objects)) return errorResponse(res, 400, 'objects array required');

    const upserted = [];
    const typeIndexUpdates = new Map();
    const allNew = [];

    for (const obj of objects.slice(0, 100)) {
      if (!obj?.id || !obj?.type || !obj?.name || !OBJECT_TYPES.includes(obj.type)) continue;
      obj.updatedAt = new Date().toISOString();
      if (!obj.createdAt) obj.createdAt = obj.updatedAt;
      await kv.set(`${prefix}:obj:${obj.id}`, obj);

      // Collect type index updates
      if (!typeIndexUpdates.has(obj.type)) {
        typeIndexUpdates.set(obj.type, await kv.get(`${prefix}:type:${obj.type}`) || []);
      }
      const typeIds = typeIndexUpdates.get(obj.type);
      if (!typeIds.includes(obj.id)) {
        typeIds.unshift(obj.id);
        if (typeIds.length > MAX_OBJECTS_PER_TYPE) typeIds.length = MAX_OBJECTS_PER_TYPE;
      }
      allNew.push(obj.id);
      upserted.push(obj.id);
    }

    // Flush type indexes
    for (const [type, ids] of typeIndexUpdates) {
      await kv.set(`${prefix}:type:${type}`, ids);
    }

    // Update global index
    if (allNew.length > 0) {
      const allKey = `${prefix}:all`;
      const allIds = await kv.get(allKey) || [];
      for (const id of allNew) {
        if (!allIds.includes(id)) allIds.unshift(id);
      }
      const maxAll = MAX_OBJECTS_PER_TYPE * OBJECT_TYPES.length;
      if (allIds.length > maxAll) allIds.length = maxAll;
      await kv.set(allKey, allIds);
    }

    return res.status(200).json({ ok: true, upserted: upserted.length });
  }

  if (req.method === 'DELETE' && action === 'delete') {
    const { id } = req.query;
    if (!id) return errorResponse(res, 400, 'id required');

    const obj = await kv.get(`${prefix}:obj:${id}`);
    if (obj) {
      await kv.del(`${prefix}:obj:${id}`);

      // Remove from type index
      const typeKey = `${prefix}:type:${obj.type}`;
      const typeIds = await kv.get(typeKey) || [];
      const filtered = typeIds.filter(tid => tid !== id);
      await kv.set(typeKey, filtered);

      // Remove from global index
      const allKey = `${prefix}:all`;
      const allIds = await kv.get(allKey) || [];
      await kv.set(allKey, allIds.filter(tid => tid !== id));

      // Remove relationships
      await kv.del(`${prefix}:rel:${id}`);
      await kv.del(`${prefix}:rev:${id}`);
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST' && action === 'link') {
    const { type, sourceId, targetId, properties } = req.body;
    if (!RELATIONSHIP_TYPES.includes(type)) return errorResponse(res, 400, `Invalid relationship type: ${type}`);
    if (!sourceId || !targetId) return errorResponse(res, 400, 'sourceId and targetId required');

    const rel = { type, sourceId, targetId, properties: properties || {}, createdAt: new Date().toISOString() };

    // Store forward relationship
    const fwdKey = `${prefix}:rel:${sourceId}`;
    const fwdRels = await kv.get(fwdKey) || [];
    const existingIdx = fwdRels.findIndex(r => r.targetId === targetId && r.type === type);
    if (existingIdx >= 0) fwdRels[existingIdx] = rel;
    else fwdRels.push(rel);
    await kv.set(fwdKey, fwdRels);

    // Store reverse relationship
    const revKey = `${prefix}:rev:${targetId}`;
    const revRels = await kv.get(revKey) || [];
    const revIdx = revRels.findIndex(r => r.sourceId === sourceId && r.type === type);
    if (revIdx >= 0) revRels[revIdx] = rel;
    else revRels.push(rel);
    await kv.set(revKey, revRels);

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET' && action === 'relationships') {
    const { id, direction = 'both' } = req.query;
    if (!id) return errorResponse(res, 400, 'id required');

    const result = {};
    if (direction === 'outbound' || direction === 'both') {
      result.outbound = await kv.get(`${prefix}:rel:${id}`) || [];
    }
    if (direction === 'inbound' || direction === 'both') {
      result.inbound = await kv.get(`${prefix}:rev:${id}`) || [];
    }

    return res.status(200).json(result);
  }

  if (req.method === 'GET' && action === 'query') {
    const { type, key, value, limit = '20' } = req.query;
    if (!type || !OBJECT_TYPES.includes(type)) return errorResponse(res, 400, 'Valid type required');

    const typeKey = `${prefix}:type:${type}`;
    const ids = await kv.get(typeKey) || [];
    const matches = [];

    for (const id of ids) {
      if (matches.length >= parseInt(limit)) break;
      const obj = await kv.get(`${prefix}:obj:${id}`);
      if (!obj || isExpired(obj)) continue;
      if (key && value) {
        const propVal = obj.properties?.[key];
        if (String(propVal) === String(value)) matches.push(obj);
      } else {
        matches.push(obj);
      }
    }

    return res.status(200).json({ objects: matches });
  }

  if (req.method === 'GET' && action === 'stats') {
    const entries = await Promise.all(
      OBJECT_TYPES.map(async type => {
        const ids = await kv.get(`${prefix}:type:${type}`) || [];
        return [type, ids.length];
      })
    );
    const counts = Object.fromEntries(entries);
    return res.status(200).json({ counts, total: Object.values(counts).reduce((s, c) => s + c, 0) });
  }

  return errorResponse(res, 400, 'Unknown action. Use: get, list, upsert, batch, delete, link, relationships, query, stats');
}
