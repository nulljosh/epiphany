import { useEffect, useRef } from 'react';
import './landing.css';

const TICKER_DATA = [
  { sym: 'AAPL', price: '$213.18', chg: '+1.2%', up: true },
  { sym: 'NVDA', price: '$875.40', chg: '+3.1%', up: true },
  { sym: 'BTC',  price: '$93,200', chg: '+2.4%', up: true },
  { sym: 'ETH',  price: '$3,410',  chg: '-0.8%', up: false },
  { sym: 'GOLD', price: '$2,340',  chg: '+0.3%', up: true },
  { sym: 'MSFT', price: '$416.50', chg: '+0.9%', up: true },
  { sym: 'OIL',  price: '$78.20',  chg: '-1.4%', up: false },
  { sym: 'SOL',  price: '$162.40', chg: '+5.2%', up: true },
  { sym: 'TSLA', price: '$247.10', chg: '-2.1%', up: false },
  { sym: 'SPX',  price: '$5,218',  chg: '+0.6%', up: true },
];

const MKT_DATA = [
  { sym: 'AAPL', name: 'Apple Inc.',   price: '$213.18', chg: '+1.24%', up: true  },
  { sym: 'NVDA', name: 'NVIDIA Corp.', price: '$875.40', chg: '+3.12%', up: true  },
  { sym: 'BTC',  name: 'Bitcoin',      price: '$93,200', chg: '+2.41%', up: true  },
  { sym: 'GOLD', name: 'Gold Spot',    price: '$2,340',  chg: '+0.31%', up: true  },
  { sym: 'ETH',  name: 'Ethereum',     price: '$3,410',  chg: '-0.83%', up: false },
];

function sparkPath(up, seed) {
  let s = seed || 42;
  const lcg = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const n = 10;
  const pts = [];
  let y = 20;
  for (let i = 0; i < n; i++) {
    const trend = up ? -0.8 : 0.8;
    y = Math.max(6, Math.min(34, y + trend + (lcg() - 0.5) * 5));
    pts.push([i * (66 / (n - 1)), y]);
  }
  pts[pts.length - 1][1] = up ? 8 : 32;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
    d += ` C${cpx},${pts[i - 1][1]} ${cpx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`;
  }
  return d;
}

