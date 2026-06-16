import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../server/api/people.js';

global.fetch = vi.fn();

function makeGoogleResult(title, link, snippet = '') {
  return {
    title,
    snippet,
    link,
    displayLink: new URL(link).hostname,
    pagemap: {},
  };
}

describe('People API', () => {
  let mockReq;
  let mockRes;
  let jsonData;
  let statusCode;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonData = null;
    statusCode = 200;

    mockReq = {
      query: { q: 'Elon Musk' },
      headers: {}
    };

    mockRes = {
      status: vi.fn((code) => { statusCode = code; return mockRes; }),
      json: vi.fn((data) => { jsonData = data; return mockRes; }),
      setHeader: vi.fn()
    };

    // Set env for Google CSE
    process.env.GOOGLE_CSE_KEY = 'test-key';
    process.env.GOOGLE_CSE_ID = 'test-cx';
  });

  it('returns structured results from Google CSE', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        items: [
          makeGoogleResult('Elon Musk - Wikipedia', 'https://en.wikipedia.org/wiki/Elon_Musk', 'CEO of Tesla'),
          makeGoogleResult('Elon Musk (@elonmusk)', 'https://twitter.com/elonmusk', 'Official account'),
        ]
      })
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.query).toBe('Elon Musk');
    expect(jsonData.results.length).toBe(2);
    expect(jsonData.results[0].title).toBe('Elon Musk - Wikipedia');
    expect(jsonData.resultCount).toBe(2);
  });

  it('detects social links from results', async () => {
    mockReq.query = { q: 'Social Test Person' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        items: [
          makeGoogleResult('Twitter', 'https://twitter.com/elonmusk'),
          makeGoogleResult('LinkedIn', 'https://www.linkedin.com/in/elonmusk'),
          makeGoogleResult('GitHub', 'https://github.com/elonmusk'),
        ]
      })
    });

    await handler(mockReq, mockRes);

    expect(jsonData.socialLinks.length).toBe(3);
    const platforms = jsonData.socialLinks.map(l => l.platform);
    expect(platforms).toContain('twitter');
    expect(platforms).toContain('linkedin');
    expect(platforms).toContain('github');
  });

  it('extracts usernames from social URLs', async () => {
    mockReq.query = { q: 'Username Test Person' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        items: [
          makeGoogleResult('Twitter', 'https://twitter.com/elonmusk'),
          makeGoogleResult('LinkedIn', 'https://www.linkedin.com/in/satyanadella'),
        ]
      })
    });

    await handler(mockReq, mockRes);

    const twitter = jsonData.socialLinks.find(l => l.platform === 'twitter');
    expect(twitter.username).toBe('elonmusk');
    const linkedin = jsonData.socialLinks.find(l => l.platform === 'linkedin');
    expect(linkedin.username).toBe('satyanadella');
  });

  it('returns 400 for missing query', async () => {
    mockReq.query = {};

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(400);
  });

  it('falls back to DuckDuckGo when Google fails', async () => {
    mockReq.query = { q: 'DuckDuckGo Fallback Person' };
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });
    // DuckDuckGo fallback
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        Heading: 'Elon Musk',
        Abstract: 'CEO of Tesla and SpaceX',
        AbstractURL: 'https://en.wikipedia.org/wiki/Elon_Musk',
        AbstractSource: 'Wikipedia',
        RelatedTopics: [],
      })
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.results.length).toBeGreaterThan(0);
  });

  it('handles empty results gracefully', async () => {
    mockReq.query = { q: 'Empty Results Nobody' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [] })
    });

    await handler(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(jsonData.results).toEqual([]);
    expect(jsonData.socialLinks).toEqual([]);
  });

  it('deduplicates social platforms', async () => {
    mockReq.query = { q: 'Dedup Test Person' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        items: [
          makeGoogleResult('X profile', 'https://x.com/elonmusk'),
          makeGoogleResult('Twitter', 'https://twitter.com/elonmusk'),
        ]
      })
    });

    await handler(mockReq, mockRes);

    // x.com and twitter.com both map to "twitter" -- should only appear once
    const twitterLinks = jsonData.socialLinks.filter(l => l.platform === 'twitter');
    expect(twitterLinks.length).toBe(1);
  });

  it('finds primary image from pagemap', async () => {
    mockReq.query = { q: 'Image Test Person' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        items: [{
          title: 'Test',
          snippet: 'Test snippet',
          link: 'https://example.com',
          displayLink: 'example.com',
          pagemap: {
            cse_image: [{ src: 'https://example.com/photo.jpg' }]
          }
        }]
      })
    });

    await handler(mockReq, mockRes);

    expect(jsonData.primaryImage).toBe('https://example.com/photo.jpg');
  });
});
