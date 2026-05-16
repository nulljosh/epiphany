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
    // Lightweight ping: count one row from any table to prevent auto-pause
    await supabaseRequest('profiles?select=id&limit=1');
    return res.status(200).json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error('[SUPABASE-PING]', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
