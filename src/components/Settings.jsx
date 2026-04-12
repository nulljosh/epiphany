import { useState, useEffect, useRef } from 'react';
import { SYSTEM_FONT as font } from '../utils/formatting';
import { fileToBase64 } from '../utils/helpers';

const NAV_ITEMS = [
  { id: 'account', label: 'Account' },
  { id: 'map', label: 'Map Layers' },
  { id: 'about', label: 'About' },
];

function Row({ label, children, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
      <span style={{ fontSize: 13, color: t.text, fontFamily: font }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  );
}

export default function Settings({ dark, setDark, t, mapLayers, setMapLayers, user, logout, subscription, changeName, changeEmail, changePassword, refreshUser }) {
  const [section, setSection] = useState('account');

  const [name, setName] = useState(user?.name || '');
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState(null);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  useEffect(() => {
    if (refreshUser) refreshUser();
  }, []);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);
  const avatarUrl = user?.avatarUrl ? `${user.avatarUrl}?v=${user.avatarUpdatedAt || '1'}` : null;

  const generateBitmapAvatar = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const palettes = [
      ['#e63946','#457b9d','#1d3557','#f1faee','#a8dadc'],
      ['#7b2d8b','#c77dff','#e0aaff','#10002b','#240046'],
      ['#0077b6','#00b4d8','#90e0ef','#caf0f8','#03045e'],
      ['#d62828','#f77f00','#fcbf49','#eae2b7','#003049'],
      ['#2d6a4f','#52b788','#b7e4c7','#d8f3dc','#1b4332'],
    ];
    const palette = palettes[Math.floor(Math.random() * palettes.length)];
    // Fill background
    ctx.fillStyle = palette[3];
    ctx.fillRect(0, 0, 64, 64);
    // Symmetric 4x4 tile pattern (mirrored left-right)
    const tileSize = 8;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        if (Math.random() > 0.45) {
          ctx.fillStyle = palette[Math.floor(Math.random() * 3)];
          ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
          ctx.fillRect((7 - col) * tileSize, row * tileSize, tileSize, tileSize);
        }
      }
    }
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleGenerateAvatar = async () => {
    setAvatarUploading(true);
    setAvatarMsg(null);
    try {
      const base64 = generateBitmapAvatar();
      const res = await fetch('/api/avatar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64 }) });
      const data = await res.json();
      if (data.ok && data.avatarUrl) { setAvatarMsg({ text: 'New avatar generated', error: false }); if (refreshUser) refreshUser(); }
      else setAvatarMsg({ text: data.error || 'Failed', error: true });
    } catch { setAvatarMsg({ text: 'Failed', error: true }); }
    finally { setAvatarUploading(false); }
  };

  const handleNameSave = async () => {
    if (!name.trim() || name === user?.name) return;
    setNameSaving(true); setNameMsg(null);
    const result = await changeName(name.trim());
    setNameSaving(false);
    setNameMsg(result.ok ? { text: 'Saved', error: false } : { text: result.error, error: true });
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !emailPassword) return;
    setEmailSaving(true); setEmailMsg(null);
    const result = await changeEmail(newEmail.trim(), emailPassword);
    setEmailSaving(false);
    if (result.ok) { setEmailMsg({ text: 'Email updated', error: false }); setShowEmailForm(false); setNewEmail(''); setEmailPassword(''); }
    else setEmailMsg({ text: result.error, error: true });
  };

  const handlePasswordChange = async () => {
    if (!currentPw || !newPw) return;
    if (newPw !== confirmPw) { setPwMsg({ text: 'Passwords do not match', error: true }); return; }
    setPwSaving(true); setPwMsg(null);
    const result = await changePassword(currentPw, newPw);
    setPwSaving(false);
    if (result.ok) { setPwMsg({ text: 'Password updated', error: false }); setShowPasswordForm(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    else setPwMsg({ text: result.error, error: true });
  };

  const tierLabel = subscription?.plan === 'pro' ? 'Pro' : subscription?.plan === 'starter' ? 'Starter' : 'Free';
  const tierColor = subscription?.plan === 'pro' ? '#8b5cf6' : subscription?.plan === 'starter' ? '#0071e3' : t.textTertiary;

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 12, fontFamily: font, background: t.glass, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, outline: 'none', boxSizing: 'border-box' };
  const btnStyle = (primary) => ({ padding: '6px 12px', fontSize: 11, fontWeight: 600, fontFamily: font, background: primary ? t.text : 'transparent', color: primary ? t.bg : t.textSecondary, border: `1px solid ${primary ? 'transparent' : t.border}`, borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' });
  const msgStyle = (isError) => ({ fontSize: 11, color: isError ? '#ef4444' : t.green, marginTop: 4 });

  const navStyle = (active) => ({
    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, fontFamily: font,
    fontWeight: active ? 600 : 400, color: active ? t.text : t.textSecondary,
    background: active ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent',
    border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Sidebar */}
      <div style={{ width: 140, flexShrink: 0, padding: '16px 8px', borderRight: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, padding: '0 12px', marginBottom: 8 }}>Settings</div>
        {NAV_ITEMS.map(item => (
          <button key={item.id} style={navStyle(section === item.id)} onClick={() => setSection(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>

        {section === 'account' && user && (
          <>
            {/* Avatar + identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div onClick={handleGenerateAvatar} style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: t.glass, border: `2px solid ${t.border}`, cursor: avatarUploading ? 'wait' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: avatarUploading ? 0.6 : 1 }} title="Click to generate new avatar">
                {avatarUrl ? <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} /> : null}
                <span style={{ fontSize: 20, color: t.textTertiary, display: avatarUrl ? 'none' : 'block' }}>{(user.name || user.email)?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: font }}>{user.name || user.email}</div>
                <div style={{ fontSize: 11, color: avatarMsg ? (avatarMsg.error ? '#ef4444' : t.green) : t.textTertiary, marginTop: 2 }}>
                  {avatarUploading ? 'Generating...' : avatarMsg ? avatarMsg.text : 'Click to generate avatar'}
                </div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: tierColor, background: `${tierColor}18`, padding: '2px 8px', borderRadius: 999 }}>{tierLabel}</span>
            </div>

            <Row label="Email" t={t}>
              <span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>{user.email}</span>
              <button style={btnStyle(false)} onClick={() => setShowEmailForm(!showEmailForm)}>Change</button>
            </Row>
            {showEmailForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="New email" style={inputStyle} />
                <input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} placeholder="Current password" style={inputStyle} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleEmailChange} disabled={emailSaving} style={btnStyle(true)}>{emailSaving ? '...' : 'Update'}</button>
                  <button onClick={() => { setShowEmailForm(false); setEmailMsg(null); }} style={btnStyle(false)}>Cancel</button>
                </div>
                {emailMsg && <div style={msgStyle(emailMsg.error)}>{emailMsg.text}</div>}
              </div>
            )}

            <Row label="Display name" t={t}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ ...inputStyle, width: 140 }} onKeyDown={e => e.key === 'Enter' && handleNameSave()} />
              <button onClick={handleNameSave} disabled={nameSaving} style={btnStyle(true)}>{nameSaving ? '...' : 'Save'}</button>
            </Row>
            {nameMsg && <div style={msgStyle(nameMsg.error)}>{nameMsg.text}</div>}

            <Row label="Password" t={t}>
              <button style={btnStyle(false)} onClick={() => setShowPasswordForm(!showPasswordForm)}>Change</button>
            </Row>
            {showPasswordForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" style={inputStyle} />
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" style={inputStyle} />
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" style={inputStyle} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handlePasswordChange} disabled={pwSaving} style={btnStyle(true)}>{pwSaving ? '...' : 'Update'}</button>
                  <button onClick={() => { setShowPasswordForm(false); setPwMsg(null); }} style={btnStyle(false)}>Cancel</button>
                </div>
                {pwMsg && <div style={msgStyle(pwMsg.error)}>{pwMsg.text}</div>}
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <button onClick={logout} style={{ ...btnStyle(false), color: '#ef4444', borderColor: '#ef444433' }}>Sign Out</button>
            </div>
          </>
        )}

        {section === 'map' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 }}>Visible layers</div>
            {Object.entries(mapLayers).map(([key, enabled]) => (
              <Row key={key} label={key} t={t}>
                <button
                  aria-pressed={enabled}
                  onClick={() => setMapLayers(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: enabled ? '#0071e3' : t.border, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                </button>
              </Row>
            ))}
          </>
        )}

        {section === 'about' && (
          <>
            <Row label="Version" t={t}><span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>v1.0.0-beta</span></Row>
            <Row label="Name" t={t}><span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>Epiphany</span></Row>
          </>
        )}
      </div>
    </div>
  );
}
