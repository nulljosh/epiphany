// Lazy-load @vercel/kv to prevent gateway crash when KV env vars are missing.
// All files should import { getKv } from './_kv.js' instead of '@vercel/kv'.
// Wraps kv.get() to handle @vercel/kv v3 returning raw strings instead of parsed objects.
let _kv = null;
let _loaded = false;

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
              const result = await target.get(...args);
              if (typeof result === 'string') {
                try {
                  let parsed = JSON.parse(result);
                  // Double-serialization safety: if still a string after first parse, parse again
                  if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch { /* use first parse */ }
                  }
                  return parsed;
                } catch { return result; }
              }
              return result;
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
