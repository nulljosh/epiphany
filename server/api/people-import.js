import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

const KV_PREFIX = 'people-index';
const MAX_IMPORT = 500;
const RATE_KEY = 'people-import-rate';
const RATE_WINDOW = 60; // seconds
const RATE_LIMIT = 10; // max imports per window

function personId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseVcf(text) {
  const contacts = [];
  const cards = text.split('BEGIN:VCARD').filter(c => c.trim());

  for (const card of cards) {
    const lines = card.split(/\r?\n/);
    const contact = {};

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('FN:') || upper.startsWith('FN;')) {
        contact.name = line.substring(line.indexOf(':') + 1).trim();
      } else if (upper.startsWith('EMAIL') && line.includes(':')) {
        contact.email = line.substring(line.indexOf(':') + 1).trim();
      } else if (upper.startsWith('TEL') && line.includes(':')) {
        contact.phone = line.substring(line.indexOf(':') + 1).trim();
      } else if (upper.startsWith('NOTE') && line.includes(':')) {
        contact.notes = line.substring(line.indexOf(':') + 1).trim();
      } else if (upper.startsWith('CATEGORIES') && line.includes(':')) {
        contact.tags = line.substring(line.indexOf(':') + 1).split(',').map(t => t.trim()).filter(Boolean);
      } else if (upper.startsWith('ORG') && line.includes(':')) {
        const org = line.substring(line.indexOf(':') + 1).replace(/;/g, ', ').trim();
        if (org) contact.notes = contact.notes ? `${contact.notes}\nOrg: ${org}` : `Org: ${org}`;
      }
    }

    if (contact.name) contacts.push(contact);
  }

  return contacts;
}

function mergeFields(existing, incoming) {
  return {
    ...existing,
    bio: existing.bio || incoming.bio || null,
    tags: [...new Set([...(existing.tags || []), ...(incoming.tags || [])])],
    notes: existing.notes || incoming.notes || '',
    socials: existing.socials?.length ? existing.socials : (incoming.socials || []),
    updatedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  const kv = await getKv();
  if (!kv) return errorResponse(res, 503, 'KV unavailable');

  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  // Rate limiting
  const rateKey = `${RATE_KEY}:${session.userId}`;
  const rateCount = (await kv.get(rateKey)) || 0;
  if (rateCount >= RATE_LIMIT) {
    return errorResponse(res, 429, 'Too many imports. Try again in a minute.');
  }
  await kv.set(rateKey, rateCount + 1, { ex: RATE_WINDOW });

  // Parse input -- JSON array or vCard text
  let contacts = [];
  const contentType = (req.headers['content-type'] || '').toLowerCase();

  if (contentType.includes('text/vcard') || contentType.includes('text/x-vcard')) {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    contacts = parseVcf(body);
  } else {
    // JSON body
    const body = req.body;
    if (body?.vcf && typeof body.vcf === 'string') {
      contacts = parseVcf(body.vcf);
    } else if (Array.isArray(body)) {
      contacts = body;
    } else if (Array.isArray(body?.contacts)) {
      contacts = body.contacts;
    } else {
      return errorResponse(res, 400, 'Expected JSON array of contacts, { contacts: [...] }, or { vcf: "..." }');
    }
  }

  if (contacts.length === 0) return errorResponse(res, 400, 'No valid contacts found');
  if (contacts.length > MAX_IMPORT) return errorResponse(res, 400, `Max ${MAX_IMPORT} contacts per import`);

  // Validate contacts
  const valid = contacts.filter(c => c.name && typeof c.name === 'string' && c.name.trim().length > 0);
  if (valid.length === 0) return errorResponse(res, 400, 'No contacts with valid names');

  // Load existing people
  const kvKey = `${KV_PREFIX}:${session.userId}`;
  const data = await kv.get(kvKey) || { people: [] };
  const people = data.people || [];
  const existingMap = new Map(people.map(p => [p.id, p]));

  let imported = 0;
  let skipped = 0;
  let merged = 0;
  const now = new Date().toISOString();

  for (const contact of valid) {
    const id = personId(contact.name.trim());
    if (!id) { skipped++; continue; }

    const incoming = {
      id,
      name: contact.name.trim(),
      image: null,
      bio: null,
      tags: (contact.tags || []).map(t => t.trim()).filter(Boolean),
      notes: contact.notes || '',
      socials: [],
      relationships: [],
      searchData: null,
      enrichment: null,
    };

    // Build socials from email/phone
    if (contact.email) incoming.socials.push({ platform: 'email', url: `mailto:${contact.email}` });
    if (contact.phone) incoming.socials.push({ platform: 'phone', url: `tel:${contact.phone}` });

    const existing = existingMap.get(id);
    if (existing) {
      const mergedRecord = mergeFields(existing, incoming);
      existingMap.set(id, mergedRecord);
      merged++;
    } else {
      existingMap.set(id, { ...incoming, createdAt: now, updatedAt: now });
      imported++;
    }
  }

  skipped += valid.length - imported - merged - skipped >= 0 ? 0 : 0;

  // Rebuild array preserving order -- existing first, then new
  const updatedPeople = [];
  const seen = new Set();
  // Existing people in original order (possibly merged)
  for (const p of people) {
    if (existingMap.has(p.id)) {
      updatedPeople.push(existingMap.get(p.id));
      seen.add(p.id);
    }
  }
  // New imports at the front
  const newPeople = [];
  for (const [id, p] of existingMap) {
    if (!seen.has(id)) newPeople.push(p);
  }
  const finalPeople = [...newPeople, ...updatedPeople];

  await kv.set(kvKey, { people: finalPeople });

  return res.status(200).json({ ok: true, imported, skipped, merged });
}
