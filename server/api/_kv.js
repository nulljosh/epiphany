import { Redis } from '@upstash/redis';

let _kv = null;
let _loaded = false;

// Local-only stand-in so signup, login and checkout can be tested on localhost with no real database.
// ponytail: opt-in by env var and refused on the production Worker; no persistence, TTLs honoured on read.
function memoryKv() {
  const m = new Map();
  const live = (k) => { const e = m.get(k); if (e && e.exp && e.exp < Date.now()) { m.delete(k); return undefined; } return e; };
  const get = async (k) => live(k)?.v ?? null;
  const set = async (k, v, o = {}) => {
    if (o.nx && live(k)) return null;
    m.set(k, { v, exp: o.ex ? Date.now() + o.ex * 1000 : 0 });
    return 'OK';
  };
  const del = async (...ks) => ks.reduce((n, k) => n + (m.delete(k) ? 1 : 0), 0);
  const keys = async (pat) => { const re = new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); return [...m.keys()].filter((k) => live(k) && re.test(k)); };
  return { get, set, del, keys, getStrict: get, setStrict: set };
}

export async function getKv() {
  if (!_loaded) {
    _loaded = true;
    if (process.env.EPIPHANY_LOCAL_KV === '1' && process.env.NODE_ENV !== 'production') {
      console.warn('[KV] using in-memory store (EPIPHANY_LOCAL_KV=1)');
      return (_kv = memoryKv());
    }
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
        // Payment handlers must distinguish a storage outage from a missing key.
        getStrict: (...args) => redis.get(...args),
        setStrict: (...args) => redis.set(...args),
        get: wrap('get', (...args) => redis.get(...args)),
        set: wrap('set', (...args) => redis.set(...args)),
        del: wrap('del', (...args) => redis.del(...args)),
        keys: wrap('keys', (...args) => redis.keys(...args)),
      };
    } catch (err) {
      console.warn('[KV] failed to init:', err.message);
      _kv = null;
    }
  }
  return _kv;
}
