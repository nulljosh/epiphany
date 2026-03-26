import { useState, useEffect, useRef, useCallback } from 'react';

export const PEOPLE_RECENT_KEY = 'monica-people-recent';
const SAVED_KEY = 'monica-people-saved';
const CACHE_KEY = 'monica-people-cache';
const MAX_RECENT = 10;
const CACHE_TTL = 1000 * 60 * 30; // 30 min

const SOCIAL_ICONS = {
  linkedin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  twitter: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  github: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
  facebook: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  instagram: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
  youtube: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#fff" d="M9.545 15.568V8.432L15.818 12z"/>
    </svg>
  ),
  reddit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 00.029-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z"/>
    </svg>
  ),
  medium: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
    </svg>
  ),
  tiktok: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
};

const SITE_SUFFIXES = [
  / [-\u2013\u2014|] LinkedIn$/i,
  / [-\u2013\u2014|] Facebook$/i,
  / [-\u2013\u2014|] Instagram$/i,
  / [-\u2013\u2014|] Twitter$/i,
  / [-\u2013\u2014|] X$/i,
  / [-\u2013\u2014|] GitHub$/i,
  / [-\u2013\u2014|] Reddit$/i,
  / [-\u2013\u2014|] YouTube$/i,
  / [-\u2013\u2014|] Medium$/i,
  / [-\u2013\u2014|] TikTok$/i,
  / [-\u2013\u2014|] Wikipedia$/i,
  / [-\u2013\u2014|] Crunchbase$/i,
  / [-\u2013\u2014|] IMDb$/i,
  / [-\u2013\u2014|] Forbes$/i,
  / [-\u2013\u2014|] Bloomberg$/i,
];

function extractProfileName(results, query) {
  if (!results?.results?.length) return query;
  const title = results.results[0].title || '';
  let name = title;
  for (const re of SITE_SUFFIXES) {
    name = name.replace(re, '');
  }
  name = name.replace(/\s*\(.*?\)\s*$/, '').trim();
  if (name.length > 0 && name.length < 80) return name;
  return query;
}

