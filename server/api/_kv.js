// Lazy-load @vercel/kv to prevent gateway crash when KV env vars are missing.
// All files should import { getKv } from './_kv.js' instead of '@vercel/kv'.
// Wraps kv.get() to handle @vercel/kv v3 returning raw strings instead of parsed objects.
let _kv = null;
let _loaded = false;

// Trim whitespace/newlines from KV env vars before @vercel/kv reads them.
// Upstash throws UrlError if the URL contains trailing whitespace.
for (const key of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'KV_REST_API_READ_ONLY_TOKEN', 'KV_URL', 'REDIS_URL']) {
  if (process.env[key]) process.env[key] = process.env[key].trim();
}

export async function getKv() {
  if (!_loaded) {
    _loaded = true;
    try {
      const mod = await import('@vercel/kv');
      const rawKv = mod.kv;
      _kv = new Proxy(rawKv, {
        get(target, prop) {
          if (prop === 'get') {
            return async (...args) => {
              try {
                const result = await target.get(...args);
                if (typeof result === 'string') {
                  try {
                    let parsed = JSON.parse(result);
                    if (typeof parsed === 'string') {
                      try { parsed = JSON.parse(parsed); } catch { /* use first parse */ }
                    }
                    return parsed;
                  } catch { return result; }
                }
                return result;
              } catch (err) {
                console.error('[KV] get error:', err.message);
                return null;
              }
            };
          }
          if (prop === 'set') {
            return async (...args) => {
              try { return await target.set(...args); }
              catch (err) { console.error('[KV] set error:', err.message); return null; }
            };
          }
          if (prop === 'del') {
            return async (...args) => {
              try { return await target.del(...args); }
              catch (err) { console.error('[KV] del error:', err.message); return null; }
            };
          }
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
    } catch (err) {
      console.warn('Failed to load @vercel/kv:', err.message);
      _kv = null;
    }
  }
  return _kv;
}
