import { describe, expect, it } from 'vitest';
import { parseStatementText, categorizeTransaction, summarizeTransactions } from '../../server/api/statements-shared.js';

describe('categorizeTransaction', () => {
  it('returns null for income/deposits', () => {
    expect(categorizeTransaction('DIRECT DEPOSIT - PAYROLL')).toBeNull();
    expect(categorizeTransaction('Transfer In from Savings')).toBeNull();
    expect(categorizeTransaction('Interest Earned')).toBeNull();
  });

  it('returns null for credit card payments', () => {
    expect(categorizeTransaction('PAYMENT - THANK YOU / PAIEMENT - MERCI')).toBeNull();
    expect(categorizeTransaction('PAYMENT - THANK YOU')).toBeNull();
  });

  it('categorizes food', () => {
    expect(categorizeTransaction('SUBWAY 23104 LANGLEY BC')).toBe('food');
    expect(categorizeTransaction("WENDY'S RESTAURANTS LANGLEY BC")).toBe('food');
    expect(categorizeTransaction('STARBUCKS #1234')).toBe('food');
    expect(categorizeTransaction('CHIPOTLE #2899 LANGLEY BC')).toBe('food');
    expect(categorizeTransaction('FRESHSLICE-200ST MARKHAM ON')).toBe('food');
    expect(categorizeTransaction('DAIRY QUEEN #27304 OLO LANGLEY BC')).toBe('food');
  });

  it('categorizes shopping', () => {
    expect(categorizeTransaction('COSTCO WHOLESALE W259 LANGLEY BC')).toBe('shopping');
    expect(categorizeTransaction('WALMART.CA MISSISSAUGA ON')).toBe('shopping');
    expect(categorizeTransaction('WAL-MART #5853 SURREY BC')).toBe('shopping');
    expect(categorizeTransaction('SHOPPERS DRUG MART #28 LANGLEY BC')).toBe('shopping');
    expect(categorizeTransaction('DOLLARAMA #1053 LANGLEY BC')).toBe('shopping');
    expect(categorizeTransaction('REAL CDN SUPERSTORE #1 LANGLEY BC')).toBe('shopping');
    expect(categorizeTransaction('SAVE ON FOODS #992 LANGLEY BC')).toBe('shopping');
  });

  it('categorizes alcohol', () => {
    expect(categorizeTransaction('RIDERS LIQUOR STORE LANGLEY BC')).toBe('alcohol');
    expect(categorizeTransaction('SHOOTERS LIQUOR STORE SURREY BC')).toBe('alcohol');
  });

  it('categorizes transit', () => {
    expect(categorizeTransaction('CHV40172 LANGLEY -208 LANGLEY BC')).toBe('transit');
  });

  it('categorizes cannabis', () => {
    expect(categorizeTransaction('420 CANNABIS - LANGLEY LANGLEY BC')).toBe('cannabis');
  });

  it('categorizes gas', () => {
    expect(categorizeTransaction('CHEVRON 43376 SURREY BC')).toBe('gas');
    expect(categorizeTransaction('SUPER SAVE GAS #87 LANGLEY BC')).toBe('gas');
  });

  it('categorizes pets', () => {
    expect(categorizeTransaction('HOMES ALIVE PET CENTRE EDMONTON AB')).toBe('pets');
  });

  it('categorizes vape', () => {
    expect(categorizeTransaction('THE VAPORY LANGLEY LANGLEY BC')).toBe('vape');
    expect(categorizeTransaction('VAPE STREET LANGLEY BC')).toBe('vape');
  });

  it('returns uncategorized for unknown', () => {
    expect(categorizeTransaction('RANDOM STORE XYZ')).toBe('uncategorized');
  });
});

describe('parseStatementText - Wealthsimple format', () => {
  it('parses inline YYYY-MM-DD format', () => {
    const text = '2026-01-152026-01-15Coffee Shop-$4.50$995.50\n2026-01-162026-01-16Grocery Store-$55.00$940.50';
    const result = parseStatementText(text);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-01-15');
    expect(result[0].description).toBe('Coffee Shop');
    expect(result[0].amount).toBe(-4.5);
    expect(result[0].balance).toBe(995.5);
  });

  it('parses multi-line YYYY-MM-DD format', () => {
    const text = '2026-01-15\n2026-01-15\nCoffee Shop\n-$4.50\n$995.50';
    const result = parseStatementText(text);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Coffee Shop');
  });

  it('returns empty for unparseable text', () => {
    const result = parseStatementText('This is not a statement');
    expect(result).toEqual([]);
  });
});

