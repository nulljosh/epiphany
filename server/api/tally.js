import { applyCors } from './_cors.js';
import { getKv } from './_kv.js';

const SCHEDULE = { 0: 21, 1: 25, 2: 25, 3: 23, 4: 27, 5: 25, 6: 23, 7: 26, 8: 24, 9: 28, 10: 25, 11: 16 };

function daysUntil(date) {
  return Math.max(0, Math.ceil((date - new Date()) / 86400000));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getLocalNextPayment() {
  const now = new Date();
  const year = 2026;

  for (let month = 0; month < 12; month += 1) {
    const date = new Date(Date.UTC(year, month, SCHEDULE[month], 12));
    if (date >= now) return { date: formatDate(date), daysUntil: daysUntil(date) };
  }

  const date = new Date(Date.UTC(year, 11, SCHEDULE[11], 12));
  return { date: formatDate(date), daysUntil: 0 };
}

function normalizeNextPayment(value) {
  const dateString = value?.nextPayment?.date || value?.nextPaymentDate || value?.date;
  if (!dateString) return null;
  const date = new Date(`${dateString}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return { date: formatDate(date), daysUntil: daysUntil(date) };
}

function getUserId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1].slice(0, 32) : null;
}

async function fetchTallyStatus(username, password) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const headers = { Accept: 'application/json' };
  if (username && password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
  try {
    const res = await fetch('https://tally.heyitsmejosh.com/api/status', { signal: controller.signal, headers });
    clearTimeout(timeoutId);
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
    return await res.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { action } = req.query;

  if (action === 'connect' && req.method === 'POST') {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const data = await fetchTallyStatus(username, password);
    if (!data) return res.status(401).json({ error: 'Invalid credentials or Tally unavailable' });

    const userId = getUserId(req);
    if (userId) {
      const kv = await getKv();
      if (kv) await kv.set(`tally:creds:${userId}`, { username, password }, { ex: 86400 * 365 });
    }

    const nextPayment = normalizeNextPayment(data);
    return res.status(200).json({ connected: true, nextPayment: nextPayment || getLocalNextPayment() });
  }

  if (action === 'disconnect' && req.method === 'POST') {
    const userId = getUserId(req);
    if (userId) {
      const kv = await getKv();
      if (kv) await kv.del(`tally:creds:${userId}`);
    }
    return res.status(200).json({ connected: false });
  }

  if (action === 'status' && req.method === 'GET') {
    const userId = getUserId(req);
    if (!userId) return res.status(200).json({ connected: false });
    const kv = await getKv();
    const creds = kv ? await kv.get(`tally:creds:${userId}`) : null;
    return res.status(200).json({ connected: !!creds });
  }

  if (action === 'next-payment') {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
    const userId = getUserId(req);
    let username, password;
    if (userId) {
      const kv = await getKv();
      const creds = kv ? await kv.get(`tally:creds:${userId}`) : null;
      if (creds) { username = creds.username; password = creds.password; }
    }
    const data = await fetchTallyStatus(username, password);
    const nextPayment = data ? normalizeNextPayment(data) : null;
    return res.status(200).json({ nextPayment: nextPayment || getLocalNextPayment() });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
