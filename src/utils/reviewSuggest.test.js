import { describe, it, expect } from 'vitest';
import { suggestCategories, merchantWords } from './reviewSuggest';

describe('suggestCategories', () => {
  const rows = [
    { description: 'STARBUCKS #123 VANCOUVER', category: 'coffee' },
    { description: 'STARBUCKS #88', category: 'coffee' },
    { description: 'SAVE ON FOODS 9', category: 'groceries' },
    { description: 'SAVE ON FOODS 2', category: 'groceries' },
    { description: 'SAVE ON FOODS 3', category: 'groceries' },
    { description: 'COMPASS VANCOUVER', category: 'transit' },
    { description: 'MYSTERY CO', category: 'uncategorized' },
  ];
  it('puts what similar merchants use first', () => {
    expect(suggestCategories({ description: 'STARBUCKS KITSILANO' }, rows)).toEqual(['coffee', 'groceries']);
    expect(suggestCategories({ description: 'POS VANCOUVER BAKERY' }, rows)).toEqual(['coffee', 'transit']);
  });
  it('falls back to the most used categories, never uncategorized', () => {
    expect(suggestCategories({ description: 'NOTHING ALIKE' }, rows)).toEqual(['groceries', 'coffee']);
    expect(suggestCategories({ description: 'X' }, [])).toEqual([]);
  });
  it('ignores card terminal noise words', () => {
    expect([...merchantWords('VISA DEBIT PURCHASE TIM HORTONS')]).toEqual(['tim', 'hortons']);
  });
});