describe('parseStatementText - Credit card format (RBC/TD/CIBC)', () => {
  it('parses MMM DD transaction lines with year from header', () => {
    const text = [
      'STATEMENT FROM FEB 12 TO MAR 11, 2026',
      'FEB 11 FEB 12 WALMART.CA MISSISSAUGA ON $130.24',
      'FEB 11 FEB 12 FRESHSLICE-200ST MARKHAM ON $10.50',
      'FEB 19 FEB 20 PAYMENT - THANK YOU / PAIEMENT - MERCI -$1,100.00',
    ].join('\n');

    const result = parseStatementText(text);
    expect(result.length).toBeGreaterThanOrEqual(2);

    const walmart = result.find(t => t.description.includes('WALMART'));
    expect(walmart).toBeDefined();
    expect(walmart.date).toBe('2026-02-11');
    expect(walmart.postedDate).toBe('2026-02-12');
    expect(walmart.amount).toBe(-130.24);
    expect(walmart.category).toBe('shopping');

    const freshslice = result.find(t => t.description.includes('FRESHSLICE'));
    expect(freshslice).toBeDefined();
    expect(freshslice.amount).toBe(-10.50);
    expect(freshslice.category).toBe('food');
  });

  it('excludes payment lines from categories', () => {
    const text = [
      'STATEMENT FROM FEB 12 TO MAR 11, 2026',
      'FEB 19 FEB 20 PAYMENT - THANK YOU / PAIEMENT - MERCI -$1,100.00',
    ].join('\n');

    const result = parseStatementText(text);
    const payment = result.find(t => t.description.includes('PAYMENT'));
    if (payment) {
      expect(payment.category).toBeNull();
    }
  });

  it('handles statement period year extraction variants', () => {
    const text1 = 'STATEMENT FROM JAN 01 TO JAN 31, 2025\nJAN 05 JAN 06 TEST STORE $10.00';
    const r1 = parseStatementText(text1);
    expect(r1.length).toBeGreaterThan(0);
    expect(r1[0].date).toBe('2025-01-05');

    const text2 = 'STATEMENT PERIOD JAN 1 TO FEB 1 2025\nJAN 15 JAN 16 TEST STORE $5.00';
    const r2 = parseStatementText(text2);
    if (r2.length > 0) {
      expect(r2[0].date).toMatch(/^2025-/);
    }
  });
});

describe('summarizeTransactions', () => {
  it('sums negative amounts by category', () => {
    const transactions = [
      { date: '2026-02-11', amount: -130.24, category: 'shopping' },
      { date: '2026-02-11', amount: -10.50, category: 'food' },
      { date: '2026-02-12', amount: -42.41, category: 'alcohol' },
      { date: '2026-02-13', amount: -125.98, category: 'shopping' },
    ];
    const summary = summarizeTransactions(transactions, 'test.pdf');
    expect(summary.total).toBe(309.13);
    expect(summary.categories.shopping).toBe(256.22);
    expect(summary.categories.food).toBe(10.50);
    expect(summary.categories.alcohol).toBe(42.41);
    expect(summary.month).toBe('Feb 2026');
    expect(summary.sortKey).toBe('2026-02');
  });

  it('ignores positive amounts and null categories', () => {
    const transactions = [
      { date: '2026-02-11', amount: 1100, category: null },
      { date: '2026-02-11', amount: -10.50, category: 'food' },
    ];
    const summary = summarizeTransactions(transactions, 'test.pdf');
    expect(summary.total).toBe(10.50);
    expect(summary.categories.food).toBe(10.50);
  });

  it('handles empty transactions', () => {
    const summary = summarizeTransactions([], 'empty.pdf');
    expect(summary.total).toBe(0);
    expect(summary.categories).toEqual({});
    expect(summary.month).toBe('empty');
  });
});
