// Fast pass: TradingView's own Strategy Tester numbers for the Epiphany strategy on every watchlist symbol, no GIFs.
// Writes tradingview/results-tv-stats.json.   node tradingview/stats-watchlist.mjs
import fs from 'fs';
const H = '/Users/joshua/Documents/Code/_external/tradingview-mcp/src';
const { connect } = await import(`${H}/connection.js`);
const core = await import(`${H}/core/index.js`);
const here = new URL('.', import.meta.url).pathname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
await connect();
try { await core.replay.stop(); } catch {}
await core.chart.setTimeframe({ timeframe: 'D' });
const syms = (await core.watchlist.get()).symbols.map(s => s.symbol).filter(s => !/VIX$/.test(s));  // VIX is a fear gauge, not a holding
const out = {};
for (const sym of syms) {
  let m = null;
  for (let tries = 0; tries < 3 && !m?.total_trades; tries++) {
    await core.chart.setSymbol({ symbol: sym });
    await sleep(tries ? 6000 : 3500);
    m = (await core.data.getStrategyResults()).metrics;
  }
  out[sym] = m ? { trades: m.total_trades, wins: m.winning_trades, net_pct: m.net_profit_percent,
    max_dd_pct: m.max_drawdown_percent, profit_factor: m.profit_factor } : { error: 'no results' };
  fs.writeFileSync(`${here}results-tv-stats.json`, JSON.stringify(out, null, 1));
  console.log(sym, JSON.stringify(out[sym]));
}
process.exit(0);
