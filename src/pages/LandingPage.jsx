import { useEffect } from 'react';
import './landing.css';

// Landing, laid out like Hermes: a centred nav, one big line over the live map,
// three feature rows, three cards, pricing, then the footer. The map behind the
// hero is the real one (App.jsx renders it), not a picture of it.

const APP_STORE = 'https://apps.apple.com/app/id6779522175';
const REPO = 'https://github.com/nulljosh/epiphany';

const ROWS = [
  { label: 'Map', title: 'What is happening near you', body: 'Flights, incidents, weather, fires and events on one live map. Filter by type and time.' },
  { label: 'Markets', title: 'Every price, one glance', body: 'Stocks, crypto and commodities with index cards, top movers and full-screen charts.' },
  { label: 'Money', title: 'Where it went, what is due', body: 'Drop in a statement. See bills due in 30 days, money in against spending, and what changed.' },
];

const CELLS = [
  { label: 'Alerts', title: 'Price alerts', body: 'Set a price and get told, even with the app closed.' },
  { label: 'Autopilot', title: 'A written trading rule', body: 'Paper money only. It smooths the ride; it does not beat buying and holding.' },
  { label: 'People', title: 'Search anyone', body: 'Public profiles, links and news mentions in one place.' },
];

const PLANS = [
  { tier: 'Web', price: '$0', note: 'in your browser', body: 'The map, markets and one portfolio.', cta: 'Start free', action: 'register' },
  { tier: 'Premium', price: '$1', note: 'once, on the web', body: 'Real-time data, alerts, Autopilot, brokerage sync and every update.', cta: 'Unlock for $1', action: 'paid', solid: true },
  { tier: 'The app', price: '$1', note: 'on the App Store', body: 'iPhone, Mac and Apple Watch, with widgets.', cta: 'Get the app', href: APP_STORE },
];

export default function LandingPage({ onRegister, onRegisterPaid, onLogin, zooming = false }) {
  // Reveal once on intersect, with a safety net so nothing stays hidden.
  useEffect(() => {
    const els = document.querySelectorAll('.lp .reveal');
    const showAll = () => els.forEach((el) => el.classList.add('in'));
    if (!('IntersectionObserver' in window)) { showAll(); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
    const safety = setTimeout(showAll, 2500);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);

  const act = (action) => (e) => {
    e.preventDefault();
    if (action === 'paid') onRegisterPaid(); else if (action === 'login') onLogin(); else onRegister();
  };

  return (
    <div id="top" className={`lp${zooming ? ' zooming' : ''}`}>
      <header className="nav" aria-label="Site">
        <nav className="nav-links" aria-label="Main">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <a className="nav-brand" href="#top"><img src="/epiphany-icon.svg" alt="" width="28" height="28" /><span>Epiphany</span></a>
        <div className="nav-end">
          <button className="nav-login" type="button" onClick={act('login')}>Log in</button>
          <button className="btn btn-solid" type="button" onClick={act('register')}>Get Epiphany</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="label">Map, markets and money</p>
          <h1>Epiphany</h1>
          <p className="lead">Everything happening in your world, on one screen.</p>
          <div className="cta">
            <button className="btn btn-solid" type="button" onClick={act('register')}>Open the web app</button>
            <a className="btn btn-ghost" href={APP_STORE}>Get it on the App Store</a>
          </div>
          <p className="fine">Web, iPhone, Mac and Apple Watch. Free on the web, $1 for everything.</p>
          <p className="hint">The map behind this is live.</p>
        </section>

        <section className="band" id="features">
          <div className="band-head reveal">
            <img className="band-art" src="/brand/prometheus.webp" alt="" loading="lazy" />
            <div>
              <p className="label">Forethought</p>
              <h2>One screen for all of it</h2>
              <p>Most apps do one of these. Epiphany puts the map, the markets and your money side by side.</p>
            </div>
          </div>
          <figure className="stage reveal">
            <img src="/landing/mac-markets.jpg" width="1200" height="800" loading="lazy" alt="Epiphany on the Mac: the market list in a column, Mastercard's chart and stats beside it." />
            <figcaption>The Mac app, on live prices.</figcaption>
          </figure>
          <div className="frows">
            {ROWS.map((r) => (
              <article className="frow reveal" key={r.label}>
                <p className="label">{r.label}</p><h3>{r.title}</h3><p>{r.body}</p>
              </article>
            ))}
          </div>
          <div className="cells">
            {CELLS.map((c) => (
              <article className="cell reveal" key={c.label}>
                <p className="label">{c.label}</p><h3>{c.title}</h3><p>{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sec" id="pricing">
          <p className="label reveal">Pricing</p>
          <h2 className="reveal">Free on the web. $1 for the rest.</h2>
          <p className="body reveal">No subscription, no ads.</p>
          <div className="plans">
            {PLANS.map((p) => (
              <div className={`plan reveal${p.solid ? ' plan-hi' : ''}`} key={p.tier}>
                <small>{p.tier}</small>
                <b>{p.price}<span> {p.note}</span></b>
                <p>{p.body}</p>
                {p.href
                  ? <a className="btn btn-ghost" href={p.href}>{p.cta}</a>
                  : <button className={`btn ${p.solid ? 'btn-solid' : 'btn-ghost'}`} type="button" onClick={act(p.action)}>{p.cta}</button>}
              </div>
            ))}
          </div>
          <p className="fine reveal">A web unlock and the App Store app are separate purchases. Autopilot trades paper money only.</p>
        </section>
      </main>

      <footer className="foot">
        <div className="foot-top">
          <div className="foot-brand"><img src="/epiphany-icon.svg" alt="" width="40" height="40" /><b>Epiphany</b><p>Your world, one screen.</p></div>
          <nav className="foot-cols" aria-label="Footer">
            <div><p className="label">Epiphany</p><a href={APP_STORE}>App Store</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href={`${REPO}/blob/main/roadmap.md`}>Roadmap</a></div>
            <div><p className="label">Source</p><a href={REPO}>GitHub</a><a href={`${REPO}/blob/main/WHITEPAPER.md`}>Whitepaper</a><a href={`${REPO}/blob/main/docs/API.md`}>API</a><a href={`${REPO}/issues`}>Report a bug</a></div>
            <div><p className="label">Project</p><a href="/privacy.html">Privacy</a><a href="/terms.md">Terms</a><a href={`${REPO}/blob/main/SECURITY.md`}>Security</a><a href="https://jaybulb.com">More apps</a></div>
          </nav>
        </div>
        <p className="legal">© 2026 Joshua Trommel · Apache 2.0 · <a href="/privacy.html">Privacy</a></p>
        <p className="legal note">Epiphany provides educational and informational tools only and does not provide investment advice. Past performance does not guarantee future results. Brokerage connections are read-only.</p>
      </footer>
    </div>
  );
}
