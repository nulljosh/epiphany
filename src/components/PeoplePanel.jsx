import { useState, useEffect, useRef, useCallback } from 'react';
import { usePeopleIndex } from '../hooks/usePeopleIndex';
import { personToOntology } from '../lib/ontology';
import { useOntology } from '../hooks/useOntology';

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

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// --- Index Sub-Components ---

function TagInput({ tags, onChange, dark, t }) {
  const [input, setInput] = useState('');
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  const addTag = () => {
    const tag = input.trim();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput('');
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length > 0 ? 6 : 0 }}>
        {tags.map(tag => (
          <span
            key={tag}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 100,
              background: dark ? 'rgba(10,132,255,0.15)' : 'rgba(10,132,255,0.1)',
              color: t.accent || '#0a84ff', fontSize: 11, fontWeight: 500,
            }}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter(x => x !== tag))}
              style={{
                background: 'none', border: 'none', color: 'inherit',
                cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1,
              }}
            >
              {'\u00d7'}
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          placeholder="Add tag..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
          }}
          style={{
            flex: 1, padding: '4px 8px', borderRadius: 6,
            border: `1px solid ${t.border}`,
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: t.text, fontSize: 12, fontFamily: font, outline: 'none',
          }}
        />
        <button
          onClick={addTag}
          disabled={!input.trim()}
          style={{
            padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${t.border}`,
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            color: t.textSecondary, fontSize: 12, cursor: 'pointer',
            fontFamily: font, opacity: input.trim() ? 1 : 0.4,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// --- Timeline Component ---

function PersonTimeline({ person, mentions, dark, t }) {
  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  const events = [];

  // Indexed event
  if (person.createdAt) {
    events.push({ type: 'indexed', date: person.createdAt, label: 'Indexed' });
  }

  // Enrichment event
  if (person.enrichment?.enrichedAt) {
    events.push({ type: 'enriched', date: person.enrichment.enrichedAt, label: 'AI Enrichment completed' });
  }

  // Last updated (if different from created)
  if (person.updatedAt && person.updatedAt !== person.createdAt) {
    events.push({ type: 'updated', date: person.updatedAt, label: 'Record updated' });
  }

  // News mentions
  if (mentions?.length) {
    for (const m of mentions.slice(0, 5)) {
      if (m.publishedAt) {
        events.push({ type: 'mention', date: m.publishedAt, label: m.title, url: m.url, source: m.source });
      }
    }
  }

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (events.length === 0) return null;

  const typeColors = {
    indexed: t.green || '#30D158',
    enriched: t.accent || '#0a84ff',
    updated: t.textSecondary,
    mention: '#FF9500',
  };

  return (
    <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: t.textSecondary,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
      }}>
        Timeline
      </div>
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 5, top: 4, bottom: 4, width: 1,
          background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }} />
        {events.map((ev, i) => (
          <div key={i} style={{ position: 'relative', paddingBottom: i < events.length - 1 ? 12 : 0 }}>
            {/* Dot */}
            <div style={{
              position: 'absolute', left: -18, top: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: typeColors[ev.type] || t.textSecondary,
              border: `2px solid ${dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'}`,
            }} />
            <div style={{ fontSize: 10, color: t.textTertiary || t.textSecondary, marginBottom: 2 }}>
              {formatTimestamp(ev.date)}
            </div>
            {ev.url ? (
              <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 12, color: t.accent || '#0a84ff', textDecoration: 'none',
                lineHeight: 1.4, display: 'block',
              }}>
                {ev.label}
                {ev.source && <span style={{ color: t.textTertiary, fontSize: 10 }}> - {ev.source}</span>}
              </a>
            ) : (
              <div style={{ fontSize: 12, color: t.text, lineHeight: 1.4 }}>
                {ev.label}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Mentions Component ---

function PersonMentions({ mentions, loading, dark, t }) {
  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  if (loading) {
    return (
      <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: t.textSecondary,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
        }}>
          Recent Mentions
        </div>
        <div style={{ textAlign: 'center', padding: '8px 0', color: t.textSecondary, fontSize: 12 }}>
          Scanning news...
        </div>
      </div>
    );
  }

  if (!mentions || mentions.length === 0) return null;

  return (
    <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: t.textSecondary,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        Recent Mentions ({mentions.length})
      </div>
      {mentions.slice(0, 8).map((m, i) => (
        <a
          key={i}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', gap: 10, padding: '8px 0', textDecoration: 'none',
            borderBottom: i < Math.min(mentions.length, 8) - 1 ? `1px solid ${t.border}` : 'none',
            alignItems: 'flex-start',
          }}
        >
          {m.image && (
            <img src={m.image} alt="" style={{
              width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
              border: `1px solid ${t.border}`,
            }} onError={e => { e.target.style.display = 'none'; }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500, color: t.accent || '#0a84ff',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {m.title}
            </div>
            <div style={{ fontSize: 11, color: t.textTertiary || t.textSecondary, marginTop: 2 }}>
              {m.source}{m.publishedAt ? ` - ${formatTimestamp(m.publishedAt)}` : ''}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// --- Enrichment Display ---

function EnrichmentCard({ enrichment, dark, t }) {
  if (!enrichment) return null;

  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: t.textSecondary,
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
  };

  return (
    <>
      {/* Intel Summary */}
      <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
        <div style={labelStyle}>Intelligence</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {enrichment.role && (
            <div style={{ fontSize: 13, color: t.text }}>
              <span style={{ color: t.textSecondary }}>Role:</span> {enrichment.role}
            </div>
          )}
          {enrichment.company && (
            <div style={{ fontSize: 13, color: t.text }}>
              <span style={{ color: t.textSecondary }}>Org:</span> {enrichment.company}
            </div>
          )}
          {enrichment.location && (
            <div style={{ fontSize: 13, color: t.text }}>
              <span style={{ color: t.textSecondary }}>Location:</span> {enrichment.location}
            </div>
          )}
          {enrichment.sentiment && (
            <div style={{ fontSize: 12, color: t.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
              "{enrichment.sentiment}"
            </div>
          )}
        </div>
      </div>

      {/* Key Facts */}
      {enrichment.keyFacts?.length > 0 && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={labelStyle}>Key Facts</div>
          {enrichment.keyFacts.map((fact, i) => (
            <div key={i} style={{
              fontSize: 13, color: t.text, padding: '4px 0 4px 12px',
              borderLeft: `2px solid ${t.accent || '#0a84ff'}`,
              marginBottom: i < enrichment.keyFacts.length - 1 ? 6 : 0,
              lineHeight: 1.4,
            }}>
              {fact}
            </div>
          ))}
        </div>
      )}

      {/* Associates */}
      {enrichment.associates?.length > 0 && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={labelStyle}>Known Associates</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {enrichment.associates.map((name, i) => (
              <span key={i} style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 100,
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: t.text, border: `1px solid ${t.border}`,
              }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Industry Tags */}
      {enrichment.industryTags?.length > 0 && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={labelStyle}>Industry / Domain</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {enrichment.industryTags.map((tag, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 100,
                background: dark ? 'rgba(48,209,88,0.12)' : 'rgba(48,209,88,0.08)',
                color: t.green || '#30D158', fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// --- Force-Directed Graph ---

function RelationshipGraph({ people, ontology, dark, t, onSelectPerson }) {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const animRef = useRef(null);
  const dragRef = useRef(null);
  const imagesRef = useRef({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (people.length === 0) return;

    const nodes = people.map((p, i) => {
      const angle = (2 * Math.PI * i) / people.length;
      const radius = Math.min(150, people.length * 20);
      return {
        id: p.id,
        name: p.name,
        image: p.image,
        x: 200 + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: 200 + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
        enrichment: p.enrichment,
      };
    });
    nodesRef.current = nodes;

    // Load person images
    for (const node of nodes) {
      if (node.image && !imagesRef.current[node.id]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { imagesRef.current[node.id] = img; };
        img.src = node.image;
      }
    }

    // Build edges from enrichment associates
    const edges = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const nameMap = new Map(nodes.map(n => [n.name.toLowerCase(), n]));

    for (const node of nodes) {
      if (!node.enrichment?.associates) continue;
      for (const assocName of node.enrichment.associates) {
        const match = nameMap.get(assocName.toLowerCase());
        if (match && match.id !== node.id) {
          const edgeKey = [node.id, match.id].sort().join(':');
          if (!edges.some(e => [e.source, e.target].sort().join(':') === edgeKey)) {
            edges.push({ source: node.id, target: match.id });
          }
        }
      }
    }

    // Also fetch ontology relationships
    (async () => {
      for (const node of nodes) {
        const ontId = `person:${node.name.toLowerCase()}`;
        const rels = await ontology.getRelationships(ontId);
        const allRels = [...(rels.outbound || []), ...(rels.inbound || [])];
        for (const rel of allRels) {
          const otherId = rel.sourceId === ontId ? rel.targetId : rel.sourceId;
          // Find matching node
          const otherNode = nodes.find(n => `person:${n.name.toLowerCase()}` === otherId);
          if (otherNode) {
            const edgeKey = [node.id, otherNode.id].sort().join(':');
            if (!edges.some(e => [e.source, e.target].sort().join(':') === edgeKey)) {
              edges.push({ source: node.id, target: otherNode.id });
            }
          }
        }
      }
      edgesRef.current = edges;
      setLoaded(true);
    })();

    edgesRef.current = edges;
    setLoaded(true);
  }, [people, ontology]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const centerX = W / 2;
    const centerY = H / 2;

    // Reposition nodes to center
    const nodes = nodesRef.current;
    for (const node of nodes) {
      node.x = centerX + (node.x - 200) * (W / 400);
      node.y = centerY + (node.y - 200) * (H / 400);
    }

    function simulate() {
      const edges = edgesRef.current;
      const DAMPING = 0.85;
      const REPULSION = 2000;
      const ATTRACTION = 0.005;
      const SPRING_LENGTH = 120;
      const GRAVITY = 0.02;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const src = nodes.find(n => n.id === edge.source);
        const tgt = nodes.find(n => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - SPRING_LENGTH) * ATTRACTION;
        const fx = (dx / Math.max(dist, 1)) * force;
        const fy = (dy / Math.max(dist, 1)) * force;
        src.vx += fx;
        src.vy += fy;
        tgt.vx -= fx;
        tgt.vy -= fy;
      }

      // Gravity toward center
      for (const node of nodes) {
        node.vx += (centerX - node.x) * GRAVITY;
        node.vy += (centerY - node.y) * GRAVITY;
      }

      // Update positions
      for (const node of nodes) {
        if (dragRef.current?.id === node.id) continue;
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(30, Math.min(W - 30, node.x));
        node.y = Math.max(30, Math.min(H - 30, node.y));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const edges = edgesRef.current;

      // Draw edges
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const src = nodes.find(n => n.id === edge.source);
        const tgt = nodes.find(n => n.id === edge.target);
        if (!src || !tgt) continue;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      }

      // Draw nodes
      const nodeRadius = 22;
      for (const node of nodes) {
        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 3, 0, Math.PI * 2);
        ctx.fillStyle = dark ? 'rgba(10,132,255,0.08)' : 'rgba(10,132,255,0.05)';
        ctx.fill();

        // Circle clip for image
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.clip();

        const img = imagesRef.current[node.id];
        if (img) {
          ctx.drawImage(img, node.x - nodeRadius, node.y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
        } else {
          ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
          ctx.fillRect(node.x - nodeRadius, node.y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
          // Person icon placeholder
          ctx.fillStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.arc(node.x, node.y - 4, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(node.x, node.y + 14, 12, 8, 0, Math.PI, 0);
          ctx.fill();
        }
        ctx.restore();

        // Border
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Name label
        ctx.fillStyle = t.text;
        ctx.font = '500 11px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.name.split(' ')[0], node.x, node.y + nodeRadius + 14);
      }
    }

    function tick() {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(tick);
    }

    tick();

    // Interaction handlers
    function getNodeAt(x, y) {
      for (const node of nodes) {
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < 26 * 26) return node;
      }
      return null;
    }

    function onPointerDown(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const node = getNodeAt(x, y);
      if (node) {
        dragRef.current = { id: node.id, offsetX: x - node.x, offsetY: y - node.y, moved: false };
      }
    }

    function onPointerMove(e) {
      if (!dragRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const node = nodes.find(n => n.id === dragRef.current.id);
      if (node) {
        node.x = x - dragRef.current.offsetX;
        node.y = y - dragRef.current.offsetY;
        node.vx = 0;
        node.vy = 0;
        dragRef.current.moved = true;
      }
    }

    function onPointerUp(e) {
      if (dragRef.current && !dragRef.current.moved) {
        onSelectPerson(dragRef.current.id);
      }
      dragRef.current = null;
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [loaded, dark, t, onSelectPerson]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%', height: 360, borderRadius: 12,
        background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        border: `1px solid ${t.cardBorder || t.border}`,
        cursor: 'grab', touchAction: 'none',
      }}
    />
  );
}

// --- Person Detail ---

function PersonDetail({ person, onUpdate, onDelete, onClose, dark, t, peopleIndex }) {
  const [notes, setNotes] = useState(person.notes || '');
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);
  const [mentions, setMentions] = useState(null);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const notesTimer = useRef(null);

  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  // Fetch mentions on mount
  useEffect(() => {
    setMentionsLoading(true);
    peopleIndex.crossref(person.id).then(data => {
      setMentions(data?.mentions || []);
    }).finally(() => setMentionsLoading(false));
  }, [person.id, peopleIndex]);

  const handleNotesChange = (val) => {
    setNotes(val);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      onUpdate({ ...person, notes: val });
    }, 800);
  };

  const handleTagsChange = (tags) => {
    onUpdate({ ...person, tags });
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichError(null);
    const result = await peopleIndex.enrich(person.id);
    if (!result.ok) {
      setEnrichError(result.error);
    }
    setEnriching(false);
  };

  return (
    <div style={{ padding: 0 }}>
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', color: t.accent || '#0a84ff',
          cursor: 'pointer', fontSize: 13, fontFamily: font, padding: '0 0 12px',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>

      <div style={{ ...glass, padding: 20, marginBottom: 12, textAlign: 'center' }}>
        {person.image ? (
          <img
            src={person.image}
            alt={person.name}
            style={{
              width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
              margin: '0 auto 12px', display: 'block',
              border: `2px solid ${t.border}`,
            }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <PersonPlaceholder size={80} bgColor={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} borderColor={t.border} />
        )}
        <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 4 }}>
          {person.name}
        </div>
        {person.enrichment?.role && (
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 2 }}>
            {person.enrichment.role}{person.enrichment.company ? ` at ${person.enrichment.company}` : ''}
          </div>
        )}
        {person.enrichment?.location && (
          <div style={{ fontSize: 12, color: t.textTertiary || t.textSecondary }}>
            {person.enrichment.location}
          </div>
        )}
        {!person.enrichment?.role && person.bio && (
          <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, maxWidth: 400, margin: '0 auto' }}>
            {person.bio}
          </div>
        )}

        {/* Enrich button */}
        {!person.enrichment && person.searchData?.results?.length > 0 && (
          <button
            onClick={handleEnrich}
            disabled={enriching}
            style={{
              marginTop: 10, padding: '6px 16px', borderRadius: 100,
              border: `1px solid ${t.accent || '#0a84ff'}`,
              background: `${t.accent || '#0a84ff'}15`,
              color: t.accent || '#0a84ff',
              fontSize: 12, fontWeight: 600, fontFamily: font,
              cursor: enriching ? 'default' : 'pointer',
              opacity: enriching ? 0.6 : 1,
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={e => { if (!enriching) e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {enriching ? 'Enriching...' : 'AI Enrich'}
          </button>
        )}
        {enrichError && (
          <div style={{ fontSize: 11, color: '#FF453A', marginTop: 6 }}>{enrichError}</div>
        )}
      </div>

      {/* Social Links */}
      {person.socials?.length > 0 && (
        <div style={{
          ...glass, padding: '10px 14px', marginBottom: 12,
          display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
        }}>
          {person.socials.map((link, i) => (
            <a
              key={link.platform || i}
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
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {SOCIAL_ICONS[link.platform] || null}
              <span>{link.username || link.platform}</span>
            </a>
          ))}
        </div>
      )}

      {/* Enrichment Data */}
      <EnrichmentCard enrichment={person.enrichment} dark={dark} t={t} />

      {/* Tags */}
      <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: t.textSecondary,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
        }}>
          Tags
        </div>
        <TagInput tags={person.tags || []} onChange={handleTagsChange} dark={dark} t={t} />
      </div>

      {/* Notes */}
      <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: t.textSecondary,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
        }}>
          Notes
        </div>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Add notes about this person..."
          rows={4}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: t.text, fontSize: 13, fontFamily: font, outline: 'none',
            resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
          }}
        />
      </div>

      {/* Mentions */}
      <PersonMentions mentions={mentions} loading={mentionsLoading} dark={dark} t={t} />

      {/* Timeline */}
      <PersonTimeline person={person} mentions={mentions} dark={dark} t={t} />

      {/* Relationships */}
      {person.relationships?.length > 0 && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: t.textSecondary,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
          }}>
            Relationships
          </div>
          {person.relationships.map((rel, i) => (
            <div key={i} style={{
              fontSize: 13, color: t.text, padding: '4px 0',
              borderBottom: i < person.relationships.length - 1 ? `1px solid ${t.border}` : 'none',
            }}>
              <span style={{ color: t.textSecondary }}>{rel.type}:</span> {rel.name}
            </div>
          ))}
        </div>
      )}

      {/* Search Data */}
      {person.searchData?.results?.length > 0 && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: t.textSecondary,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
          }}>
            Search Results ({person.searchData.resultCount})
          </div>
          {person.searchData.results.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', padding: '8px 0',
                borderBottom: i < person.searchData.results.length - 1 ? `1px solid ${t.border}` : 'none',
                textDecoration: 'none',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: t.accent || '#0a84ff', marginBottom: 2 }}>
                {r.title}
              </div>
              <div style={{ fontSize: 11, color: t.textTertiary || t.textSecondary }}>
                {r.displayUrl}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => { onDelete(person.id); onClose(); }}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: `1px solid rgba(255,69,58,0.3)`,
          background: 'rgba(255,69,58,0.08)',
          color: '#FF453A', fontSize: 13, fontWeight: 500,
          fontFamily: font, cursor: 'pointer',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        Remove from Index
      </button>
    </div>
  );
}

