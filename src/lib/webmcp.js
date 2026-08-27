// WebMCP tool registration. Exposes epiphany's core actions to in-browser
// agents (Claude in Chrome et al) via document.modelContext.
//
// ponytail: every tool delegates to an existing hook callback or an existing
// /api route. Nothing here reimplements app logic -- if a tool needs new
// behaviour, add it to the hook, not here.
import { useEffect, useRef } from 'react';

const json = async (path, init) => {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

const post = (path, body) => json(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const SYMBOL = { type: 'string', description: 'Ticker symbol, e.g. AAPL' };

// ctx is the live hook state from App.jsx, read through a ref so tools always
// see current values without re-registering on every render.
function buildTools(get) {
  return [
    // ---- read-only -------------------------------------------------------
    {
      name: 'get_watchlist',
      description: "List the symbols on the user's watchlist.",
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ symbols: get().watchlist }),
    },
    {
      name: 'get_quote',
      description: 'Get the latest price and daily change for one or more symbols.',
      inputSchema: {
        type: 'object',
        properties: { symbols: { type: 'array', items: SYMBOL, description: 'Symbols to quote' } },
        required: ['symbols'],
      },
      execute: ({ symbols }) =>
        json(`/api/stocks-free?symbols=${encodeURIComponent(symbols.join(','))}`),
    },
    {
      name: 'get_market_summary',
      description: 'Get index levels, macro indicators and the fear/greed reading for today.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => json('/api/markets'),
    },
    {
      name: 'get_portfolio',
      description: "Get the user's holdings, account balances and total net worth.",
      inputSchema: { type: 'object', properties: {} },
      execute: () => json('/api/portfolio'),
    },
    {
      name: 'get_news',
      description: 'Get recent market and world news headlines.',
      inputSchema: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Max headlines (default 20)' } },
      },
      execute: async ({ limit = 20 } = {}) => {
        const data = await json('/api/news');
        const items = Array.isArray(data) ? data : data.articles || data.items || [];
        return items.slice(0, limit);
      },
    },
    {
      name: 'list_alerts',
      description: 'List the price alerts the user has configured.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ alerts: get().alerts }),
    },

    // ---- reversible state changes ----------------------------------------
    {
      name: 'add_to_watchlist',
      description: "Add a symbol to the user's watchlist.",
      inputSchema: { type: 'object', properties: { symbol: SYMBOL }, required: ['symbol'] },
      execute: async ({ symbol }) => {
        get().addSymbol(symbol);
        return { added: symbol.toUpperCase().trim() };
      },
    },
    {
      name: 'remove_from_watchlist',
      description: "Remove a symbol from the user's watchlist.",
      inputSchema: { type: 'object', properties: { symbol: SYMBOL }, required: ['symbol'] },
      execute: async ({ symbol }) => {
        get().removeSymbol(symbol.toUpperCase().trim());
        return { removed: symbol.toUpperCase().trim() };
      },
    },
    {
      name: 'create_price_alert',
      description: 'Create a price alert that fires when a symbol crosses a target price.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: SYMBOL,
          targetPrice: { type: 'number', description: 'Price to trigger at' },
          direction: { type: 'string', enum: ['above', 'below'], description: 'Trigger when price goes above or below the target' },
        },
        required: ['symbol', 'targetPrice', 'direction'],
      },
      execute: async ({ symbol, targetPrice, direction }) => {
        await get().addAlert(symbol.toUpperCase().trim(), targetPrice, direction);
        return { created: { symbol, targetPrice, direction } };
      },
    },
    {
      name: 'delete_price_alert',
      description: 'Delete a price alert by id (see list_alerts).',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Alert id' } }, required: ['id'] },
      execute: async ({ id }) => {
        await get().removeAlert(id);
        return { deleted: id };
      },
    },

    // ---- consequential ----------------------------------------------------
    {
      name: 'set_broker_autopilot',
      description: 'Turn automated broker trading on or off. This lets the app place real trades with real money.',
      requiresConfirmation: true,
      inputSchema: {
        type: 'object',
        properties: { enabled: { type: 'boolean', description: 'true to enable automated trading' } },
        required: ['enabled'],
      },
      execute: ({ enabled }) => post('/api/broker/autopilot', { enabled }),
    },
    {
      name: 'disconnect_broker',
      description: 'Disconnect a linked brokerage account. Holdings synced from it stop updating.',
      requiresConfirmation: true,
      inputSchema: {
        type: 'object',
        properties: { broker: { type: 'string', description: 'Broker to disconnect, e.g. alpaca or wealthsimple' } },
        required: ['broker'],
      },
      execute: ({ broker }) => post('/api/broker/disconnect', { broker }),
    },
  ];
}

export function useWebMCP(ctx) {
  const ref = useRef(ctx);
  ref.current = ctx;

  useEffect(() => {
    const mc = document.modelContext;
    if (!mc?.registerTool) return; // browser without WebMCP support
    let cancelled = false;
    const registered = [];

    (async () => {
      for (const tool of buildTools(() => ref.current)) {
        if (cancelled) return;
        try {
          registered.push(await mc.registerTool(tool));
        } catch (err) {
          console.warn('[webmcp] failed to register', tool.name, err?.message);
        }
      }
    })();

    return () => {
      cancelled = true;
      // registerTool returns a handle with unregister() in the current spec.
      for (const h of registered) { try { h?.unregister?.(); } catch { /* gone already */ } }
    };
  }, []);
}
