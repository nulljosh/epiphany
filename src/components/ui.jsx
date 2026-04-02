import { useState, useEffect, useCallback } from 'react';

// Inject keyframes for animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes scroll {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-50%, 0, 0); }
  }
  * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .rise-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 768px) {
    .rise-grid {
      grid-template-columns: 1fr;
    }
  }
`;
if (!document.head.querySelector('#bloomberg-animations')) {
  styleSheet.id = 'bloomberg-animations';
  document.head.appendChild(styleSheet);
}

// Bloomberg-style blinking indicators
export const BlinkingDot = ({ color, delay = 0, speed = 2 }) => (
  <span style={{
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: color,
    animation: `blink ${speed}s ease-in-out ${delay}s infinite`,
    border: `1px solid ${color}`,
  }} />
);

export const StatusBar = ({ t, reliability }) => {
  const status = reliability?.status || 'live';
  const cfg = status === 'loading'
    ? { label: 'LOADING', color: t.textSecondary }
    : status === 'stale'
    ? { label: 'STALE', color: '#ff6b6b' }
    : status === 'fallback'
      ? { label: 'FALLBACK', color: '#f5a623' }
      : { label: 'LIVE', color: t.green };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
      <BlinkingDot color={cfg.color} delay={0} speed={3} />
      <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
    </div>
  );
};

// Mobile hamburger menu - glass dropdown overlay

export const MobileMenu = ({ t, font, children, buttonStyle }) => {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Menu"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 6,
          padding: '5px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...buttonStyle,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round">
          {open
            ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            : <><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></>
          }
        </svg>
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 180,
            background: t.glass,
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: '8px 0',
            zIndex: 999,
            fontFamily: font,
          }}>
            {/* Wrap children to auto-close on click */}
            <div onClick={close}>
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const MobileMenuItem = ({ t, font, onClick, style, children }) => (
  <button
    onClick={onClick}
    style={{
      display: 'block',
      width: '100%',
      background: 'none',
      border: 'none',
      padding: '10px 16px',
      color: t.textSecondary,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: font,
      cursor: 'pointer',
      textAlign: 'left',
      ...style,
    }}
  >
    {children}
  </button>
);

export const MobileMenuDivider = ({ t }) => (
  <div style={{ height: 1, background: t.border, margin: '4px 0' }} />
);

export const Card = ({ children, style, onClick, dark, t }) => (
  <div onClick={onClick} style={{
    background: t.glass,
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    borderRadius: 20,
    border: `0.5px solid ${t.border}`,
    boxShadow: 'none',
    cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    ...style
  }}>{children}</div>
);
