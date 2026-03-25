import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { checkRateLimit } from './_ratelimit.js';

const ARRAY_FIELDS = ['holdings', 'accounts', 'debt', 'goals', 'spending', 'giving'];

function validatePortfolioPayload(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid data format' };

  const errors = [];

  for (const field of ARRAY_FIELDS) {
    if (data[field] && !Array.isArray(data[field])) errors.push(`${field} must be an array`);
  }

  if (Array.isArray(data.holdings)) {
    data.holdings.forEach((h, i) => {
      if (!h.symbol || typeof h.symbol !== 'string') errors.push(`holdings[${i}]: missing symbol`);
      if (typeof h.shares !== 'number' || h.shares < 0) errors.push(`holdings[${i}]: invalid shares`);
    });
  }

  if (data.budget && typeof data.budget === 'object') {
    if (data.budget.income && !Array.isArray(data.budget.income)) errors.push('budget.income must be an array');
    if (data.budget.expenses && !Array.isArray(data.budget.expenses)) errors.push('budget.expenses must be an array');
  }

  return errors.length > 0 ? { valid: false, error: errors.join('; ') } : { valid: true };
}

export default async function handler(req, res) {
  const kv = await getKv();
  const session = await getSessionUser(req);
  if (!session) {
    return errorResponse(res, 401, 'Authentication required');
  }

  const { action } = req.query;
  const kvKey = `portfolio:${session.userId}`;

  // GET: read portfolio
  if (req.method === 'GET' && action === 'get') {
    const data = await kv.get(kvKey);
    console.log(`[portfolio] GET ${kvKey}:`, data ? `${JSON.stringify(data).length} bytes` : 'null');
    return res.status(200).json(data || { holdings: [], accounts: [], debt: [], goals: [], spending: [], giving: [] });
  }

  // GET: compact summary for CLI
  if (req.method === 'GET' && action === 'summary') {
    const data = await kv.get(kvKey);
    if (!data) return res.status(200).json({ empty: true });

    const stocksValue = (data.holdings || []).reduce((sum, h) => sum + (h.shares * (h.costBasis || 0)), 0);
    const cashValue = (data.accounts || []).reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalDebt = (data.debt || []).reduce((sum, d) => sum + (d.balance || 0), 0);
    const netWorth = stocksValue + cashValue - totalDebt;

    const totalIncome = data.budget?.income?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
    const totalExpenses = data.budget?.expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    return res.status(200).json({
      netWorth: Math.round(netWorth * 100) / 100,
      stocksValue: Math.round(stocksValue * 100) / 100,
      cashValue: Math.round(cashValue * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      monthlyIncome: totalIncome,
      monthlyExpenses: totalExpenses,
      surplus: totalIncome - totalExpenses,
      holdingsCount: (data.holdings || []).length,
      topHoldings: (data.holdings || [])
        .map(h => ({ symbol: h.symbol, value: Math.round(h.shares * (h.costBasis || 0) * 100) / 100 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      debtItems: (data.debt || []).map(d => ({ name: d.name, balance: d.balance })),
      updatedAt: data.updatedAt || null,
    });
  }

  // POST: update portfolio
  if (req.method === 'POST' && action === 'update') {
    if (!(await checkRateLimit(req, { prefix: 'rl:portfolio' }))) {
      return errorResponse(res, 429, 'Too many requests');
    }
    const body = req.body;
    const { valid, error } = validatePortfolioPayload(body);
    if (!valid) {
      return res.status(400).json({ error });
    }

    // When _fullReplace is true, the client is sending a complete portfolio
    // (e.g. from the web/iOS editor). Accept it as-is including empty arrays.
    // Otherwise, merge: empty arrays in the request do not overwrite non-empty
    // arrays on the server. This prevents accidental data wipes from partial
    // update clients like `balance update`.
    const fullReplace = body._fullReplace === true;
    const existing = fullReplace ? {} : (await kv.get(kvKey) || {});

    const mergeField = (field) => {
      const incoming = Array.isArray(body[field]) ? body[field] : [];
      const current = Array.isArray(existing[field]) ? existing[field] : [];
      return incoming.length > 0 ? incoming : current;
    };

    const mergeBudget = () => {
      const incoming = body.budget || { income: [], expenses: [] };
      const current = existing.budget || { income: [], expenses: [] };
      const hasIncoming = (incoming.income?.length > 0) || (incoming.expenses?.length > 0);
      return hasIncoming ? incoming : current;
    };

    const payload = {
      holdings: mergeField('holdings'),
      accounts: mergeField('accounts'),
      budget: mergeBudget(),
      debt: mergeField('debt'),
      goals: mergeField('goals'),
      spending: mergeField('spending'),
      giving: mergeField('giving'),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(kvKey, payload);
    return res.status(200).json({ ok: true, updatedAt: payload.updatedAt });
  }

  return errorResponse(res, 400, 'Unknown action. Use: get, update, summary');
}