export default function LandingPage({ onRegister, onLogin }) {
  const canvasRef = useRef(null);

  // canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, nodes = [], animId;

    const randBetween = (a, b) => a + Math.random() * (b - a);

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function initNodes(n = 80) {
      nodes = [];
      for (let i = 0; i < n; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: randBetween(-0.15, 0.15), vy: randBetween(-0.15, 0.15),
          r: randBetween(1, 2.5),
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: randBetween(0.005, 0.02),
          isPing: Math.random() < 0.08,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - dist / 120) * 0.07})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      nodes.forEach(n => {
        n.pulse += n.pulseSpeed;
        const a = 0.3 + 0.3 * Math.sin(n.pulse);
        if (n.isPing) {
          const pr = 6 + 4 * Math.abs(Math.sin(n.pulse * 0.5));
          ctx.beginPath();
          ctx.arc(n.x, n.y, pr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.2})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.45})`;
        ctx.fill();
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0) n.x = W;
        if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H;
        if (n.y > H) n.y = 0;
      });

      animId = requestAnimationFrame(draw);
    }

    resize();
    initNodes();
    draw();
    const onResize = () => { resize(); initNodes(); };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); };
  }, []);

  // scroll reveal
  useEffect(() => {
    const reveals = document.querySelectorAll('.lp .reveal');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.15 });
    reveals.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp">
      {/* NAV */}
      <nav>
        <a className="nav-logo" href="#">
          <img src="/icon-192.svg" alt="Epiphany" />
          EPIPHANY
        </a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#markets">Markets</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <div className="nav-auth">
          <button className="nav-login" onClick={onLogin}>Log in</button>
          <button className="nav-register" onClick={onRegister}>Register</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <canvas id="hero-canvas" ref={canvasRef} />
        <div className="hero-eyebrow">Personal Intelligence Platform</div>
        <h1 className="hero-headline">Know what's happening,</h1>
        <div className="hero-headline-accent">right now.</div>
        <p className="hero-sub">
          Real-time awareness of everything around you: markets, events, weather, crime, flights. All in one place.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={onRegister}>Register free</button>
          <a className="btn-secondary" href="#features">
            See what it does
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        <div className="hero-pill">
          <span className="pulse-dot" />
          Live data &middot; refreshed every 30 seconds
        </div>
      </section>

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {[...TICKER_DATA, ...TICKER_DATA].map((d, i) => (
            <div className="ticker-item" key={i}>
              <span className="sym">{d.sym}</span>
              <span>{d.price}</span>
              <span className={d.up ? 'up' : 'dn'}>{d.chg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features">
        <div className="container">
          <div className="reveal">
            <div className="section-label">What Epiphany does</div>
            <h2 className="section-title">Your world,<br /><strong>at a glance.</strong></h2>
            <p className="section-body">Three layers of intelligence, unified in a single app. No noise. Just signal.</p>
          </div>
          <div className="features-grid reveal">
            <div className="feature-card">
              <div className="feature-icon blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8">
                  <path d="M3 12a9 9 0 1 0 18 0A9 9 0 0 0 3 12z" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </div>
              <div className="feature-name">Situation</div>
              <p className="feature-desc">A live map of everything happening near you. Flights overhead, crime reports, weather alerts, traffic, wildfires, local events. Updating in real time as you move.</p>
              <div className="feature-tags">
                <span className="tag">Flights</span>
                <span className="tag">Weather</span>
                <span className="tag">Crime</span>
                <span className="tag">Traffic</span>
                <span className="tag">Events</span>
                <span className="tag">Wildfires</span>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <div className="feature-name">Markets</div>
              <p className="feature-desc">Stocks, crypto, and commodities with live quotes. Your portfolio summary, net worth, spending forecast, debt payoff timeline, and savings projections. All in one view.</p>
              <div className="feature-tags">
                <span className="tag">Stocks</span>
                <span className="tag">Crypto</span>
                <span className="tag">Portfolio</span>
                <span className="tag">Fear &amp; Greed</span>
                <span className="tag">Macro</span>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div className="feature-name">People</div>
              <p className="feature-desc">Search anyone by name and get a structured intelligence profile: social discovery, public records, news mentions, web presence. All in seconds, from public sources.</p>
              <div className="feature-tags">
                <span className="tag">LinkedIn</span>
                <span className="tag">Public Records</span>
                <span className="tag">News</span>
                <span className="tag">Social</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SITUATION SHOWCASE */}
      <div className="showcase" id="situation">
        <div className="showcase-inner">
          <div className="reveal">
            <div className="section-label">Situation</div>
            <h2 className="section-title">The map is<br /><strong>your home screen.</strong></h2>
            <p className="section-body" style={{ marginBottom: 32 }}>
              Everything happening around you, visible at once. Zoom in to see more. Epiphany always shows the most relevant layer of detail for your current position.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { color: 'rgba(255,255,255,0.8)',  title: 'Live flight tracking',  body: 'See every aircraft overhead with flight number and airline.' },
                { color: 'rgba(255,255,255,0.5)', title: 'Incident layer',        body: 'Traffic, construction, emergency services, and crime reports.' },
                { color: 'rgba(255,255,255,0.35)', title: 'Local events',          body: 'Concerts, sports, community events. Pulled from Ticketmaster and OSM.' },
              ].map(({ color, title, body }) => (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 7, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 300 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="showcase-visual">
              <div className="mock-phone">
                <div style={{ background: '#1c1c1e', padding: '14px 20px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#fff' }}>
                  <span>12:26</span><span>&#9679;&#9679;&#9679;</span>
                </div>
                <div className="mock-map">
                  <svg width="100%" height="100%" viewBox="0 0 280 480" preserveAspectRatio="xMidYMid slice">
                    <rect width="280" height="480" fill="#111" />
                    <line x1="0" y1="240" x2="280" y2="240" stroke="#222" strokeWidth="8" />
                    <line x1="0" y1="300" x2="280" y2="300" stroke="#222" strokeWidth="4" />
                    <line x1="140" y1="0" x2="140" y2="480" stroke="#222" strokeWidth="6" />
                    <line x1="80" y1="0" x2="80" y2="480" stroke="#222" strokeWidth="3" />
                    <line x1="200" y1="0" x2="200" y2="480" stroke="#222" strokeWidth="3" />
                    <line x1="0" y1="360" x2="200" y2="160" stroke="#222" strokeWidth="4" />
                    <rect x="10" y="10" width="60" height="80" rx="4" fill="#1a1a1a" opacity="0.8" />
                    <rect x="160" y="320" width="100" height="80" rx="4" fill="#1a1a1a" opacity="0.8" />
                    <rect x="100" y="100" width="40" height="40" rx="2" fill="#1a1a1a" opacity="0.6" />
                    <circle cx="140" cy="240" r="10" fill="rgba(255,255,255,0.15)" />
                    <circle cx="140" cy="240" r="5" fill="rgba(255,255,255,0.85)" />
                    <g className="map-dot" transform="translate(60,80) rotate(45)">
                      <text fontSize="16" fill="rgba(255,255,255,0.75)" textAnchor="middle">&#9992;</text>
                    </g>
                    <g className="map-dot" transform="translate(220,140) rotate(135)">
                      <text fontSize="14" fill="rgba(255,255,255,0.75)" textAnchor="middle">&#9992;</text>
                    </g>
                    <g className="map-dot" transform="translate(180,380) rotate(200)">
                      <text fontSize="13" fill="rgba(255,255,255,0.75)" textAnchor="middle">&#9992;</text>
                    </g>
                    <circle className="map-dot" cx="100" cy="160" r="6" fill="rgba(255,255,255,0.5)" />
                    <circle className="map-dot" cx="200" cy="200" r="6" fill="rgba(255,255,255,0.5)" />
                    <circle className="map-dot" cx="60" cy="320" r="5" fill="rgba(255,255,255,0.5)" />
                    <g className="map-dot" transform="translate(190,100)">
                      <polygon points="0,-10 9,6 -9,6" fill="rgba(255,255,255,0.4)" />
                      <text y="4" fontSize="7" fill="#000" textAnchor="middle" fontWeight="bold">!</text>
                    </g>
                    <g className="map-dot" transform="translate(240,260)">
                      <polygon points="0,-8 7,5 -7,5" fill="rgba(255,255,255,0.4)" />
                      <text y="3" fontSize="6" fill="#000" textAnchor="middle" fontWeight="bold">!</text>
                    </g>
                    <text x="60" y="95" fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">Flight DAL822</text>
                    <text x="100" y="148" fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">Stadium</text>
                  </svg>
                </div>
                <div className="mock-tabs">
                  {[
                    { icon: '🗺', label: 'Situation', active: true },
                    { icon: '📈', label: 'Markets', active: false },
                    { icon: '👤', label: 'People', active: false },
                    { icon: '⚙️', label: 'Settings', active: false },
                  ].map(({ icon, label, active }) => (
                    <div key={label} className={`mock-tab${active ? ' active' : ''}`}>
                      <div className="mock-tab-icon">{icon}</div>
                      <div>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MARKETS SHOWCASE */}
      <section id="markets">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }} className="responsive-flip">
            <div className="reveal" style={{ order: 2 }}>
              <div className="section-label">Markets</div>
              <h2 className="section-title">Your finances,<br /><strong>intelligently.</strong></h2>
              <p className="section-body" style={{ marginBottom: 32 }}>
                Live market data, portfolio tracking, spending analysis, and debt payoff projections. All derived from your real financial data.
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'Net worth tracking across accounts, portfolio, and debt',
                  'Monte Carlo spending forecast with category breakdown',
                  'Debt payoff timeline: avalanche vs snowball vs do-nothing',
                  'Trading simulator with Kelly criterion position sizing',
                ].map(item => (
                  <li key={item} style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 300, display: 'flex', gap: 12 }}>
                    <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>&#8594;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="reveal" style={{ order: 1 }}>
              <div className="markets-mock">
                <div className="mkt-header">Markets</div>
                <div className="mkt-hero">
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 8 }}>NET WORTH</div>
                  <div className="mkt-price">$124,830</div>
                  <div className="mkt-change">+$1,240.50 (1.0%) today</div>
                </div>
                {MKT_DATA.map((d, i) => {
                  const color = d.up ? '#ffffff' : 'rgba(255,255,255,0.35)';
                  return (
                    <div className="mkt-row" key={d.sym}>
                      <div>
                        <div className="mkt-sym">{d.sym}</div>
                        <div className="mkt-name">{d.name}</div>
                      </div>
                      <svg width="70" height="40" viewBox="0 0 70 40">
                        <path d={sparkPath(d.up, i * 9371 + 1234)} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />
                      </svg>
                      <div className="mkt-val">
                        <div className="mkt-p">{d.price}</div>
                        <div className="mkt-chg" style={{ color }}>{d.chg}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATEMENT */}
      <section className="statement-section" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="reveal">
          <p className="statement-quote">
            "Think of it as having a friend who <em>always knows</em> what's going on."
          </p>
          <div className="statement-attr">Palantir for normal people &middot; $1/week</div>
        </div>
      </section>

      {/* DATA STATS */}
      <section>
        <div className="container">
          <div className="reveal">
            <div className="section-label">Coverage</div>
            <h2 className="section-title">Everything,<br /><strong>everywhere.</strong></h2>
          </div>
          <div className="data-grid reveal">
            <div className="data-cell">
              <div className="data-cell-num">8+</div>
              <div className="data-cell-label">Real-time data layers on the map</div>
            </div>
            <div className="data-cell">
              <div className="data-cell-num">30s</div>
              <div className="data-cell-label">Market refresh interval</div>
            </div>
            <div className="data-cell">
              <div className="data-cell-num">&infin;</div>
              <div className="data-cell-label">Stocks, crypto, and commodities tracked</div>
            </div>
            <div className="data-cell">
              <div className="data-cell-num">&#10022;</div>
              <div className="data-cell-label">Daily brief, curated every morning</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section" id="pricing">
        <div className="reveal">
          <div className="section-label" style={{ textAlign: 'center' }}>Pricing</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>Simple.<br /><strong>One price.</strong></h2>
        </div>
        <div className="pricing-cards reveal">
          <div className="pricing-card">
            <div className="pricing-tier">Free</div>
            <div className="pricing-price">$0</div>
            <div className="pricing-desc">Core intelligence, no credit card required.</div>
            <ul className="pricing-features">
              <li className="included">Situation map with all data layers</li>
              <li className="included">Live market quotes</li>
              <li className="included">People search</li>
              <li>Portfolio tracking</li>
              <li>Daily Brief</li>
              <li>Price alerts</li>
            </ul>
            <button className="pricing-cta outline" onClick={onRegister}>Register free</button>
          </div>
          <div className="pricing-card featured">
            <div className="pricing-badge">PREMIUM</div>
            <div className="pricing-tier">Intelligence</div>
            <div className="pricing-price">$1 <span>/ week</span></div>
            <div className="pricing-desc">Full personal intelligence platform. Cancel any time.</div>
            <ul className="pricing-features">
              <li className="included">Everything in Free</li>
              <li className="included">Portfolio + net worth tracking</li>
              <li className="included">Spending forecast &amp; debt payoff</li>
              <li className="included">Daily Brief</li>
              <li className="included">Price &amp; area alerts</li>
              <li className="included">Trading simulator</li>
            </ul>
            <button className="pricing-cta filled" onClick={onRegister}>Start Premium &middot; $1/wk</button>
          </div>
        </div>
      </section>

      {/* DOWNLOAD STRIP */}
      <div className="download-strip" id="download">
        <div className="dl-label">Available now</div>
        <div className="dl-title">iOS &middot; macOS &middot; Web</div>
        <div className="dl-buttons">
          <a className="dl-btn-dark" href="https://apps.apple.com" target="_blank" rel="noreferrer">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Download for iOS
          </a>
          <a className="dl-btn-dark" href="#" target="_blank" rel="noreferrer">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="14" rx="2" />
              <path d="M8 20h8M12 18v2" />
            </svg>
            Download for macOS
          </a>
          <button className="dl-btn-outline" onClick={onRegister}>Open Web App</button>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-brand">
          <img src="/icon-192.svg" alt="" />
          EPIPHANY &middot; 2026
        </div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Support</a>
          <button className="nav-login" style={{ fontSize: 13, color: 'var(--text3)', padding: 0 }} onClick={onLogin}>Log in</button>
          <button className="nav-register" style={{ fontSize: 13, border: 'none', background: 'none', color: 'var(--text2)', padding: 0 }} onClick={onRegister}>Register</button>
        </div>
      </footer>
    </div>
  );
}