function PersonPlaceholder({ size = 72, bgColor, borderColor }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bgColor || 'rgba(128,128,128,0.15)',
      border: `2px solid ${borderColor || 'rgba(128,128,128,0.3)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 12px', flexShrink: 0,
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0112 0v1" />
      </svg>
    </div>
  );
}

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(PEOPLE_RECENT_KEY) || '[]');
  } catch { return []; }
}

function saveRecent(query) {
  const recent = getRecent().filter(q => q.toLowerCase() !== query.toLowerCase());
  recent.unshift(query);
  localStorage.setItem(PEOPLE_RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function removeRecent(query) {
  const recent = getRecent().filter(q => q !== query);
  localStorage.setItem(PEOPLE_RECENT_KEY, JSON.stringify(recent));
}

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  } catch { return []; }
}

function savePerson(profile) {
  const saved = getSaved().filter(p => p.query.toLowerCase() !== profile.query.toLowerCase());
  saved.unshift({ ...profile, savedAt: Date.now() });
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
}

function removeSaved(query) {
  const saved = getSaved().filter(p => p.query.toLowerCase() !== query.toLowerCase());
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
}

function isPersonSaved(query) {
  return getSaved().some(p => p.query.toLowerCase() === query.toLowerCase());
}

function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch { return {}; }
}

function setCacheEntry(query, data) {
  const cache = getCache();
  cache[query.toLowerCase().trim()] = { data, ts: Date.now() };
  // keep cache from growing unbounded -- 50 entries max
  const keys = Object.keys(cache);
  if (keys.length > 50) {
    const sorted = keys.sort((a, b) => cache[a].ts - cache[b].ts);
    for (let i = 0; i < keys.length - 50; i++) delete cache[sorted[i]];
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function getCacheEntry(query) {
  const cache = getCache();
  const entry = cache[query.toLowerCase().trim()];
  if (!entry) return null;
  return entry;
}

const SUGGESTION_POOL = [
  'Elon Musk', 'Taylor Swift', 'Justin Trudeau',
  'Mark Zuckerberg', 'Beyonce', 'Sam Altman',
  'Tim Cook', 'Rihanna', 'Jensen Huang',
  'LeBron James', 'Drake', 'Satya Nadella',
  'Oprah Winfrey', 'Jeff Bezos', 'Alexandria Ocasio-Cortez',
];

export default function PeoplePanel({ dark, t }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recentSearches, setRecentSearches] = useState(getRecent);
  const [savedProfiles, setSavedProfiles] = useState(getSaved);
  const [fromCache, setFromCache] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIndex(prev => (prev + 1) % SUGGESTION_POOL.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentSuggestions = (0, () => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      out.push(SUGGESTION_POOL[(suggestionIndex + i) % SUGGESTION_POOL.length]);
    }
    return out;
  })();

  const fetchPerson = useCallback(async (query, { background = false } = {}) => {
    if (!query.trim()) return;
    if (!background) {
      setLoading(true);
      setError(null);

      // Check cache -- show instantly if available
      const cached = getCacheEntry(query);
      if (cached) {
        setResults(cached.data);
        setFromCache(true);
        setLoading(false);
      }
    }
    try {
      const res = await fetch(`/api/people?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setCacheEntry(query, data);
      setResults(data);
      setFromCache(false);
      if (!background) {
        saveRecent(query.trim());
        setRecentSearches(getRecent());
      }
    } catch (err) {
      // If we showed cached data, keep it and just clear loading
      if (!fromCache) {
        setError(err.message);
        setResults(null);
      }
    } finally {
      setLoading(false);
    }
  }, [fromCache]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setResults(null);
      setError(null);
      setFromCache(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchPerson(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, fetchPerson]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && search.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      fetchPerson(search);
    } else if (e.key === 'Escape') {
      setSearch('');
      setResults(null);
      setError(null);
      setFromCache(false);
      inputRef.current?.blur();
    }
  }, [search, fetchPerson]);

  const handleBookmark = useCallback(() => {
    if (!results) return;
    const query = results.query;
    if (isPersonSaved(query)) {
      removeSaved(query);
    } else {
      savePerson({
        query,
        primaryImage: results.primaryImage,
        topSnippet: results.results[0]?.snippet || null,
        socialLinks: results.socialLinks || [],
      });
    }
    setSavedProfiles(getSaved());
  }, [results]);

  const profileName = results ? extractProfileName(results, results.query) : '';
  const isSaved = results ? isPersonSaved(results.query) : false;

  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  return (
    <div style={{ padding: 16, fontFamily: font, maxHeight: '100%', overflow: 'auto' }}>
      {/* Search */}
      <input
        ref={inputRef}
        type="text"
        aria-label="Search people"
        placeholder="Search people..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: `1px solid ${t.border}`,
          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          color: t.text, fontSize: 14, fontFamily: font, outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease',
        }}
        onFocus={e => e.target.style.borderColor = t.accent || '#0071e3'}
        onBlur={e => e.target.style.borderColor = t.border}
      />

      {/* Loading */}
      {loading && !results && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: t.textSecondary, fontSize: 13 }}>
          <div style={{
            width: 20, height: 20, border: `2px solid ${t.border}`,
            borderTopColor: t.accent || '#0071e3', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 8px',
          }} />
          Searching...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          ...glass, padding: '12px 14px', marginTop: 12,
          borderColor: 'rgba(255,69,58,0.3)',
          color: '#FF453A', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div style={{ marginTop: 12 }}>
          {/* Profile Card */}
          <div style={{ ...glass, padding: 20, marginBottom: 12, textAlign: 'center', position: 'relative' }}>
            {/* Bookmark button */}
            <button
              onClick={handleBookmark}
              aria-label={isSaved ? 'Remove bookmark' : 'Bookmark profile'}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                color: isSaved ? (t.accent || '#0071e3') : (t.textTertiary || t.textSecondary),
                padding: 4,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
            </button>

            {/* Cached indicator */}
            {fromCache && (
              <div style={{
                position: 'absolute', top: 14, left: 14,
                fontSize: 10, color: t.textTertiary || t.textSecondary,
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                padding: '2px 6px', borderRadius: 4,
                opacity: 0.7,
              }}>
                cached
              </div>
            )}

            {results.primaryImage ? (
              <img
                src={results.primaryImage}
                alt={profileName}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  objectFit: 'cover', margin: '0 auto 12px',
                  display: 'block',
                  border: `2px solid ${t.border}`,
                }}
                onError={e => {
                  // Replace with placeholder on error
                  e.target.style.display = 'none';
                  e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                }}
              />
            ) : null}
            {!results.primaryImage && (
              <PersonPlaceholder size={72} bgColor={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} borderColor={t.border} />
            )}
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 6 }}>
              {profileName}
            </div>
            {results.results[0]?.snippet && (
              <div style={{
                fontSize: 13, color: t.textSecondary, lineHeight: 1.5,
                maxWidth: 400, margin: '0 auto',
              }}>
                {results.results[0].snippet}
              </div>
            )}
          </div>

          {/* Social Links */}
          {results.socialLinks.length > 0 && (
            <div style={{
              ...glass, padding: '10px 14px', marginBottom: 12,
              display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
            }}>
              {results.socialLinks.map(link => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.username ? `@${link.username}` : link.platform}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 8,
                    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: t.textSecondary, textDecoration: 'none',
                    fontSize: 12, fontWeight: 500,
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                  }}
                >
                  {SOCIAL_ICONS[link.platform] || null}
                  <span>{link.username || link.platform}</span>
                </a>
              ))}
            </div>
          )}

          {/* Results List */}
          {results.results.length > 0 && (
            <div style={{ ...glass, padding: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: t.textSecondary,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
              }}>
                Results ({results.resultCount})
              </div>
              {results.results.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block', padding: '10px 0',
                    borderBottom: i < results.results.length - 1 ? `1px solid ${t.border}` : 'none',
                    textDecoration: 'none',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.accent || '#0071e3', marginBottom: 2 }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, color: t.textTertiary || t.textSecondary, marginBottom: 4 }}>
                    {r.displayUrl}
                  </div>
                  <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.4 }}>
                    {r.snippet}
                  </div>
                </a>
              ))}
            </div>
          )}

          {results.results.length === 0 && !loading && (
            <div style={{ ...glass, padding: '20px 14px', textAlign: 'center', color: t.textTertiary || t.textSecondary, fontSize: 13 }}>
              No results found
            </div>
          )}
        </div>
      )}

      {/* Recent Searches + Saved Profiles / Empty State */}
      {!loading && !results && !error && (
        <div style={{ marginTop: 16 }}>
          {/* Saved Profiles */}
          {savedProfiles.length > 0 && (
            <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: t.textSecondary,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
              }}>
                Saved Profiles
              </div>
              {savedProfiles.map((p, i) => (
                <div
                  key={p.query}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: i < savedProfiles.length - 1 ? `1px solid ${t.border}` : 'none',
                  }}
                >
                  {p.primaryImage ? (
                    <img
                      src={p.primaryImage}
                      alt={p.query}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        objectFit: 'cover', flexShrink: 0,
                        border: `1px solid ${t.border}`,
                      }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${t.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21v-1a6 6 0 0112 0v1" />
                      </svg>
                    </div>
                  )}
                  <button
                    onClick={() => { setSearch(p.query); fetchPerson(p.query); }}
                    style={{
                      flex: 1, background: 'none', border: 'none',
                      color: t.text, fontSize: 13, fontFamily: font,
                      cursor: 'pointer', textAlign: 'left', padding: 0,
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                  >
                    <div style={{ fontWeight: 500 }}>{p.query}</div>
                    {p.topSnippet && (
                      <div style={{
                        fontSize: 11, color: t.textTertiary || t.textSecondary,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: 220, marginTop: 2,
                      }}>
                        {p.topSnippet}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      removeSaved(p.query);
                      setSavedProfiles(getSaved());
                    }}
                    aria-label={`Remove saved ${p.query}`}
                    style={{
                      background: 'none', border: 'none',
                      color: t.textTertiary || t.textSecondary,
                      cursor: 'pointer', fontSize: 14, padding: '0 4px',
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {'\u00d7'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 ? (
            <div style={{ ...glass, padding: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: t.textSecondary,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
              }}>
                Recent Searches
              </div>
              {recentSearches.map((q, i) => (
                <div
                  key={q}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 0',
                    borderBottom: i < recentSearches.length - 1 ? `1px solid ${t.border}` : 'none',
                  }}
                >
                  <button
                    onClick={() => { setSearch(q); fetchPerson(q); }}
                    style={{
                      flex: 1, background: 'none', border: 'none',
                      color: t.text, fontSize: 13, fontFamily: font,
                      cursor: 'pointer', textAlign: 'left', padding: 0,
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                  >
                    {q}
                  </button>
                  <button
                    onClick={() => {
                      removeRecent(q);
                      setRecentSearches(getRecent());
                    }}
                    aria-label={`Remove ${q}`}
                    style={{
                      background: 'none', border: 'none',
                      color: t.textTertiary || t.textSecondary,
                      cursor: 'pointer', fontSize: 14, padding: '0 4px',
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {'\u00d7'}
                  </button>
                </div>
              ))}
            </div>
          ) : savedProfiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textTertiary || t.textSecondary }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <path d="M11 8a3 3 0 00-3 3"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Search for anyone</div>
              <div style={{ fontSize: 12, marginBottom: 14 }}>Find profiles, social links, and public info</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', transition: 'opacity 0.3s ease' }}>
                {currentSuggestions.map(name => (
                  <button
                    key={name}
                    onClick={() => { setSearch(name); fetchPerson(name); }}
                    style={{
                      padding: '6px 14px', borderRadius: 100,
                      border: `1px solid ${t.cardBorder || t.border}`,
                      background: t.glass,
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      color: t.text, fontSize: 12, fontWeight: 500,
                      fontFamily: font, cursor: 'pointer',
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.background = t.glass;
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
