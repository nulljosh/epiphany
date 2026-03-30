import { useState, useEffect, useRef } from 'react';
import './auth.css';

const FONT = "'Sora', -apple-system, BlinkMacSystemFont, sans-serif";

function NetworkCanvas() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    if (nodesRef.current.length === 0) {
      for (let i = 0; i < 40; i++) {
        nodesRef.current.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
          r: Math.random() * 1.2 + 0.4,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const nodes = nodesRef.current;
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = `rgba(0,228,106,${(1 - dist / 120) * 0.06})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = 'rgba(0,228,106,0.12)';
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.6, pointerEvents: 'none' }} />;
}

const label = { display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' };
const card = { background: 'rgba(255,255,255,0.025)', borderRadius: 20, padding: '36px 32px 32px', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(40px)', boxShadow: '0 4px 60px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.04) inset' };
const errorBox = { color: '#ff5555', fontSize: 13, marginBottom: 20, padding: '10px 14px', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.12)', borderRadius: 10 };

function fadeStyle(mounted, delay = 0) {
  return { animation: mounted ? `authFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both` : 'none', opacity: mounted ? undefined : 0 };
}

export default function LoginPage({ onLogin, onSwitchToRegister, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    <div style={{ minHeight: '100vh', background: '#060a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <NetworkCanvas />
      <div style={{ position: 'absolute', top: '35%', left: '50%', width: 700, height: 700, transform: 'translate(-50%, -50%)', background: 'radial-gradient(circle, rgba(0,228,106,0.04) 0%, transparent 70%)', animation: 'authPulse 6s ease-in-out infinite', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36, ...fadeStyle(mounted, 0.05) }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 20px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,228,106,0.15), rgba(0,228,106,0.05))', border: '1px solid rgba(0,228,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#00e46a', lineHeight: 1 }}>M</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Monica</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Personal intelligence platform</p>
        </div>

        {/* Form */}
        <div style={{ ...card, ...fadeStyle(mounted, 0.12) }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="auth-input" placeholder="you@example.com" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="auth-input" placeholder="Min 8 characters" />
            </div>
            <div style={{ marginBottom: 28, textAlign: 'right' }}>
              <button type="button" onClick={() => { setForgotMode(true); setForgotMsg(''); setForgotEmail(email); }} className="auth-link">Forgot password?</button>
            </div>
            {error && <div style={errorBox}>{error}</div>}
            <button type="submit" disabled={submitting} className="auth-btn">{submitting ? 'Signing in...' : 'Sign In'}</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 24, marginBottom: 0, fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            No account? <button onClick={onSwitchToRegister} className="auth-link-accent">Create one</button>
          </p>
        </div>

        {/* Forgot password */}
        {forgotMode && (
          <div style={{ marginTop: 16, padding: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(30px)', animation: 'authFadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
            <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 14px' }}>Reset Password</h3>
            {forgotMsg ? (
              <>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{forgotMsg}</p>
                <button onClick={() => setForgotMode(false)} className="auth-link-accent" style={{ marginTop: 14, fontSize: 12 }}>Back to login</button>
              </>
            ) : (
              <form onSubmit={handleForgot}>
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required placeholder="Your email address" className="auth-input-sm" style={{ marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={forgotSubmitting} className="auth-btn" style={{ borderRadius: 10, fontSize: 13, padding: 11 }}>{forgotSubmitting ? 'Sending...' : 'Send Reset Link'}</button>
                  <button type="button" onClick={() => setForgotMode(false)} style={{ padding: '11px 18px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 13, fontFamily: FONT, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 10, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em', textTransform: 'uppercase', ...fadeStyle(mounted, 0.25) }}>v3.5.2</div>
      </div>
    </div>
  );
}
