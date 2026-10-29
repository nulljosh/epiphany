import { describe, expect, it } from 'vitest';
import { cleanLists } from '../../server/api/watchlist-lists.js';

describe('cleanLists', () => {
  it('trims names, uppercases and dedupes symbols, drops bad ones', () => {
    expect(cleanLists([{ name: '  Tech ', symbols: ['aapl', 'AAPL', 'bad symbol!', 'shop.to'] }]))
      .toEqual([{ name: 'Tech', symbols: ['AAPL', 'SHOP.TO'] }]);
  });
  it('skips blank and duplicate names, caps the count', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ name: `L${i}`, symbols: [] }));
    expect(cleanLists([{ name: '' }, { name: 'A' }, { name: 'a' }])).toEqual([{ name: 'A', symbols: [] }]);
    expect(cleanLists(many)).toHaveLength(10);
  });
  it('rejects anything that is not an array', () => {
    expect(cleanLists({ name: 'x' })).toBeNull();
  });
});
