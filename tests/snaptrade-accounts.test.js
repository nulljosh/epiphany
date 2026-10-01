import { describe, it, expect } from 'vitest';
import { SnapTradeAdapter } from '../src/utils/brokers/snaptrade.js';

// Shaped like the real Wealthsimple snapshot from 2026-10-01: CAD account, USD-listed SPY, a USD cash line.
function adapter() {
  const a = new SnapTradeAdapter({ clientId: 'c', consumerKey: 'k', userId: 'u', userSecret: 's' });
  a.listAccounts = async () => [{ id: 'tfsa', name: 'Wealthsimple Trade TFSA' }];
  a._request = async (_m, path) => path.endsWith('/balances')
    ? [{ cash: 738.2, currency: { code: 'CAD' } }, { cash: 4.92, currency: { code: 'USD' } }]
    : [{ units: 0.6259, price: 764, currency: { code: 'USD' }, symbol: { symbol: { symbol: 'SPY' } } }];
  return a;
}

describe('SnapTrade account totals', () => {
  it('converts USD holdings and USD cash into CAD before adding them up', async () => {
    const [acct] = await adapter().getAccounts({ usdPerCad: 0.7 });
    expect(acct.cash).toBeCloseTo(738.2 + 4.92 / 0.7, 2);
    expect(acct.balance).toBeCloseTo(738.2 + 4.92 / 0.7 + (0.6259 * 764) / 0.7, 2);
    expect(acct.currency).toBe('CAD');
  });

  it('keeps the old raw sum when the rate is unavailable', async () => {
    const [acct] = await adapter().getAccounts();
    expect(acct.balance).toBeCloseTo(738.2 + 4.92 + 0.6259 * 764, 2);
    expect(acct.currency).toBeNull();
  });
});
