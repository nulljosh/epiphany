import { useState } from 'react';

export default function ResetPasswordPage({ token, onBack }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [resetName, setResetName] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth?action=reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Reset failed');
      } else {
        setMessage(data.message || 'Password reset successfully.');
        setResetName(data.name || '');
        setDone(true);
      }
    } catch {
      setError('Something went wrong. Try again.');
    }
    setSubmitting(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
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
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, marginTop: 0 }}>
          Reset Password
        </h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 32, marginTop: 0 }}>
          Enter your new password
        </p>

        {done ? (
          <>
            {resetName && <p style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Hi {resetName}</p>}
            <p style={{ color: '#00d46a', fontSize: 14 }}>{message}</p>
            <button
              onClick={onBack}
              style={{
                width: '100%',
                padding: 14,
                background: '#00d46a',
                color: '#000',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: 16,
              }}
            >Back to Login</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={inputStyle}
                placeholder="Min 8 characters"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                style={inputStyle}
                placeholder="Confirm password"
              />
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
            >{submitting ? 'Resetting...' : 'Reset Password'}</button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#666' }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00d46a',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: 0,
                }}
              >Back to login</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
