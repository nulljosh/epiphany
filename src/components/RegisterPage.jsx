import { useState, useEffect } from 'react';
import './auth.css';

const FONT = "'Sora', -apple-system, BlinkMacSystemFont, sans-serif";
const label = { display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' };
const card = { background: 'rgba(255,255,255,0.025)', borderRadius: 20, padding: '36px 32px 32px', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(40px)' };
const errorBox = { color: '#ff5555', fontSize: 13, marginBottom: 20, padding: '10px 14px', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.12)', borderRadius: 10 };

function fadeStyle(mounted, delay = 0) {
  return { animation: mounted ? `authFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both` : 'none', opacity: mounted ? undefined : 0 };
}

const TIERS = [
  { name: 'Free', price: '$0', period: 'forever', features: ['Map + all data layers', 'Live stock data + ticker', 'Situation monitor', 'Trading simulator'], highlight: false },
  { name: 'Premium', price: '$1', period: '/wk', features: ['Everything in Free', 'AI Analyst (Claude)', 'Portfolio + watchlist', 'Ontology + deep data'], highlight: true },
];

export default function RegisterPage({ onRegister, onSwitchToLogin, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirmPassword) { setLocalError('Passwords do not match'); return; }
    setSubmitting(true);
    await onRegister(email, password);
    setSubmitting(false);
  };

  const displayError = localError || error;

  return (
    <div style={{ minHeight: '100vh', background: '#060a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '30%', left: '50%', width: 800, height: 800, transform: 'translate(-50%, -50%)', background: 'rgba(0,228,106,0.02)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 900, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32, ...fadeStyle(mounted, 0.05) }}>
          <div style={{ width: 44, height: 44, margin: '0 auto 18px', borderRadius: 12, background: 'rgba(0,228,106,0.1)', border: '1px solid rgba(0,228,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#00e46a', lineHeight: 1 }}>M</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Monica</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Create your account to get started</p>
        </div>

        {/* Pricing tiers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28, ...fadeStyle(mounted, 0.1) }}>
          {TIERS.map(tier => (
            <div key={tier.name} style={{ background: 'rgba(255,255,255,0.025)', border: tier.highlight ? '1px solid rgba(0,228,106,0.25)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 22, backdropFilter: 'blur(20px)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: tier.highlight ? '#00e46a' : 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{tier.name}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                {tier.price}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 400, marginLeft: 2 }}>{tier.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0 0' }}>
                {tier.features.map(f => <li key={f} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 7, lineHeight: 1.3 }}>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ maxWidth: 420, margin: '0 auto', ...card, ...fadeStyle(mounted, 0.18) }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="auth-input" placeholder="you@example.com" />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="auth-input" placeholder="Min 8 characters" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={label}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} className="auth-input" placeholder="Repeat password" />
            </div>
            {displayError && <div style={errorBox}>{displayError}</div>}
            <button type="submit" disabled={submitting} className="auth-btn">{submitting ? 'Creating account...' : 'Create Account'}</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 22, marginBottom: 0, fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            Already have an account? <button onClick={onSwitchToLogin} className="auth-link-accent">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
