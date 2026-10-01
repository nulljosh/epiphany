// For every symbol on the TradingView watchlist: record a replay GIF of the Epiphany strategy,
// then read TradingView's own Strategy Tester numbers. Writes tradingview/results-tv-watchlist.json.
//   node tradingview/record-watchlist.mjs [START_DATE] [STEPS]
import { execFileSync } from 'child_process';
import fs from 'fs';
const H = '/Users/joshua/Documents/Code/_external/tradingview-mcp/src';
const { connect } = await import(`${H}/connection.js`);
const core = await import(`${H}/core/index.js`);
const [date = '2024-01-02', steps = '150'] = process.argv.slice(2);
const here = new URL('.', import.meta.url).pathname;
fs.mkdirSync(`${here}replays`, { recursive: true });
await connect();
const syms = (await core.watchlist.get()).symbols.map(s => s.symbol);
const out = `${here}results-tv-watchlist.json`;
const results = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
for (const sym of syms) {
  if (results[sym]?.gif) { console.log('skip', sym); continue; }  // resumable
  const gif = `${here}replays/${sym.replace(':', '-')}.gif`;
  const row = { symbol: sym };
  try {
    execFileSync('node', [`${here}record-replay.mjs`, sym, date, steps, gif], { stdio: 'inherit', timeout: 900000 });
    row.gif = gif;
    await new Promise(r => setTimeout(r, 3000));
    const m = (await core.data.getStrategyResults()).metrics || {};
    Object.assign(row, { trades: m.total_trades, wins: m.winning_trades, net_pct: m.net_profit_percent,
      max_dd_pct: m.max_drawdown_percent, profit_factor: m.profit_factor });
  } catch (e) {
    row.error = String(e.message).slice(0, 200);
  }
  results[sym] = row;
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(new Date().toISOString(), sym, JSON.stringify(row));
}
process.exit(0);
