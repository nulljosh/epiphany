// Prints the live TradingView watchlist as JSON, via the TradingView MCP. Used by `backtest.py watchlist`.
const H = '/Users/joshua/Documents/Code/_external/tradingview-mcp/src';
const { connect } = await import(`${H}/connection.js`);
const core = await import(`${H}/core/index.js`);
await connect();
console.log(JSON.stringify(await core.watchlist.get()));
process.exit(0);
