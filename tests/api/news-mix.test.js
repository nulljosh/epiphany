import { describe, it, expect } from 'vitest';
import { dedup } from '../../server/api/news.js';

describe('news dedup', () => {
  it('round-robins sources so one feed cannot fill the top', () => {
    const a = (s, title) => ({ source: s, title, url: `https://${s}/${title.length}` });
    const out = dedup([
      a('cnbc.com', 'Pizza chains are under pressure from weight loss drugs'),
      a('cnbc.com', 'Airlines retire international first class cabins'),
      a('cnbc.com', 'Robot startup cuts employee health benefits'),
      a('marketwatch.com', 'Treasury yields climb ahead of the jobs report'),
    ]);
    expect(out.map(x => x.source)).toEqual(['cnbc.com', 'marketwatch.com', 'cnbc.com', 'cnbc.com']);
  });
});
