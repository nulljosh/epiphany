// Lazy-load @vercel/kv to prevent gateway crash when KV env vars are missing.
// All files should import { getKv } from './_kv.js' instead of '@vercel/kv'.
let _kv = null;
let _loaded = false;

export async function getKv() {
  if (!_loaded) {
    _loaded = true;
    try {
      const mod = await import('@vercel/kv');
      _kv = mod.kv;
    } catch (err) {
      console.warn('Failed to load @vercel/kv:', err.message);
      _kv = null;
    }
  }
  return _kv;
}
