import { useState, useEffect, useRef } from 'react';

const GRID_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap');

@keyframes loginFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes loginPulse {
  0%, 100% { opacity: 0.03; }
  50% { opacity: 0.07; }
}
@keyframes loginGlow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
@keyframes loginShimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

.monica-login-input {
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
.monica-login-input::placeholder {
  color: rgba(255,255,255,0.2);
}
.monica-login-input:focus {
  border-color: rgba(0,228,106,0.4);
  background: rgba(255,255,255,0.05);
  box-shadow: 0 0 0 3px rgba(0,228,106,0.06), 0 0 20px rgba(0,228,106,0.04);
}

.monica-login-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #00e46a, #00c45a);
  color: #000;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  font-family: 'Sora', -apple-system, sans-serif;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, opacity 0.2s;
  position: relative;
  overflow: hidden;
}
.monica-login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 30px rgba(0,228,106,0.25), 0 2px 8px rgba(0,228,106,0.15);
}
.monica-login-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.985);
}
.monica-login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.monica-login-link {
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  font-size: 12px;
  font-family: 'Sora', -apple-system, sans-serif;
  padding: 0;
  transition: color 0.2s;
  letter-spacing: 0.01em;
}
.monica-login-link:hover {
  color: rgba(255,255,255,0.6);
}
.monica-login-link-accent {
  background: none;
  border: none;
  color: #00e46a;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Sora', -apple-system, sans-serif;
  padding: 0;
  transition: color 0.2s, text-shadow 0.2s;
  letter-spacing: 0.01em;
}
.monica-login-link-accent:hover {
  color: #33ff8a;
  text-shadow: 0 0 12px rgba(0,228,106,0.3);
}

.monica-forgot-input {
  width: 100%;
  padding: 11px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #f0f0f0;
  font-size: 13px;
  font-family: 'Sora', -apple-system, sans-serif;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.monica-forgot-input:focus {
  border-color: rgba(0,228,106,0.35);
}
`;

function NetworkCanvas({ width, height }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const nodeCount = 40;
    if (nodesRef.current.length === 0) {
      for (let i = 0; i < nodeCount; i++) {
        nodesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          r: Math.random() * 1.2 + 0.4,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const nodes = nodesRef.current;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      // connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.06;
            ctx.strokeStyle = `rgba(0,228,106,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        ctx.fillStyle = 'rgba(0,228,106,0.12)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.6,
        pointerEvents: 'none',
      }}
    />
  );
}

export default function LoginPage({ onLogin, onSwitchToRegister, error, theme: t }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

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

  const fadeStyle = (delay = 0) => ({
    animation: mounted ? `loginFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both` : 'none',
    opacity: mounted ? undefined : 0,
  });

  return (
    <>
      <style>{GRID_CSS}</style>
      <div style={{
        minHeight: '100vh',
        background: '#060a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background network */}
        <NetworkCanvas width={1920} height={1080} />

        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          width: 700,
          height: 700,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(0,228,106,0.04) 0%, transparent 70%)',
          animation: 'loginPulse 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Card */}
        <div style={{
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Logo + header */}
          <div style={{ textAlign: 'center', marginBottom: 36, ...fadeStyle(0.05) }}>
            {/* Logomark */}
            <div style={{
              width: 48,
              height: 48,
              margin: '0 auto 20px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(0,228,106,0.15), rgba(0,228,106,0.05))',
              border: '1px solid rgba(0,228,106,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <span style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#00e46a',
                lineHeight: 1,
              }}>M</span>
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
            }}>Personal intelligence platform</p>
          </div>

          {/* Form card */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            borderRadius: 20,
            padding: '36px 32px 32px',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(40px)',
            boxShadow: '0 4px 60px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
            ...fadeStyle(0.12),
          }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
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
                  className="monica-login-input"
                  placeholder="you@example.com"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
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
                  className="monica-login-input"
                  placeholder="Min 8 characters"
                />
              </div>

              <div style={{ marginBottom: 28, textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotMsg(''); setForgotEmail(email); }}
                  className="monica-login-link"
                >Forgot password?</button>
              </div>

              {error && (
                <div style={{
                  color: '#ff5555',
                  fontSize: 13,
                  marginBottom: 20,
                  padding: '10px 14px',
                  background: 'rgba(255,60,60,0.08)',
                  border: '1px solid rgba(255,60,60,0.12)',
                  borderRadius: 10,
                  letterSpacing: '0.01em',
                }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="monica-login-btn"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{
              textAlign: 'center',
              marginTop: 24,
              marginBottom: 0,
              fontSize: 13,
              color: 'rgba(255,255,255,0.25)',
            }}>
              No account?{' '}
              <button
                onClick={onSwitchToRegister}
                className="monica-login-link-accent"
              >Create one</button>
            </p>
          </div>

          {/* Forgot password modal */}
          {forgotMode && (
            <div style={{
              marginTop: 16,
              padding: 24,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(30px)',
              animation: 'loginFadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}>
              <h3 style={{
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                margin: '0 0 14px',
                letterSpacing: '-0.01em',
              }}>Reset Password</h3>
              {forgotMsg ? (
                <>
                  <p style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 13,
                    margin: 0,
                    lineHeight: 1.5,
                  }}>{forgotMsg}</p>
                  <button
                    onClick={() => setForgotMode(false)}
                    className="monica-login-link-accent"
                    style={{ marginTop: 14, fontSize: 12 }}
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
                    className="monica-forgot-input"
                    style={{ marginBottom: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="submit"
                      disabled={forgotSubmitting}
                      style={{
                        flex: 1,
                        padding: 11,
                        background: 'linear-gradient(135deg, #00e46a, #00c45a)',
                        color: '#000',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "'Sora', -apple-system, sans-serif",
                        cursor: forgotSubmitting ? 'not-allowed' : 'pointer',
                        opacity: forgotSubmitting ? 0.5 : 1,
                        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        letterSpacing: '0.01em',
                      }}
                    >{forgotSubmitting ? 'Sending...' : 'Send Reset Link'}</button>
                    <button
                      type="button"
                      onClick={() => setForgotMode(false)}
                      style={{
                        padding: '11px 18px',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.4)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        fontSize: 13,
                        fontFamily: "'Sora', -apple-system, sans-serif",
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                    >Cancel</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Version tag */}
          <div style={{
            textAlign: 'center',
            marginTop: 32,
            fontSize: 10,
            color: 'rgba(255,255,255,0.12)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            ...fadeStyle(0.25),
          }}>v3.5.1</div>
        </div>
      </div>
    </>
  );
}
