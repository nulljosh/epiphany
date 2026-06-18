import { useEffect } from 'react';
import './landing.css';

// Landing Page v2 — ported from the Claude Design handoff prototype
// (epiphany-handoff.zip → Landing Page v2.html + screens.css). Demo data in
// the phone mockups and ticker is intentionally static, same as the prototype.

const TICKER_DATA = [
  { sym: 'AAPL', price: '213.18',  chg: '+1.24%', up: true },
  { sym: 'NVDA', price: '875.40',  chg: '+3.12%', up: true },
  { sym: 'BTC',  price: '93,200',  chg: '+2.41%', up: true },
  { sym: 'TSLA', price: '247.10',  chg: '−2.13%', up: false },
  { sym: 'SPX',  price: '5,842',   chg: '+0.62%', up: true },
  { sym: 'ETH',  price: '4,310',   chg: '+1.87%', up: true },
  { sym: 'GOLD', price: '2,340',   chg: '+0.31%', up: true },
  { sym: 'VIX',  price: '14.2',    chg: '−4.05%', up: false },
];

const MKT_ROWS = [
  { sym: 'AAPL', name: 'Apple Inc.',   price: '$213.18', chg: '+1.24%', up: true,  pts: '0,22 8,18 16,20 24,13 32,15 40,9 48,7 54,5' },
  { sym: 'NVDA', name: 'NVIDIA Corp.', price: '$875.40', chg: '+3.12%', up: true,  pts: '0,24 8,20 16,16 24,11 32,7 40,5 48,3 54,1' },
  { sym: 'BTC',  name: 'Bitcoin',      price: '$93,200', chg: '+2.41%', up: true,  pts: '0,16 8,10 16,13 24,8 32,11 40,7 48,9 54,5' },
  { sym: 'TSLA', name: 'Tesla Inc.',   price: '$247.10', chg: '−2.13%', up: false, pts: '0,5 8,9 16,7 24,13 32,15 40,21 48,19 54,25' },
  { sym: 'GOLD', name: 'Gold Spot',    price: '$2,340',  chg: '+0.31%', up: true,  pts: '0,20 8,18 16,15 24,13 32,14 40,11 48,10 54,8' },
];

const PPL_NEWS = [
  { title: 'OpenAI raises $40B at $300B valuation in largest startup funding round', meta: 'Reuters · 2h ago' },
  { title: 'Altman on AGI timeline: "We\'re closer than most people think"', meta: 'Bloomberg · 1d ago' },
  { title: 'GPT-5 launch: "The biggest model we\'ve ever shipped"', meta: 'The Verge · 3d ago' },
];

const SignalIcon = () => (
  <svg width="16" height="11" viewBox="0 0 16 11" fill="white"><rect x="0" y="3.5" width="2.5" height="7.5" rx="0.6" opacity="0.3" /><rect x="4" y="2" width="2.5" height="9" rx="0.6" opacity="0.55" /><rect x="8" y="0.5" width="2.5" height="10.5" rx="0.6" opacity="0.8" /><rect x="12" y="0" width="2.5" height="11" rx="0.6" /></svg>
);
const WifiIcon = () => (
  <svg width="15" height="11" viewBox="0 0 15 11" fill="white"><path d="M7.5 2C5.2 2 3.1 3 1.6 4.7L0 3C1.9 1.1 4.6 0 7.5 0s5.6 1.1 7.5 3L13.4 4.7C11.9 3 9.8 2 7.5 2z" opacity="0.3" /><path d="M7.5 5c-1.4 0-2.6.6-3.5 1.5L2.4 5C3.8 3.7 5.5 3 7.5 3s3.7.7 5.1 2l-1.6 1.5C10.1 5.6 8.9 5 7.5 5z" opacity="0.65" /><path d="M7.5 8c-.7 0-1.3.3-1.8.7L4 7c1-.9 2.2-1.4 3.5-1.4S11 6.1 12 7l-1.7 1.7C9.8 8.3 9.2 8 7.5 8z" /><circle cx="7.5" cy="10.5" r="1.3" /></svg>
);
const BatteryIcon = () => (
  <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="white" strokeOpacity="0.3" /><rect x="2" y="2" width="17" height="8" rx="2" fill="white" /><path d="M23.5 4v4a2 2 0 000-4z" fill="white" opacity="0.4" /></svg>
);

