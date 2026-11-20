import { describe, it, expect } from 'vitest';
import { parseInfoTable, weightedReturn } from '../../server/api/pilots.js';

const row = (name, cusip, value, extra = '') => `<ns1:infoTable><ns1:nameOfIssuer>${name}</ns1:nameOfIssuer><ns1:cusip>${cusip}</ns1:cusip><ns1:value>${value}</ns1:value><ns1:shrsOrPrnAmt><ns1:sshPrnamt>1</ns1:sshPrnamt><ns1:sshPrnamtType>SH</ns1:sshPrnamtType></ns1:shrsOrPrnAmt>${extra}</ns1:infoTable>`;

describe('pilots', () => {
  it('sums a CUSIP across rows, skips options, ranks by value', () => {
    const xml = row('APPLE', '037833100', 300) + row('APPLE', '037833100', 100) + row('BANK', '060505104', 600) + row('APPLE', '037833100', 999, '<ns1:putCall>Call</ns1:putCall>');
    const t = parseInfoTable(xml);
    expect(t.count).toBe(2);
    expect(t.rows[0]).toMatchObject({ cusip: '060505104', value: 600, weight: 0.6 });
    expect(t.rows[1]).toMatchObject({ cusip: '037833100', value: 400 });
  });
  it('re-weights around holdings with no price', () => {
    const h = [{ ticker: 'A', weight: 0.5 }, { ticker: 'B', weight: 0.25 }, { ticker: null, weight: 0.25 }];
    expect(weightedReturn(h, { A: 100, B: 100 }, { A: 110, B: 70 })).toBeCloseTo((0.5 * 0.1 + 0.25 * -0.3) / 0.75);
    expect(weightedReturn(h, {}, {})).toBeNull();
  });
});
