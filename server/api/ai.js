import Anthropic from '@anthropic-ai/sdk';
import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { checkRateLimit } from './_ratelimit.js';
import { getFmpApiKey, FMP_BASE } from './stocks-shared.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_HISTORY = 20;

const TOOLS = [
  {
    name: 'lookup_stock',
    description: 'Get current price, change %, market cap, P/E ratio for a stock symbol',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Stock ticker symbol (e.g. AAPL)' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_portfolio',
    description: 'Get the user\'s investment portfolio: holdings, accounts, debt, goals, budget',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_news',
    description: 'Search recent news articles. Optionally filter by query term.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Optional search query' } },
    },
  },
  {
    name: 'get_macro',
    description: 'Get current 10-year Treasury yield',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'query_ontology',
    description: 'Query the knowledge graph for objects by type. Types: asset, person, event, place, account, transaction, note, alert, decision',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Object type to query' },
        key: { type: 'string', description: 'Optional property key to filter by' },
        value: { type: 'string', description: 'Optional property value to match' },
      },
      required: ['type'],
    },
  },
  {
    name: 'get_alerts',
    description: 'Get the user\'s price alerts',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_watchlist',
    description: 'Get the user\'s stock watchlist',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_alert',
    description: 'Create a new price alert for a stock',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Stock symbol' },
        target_price: { type: 'number', description: 'Target price' },
        direction: { type: 'string', enum: ['above', 'below'], description: 'Trigger when price goes above or below target' },
      },
      required: ['symbol', 'target_price', 'direction'],
    },
  },
  {
    name: 'add_note',
    description: 'Save a note to the user\'s knowledge graph',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Note content' } },
      required: ['text'],
    },
  },
];

async function fetchStockQuote(symbol) {
  const apiKey = getFmpApiKey();
  if (!apiKey) return { error: 'Stock data not configured' };
  const fmpSymbol = symbol.replace('-', '.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${FMP_BASE}/quote/${fmpSymbol}?apikey=${apiKey}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { error: `FMP error ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return { error: `No data for ${symbol}` };
    const q = data[0];
    return { symbol, price: q.price, change: q.change, changePercent: q.changesPercentage, marketCap: q.marketCap, pe: q.pe, name: q.name };
  } catch {
    clearTimeout(timer);
    return { error: 'Stock lookup failed' };
  }
}

async function fetchNewsInternal(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query || 'world')}&mode=ArtList&maxrecords=10&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).map(a => ({ title: a.title, url: a.url, source: a.domain, seendate: a.seendate }));
  } catch {
    clearTimeout(timer);
    return [];
  }
}

async function fetchMacroInternal() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=DEMO_KEY&file_type=json&limit=1&sort_order=desc', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { note: 'Macro data temporarily unavailable' };
    const data = await res.json();
    return { tenYearYield: data.observations?.[0]?.value || 'N/A' };
  } catch {
    clearTimeout(timer);
    return { note: 'Macro data temporarily unavailable' };
  }
}

const EVENT_TTL_DAYS = 30;
function isExpired(obj) {
  if (obj.type !== 'event') return false;
  return Date.now() - new Date(obj.createdAt).getTime() > EVENT_TTL_DAYS * 86400000;
}