function Phone({ wifi = false, children }) {
  return (
    <div className="iphone-wrap">
      <div className="iphone">
        <div className="di" />
        <div className="sb">
          <span>9:41</span>
          <div className="sb-icons">
            <SignalIcon />
            {wifi && <WifiIcon />}
            <BatteryIcon />
          </div>
        </div>
        <div className="iphone-screen">{children}</div>
        <div className="hi" />
      </div>
    </div>
  );
}

function TabBar({ active }) {
  const items = [
    { key: 'situation', icon: '🗺', label: 'Situation' },
    { key: 'markets', icon: '📈', label: 'Markets' },
    { key: 'people', icon: '👤', label: 'People' },
    active === 'ai'
      ? { key: 'ai', icon: '✦', label: 'AI', plain: true }
      : { key: 'settings', icon: '⚙️', label: 'Settings' },
  ];
  return (
    <div className="tab-bar">
      {items.map(({ key, icon, label, plain }) => (
        <div key={key} className={`tab-item${key === active ? ' on' : ''}`}>
          {plain
            ? <div style={{ fontSize: 18, lineHeight: 1 }}>{icon}</div>
            : <div className="tab-icon" style={key === active ? undefined : { opacity: 0.35 }}>{icon}</div>}
          <div>{label}</div>
        </div>
      ))}
    </div>
  );
}

