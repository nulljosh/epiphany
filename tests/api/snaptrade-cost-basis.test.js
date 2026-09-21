import { describe, it, expect } from 'vitest';
import { SnapTradeAdapter } from '../../src/utils/brokers/snaptrade.js';

describe('SnapTradeAdapter.costBasisFromActivities', () => {
  it('averages buys and reduces on sells, ignoring closed positions', () => {
    const acts = [
      { date: '2026-03-01', type: 'BUY', symbol: 'XEQT', units: 10, price: 30 },
      { date: '2026-01-01', type: 'BUY', symbol: 'XEQT', units: 10, price: 20 },
      { date: '2026-04-01', type: 'SELL', symbol: 'XEQT', units: 5, price: 40 },
      { date: '2026-02-01', type: 'BUY', symbol: 'GONE', units: 1, price: 5 },
      { date: '2026-02-02', type: 'SELL', symbol: 'GONE', units: 1, price: 6 },
      { date: '2026-02-03', type: 'DIVIDEND', symbol: 'XEQT', units: 0, amount: 12 },
    ];
    expect(SnapTradeAdapter.costBasisFromActivities(acts)).toEqual({ XEQT: 25 });
  });
});

describe('SnapTradeAdapter.getHoldings', () => {
  it('emits crypto as a Yahoo pair so BTC is not priced as the Grayscale ETF', async () => {
    const adapter = new SnapTradeAdapter({ clientId: 'c', consumerKey: 'k', userId: 'u', userSecret: 's' });
    adapter._request = async (_m, path) => path === '/accounts'
      ? [{ id: 'a1', name: 'Wealthsimple Trade CRYPTO' }, { id: 'a2', name: 'Wealthsimple Trade TFSA' }]
      : path.includes('a1') ? [{ symbol: { symbol: { symbol: 'BTC' } }, units: 0.001, price: 100000 }]
        : [{ symbol: { symbol: { symbol: 'SPY' } }, units: 1, price: 700 }];
    const symbols = (await adapter.getHoldings()).map(h => h.symbol);
    expect(symbols).toEqual(['BTC-USD', 'SPY']);
  });
});
