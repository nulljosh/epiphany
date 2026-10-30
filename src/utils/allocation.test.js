import { describe, expect, it } from 'vitest';
import { allocation, isCrypto } from './allocation';

describe('allocation', () => {
  it('splits holdings into stocks and crypto, adds cash, drops empty buckets', () => {
    expect(allocation([{ symbol: 'AAPL', value: 300 }, { symbol: 'BTC-USD', value: 100 }, { symbol: 'X', value: 0 }], 50))
      .toEqual([{ label: 'Stocks', value: 300 }, { label: 'Crypto', value: 100 }, { label: 'Cash', value: 50 }]);
    expect(allocation([{ symbol: 'SHOP.TO', value: 10 }], 0)).toEqual([{ label: 'Stocks', value: 10 }]);
  });
  it('knows a coin ticker from a stock', () => {
    expect(isCrypto('ETH')).toBe(true);
    expect(isCrypto('COIN')).toBe(false);
  });
});
