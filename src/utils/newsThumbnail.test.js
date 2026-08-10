import { describe, it, expect } from 'vitest';
import { newsThumbnail } from './newsThumbnail';

describe('newsThumbnail', () => {
  it('prefers the article\'s own image when GDELT supplied one', () => {
    expect(newsThumbnail({ image: 'https://cdn.example.com/a.jpg', sourceUrl: 'https://www.nytimes.com' }))
      .toBe('https://cdn.example.com/a.jpg');
  });

  it('falls back to the publisher logo for image-less Google News items', () => {
    expect(newsThumbnail({ image: null, source: 'The Guardian', sourceUrl: 'https://www.theguardian.com' }))
      .toBe('https://www.google.com/s2/favicons?domain=theguardian.com&sz=128');
  });

  it('uses a bare-domain source when the feed gave no source url', () => {
    expect(newsThumbnail({ image: null, source: 'cnbc.com', sourceUrl: null }))
      .toBe('https://www.google.com/s2/favicons?domain=cnbc.com&sz=128');
  });

  it('returns null rather than a bogus domain for display-name-only sources', () => {
    expect(newsThumbnail({ image: null, source: 'The Guardian', sourceUrl: null })).toBeNull();
    expect(newsThumbnail({ image: null })).toBeNull();
    expect(newsThumbnail(null)).toBeNull();
  });
});
