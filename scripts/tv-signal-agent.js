#!/usr/bin/env node
// TradingView MCP → Broker signal agent
// Polls live TradingView chart for Monica Kelly entry signals, fires orders.
//
// Usage:
//   node scripts/tv-signal-agent.js [--broker alpaca|wealthsimple] [--study Monica|Epiphany] [--dry-run]
//
// Requires:
//   - TradingView Desktop running with --remote-debugging-port=9222
//   - tradingview-mcp registered in ~/.claude/mcp.json (already done)
//   - SIGNAL_API env var (default: http://localhost:3000)
//   - SIGNAL_API_KEY env var (optional shared secret for /api/broker/signal)
//   - WS_USER_ID env var (for Wealthsimple mode)
//
// Talks to the TradingView MCP server directly via its JS core (no MCP protocol needed).

import path from 'path';

const TV_MCP_PATH = path.resolve('/Users/joshua/Documents/Code/_external/tradingview-mcp');
const POLL_INTERVAL_MS = 5000;
const SIGNAL_API = process.env.SIGNAL_API || 'http://localhost:3000';
const DRY_RUN = process.argv.includes('--dry-run');
const arg = (k, d) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d;
const BROKER = arg('--broker', 'alpaca');
const STUDY = arg('--study', 'Monica');

// Import TradingView MCP core directly (bypasses MCP protocol overhead)
const { connect } = await import(`${TV_MCP_PATH}/src/connection.js`);
const core = await import(`${TV_MCP_PATH}/src/core/index.js`);

// Last label seen. Fire only when a new one appears, never on labels already on the chart at startup.
let lastKey;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function readSignal() {
  // Labels come oldest first; the strategy draws "BUY" / "SELL" at signal bars
  const res = await core.data.getPineLabels({ study_filter: STUDY, verbose: true });
  const latest = res?.studies?.[0]?.labels?.at(-1);
  if (!latest?.text) return null;

  const text = latest.text.toUpperCase();
  if (!text.includes('BUY') && !text.includes('SELL')) return null;

  const quote = await core.data.getQuote({});
  return {
    key: `${latest.id}:${latest.x}:${latest.text}`,
    action: text.includes('BUY') ? 'buy' : 'sell',
    sym: quote?.symbol?.replace(/^[A-Z]+:/, '') || 'SPY',
    price: quote?.close || 0,
    labelText: latest.text,
    time: Date.now(),
  };
}

async function fireOrder(signal) {
  const endpoint = BROKER === 'wealthsimple'
    ? `${SIGNAL_API}/api/broker/ws-signal`
    : `${SIGNAL_API}/api/broker/signal`;

  const body = BROKER === 'wealthsimple'
    ? { symbol: signal.sym, side: signal.action, qty: 1, userId: process.env.WS_USER_ID }
    : { symbol: signal.sym, qty: 1, side: signal.action };

  log(`[${BROKER}] Placing ${signal.action} ${signal.sym} @ ~${signal.price}`);

  if (DRY_RUN) {
    log('[DRY-RUN] Would POST:', JSON.stringify(body));
    return;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    log(`[ERROR] Order rejected: ${data.error || JSON.stringify(data)}`);
  } else {
    log(`[OK] Order placed. ID: ${data.orderId || data.order?.id}`);
  }
}

async function poll() {
  try {
    const signal = await readSignal();
    if (!signal) return;

    if (lastKey === undefined) { lastKey = signal.key; return; } // prime, don't trade history
    if (signal.key === lastKey) return;
    lastKey = signal.key;

    log(`Signal detected: ${signal.action.toUpperCase()} ${signal.sym} — "${signal.labelText}"`);
    await fireOrder(signal);
  } catch (err) {
    log('[POLL ERROR]', err.message);
  }
}

// Connect to TradingView CDP
log(`Connecting to TradingView CDP...`);
await connect();
log(`Connected. Polling every ${POLL_INTERVAL_MS / 1000}s. Study: ${STUDY}. Broker: ${BROKER}. Dry-run: ${DRY_RUN}`);

setInterval(poll, POLL_INTERVAL_MS);
poll(); // immediate first check
