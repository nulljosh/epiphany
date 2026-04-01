// GET current Alpaca paper positions + account summary
import { ALPACA_BASE, alpacaHeaders, hasAlpacaKey } from './alpaca.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasAlpacaKey()) {
    return res.status(200).json({ positions: [], account: null, configured: false });
  }

  try {
    const [posRes, accRes] = await Promise.all([
      fetch(`${ALPACA_BASE}/v2/positions`, { headers: alpacaHeaders() }),
      fetch(`${ALPACA_BASE}/v2/account`, { headers: alpacaHeaders() }),
    ]);
    const [raw, account] = await Promise.all([posRes.json(), accRes.json()]);

    return res.status(200).json({
      configured: true,
      positions: Array.isArray(raw) ? raw.map(p => ({
        symbol: p.symbol,
        qty: +p.qty,
        side: p.side,
        avgEntry: +p.avg_entry_price,
        currentPrice: +p.current_price,
        pnl: +p.unrealized_pl,
        pnlPct: +p.unrealized_plpc * 100,
        marketValue: +p.market_value,
      })) : [],
      account: account.equity ? {
        equity: +account.equity,
        cash: +account.cash,
        buyingPower: +account.buying_power,
        dayPnl: +account.equity - +account.last_equity,
      } : null,
    });
  } catch (err) {
    console.error('[BROKER/POSITIONS] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
