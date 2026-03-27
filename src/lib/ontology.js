// Monica Personal Ontology -- unified object model for all data sources
// Every piece of data in Monica becomes a typed object with relationships.

export const OBJECT_TYPES = ['asset', 'person', 'event', 'place', 'account', 'transaction', 'note', 'alert', 'decision'];

export const RELATIONSHIP_TYPES = ['owns', 'located_at', 'mentions', 'related_to', 'caused_by', 'part_of'];

// Generate a short unique ID (collision-safe for personal use)
export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Create a new ontology object
export function createObject(type, name, properties = {}, source = 'manual') {
  if (!OBJECT_TYPES.includes(type)) throw new Error(`Invalid object type: ${type}`);
  return {
    id: generateId(),
    type,
    name,
    properties,
    source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Create a relationship between two objects
export function createRelationship(type, sourceId, targetId, properties = {}) {
  if (!RELATIONSHIP_TYPES.includes(type)) throw new Error(`Invalid relationship type: ${type}`);
  return { type, sourceId, targetId, properties, createdAt: new Date().toISOString() };
}

// Validate an ontology object shape
export function validateObject(obj) {
  if (!obj || typeof obj !== 'object') return { valid: false, error: 'Not an object' };
  if (!obj.id || typeof obj.id !== 'string') return { valid: false, error: 'Missing id' };
  if (!OBJECT_TYPES.includes(obj.type)) return { valid: false, error: `Invalid type: ${obj.type}` };
  if (!obj.name || typeof obj.name !== 'string') return { valid: false, error: 'Missing name' };
  return { valid: true };
}

// Validate a relationship shape
export function validateRelationship(rel) {
  if (!rel || typeof rel !== 'object') return { valid: false, error: 'Not an object' };
  if (!RELATIONSHIP_TYPES.includes(rel.type)) return { valid: false, error: `Invalid type: ${rel.type}` };
  if (!rel.sourceId || !rel.targetId) return { valid: false, error: 'Missing sourceId or targetId' };
  return { valid: true };
}

// Deterministic ID for auto-populated objects (prevents duplicates)
// e.g., assetId('AAPL') always returns the same ID
export function deterministicId(type, key) {
  return `${type}:${key}`;
}

// Convert existing Monica data types into ontology objects

export function stockToAsset(symbol, stockData) {
  return {
    id: deterministicId('asset', symbol),
    type: 'asset',
    name: stockData?.name || symbol,
    properties: {
      symbol,
      assetClass: 'stock',
      price: stockData?.price,
      changePercent: stockData?.changePercent,
      marketCap: stockData?.marketCap,
    },
    source: 'stocks',
    updatedAt: new Date().toISOString(),
  };
}

export function earthquakeToEvent(quake) {
  return {
    id: deterministicId('event', `eq-${quake.id || quake.place}`),
    type: 'event',
    name: `M${quake.magnitude} Earthquake - ${quake.place || 'Unknown'}`,
    properties: {
      eventType: 'earthquake',
      magnitude: quake.magnitude,
      depth: quake.depth,
      lat: quake.lat,
      lon: quake.lon,
      severity: quake.magnitude >= 5 ? 'critical' : quake.magnitude >= 3 ? 'elevated' : 'monitor',
    },
    source: 'usgs',
    createdAt: quake.time || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function newsToEvent(article) {
  return {
    id: deterministicId('event', `news-${hashString(article.url || article.title)}`),
    type: 'event',
    name: article.title,
    properties: {
      eventType: 'news',
      url: article.url,
      source: article.source,
      image: article.image,
      lat: article.lat,
      lon: article.lon,
    },
    source: article.newsSource || 'gdelt',
    createdAt: article.publishedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function accountToOntology(account) {
  return {
    id: deterministicId('account', account.name.toLowerCase()),
    type: 'account',
    name: account.name,
    properties: {
      accountType: account.type,
      balance: account.balance,
      institution: account.institution,
      currency: account.currency || 'CAD',
    },
    source: 'portfolio',
    updatedAt: new Date().toISOString(),
  };
}

export function personToOntology(person) {
  return {
    id: deterministicId('person', person.name?.toLowerCase() || person.id),
    type: 'person',
    name: person.name,
    properties: {
      image: person.image,
      socials: person.socials,
      bio: person.bio,
    },
    source: 'people',
    updatedAt: new Date().toISOString(),
  };
}

export function crimeToEvent(crime) {
  return {
    id: deterministicId('event', `crime-${crime.id || hashString(JSON.stringify(crime))}`),
    type: 'event',
    name: crime.type || crime.description || 'Crime Incident',
    properties: {
      eventType: 'crime',
      lat: crime.lat,
      lon: crime.lon,
      severity: crime.severity || 'monitor',
    },
    source: 'crime',
    createdAt: crime.date || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function placeFromCoords(lat, lon, name) {
  return {
    id: deterministicId('place', `${lat.toFixed(2)},${lon.toFixed(2)}`),
    type: 'place',
    name: name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    properties: { lat, lon },
    source: 'geo',
    updatedAt: new Date().toISOString(),
  };
}

// Simple string hash for deterministic IDs
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
