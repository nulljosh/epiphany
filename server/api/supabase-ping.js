import { supabaseRequest, supabaseConfigured } from './supabase.js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseConfigured()) {
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  try {
    const { url, key } = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY };
    const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return res.status(200).json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error('[SUPABASE-PING]', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