function MapScreen() {
  return (
    <>
      <div className="map-screen">
        <svg viewBox="0 0 310 680" xmlns="http://www.w3.org/2000/svg">
          <rect width="310" height="680" fill="#060a10" />
          {/* Road grid with blue tint */}
          <line x1="0" y1="300" x2="310" y2="300" stroke="#0d1e36" strokeWidth="12" />
          <line x1="0" y1="385" x2="310" y2="385" stroke="#0d1e36" strokeWidth="6" />
          <line x1="0" y1="465" x2="310" y2="465" stroke="#0d1e36" strokeWidth="5" />
          <line x1="0" y1="205" x2="310" y2="205" stroke="#0d1e36" strokeWidth="5" />
          <line x1="0" y1="125" x2="310" y2="125" stroke="#0d1e36" strokeWidth="4" />
          <line x1="78" y1="0" x2="78" y2="680" stroke="#0d1e36" strokeWidth="5" />
          <line x1="155" y1="0" x2="155" y2="680" stroke="#0d1e36" strokeWidth="10" />
          <line x1="232" y1="0" x2="232" y2="680" stroke="#0d1e36" strokeWidth="5" />
          <line x1="0" y1="550" x2="210" y2="155" stroke="#0b1c32" strokeWidth="7" />
          {/* City blocks */}
          <rect x="8" y="135" width="60" height="56" rx="4" fill="#0a1520" opacity="0.95" />
          <rect x="8" y="203" width="60" height="88" rx="4" fill="#0a1520" opacity="0.95" />
          <rect x="86" y="135" width="56" height="56" rx="4" fill="#0a1520" opacity="0.9" />
          <rect x="242" y="135" width="58" height="56" rx="4" fill="#0a1520" opacity="0.9" />
          <rect x="242" y="310" width="58" height="64" rx="4" fill="#0a1520" opacity="0.9" />
          <rect x="242" y="400" width="58" height="54" rx="4" fill="#0a1520" opacity="0.9" />
          <rect x="86" y="475" width="136" height="74" rx="4" fill="#0a1520" opacity="0.85" />
          {/* Water */}
          <ellipse cx="268" cy="178" rx="42" ry="28" fill="#030c18" opacity="0.95" />
          <ellipse cx="42" cy="445" rx="30" ry="20" fill="#030c18" opacity="0.9" />
          {/* Road highlights */}
          <line x1="0" y1="300" x2="310" y2="300" stroke="#122040" strokeWidth="2" opacity="0.6" />
          <line x1="155" y1="0" x2="155" y2="680" stroke="#122040" strokeWidth="2" opacity="0.5" />
          {/* User location */}
          <circle cx="155" cy="322" r="30" fill="#0071e3" opacity="0.08" />
          <circle cx="155" cy="322" r="19" fill="#0071e3" opacity="0.13" />
          <circle cx="155" cy="322" r="9" fill="#0071e3" opacity="0.9" />
          <circle cx="155" cy="322" r="4.5" fill="#fff" />
          <circle cx="155" cy="322" r="40" fill="none" stroke="#0071e3" strokeWidth="0.8" opacity="0.2" />
          {/* Flights */}
          <text x="62" y="182" fontSize="14" fill="#4FC3F7" opacity="0.85" transform="rotate(42,62,182)">✈</text>
          <text x="236" y="112" fontSize="12" fill="#4FC3F7" opacity="0.7" transform="rotate(128,236,112)">✈</text>
          <text x="188" y="498" fontSize="11" fill="#4FC3F7" opacity="0.6" transform="rotate(215,188,498)">✈</text>
          {/* Events */}
          <circle cx="104" cy="212" r="6" fill="#30D158" opacity="0.9" />
          <circle cx="218" cy="268" r="5" fill="#30D158" opacity="0.8" />
          <circle cx="54" cy="412" r="5" fill="#30D158" opacity="0.75" />
          {/* Incidents */}
          <polygon points="207,102 217,120 197,120" fill="#FF9F0A" opacity="0.85" />
          <text x="207" y="115" fontSize="7" fill="#fff" textAnchor="middle" fontWeight="800">!</text>
          <polygon points="258,316 267,332 249,332" fill="#FF9F0A" opacity="0.7" />
          {/* Crime */}
          <circle cx="120" cy="366" r="4" fill="#FF453A" opacity="0.7" />
          <circle cx="190" cy="185" r="3.5" fill="#FF453A" opacity="0.6" />
          {/* Labels */}
          <text x="62" y="200" fontSize="7" fill="rgba(255,255,255,0.38)" textAnchor="middle">DAL 442</text>
          <text x="104" y="200" fontSize="7" fill="rgba(255,255,255,0.38)" textAnchor="middle">Stadium</text>
        </svg>
      </div>

      <div className="map-top-bar" style={{ paddingTop: 56 }}>
        <div className="map-tab on">Situation</div>
        <div className="map-tab">Markets</div>
        <div className="map-tab">People</div>
      </div>

      <div className="map-layers" style={{ top: 106 }}>
        <div className="layer-chip" style={{ color: '#4FC3F7', borderColor: 'rgba(79,195,247,0.2)' }}>✈ Flights</div>
        <div className="layer-chip" style={{ color: '#30D158', borderColor: 'rgba(48,209,88,0.2)' }}>◉ Events</div>
        <div className="layer-chip" style={{ color: '#FF9F0A', borderColor: 'rgba(255,159,10,0.2)' }}>⚠ Incidents</div>
        <div className="layer-chip" style={{ color: '#FF453A', borderColor: 'rgba(255,69,58,0.2)' }}>◆ Crime</div>
      </div>

      <div style={{ position: 'absolute', top: 106, right: 14, zIndex: 11, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 100 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158' }} />
        LIVE
      </div>

      <div className="map-card">
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Nearby now</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { dot: '#4FC3F7', title: 'DAL 442 · 37,400 ft', sub: 'Delta Air Lines · Atlanta', when: 'now', border: true },
            { dot: '#30D158', title: 'Warriors vs Clippers', sub: 'Chase Center · 0.4 mi', when: '7:30 PM', border: true },
            { dot: '#FF9F0A', title: 'Road closure — Mission St', sub: 'Construction · 0.2 mi', when: '2h ago', border: false },
          ].map(({ dot, title, sub, when, border }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: border ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>{title}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{sub}</div>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>{when}</div>
            </div>
          ))}
        </div>
      </div>

      <TabBar active="situation" />
    </>
  );
}

