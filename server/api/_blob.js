// Drop-in replacement for @vercel/blob, backed by Workers KV.
//
// R2 would be the natural fit, but it can only be enabled from the Cloudflare
// dashboard, so KV keeps the migration self-service. Values here are avatars,
// cached JSON and statement PDFs — all comfortably under KV's 25MB/value cap.
// ponytail: swap the four functions below for R2 if a value ever outgrows that.
//
// Callers persist the returned `url` and fetch it back later, so the shim hands
// out URLs pointing at this Worker's own /api/blob/<key> route rather than a
// third-party origin.

const PREFIX = 'blob:';

function kv() {
  const ns = globalThis.__blobKv;
  if (!ns) throw new Error('BLOB KV binding unavailable');
  return ns;
}

function baseUrl() {
  return (globalThis.__publicBaseUrl || '').replace(/\/$/, '');
}

export function keyToUrl(key) {
  return `${baseUrl()}/api/blob/${key}`;
}

// Accepts either a bare key or a previously-issued URL.
export function urlToKey(urlOrKey) {
  if (!urlOrKey) return '';
  const s = String(urlOrKey);
  if (!s.includes('://')) return s.replace(/^\/+/, '');
  try {
    return decodeURIComponent(new URL(s).pathname.replace(/^\/api\/blob\//, ''));
  } catch {
    return s;
  }
}

export async function put(pathname, body, _opts = {}) {
  const key = String(pathname).replace(/^\/+/, '');
  const value =
    typeof body === 'string' || body instanceof ArrayBuffer || ArrayBuffer.isView(body)
      ? body
      : JSON.stringify(body);

  await kv().put(PREFIX + key, value, {
    metadata: { uploadedAt: new Date().toISOString() },
  });

  return { url: keyToUrl(key), downloadUrl: keyToUrl(key), pathname: key };
}

export async function del(urlOrKey, _opts = {}) {
  const key = urlToKey(urlOrKey);
  if (key) await kv().delete(PREFIX + key);
}

export async function list({ prefix = '' } = {}) {
  const res = await kv().list({ prefix: PREFIX + prefix });
  const blobs = res.keys.map((k) => {
    const key = k.name.slice(PREFIX.length);
    return {
      url: keyToUrl(key),
      downloadUrl: keyToUrl(key),
      pathname: key,
      uploadedAt: k.metadata?.uploadedAt || null,
      size: k.metadata?.size ?? 0,
    };
  });
  // @vercel/blob returns newest-first; latest.js relies on blobs[0].
  blobs.sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
  return { blobs, cursor: res.cursor, hasMore: !res.list_complete };
}

export async function get(urlOrKey, _opts = {}) {
  return kv().get(PREFIX + urlToKey(urlOrKey));
}

export async function getArrayBuffer(urlOrKey) {
  return kv().get(PREFIX + urlToKey(urlOrKey), 'arrayBuffer');
}
