import { useState } from 'react';

export default function LoginPage({ onLogin, onSwitchToRegister, error, theme: t }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onLogin(email, password);
    setSubmitting(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotSubmitting(true);
    try {
      const res = await fetch('/api/auth?action=forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      setForgotMsg(data.message || 'Check your email for a reset link.');
    } catch {
      setForgotMsg('Something went wrong. Try again.');
    }
    setForgotSubmitting(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#111',
        borderRadius: 16,
        padding: 40,
        border: '1px solid #222',
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 8,
          marginTop: 0,
        }}>Opticon</h1>
        <p style={{
          fontSize: 14,
          color: '#888',
          marginBottom: 32,
          marginTop: 0,
        }}>Sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
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

          <div style={{ marginBottom: 12 }}>
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
          <div style={{ marginBottom: 24, textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => { setForgotMode(true); setForgotMsg(''); setForgotEmail(email); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
              }}
            >Forgot password?</button>
          </div>

          {error && (
            <div style={{
              color: '#ff4444',
              fontSize: 13,
              marginBottom: 16,
              padding: '8px 12px',
              background: 'rgba(255,68,68,0.1)',
              borderRadius: 6,
            }}>{error}</div>
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
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 13,
          color: '#666',
        }}>
          No account?{' '}
          <button
            onClick={onSwitchToRegister}
            style={{
              background: 'none',
              border: 'none',
              color: '#00d46a',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
            }}
          >Create one</button>
        </p>

        {forgotMode && (
          <div style={{
            marginTop: 24,
            padding: 20,
            background: '#0a0a0a',
            borderRadius: 10,
            border: '1px solid #333',
          }}>
            <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 12px' }}>Reset Password</h3>
            {forgotMsg ? (
              <>
                <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>{forgotMsg}</p>
                <button
                  onClick={() => setForgotMode(false)}
                  style={{
                    marginTop: 12,
                    background: 'none',
                    border: 'none',
                    color: '#00d46a',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: 0,
                  }}
                >Back to login</button>
              </>
            ) : (
              <form onSubmit={handleForgot}>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  placeholder="Your email address"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#111',
                    border: '1px solid #333',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: 12,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    style={{
                      flex: 1,
                      padding: 10,
                      background: '#00d46a',
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: forgotSubmitting ? 'not-allowed' : 'pointer',
                      opacity: forgotSubmitting ? 0.6 : 1,
                    }}
                  >{forgotSubmitting ? 'Sending...' : 'Send Reset Link'}</button>
                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    style={{
                      padding: '10px 16px',
                      background: '#222',
                      color: '#888',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
