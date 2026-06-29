import { useState } from 'react';
import { SYSTEM_FONT as font } from '../utils/formatting';

const VERSION = '2.6.0';
const KEY = 'epiphany_whats_new_seen';

export default function WhatsNew({ t }) {
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) !== VERSION);
  const dismiss = () => { localStorage.setItem(KEY, VERSION); setOpen(false); };
  if (!open) return null;
  return (
    <div onClick={dismiss} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.cardBg || t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: '28px 32px', maxWidth: 360, width: '90%', fontFamily: font, position: 'relative' }}>
        <button onClick={dismiss} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: t.textSecondary, fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: t.text }}>What's New in v{VERSION}</div>
        <ul style={{ paddingLeft: 18, lineHeight: 1.8, marginBottom: 20, color: t.textSecondary, fontSize: 13 }}>
          <li>Now on the App Store</li>
          <li>GitHub Sign In / Sign Up</li>
          <li>People tab live</li>
          <li>Terms of Service on registration</li>
        </ul>
        <button onClick={dismiss} style={{ width: '100%', padding: '10px 0', background: t.accent || '#00d4ff', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: font }}>Got it</button>
      </div>
    </div>
  );
}
