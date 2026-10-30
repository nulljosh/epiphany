import { describe, expect, it } from 'vitest';
import { parseFomc } from '../../server/api/fomc.js';

const meeting = (month, date) => `<div class="fomc-meeting__month col-xs-5"><strong>${month}</strong></div><div class="fomc-meeting__date col-xs-4">${date}</div>`;

describe('parseFomc', () => {
  it('takes the last day of each meeting, across years and split months', () => {
    const html = `<h4>2027 FOMC Meetings</h4>${meeting('January', '26-27')}${meeting('Apr/May', '30-1')}<h4>2026 FOMC Meetings</h4>${meeting('October', '27-28')}${meeting('December', '8-9*')}`;
    expect(parseFomc(html)).toEqual(['2026-10-28', '2026-12-09', '2027-01-27', '2027-05-01']);
    expect(parseFomc('')).toEqual([]);
  });
});
