import { Redis } from '@upstash/redis';

let _kv = null;
let _loaded = false;

export async function getKv() {
  if (!_loaded) {
    _loaded = true;
    try {
      const url = (process.env.KV_REST_API_URL || '').trim();
      const token = (process.env.KV_REST_API_TOKEN || '').trim();
      if (!url || !token) throw new Error('KV env vars missing');

      const redis = new Redis({ url, token });

      const wrap = (name, fn) => async (...args) => {
        try { return await fn(...args); }
        catch (err) { console.error(`[KV] ${name} error:`, err.message); return null; }
      };

      _kv = {
        get: wrap('get', (...args) => redis.get(...args)),
        set: wrap('set', (...args) => redis.set(...args)),
        del: wrap('del', (...args) => redis.del(...args)),
      };
    } catch (err) {
      console.warn('[KV] failed to init:', err.message);
      _kv = null;
    }
  }
  return _kv;
}