function ImportModal({ dark, t, glass, font, onImport, onClose }) {
  const [mode, setMode] = useState('json'); // 'json' | 'vcf'
  const [jsonText, setJsonText] = useState('');
  const [vcfText, setVcfText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setVcfText(reader.result);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);

    let payload;
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(jsonText);
        payload = Array.isArray(parsed) ? parsed : { contacts: parsed.contacts || [parsed] };
        if (Array.isArray(payload)) payload = payload;
      } catch {
        setError('Invalid JSON. Expected an array of contacts.');
        setImporting(false);
        return;
      }
    } else {
      if (!vcfText.trim()) {
        setError('No vCard data provided.');
        setImporting(false);
        return;
      }
      payload = { vcf: vcfText };
    }

    const res = await onImport(payload);
    setImporting(false);
    if (res.ok) {
      setResult(res);
    } else {
      setError(res.error || 'Import failed');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }} onClick={onClose}>
      <div style={{
        ...glass, padding: 20, width: '100%', maxWidth: 440,
        maxHeight: '80vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: font }}>Import Contacts</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: t.textSecondary,
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 14, borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${t.border}`,
          background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        }}>
          {[['json', 'Paste JSON'], ['vcf', 'Upload .vcf']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                flex: 1, padding: '7px 0', border: 'none',
                background: mode === key ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                color: mode === key ? t.text : t.textSecondary,
                fontSize: 12, fontWeight: mode === key ? 600 : 400,
                fontFamily: font, cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'json' && (
          <>
            <textarea
              placeholder={'[\n  { "name": "Jane Doe", "email": "jane@example.com", "tags": ["work"] },\n  { "name": "John Smith", "phone": "+1234567890" }\n]'}
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              style={{
                width: '100%', height: 160, padding: 12, borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: t.text, fontSize: 12, fontFamily: 'SF Mono, Menlo, monospace',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </>
        )}

        {mode === 'vcf' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".vcf,text/vcard"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '14px 12px', borderRadius: 8,
                border: `2px dashed ${t.border}`, background: 'transparent',
                color: t.textSecondary, fontSize: 13, fontFamily: font,
                cursor: 'pointer', marginBottom: 8,
                transition: 'border-color 0.2s ease',
              }}
            >
              {vcfText ? 'File loaded -- click to replace' : 'Choose .vcf file'}
            </button>
            {vcfText && (
              <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 8 }}>
                {vcfText.split('BEGIN:VCARD').length - 1} contact(s) detected
              </div>
            )}
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 8 }}>
              Or paste vCard text:
            </div>
            <textarea
              placeholder="BEGIN:VCARD&#10;VERSION:3.0&#10;FN:Jane Doe&#10;..."
              value={vcfText}
              onChange={e => setVcfText(e.target.value)}
              style={{
                width: '100%', height: 120, padding: 12, borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: t.text, fontSize: 12, fontFamily: 'SF Mono, Menlo, monospace',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </>
        )}

        {error && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,59,48,0.1)', color: '#ff3b30',
            fontSize: 12, fontFamily: font,
          }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(48,209,88,0.1)', color: '#30d158',
            fontSize: 12, fontFamily: font,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Import complete</div>
            <div>{result.imported} imported, {result.merged} merged, {result.skipped} skipped</div>
          </div>
        )}

        <button
          onClick={result ? onClose : handleImport}
          disabled={importing || (!jsonText.trim() && !vcfText.trim())}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
            background: importing ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
              : (t.accent || '#0a84ff'),
            color: importing ? t.textSecondary : '#fff',
            fontSize: 13, fontWeight: 600, fontFamily: font,
            cursor: importing ? 'wait' : 'pointer',
            marginTop: 14, opacity: (!jsonText.trim() && !vcfText.trim()) ? 0.4 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {importing ? 'Importing...' : result ? 'Done' : 'Import'}
        </button>
      </div>
    </div>
  );
}

function IndexView({ dark, t, peopleIndex, ontology, glass, font }) {
  const { people, loading, upsert, remove, importContacts } = peopleIndex;
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'graph'
  const [showImport, setShowImport] = useState(false);

  const filtered = filter
    ? people.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
      )
    : people;

  if (selected) {
    const person = people.find(p => p.id === selected);
    if (person) {
      return (
        <PersonDetail
          person={person}
          onUpdate={upsert}
          onDelete={remove}
          onClose={() => setSelected(null)}
          dark={dark}
          t={t}
          peopleIndex={peopleIndex}
        />
      );
    }
  }

  return (
    <>
      {showImport && (
        <ImportModal
          dark={dark} t={t} glass={glass} font={font}
          onImport={importContacts}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* View toggle + filter + import */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setShowImport(true)}
          title="Import Contacts"
          style={{
            padding: '6px 10px', border: `1px solid ${t.border}`, borderRadius: 8,
            background: 'transparent', color: t.textSecondary, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
            fontFamily: font, fontWeight: 500, whiteSpace: 'nowrap',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Import
        </button>
        {people.length > 3 && (
          <input
            type="text"
            placeholder="Filter by name or tag..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              color: t.text, fontSize: 13, fontFamily: font, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        )}
        {people.length > 1 && (
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'hidden',
            border: `1px solid ${t.border}`,
          }}>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              style={{
                padding: '6px 10px', border: 'none', cursor: 'pointer',
                background: viewMode === 'grid' ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                color: viewMode === 'grid' ? t.text : t.textSecondary,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('graph')}
              title="Graph view"
              style={{
                padding: '6px 10px', border: 'none', cursor: 'pointer',
                background: viewMode === 'graph' ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                color: viewMode === 'graph' ? t.text : t.textSecondary,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/>
                <circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/>
                <line x1="8.5" y1="7.5" x2="15.5" y2="16.5"/><line x1="15.5" y1="7.5" x2="8.5" y2="16.5"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {loading && people.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: t.textSecondary, fontSize: 13 }}>
          <div style={{
            width: 20, height: 20, border: `2px solid ${t.border}`,
            borderTopColor: t.accent || '#0a84ff', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 8px',
          }} />
          Loading index...
        </div>
      )}

      {!loading && people.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textTertiary || t.textSecondary }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 8 }}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No indexed people</div>
          <div style={{ fontSize: 12 }}>Search for someone and tap "Index" to save them here</div>
        </div>
      )}

      {/* Graph View */}
      {viewMode === 'graph' && people.length > 0 && (
        <RelationshipGraph
          people={people}
          ontology={ontology}
          dark={dark}
          t={t}
          onSelectPerson={setSelected}
        />
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 8,
        }}>
          {filtered.map(person => (
            <button
              key={person.id}
              onClick={() => setSelected(person.id)}
              style={{
                ...glass, padding: 14, textAlign: 'center',
                cursor: 'pointer', border: `1px solid ${t.cardBorder || t.border}`,
                background: t.glass, fontFamily: font,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {person.image ? (
                <img
                  src={person.image}
                  alt={person.name}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
                    margin: '0 auto 8px', display: 'block',
                    border: `1px solid ${t.border}`,
                  }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <PersonPlaceholder size={48} bgColor={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} borderColor={t.border} />
              )}
              <div style={{
                fontSize: 13, fontWeight: 600, color: t.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {person.name}
              </div>
              {person.enrichment?.role && (
                <div style={{
                  fontSize: 10, color: t.textTertiary || t.textSecondary, marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {person.enrichment.role}
                </div>
              )}
              {person.tags?.length > 0 && (
                <div style={{
                  marginTop: 4, display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap',
                }}>
                  {person.tags.slice(0, 2).map(tag => (
                    <span key={tag} style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 100,
                      background: dark ? 'rgba(10,132,255,0.12)' : 'rgba(10,132,255,0.08)',
                      color: t.accent || '#0a84ff',
                    }}>
                      {tag}
                    </span>
                  ))}
                  {person.tags.length > 2 && (
                    <span style={{ fontSize: 9, color: t.textTertiary }}>+{person.tags.length - 2}</span>
                  )}
                </div>
              )}
              {person.enrichment && (
                <div style={{
                  marginTop: 4, fontSize: 9, color: t.green || '#30D158',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>
                  enriched
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {filter && filtered.length === 0 && people.length > 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: t.textTertiary || t.textSecondary, fontSize: 13 }}>
          No matches for "{filter}"
        </div>
      )}
    </>
  );
}


export default function PeoplePanel({ dark, t, isAuthenticated }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recentSearches, setRecentSearches] = useState(getRecent);
  const [savedProfiles, setSavedProfiles] = useState(getSaved);
  const [fromCache, setFromCache] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [indexing, setIndexing] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  const peopleIndex = usePeopleIndex(isAuthenticated);
  const ontology = useOntology(isAuthenticated);

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
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // 12s hard timeout
    const timeout = setTimeout(() => controller.abort(), 12000);
    if (!background) {
      setLoading(true);
      setError(null);

      const cached = getCacheEntry(query);
      if (cached) {
        setResults(cached.data);
        setFromCache(true);
        setLoading(false);
      }
    }
    try {
      const res = await fetch(`/api/people?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      });
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
      if (err.name === 'AbortError' && abortRef.current !== controller) return;
      if (!fromCache) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        setError(isTimeout ? 'Search timed out. Try again.' : (err.message || 'Search failed. Try again.'));
        setResults(null);
      }
    } finally {
      clearTimeout(timeout);
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

  const handleIndex = useCallback(async () => {
    if (!results || !isAuthenticated) return;
    setIndexing(true);
    const profileName = extractProfileName(results, results.query);
    const person = {
      name: profileName,
      image: results.primaryImage || null,
      bio: results.results[0]?.snippet || null,
      tags: [],
      notes: '',
      socials: results.socialLinks || [],
      relationships: [],
      searchData: {
        query: results.query,
        results: results.results,
        resultCount: results.resultCount,
      },
    };
    const saved = await peopleIndex.upsert(person);
    if (saved) {
      // Also push to ontology
      try {
        const ontObj = personToOntology({ ...person, id: saved.id });
        await ontology.upsert(ontObj);
      } catch { /* non-critical */ }

      // Fire enrichment in the background
      peopleIndex.enrich(saved.id).then(result => {
        if (result.ok) {
          // Enrichment data is already updated in the hook state
        }
      });
    }
    setIndexing(false);
  }, [results, isAuthenticated, peopleIndex, ontology]);

  const isIndexed = results
    ? peopleIndex.people.some(p => {
        const name = extractProfileName(results, results.query).toLowerCase();
        return p.name.toLowerCase() === name;
      })
    : false;

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
      {/* --- SEARCH --- */}
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

          {error && (
            <div style={{
              ...glass, padding: '12px 14px', marginTop: 12,
              borderColor: 'rgba(255,69,58,0.3)',
              color: '#FF453A', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>{error}</span>
              <button
                onClick={() => fetchPerson(search)}
                style={{
                  background: 'none', border: `1px solid rgba(255,69,58,0.4)`,
                  color: '#FF453A', fontSize: 12, fontWeight: 600,
                  fontFamily: font, cursor: 'pointer',
                  padding: '4px 12px', borderRadius: 100, flexShrink: 0,
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                Retry
              </button>
            </div>
          )}

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

                {/* Index This Person button */}
                {isAuthenticated && (
                  <button
                    onClick={handleIndex}
                    disabled={indexing || isIndexed}
                    style={{
                      marginTop: 12, padding: '7px 18px', borderRadius: 100,
                      border: `1px solid ${isIndexed ? t.green || '#30D158' : t.accent || '#0a84ff'}`,
                      background: isIndexed
                        ? `${t.green || '#30D158'}15`
                        : `${t.accent || '#0a84ff'}15`,
                      color: isIndexed ? (t.green || '#30D158') : (t.accent || '#0a84ff'),
                      fontSize: 12, fontWeight: 600, fontFamily: font,
                      cursor: isIndexed ? 'default' : 'pointer',
                      opacity: indexing ? 0.6 : 1,
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => { if (!isIndexed) e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {isIndexed ? 'Indexed' : indexing ? 'Indexing...' : 'Index This Person'}
                  </button>
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
      {/* --- INDEX --- */}
      <div style={{ marginTop: 16 }}>
        <IndexView dark={dark} t={t} peopleIndex={peopleIndex} ontology={ontology} glass={glass} font={font} />
      </div>
    </div>
  );
}
