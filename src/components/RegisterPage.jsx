import { useState } from 'react';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['Prediction markets', 'Live stock data (US50)', 'Monte Carlo simulations', 'Trading simulator'],
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$20',
    period: '/mo',
    features: ['Everything in Free', 'Broker panel unlock', 'cTrader + TradingView signals', 'Basic auto-send'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$50',
    period: '/mo',
    features: ['Everything in Starter', 'Full broker automation', 'Higher signal throughput', 'Priority support'],
    highlight: true,
  },
];

export default function RegisterPage({ onRegister, onSwitchToLogin, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    await onRegister(email, password);
    setSubmitting(false);
  };

  const displayError = localError || error;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 900,
      }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 8,
          textAlign: 'center',
        }}>Monica</h1>
        <p style={{
          fontSize: 14,
          color: '#888',
          marginBottom: 32,
          textAlign: 'center',
        }}>Financial terminal. Create your account to get started.</p>

        {/* Pricing tiers inline */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 32,
        }}>
          {TIERS.map(tier => (
            <div key={tier.name} style={{
              background: '#111',
              border: tier.highlight ? '1px solid #00d46a' : '1px solid #222',
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{tier.name}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: 'tabular-nums' }}>
                {tier.price}<span style={{ fontSize: 13, color: '#666', fontWeight: 400 }}>{tier.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
                {tier.features.map(f => (
                  <li key={f} style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Registration form */}
        <div style={{
          maxWidth: 400,
          margin: '0 auto',
          background: '#111',
          borderRadius: 16,
          padding: 32,
          border: '1px solid #222',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="Min 8 characters"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="Repeat password"
              />
            </div>

            {displayError && (
              <div style={{
                color: '#ff4444',
                fontSize: 13,
                marginBottom: 16,
                padding: '8px 12px',
                background: 'rgba(255,68,68,0.1)',
                borderRadius: 6,
              }}>{displayError}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: 14,
                background: '#00d46a',
                color: '#000',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p style={{
            textAlign: 'center',
            marginTop: 20,
            marginBottom: 0,
            fontSize: 13,
            color: '#666',
          }}>
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              style={{
                background: 'none',
                border: 'none',
                color: '#00d46a',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                padding: 0,
              }}
            >Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