async function executeTool(name, input, userId, kv) {
  const prefix = `ont:${userId}`;
  switch (name) {
    case 'lookup_stock':
      return fetchStockQuote(input.symbol);
    case 'get_portfolio': {
      const data = await kv.get(`portfolio:${userId}`);
      if (!data) return { error: 'No portfolio configured' };
      const { holdings = [], accounts = [], debt = [], goals = [] } = data;
      return { holdings: holdings.slice(0, 20), accounts: accounts.slice(0, 10), debt, goals };
    }
    case 'get_news':
      return { articles: (await fetchNewsInternal(input.query)).slice(0, 10) };
    case 'get_macro':
      return fetchMacroInternal();
    case 'query_ontology': {
      const typeKey = `${prefix}:type:${input.type}`;
      const ids = (await kv.get(typeKey)) || [];
      const sliced = ids.slice(0, 20);
      if (!sliced.length) return { objects: [] };
      const objects = await Promise.all(sliced.map(id => kv.get(`${prefix}:obj:${id}`)));
      const results = objects
        .filter(obj => obj && !isExpired(obj))
        .filter(obj => !(input.key && input.value && String(obj.properties?.[input.key]) !== String(input.value)))
        .map(obj => ({ id: obj.id, name: obj.name, type: obj.type, properties: obj.properties }));
      return { objects: results };
    }
    case 'get_alerts':
      return { alerts: (await kv.get(`alerts:${userId}`)) || [] };
    case 'get_watchlist':
      return { watchlist: (await kv.get(`watchlist:${userId}`)) || [] };
    case 'create_alert': {
      const alerts = (await kv.get(`alerts:${userId}`)) || [];
      const newAlert = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        symbol: input.symbol.toUpperCase(),
        target_price: input.target_price,
        direction: input.direction,
        triggered: false,
        createdAt: new Date().toISOString(),
      };
      alerts.push(newAlert);
      await kv.set(`alerts:${userId}`, alerts);
      return { ok: true, alert: newAlert };
    }
    case 'add_note': {
      const noteId = `note:${Date.now().toString(36)}`;
      const note = {
        id: noteId, type: 'note', name: input.text.slice(0, 60),
        properties: { text: input.text }, source: 'ai',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      await kv.set(`${prefix}:obj:${noteId}`, note);
      // Update type + global indexes
      const [typeIds, allIds] = await Promise.all([
        kv.get(`${prefix}:type:note`).then(r => r || []),
        kv.get(`${prefix}:all`).then(r => r || []),
      ]);
      typeIds.unshift(noteId);
      if (typeIds.length > 100) typeIds.length = 100;
      allIds.unshift(noteId);
      if (allIds.length > 4500) allIds.length = 4500;
      await Promise.all([
        kv.set(`${prefix}:type:note`, typeIds),
        kv.set(`${prefix}:all`, allIds),
      ]);
      return { ok: true, noteId };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function buildSystemPrompt(userId, kv) {
  const parts = ['You are Monica, a personal intelligence analyst. You help the user understand their financial situation, market conditions, and local events. Be concise and direct. Use data from tools when answering factual questions.'];

  const [portfolio, watchlist, alerts] = await Promise.all([
    kv.get(`portfolio:${userId}`),
    kv.get(`watchlist:${userId}`),
    kv.get(`alerts:${userId}`),
  ]);

  if (portfolio?.holdings?.length) {
    parts.push(`User holds: ${portfolio.holdings.map(h => h.symbol).join(', ')}`);
  }
  if (watchlist?.length) {
    parts.push(`Watchlist: ${watchlist.map(w => w.symbol).join(', ')}`);
  }
  if (alerts?.length) {
    const active = alerts.filter(a => !a.triggered);
    if (active.length) parts.push(`${active.length} active price alerts`);
  }

  return parts.join('\n\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'POST required');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return errorResponse(res, 503, 'AI not configured');

  const session = await getSessionUser(req);
  if (!session) return errorResponse(res, 401, 'Authentication required');

  if (!(await checkRateLimit(req, { prefix: 'rl:ai', limit: 30, windowMs: 60000 }))) {
    return errorResponse(res, 429, 'Too many requests');
  }

  const kv = await getKv();

  if (kv) {
    const userLimitKey = `rl:ai:user:${session.userId}`;
    const now = Date.now();
    const userEntry = await kv.get(userLimitKey);
    if (!userEntry || now - userEntry.firstAttempt > 3_600_000) {
      await kv.set(userLimitKey, { count: 1, firstAttempt: now }, { ex: 3600 });
    } else if (userEntry.count >= 20) {
      return errorResponse(res, 429, 'AI hourly limit reached');
    } else {
      await kv.set(userLimitKey, { count: userEntry.count + 1, firstAttempt: userEntry.firstAttempt }, { ex: 3600 });
    }
  }

  const { message, conversationId } = req.body;
  if (!message || typeof message !== 'string') return errorResponse(res, 400, 'message required');

  const convId = conversationId || Date.now().toString(36);
  const historyKey = `ai:${session.userId}:conv:${convId}`;
  let history = (await kv.get(historyKey)) || [];

  history.push({ role: 'user', content: message });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

  const systemPrompt = await buildSystemPrompt(session.userId, kv);
  const client = new Anthropic({ apiKey });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let messages = [...history];
    let toolLoop = 0;
    const maxToolLoops = 5;
    let lastAssistantContent = null;

    while (toolLoop < maxToolLoops) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        tools: TOOLS,
      });

      let currentText = '';

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          currentText += event.delta.text;
          res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
        }
        if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          res.write(`data: ${JSON.stringify({ type: 'tool_start', name: event.content_block.name })}\n\n`);
        }
        if (event.type === 'message_stop') break;
      }

      const finalMessage = await stream.finalMessage();
      lastAssistantContent = finalMessage.content;

      const toolUses = finalMessage.content.filter(b => b.type === 'tool_use');
      if (toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: finalMessage.content });

      // Execute tools in parallel
      const toolResults = await Promise.all(toolUses.map(async (tool) => {
        const result = await executeTool(tool.name, tool.input, session.userId, kv);
        res.write(`data: ${JSON.stringify({ type: 'tool_result', name: tool.name })}\n\n`);
        return { type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) };
      }));

      messages.push({ role: 'user', content: toolResults });
      toolLoop++;
    }

    // Save structured content to preserve tool context across turns
    if (lastAssistantContent) {
      history.push({ role: 'assistant', content: lastAssistantContent });
    }
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    await kv.set(historyKey, history);

    res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`);
  } catch (err) {
    console.error('[ai] Error:', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI request failed' })}\n\n`);
  }

  res.end();
}
