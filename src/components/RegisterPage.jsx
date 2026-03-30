import { useState, useEffect } from 'react';

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

const REG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap');

@keyframes regFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.monica-reg-input {
  width: 100%;
  padding: 14px 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  color: #f0f0f0;
  font-size: 14px;
  font-family: 'Sora', -apple-system, sans-serif;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
  letter-spacing: 0.01em;
}
.monica-reg-input::placeholder {
  color: rgba(255,255,255,0.2);
}
.monica-reg-input:focus {
  border-color: rgba(0,228,106,0.4);
  background: rgba(255,255,255,0.05);
  box-shadow: 0 0 0 3px rgba(0,228,106,0.06), 0 0 20px rgba(0,228,106,0.04);
}
`;

export default function RegisterPage({ onRegister, onSwitchToLogin, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

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

  const fadeStyle = (delay = 0) => ({
    animation: mounted ? `regFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both` : 'none',
    opacity: mounted ? undefined : 0,
  });

  return (
    <>
      <style>{REG_CSS}</style>
      <div style={{
        minHeight: '100vh',
        background: '#060a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          width: 800,
          height: 800,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(0,228,106,0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          width: '100%',
          maxWidth: 900,
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32, ...fadeStyle(0.05) }}>
            <div style={{
              width: 44,
              height: 44,
              margin: '0 auto 18px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(0,228,106,0.15), rgba(0,228,106,0.05))',
              border: '1px solid rgba(0,228,106,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#00e46a', lineHeight: 1 }}>M</span>
            </div>
            <h1 style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}>Monica</h1>
            <p style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.3)',
              margin: 0,
              letterSpacing: '0.02em',
            }}>Create your account to get started</p>
          </div>

          {/* Pricing tiers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 28,
            ...fadeStyle(0.1),
          }}>
            {TIERS.map(tier => (
              <div key={tier.name} style={{
                background: 'rgba(255,255,255,0.025)',
                border: tier.highlight
                  ? '1px solid rgba(0,228,106,0.25)'
                  : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16,
                padding: 22,
                backdropFilter: 'blur(20px)',
                transition: 'border-color 0.3s',
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: tier.highlight ? '#00e46a' : 'rgba(255,255,255,0.7)',
                  marginBottom: 6,
                  letterSpacing: '0.02em',
                }}>{tier.name}</div>
                <div style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: "'Sora', sans-serif",
                  letterSpacing: '-0.02em',
                }}>
                  {tier.price}
                  <span style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.25)',
                    fontWeight: 400,
                    marginLeft: 2,
                  }}>{tier.period}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0 0' }}>
                  {tier.features.map(f => (
                    <li key={f} style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 7,
                      lineHeight: 1.3,
                      letterSpacing: '0.01em',
                    }}>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Registration form */}
          <div style={{
            maxWidth: 420,
            margin: '0 auto',
            background: 'rgba(255,255,255,0.025)',
            borderRadius: 20,
            padding: '36px 32px 32px',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(40px)',
            boxShadow: '0 4px 60px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
            ...fadeStyle(0.18),
          }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: 8,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="monica-reg-input"
                  placeholder="you@example.com"
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: 8,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="monica-reg-input"
                  placeholder="Min 8 characters"
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: 8,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="monica-reg-input"
                  placeholder="Repeat password"
                />
              </div>

              {displayError && (
                <div style={{
                  color: '#ff5555',
                  fontSize: 13,
                  marginBottom: 20,
                  padding: '10px 14px',
                  background: 'rgba(255,60,60,0.08)',
                  border: '1px solid rgba(255,60,60,0.12)',
                  borderRadius: 10,
                  letterSpacing: '0.01em',
                }}>{displayError}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: 15,
                  background: 'linear-gradient(135deg, #00e46a, #00c45a)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "'Sora', -apple-system, sans-serif",
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.5 : 1,
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease',
                  letterSpacing: '0.02em',
                }}
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p style={{
              textAlign: 'center',
              marginTop: 22,
              marginBottom: 0,
              fontSize: 13,
              color: 'rgba(255,255,255,0.25)',
            }}>
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00e46a',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'Sora', -apple-system, sans-serif",
                  padding: 0,
                  transition: 'color 0.2s, text-shadow 0.2s',
                  letterSpacing: '0.01em',
                }}
              >Sign in</button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
