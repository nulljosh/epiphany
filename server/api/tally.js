import { applyCors } from './_cors.js';

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

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (req.query.action !== 'next-payment') return res.status(400).json({ error: 'Invalid action' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://tally.heyitsmejosh.com/api/status', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Upstream unavailable');
    }

    const nextPayment = normalizeNextPayment(await response.json());
    if (!nextPayment) throw new Error('Missing next payment');
    return res.status(200).json({ nextPayment });
  } catch (error) {
    return res.status(200).json({ nextPayment: getLocalNextPayment() });
  }
}
