#!/usr/bin/env node
// Terminal dashboard for a portfolio stored in Upstash KV.
// Usage: node cli/epiphany-tui.mjs <email>   (or EPIPHANY_EMAIL env var)
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput, useStdin } from 'ink';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const h = React.createElement;

const POLL_MS = 15_000;

function loadKvEnv() {
  const cached = join(repoRoot, '.env.tui.local');
  if (existsSync(cached)) dotenv.config({ path: cached });
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return;

  // ponytail: reuse scripts/kv-portfolio-edit.sh's pull-and-cache pattern instead of a new one
  execFileSync('npx', ['--yes', 'vercel', 'env', 'pull', cached, '--environment=production', '--yes'], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  dotenv.config({ path: cached });
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { result } = await res.json();
  if (result == null) return null;
  const parsed = JSON.parse(result);
  return Array.isArray(parsed) ? JSON.parse(parsed[0]) : parsed;
}

async function fetchPortfolio(email) {
  const user = await kvGet(`user:${email}`);
  if (!user) throw new Error(`no user found for ${email}`);
  const portfolio = await kvGet(`portfolio:${user.id}`);
  return portfolio || { holdings: [] };
}

function fmtMoney(n) {
  if (typeof n !== 'number') return '-';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function App({ email }) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useInput(
    (input, key) => {
      if (input === 'q' || key.escape) exit();
      if (input === 'r') refresh();
    },
    { isActive: isRawModeSupported }
  );

  async function refresh() {
    try {
      setPortfolio(await fetchPortfolio(email));
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return h(Box, { flexDirection: 'column' }, h(Text, { color: 'red' }, `error: ${error}`), h(Text, { dimColor: true }, 'press q to quit'));
  if (!portfolio) return h(Text, { dimColor: true }, 'loading...');

  const holdings = portfolio.holdings || [];
  const totalValue = holdings.reduce((sum, x) => sum + (x.marketValue || 0), 0);

  return h(
    Box,
    { flexDirection: 'column', padding: 1 },
    h(Text, { bold: true }, `epiphany — ${email}`),
    h(Text, { dimColor: true }, `total: ${fmtMoney(totalValue)}  ·  ${holdings.length} holdings  ·  updated ${lastUpdated?.toLocaleTimeString() ?? '-'}`),
    h(Box, { marginTop: 1, flexDirection: 'column' },
      h(Box, {}, h(Text, { bold: true, dimColor: true }, pad('SYMBOL', 10) + pad('QTY', 10) + pad('VALUE', 14))),
      ...holdings.map((holding, i) =>
        h(Box, { key: holding.symbol || i },
          h(Text, {}, pad(holding.symbol || '-', 10) + pad(String(holding.shares ?? '-'), 10) + pad(fmtMoney(holding.marketValue), 14))
        )
      )
    ),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'q quit · r refresh'))
  );
}

function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s.slice(0, len - 1) + ' ' : s + ' '.repeat(len - s.length);
}

const email = process.argv[2] || process.env.EPIPHANY_EMAIL;
if (!email) {
  console.error('usage: epiphany-tui.mjs <email>  (or set EPIPHANY_EMAIL)');
  process.exit(1);
}

loadKvEnv();
render(h(App, { email }));