function MarketsScreen() {
  return (
    <>
      <div className="mkt-screen">
        <div className="mkt-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Markets</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#30D158' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158' }} />Open
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>NYSE · Nasdaq · Crypto</div>
        </div>

        <div className="mkt-nw-card">
          <div className="t-label" style={{ marginBottom: 6 }}>Net Worth</div>
          <div className="t-num" style={{ fontSize: 32 }}>$124,830</div>
          <div className="t-chg green" style={{ marginTop: 4 }}>+$1,240 today · +1.0%</div>
          <div style={{ marginTop: 12, height: 44 }}>
            <svg width="100%" height="44" viewBox="0 0 268 44" preserveAspectRatio="none">
              <defs><linearGradient id="lp-nw-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30D158" stopOpacity="0.3" /><stop offset="100%" stopColor="#30D158" stopOpacity="0" /></linearGradient></defs>
              <path d="M0,36 C20,34 35,30 55,25 C75,20 90,22 110,17 C130,12 145,14 165,10 C185,6 205,4 230,3 C242,2.5 255,2 268,1" fill="none" stroke="#30D158" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M0,36 C20,34 35,30 55,25 C75,20 90,22 110,17 C130,12 145,14 165,10 C185,6 205,4 230,3 C242,2.5 255,2 268,1 L268,44 L0,44 Z" fill="url(#lp-nw-g1)" />
            </svg>
          </div>
        </div>

        <div className="mkt-fg-card">
          <div style={{ flex: 1 }}>
            <div className="t-label" style={{ marginBottom: 5 }}>Fear &amp; Greed</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#FF9F0A', fontVariantNumeric: 'tabular-nums' }}>42</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#FF9F0A' }}>Fear</span>
            </div>
          </div>
          <div style={{ flex: 1.6 }}>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: '42%', height: '100%', background: '#FF9F0A', borderRadius: 3 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}><span>Extreme Fear</span><span>Greed</span></div>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          {MKT_ROWS.map(({ sym, name, price, chg, up, pts }, i) => (
            <div key={sym} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: i < MKT_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', gap: 10 }}>
              <div style={{ flex: 1 }}><div className="t-sym">{sym}</div><div className="t-name">{name}</div></div>
              <svg width="54" height="28" viewBox="0 0 54 28"><polyline points={pts} fill="none" stroke={up ? '#30D158' : '#FF453A'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div style={{ textAlign: 'right', flexShrink: 0 }}><div className="t-price">{price}</div><div className={`t-chg ${up ? 'green' : 'red'}`} style={{ fontSize: 10 }}>{chg}</div></div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="markets" />
    </>
  );
}

function AiScreen() {
  return (
    <div className="ai-screen">
      <div className="ai-header">
        <div className="ai-icon">E</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Epiphany AI</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Powered by Claude · 10 live tools</div>
        </div>
      </div>
      <div className="ai-msgs">
        <div className="bubble-user">What&rsquo;s happening in markets today?</div>
        <div className="bubble-ai">
          <div className="tool-row">
            <span className="tool-badge">get_prices</span>
            <span className="tool-badge">get_portfolio</span>
            <span className="tool-badge">get_news</span>
          </div>
          Markets are mixed. <strong style={{ color: '#fff' }}>NVDA leads</strong> the S&amp;P with +3.1% after strong datacenter guidance. BTC crossed $93K overnight.<br /><br />
          Your portfolio is up <strong style={{ color: '#30D158' }}>+$1,240 (+1.0%)</strong>. Fear &amp; Greed sits at <strong style={{ color: '#FF9F0A' }}>42 (Fear)</strong> — historically a buying signal.
        </div>
        <div className="bubble-user">Should I rebalance?</div>
        <div className="bubble-ai">
          <div className="tool-row">
            <span className="tool-badge">get_portfolio</span>
            <span className="tool-badge">kelly_criterion</span>
          </div>
          Your tech is at <strong style={{ color: '#fff' }}>68%</strong> — above your 60% target. Kelly suggests trimming NVDA ~$2,400 and rotating into XAU.<br /><br />
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Want me to model the impact?</span>
        </div>
      </div>
      <div className="ai-input-bar">
        <div className="ai-input-pill">Model the impact…</div>
        <button className="ai-send" type="button">Send</button>
      </div>
      <TabBar active="ai" />
    </div>
  );
}

function PeopleScreen() {
  return (
    <div className="ppl-screen">
      <div className="ppl-header">
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>People</div>
      </div>
      <div className="search-bar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        <span>Sam Altman</span>
      </div>
      <div className="profile-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="avatar">SA</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Sam Altman</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>CEO, OpenAI · San Francisco</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <div className="social-chip">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            @sama
          </div>
          <div className="social-chip">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            LinkedIn
          </div>
          <div className="social-chip">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
            GitHub
          </div>
          <div className="social-chip">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z" /></svg>
            Instagram
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '14px 16px 8px' }}>Recent News</div>
      {PPL_NEWS.map(({ title, meta }) => (
        <div className="news-item" key={title}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#0071e3', marginTop: 5, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.45, fontWeight: 400 }}>{title}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>{meta}</div>
          </div>
        </div>
      ))}

      <TabBar active="people" />
    </div>
  );
}

export default function LandingPage({ onRegister, onLogin }) {
  // scroll reveal — same behavior as the prototype: reveal once on intersect,
  // 3s safety net so content never stays hidden
  useEffect(() => {
    const els = document.querySelectorAll('.lp .lp-reveal');
    const showAll = () => els.forEach((el) => el.classList.add('in'));
    if (!('IntersectionObserver' in window)) { showAll(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
    const safety = setTimeout(showAll, 3000);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);

  const register = (e) => { e.preventDefault(); onRegister(); };
  const login = (e) => { e.preventDefault(); onLogin(); };

  return (
    <div className="lp">
      {/* ─── NAV ─── */}
      <nav className="lp-nav">
        <a className="lp-logo" href="#" onClick={(e) => e.preventDefault()}><img src="/epiphany-icon.svg" alt="Epiphany" />Epiphany</a>
        <ul className="lp-nav-links">
          <li><a href="#markets">Markets</a></li>
          <li><a href="#portfolio">Portfolio</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <div className="lp-nav-cta">
          <button className="lp-nav-login" onClick={login}>Log in</button>
          <button className="lp-nav-get" onClick={register}>Get Epiphany</button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <header className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="lp-eyebrow" style={{ position: 'relative', zIndex: 2 }}>Portfolio Intelligence</div>
        <h1 className="lp-hero-headline" style={{ position: 'relative', zIndex: 2 }}>What&rsquo;s<br /><em>going on.</em></h1>
        <p className="lp-hero-sub" style={{ position: 'relative', zIndex: 2 }}>Live signals across your stocks, crypto, and commodities — with a Buy / Hold / Sell read on every position. Palantir for your portfolio.</p>
        <div className="lp-hero-actions" style={{ position: 'relative', zIndex: 2 }}>
          <button className="lp-btn-primary" onClick={register}>Get Epiphany</button>
          <a className="lp-btn-glass glass-pill" href="#markets">See what&rsquo;s inside</a>
        </div>
        <div className="lp-live-pill glass-pill" style={{ position: 'relative', zIndex: 2 }}><span className="lp-pulse" />LIVE · UPDATING EVERY 30 SECONDS</div>

        <div className="lp-hero-phone">
          <Phone wifi>
            <img src="/screenshots/screenshot-situation-new.png" alt="Situation map" style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />
          </Phone>
        </div>
      </header>
      <div className="lp-hero-fade" />

      {/* ─── TICKER ─── */}
      <div className="lp-ticker-wrap">
        <div className="lp-ticker">
          {[...TICKER_DATA, ...TICKER_DATA].map((d, i) => (
            <div className="lp-tick" key={i}>
              <span className="sym">{d.sym}</span>
              <span>{d.price}</span>
              <span className={d.up ? 'up' : 'dn'}>{d.chg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── MARKETS ─── */}
      <section className="lp-section" id="markets">
        <div className="lp-showcase">
          <div className="lp-showcase-copy lp-reveal">
            <div className="lp-eyebrow">Markets</div>
            <h2 className="lp-showcase-headline">Your portfolio, intelligently.</h2>
            <p className="lp-showcase-sub">Net worth tracking, live quotes, and a signal on every position.</p>
            <ul className="lp-showcase-points">
              <li>Fear &amp; Greed, macro pulse, and anomaly detection</li>
              <li>RSI, MACD, Bollinger — the full indicator suite</li>
              <li>Read-only brokerage sync via SnapTrade</li>
            </ul>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '1.5rem' }}>Educational and informational only. Not investment advice.</p>
          </div>
          <div className="lp-showcase-phone lp-reveal">
            <Phone>
              <img src="/screenshots/screenshot-stocks-new.png" alt="Stock detail" style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />
            </Phone>
          </div>
        </div>
      </section>

      {/* ─── SIMULATOR ─── */}
      <section className="lp-section" id="simulator" style={{ paddingTop: 0 }}>
        <div className="lp-showcase">
          <div className="lp-showcase-copy lp-reveal">
            <div className="lp-eyebrow">Simulator</div>
            <h2 className="lp-showcase-headline">Trade without the risk.</h2>
            <p className="lp-showcase-sub">A 60fps paper-trading simulator with Kelly-criterion sizing, edge detection, and P&amp;L tracking. Practice the read before you act on it.</p>
            <ul className="lp-showcase-points">
              <li>Kelly criterion position sizing</li>
              <li>Real-time P&amp;L tracking and edge detection</li>
              <li>High-frequency paper trading engine</li>
            </ul>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '1.5rem' }}>Simulated trading only. No real funds, no real orders.</p>
          </div>
          <div className="lp-showcase-phone lp-reveal">
            <Phone>
              <img src="/screenshots/screenshot-portfolio-new.png" alt="Portfolio tab" style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />
            </Phone>
          </div>
        </div>
      </section>

      {/* ─── SCREENS GALLERY ─── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-grid-head lp-reveal">
          <div className="lp-eyebrow" style={{ color: 'var(--accent)' }}>Every screen</div>
          <h2 className="lp-showcase-headline" style={{ marginBottom: 0 }}>Built for daily use.</h2>
        </div>
        <div className="lp-screens-gallery lp-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '2rem', maxWidth: '560px', margin: '2rem auto 0' }}>
          <div style={{ borderRadius: '1rem', overflow: 'hidden', background: '#0a0e15', aspectRatio: '9/20' }}>
            <img src="/screenshots/screenshot-markets-new.png" alt="Markets ticker" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ borderRadius: '1rem', overflow: 'hidden', background: '#0a0e15', aspectRatio: '9/20' }}>
            <img src="/screenshots/screenshot-settings-new.png" alt="Settings" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      {/* ─── AND MORE ─── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-grid-head lp-reveal">
          <div className="lp-eyebrow" style={{ color: 'var(--accent)' }}>And more</div>
          <h2 className="lp-showcase-headline" style={{ marginBottom: 0 }}>Also inside.</h2>
        </div>
        <div className="lp-grid lp-reveal">
          <div className="lp-cell glass">
            <div className="lp-cell-tag">Finances</div>
            <div className="lp-cell-name">Your whole financial life</div>
            <div className="lp-cell-desc">Budgets, spending analysis, and long-term TFSA/RDSP forecasts.</div>
          </div>
          <div className="lp-cell glass">
            <div className="lp-cell-tag">Alerts</div>
            <div className="lp-cell-name">Smart trading signals</div>
            <div className="lp-cell-desc">Real-time notifications for price movements, anomalies, and market events.</div>
          </div>
          <div className="lp-cell glass">
            <div className="lp-cell-tag">Analytics</div>
            <div className="lp-cell-name">Deep portfolio insights</div>
            <div className="lp-cell-desc">Risk analysis, correlation matrices, and historical performance tracking.</div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="lp-section" id="pricing" style={{ paddingTop: 0 }}>
        <div className="lp-grid-head lp-reveal">
          <div className="lp-eyebrow" style={{ color: 'var(--accent)' }}>Pricing</div>
          <h2 className="lp-showcase-headline" style={{ marginBottom: 0 }}>Start free.</h2>
        </div>
        <div className="lp-pricing lp-reveal">
          <div className="lp-price-card glass">
            <div className="lp-price-tier">Free</div>
            <div className="lp-price-num">$0</div>
            <ul className="lp-price-feats">
              <li>1 portfolio</li>
              <li>Delayed data</li>
              <li>Basic signals</li>
            </ul>
            <button className="lp-price-btn glass-pill" onClick={register}>Start free</button>
          </div>
          <div className="lp-price-card glass premium">
            <div className="lp-price-tier">Paid</div>
            <div className="lp-price-num">$9.99<span>/mo</span></div>
            <ul className="lp-price-feats">
              <li>Real-time data</li>
              <li>Full indicator suite</li>
              <li>Brokerage sync</li>
              <li>Alerts</li>
            </ul>
            <button className="lp-price-btn solid" onClick={register}>Get Epiphany</button>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="lp-final">
        <div className="lp-final-glow" />
        <h2 className="lp-final-headline" style={{ position: 'relative' }}>Have an epiphany.</h2>
        <div style={{ position: 'relative', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="lp-btn-primary" onClick={register}>Get Epiphany</button>
          <button className="lp-btn-glass glass-pill" onClick={login}>Open the web app</button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="lp-footer">
        <div className="lp-footer-logo"><img src="/epiphany-icon.svg" alt="" />Epiphany</div>
        <ul className="lp-footer-links">
          <li><a href="#markets">Markets</a></li>
          <li><a href="#simulator">Simulator</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="/terms.md" target="_blank">Terms</a></li>
          <li><a href="/privacy.md" target="_blank">Privacy</a></li>
        </ul>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '1.5rem', lineHeight: 1.6 }}>
          Epiphany provides educational and informational tools only and does not provide investment advice. Past performance does not guarantee future results. Brokerage connections are read-only.
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.85rem' }}>© 2026 Epiphany</div>
      </footer>
    </div>
  );
}
