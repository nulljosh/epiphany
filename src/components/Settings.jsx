import { useState, useEffect, useRef, useCallback } from 'react';
import { SYSTEM_FONT as font } from '../utils/formatting';
import { fileToBase64 } from '../utils/helpers';

const BASE_NAV = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'tally', label: 'Tally' },
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

export default function Settings({ dark, setDark, t, mapLayers, setMapLayers, tickerVisible, setTickerVisible, user, logout, subscription, changeName, changeEmail, changePassword, refreshUser }) {
  const [section, setSection] = useState('account');
  const devMode = typeof localStorage !== 'undefined' && !!localStorage.getItem('epiphany_dev');
  const NAV_ITEMS = devMode ? [...BASE_NAV, { id: 'map', label: 'Map Layers' }] : BASE_NAV;

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

  const [tallyConnected, setTallyConnected] = useState(false);
  const [tallyUsername, setTallyUsername] = useState('');
  const [tallyPassword, setTallyPassword] = useState('');
  const [tallyConnecting, setTallyConnecting] = useState(false);
  const [tallyMsg, setTallyMsg] = useState(null);
  useEffect(() => {
    fetch('/api/tally?action=status').then(r => r.json()).then(d => setTallyConnected(d.connected)).catch(() => {});
  }, []);

  const handleTallyConnect = async () => {
    setTallyConnecting(true); setTallyMsg(null);
    try {
      const res = await fetch('/api/tally?action=connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: tallyUsername, password: tallyPassword }) });
      const d = await res.json();
      if (!res.ok) { setTallyMsg({ error: true, text: d.error || 'Connection failed' }); }
      else { setTallyConnected(true); setTallyUsername(''); setTallyPassword(''); setTallyMsg({ error: false, text: 'Connected to Tally' }); }
    } catch { setTallyMsg({ error: true, text: 'Network error' }); }
    setTallyConnecting(false);
  };

  const handleTallyDisconnect = async () => {
    await fetch('/api/tally?action=disconnect', { method: 'POST' });
    setTallyConnected(false); setTallyMsg(null);
  };

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);
  const avatarMsgTimerRef = useRef(null);
  const [avatarVersion, setAvatarVersion] = useState(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(null);
  const [imgError, setImgError] = useState(false);
  const baseAvatarUrl = localAvatarUrl || user?.avatarUrl;
  const avatarUrl = baseAvatarUrl ? `${baseAvatarUrl}?v=${avatarVersion || user?.avatarUpdatedAt || '1'}` : null;
  useEffect(() => { setImgError(false); }, [avatarUrl]);

  const generateNodeGraphSVG = () => {
    const r = () => Math.random();
    const palettes = [
      ['#5b8fc9','#7aabde','#3a6fa8'], ['#7aab7a','#5a9e5a','#a8d4a8'],
      ['#c96b6b','#e08080','#a84444'], ['#9b7ac9','#b89de0','#7a5aa8'],
      ['#c8913a','#e0b060','#a87020'], ['#5bc9c9','#3aa8a8','#80dede'],
      ['#c96ba8','#e080c0','#a84480'], ['#c9c96b','#e0d840','#a8a830'],
    ];
    const palette = palettes[Math.floor(r() * palettes.length)];
    const styles = ['scatter','radial','chain','layered','cluster'];
    const style = styles[Math.floor(r() * styles.length)];
    const nodeCount = 5 + Math.floor(r() * 7);
    const cx = 100, cy = 100;
    let nodes = [];
    if (style === 'radial') {
      nodes.push([cx, cy]);
      for (let i = 1; i < nodeCount; i++) {
        const a = (i / (nodeCount - 1)) * Math.PI * 2 + r() * 0.5;
        const d = 28 + r() * 38;
        nodes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
      }
    } else if (style === 'chain') {
      let x = 40 + r() * 20, y = 55 + r() * 20;
      for (let i = 0; i < nodeCount; i++) {
        nodes.push([Math.max(32, Math.min(168, x)), Math.max(32, Math.min(168, y))]);
        x += 14 + r() * 18; y += (r() - 0.5) * 44;
      }
    } else if (style === 'layered') {
      const rows = [Math.ceil(nodeCount / 3), Math.ceil(nodeCount / 3), nodeCount - 2 * Math.ceil(nodeCount / 3)];
      [55, 100, 145].forEach((yPos, l) => {
        const n = Math.max(1, rows[l]);
        for (let i = 0; i < n; i++) nodes.push([(200 / (n + 1)) * (i + 1) + (r() - 0.5) * 14, yPos + (r() - 0.5) * 14]);
      });
    } else if (style === 'cluster') {
      const cc = Array.from({ length: 2 + Math.floor(r() * 2) }, () => [45 + r() * 110, 45 + r() * 110]);
      for (let i = 0; i < nodeCount; i++) { const c = cc[i % cc.length]; nodes.push([c[0] + (r() - 0.5) * 36, c[1] + (r() - 0.5) * 36]); }
    } else {
      for (let i = 0; i < nodeCount; i++) { const a = r() * Math.PI * 2, d = r() * 68; nodes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
    }
    nodes = nodes.map(([x, y]) => [Math.max(28, Math.min(172, x)), Math.max(28, Math.min(172, y))]);
    const edges = [];
    for (let i = 1; i < nodes.length; i++) {
      let near = 0, minD = Infinity;
      for (let j = 0; j < i; j++) { const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]); if (d < minD) { minD = d; near = j; } }
      edges.push([i, near]);
    }
    const extras = Math.floor(r() * nodeCount * 0.8);
    for (let k = 0; k < extras; k++) {
      const a = Math.floor(r() * nodes.length), b = Math.floor(r() * nodes.length);
      if (a !== b && !edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) edges.push([a, b]);
    }
    const sw = (1 + r() * 1.5).toFixed(1);
    const so = (0.15 + r() * 0.28).toFixed(2);
    const bgs = ['#0f0f0f','#0d1520','#120d0d','#0d1210','#12100d'];
    const bg = bgs[Math.floor(r() * bgs.length)];
    const multiColor = r() > 0.35;
    const edgeSvg = edges.map(([a, b]) =>
      `<line x1="${nodes[a][0].toFixed(1)}" y1="${nodes[a][1].toFixed(1)}" x2="${nodes[b][0].toFixed(1)}" y2="${nodes[b][1].toFixed(1)}" stroke="rgba(255,255,255,${so})" stroke-width="${sw}"/>`
    ).join('');
    const nodeSvg = nodes.map(([x, y], i) =>
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3.5 + r() * 7).toFixed(1)}" fill="${multiColor ? palette[i % palette.length] : palette[0]}"/>`
    ).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><circle cx="100" cy="100" r="100" fill="${bg}"/>${edgeSvg}${nodeSvg}</svg>`;
  };

  const showAvatarMsg = useCallback((msg) => {
    if (avatarMsgTimerRef.current) clearTimeout(avatarMsgTimerRef.current);
    setAvatarMsg(msg);
    avatarMsgTimerRef.current = setTimeout(() => setAvatarMsg(null), 3000);
  }, []);

  const handleGenerateAvatar = async () => {
    const svg = generateNodeGraphSVG();
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    setLocalAvatarUrl(dataUrl);
    setAvatarVersion(Date.now());
    setAvatarUploading(true);
    try {
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      const res = await fetch('/api/avatar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, format: 'svg' }) });
      const data = await res.json();
      if (data.ok && data.avatarUrl) { setLocalAvatarUrl(data.avatarUrl); showAvatarMsg({ text: 'Saved', error: false }); }
      else showAvatarMsg({ text: data.error || 'Failed', error: true });
    } catch { showAvatarMsg({ text: 'Failed', error: true }); }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div onClick={handleGenerateAvatar} style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: t.glass, border: `2px solid ${t.border}`, cursor: avatarUploading ? 'wait' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: avatarUploading ? 0.6 : 1 }} title="Click to generate new avatar">
                {avatarUrl && !imgError ? <img key={avatarVersion} src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} /> : null}
                {(!avatarUrl || imgError) ? <span style={{ fontSize: 20, color: t.textTertiary }}>{(user.name || user.email)?.[0]?.toUpperCase() || '?'}</span> : null}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: font }}>{user.name || user.email}</div>
                <div style={{ fontSize: 11, color: avatarMsg ? (avatarMsg.error ? '#ef4444' : t.green) : t.textTertiary, marginTop: 2 }}>
                  {avatarUploading ? 'Uploading...' : avatarMsg ? avatarMsg.text : 'Click to generate avatar'}
                </div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: tierColor, background: `${tierColor}18`, padding: '2px 8px', borderRadius: 999 }}>{tierLabel}</span>
            </div>

            <Row label="Display name" t={t}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ ...inputStyle, width: 140 }} onKeyDown={e => e.key === 'Enter' && handleNameSave()} />
              <button onClick={handleNameSave} disabled={nameSaving} style={btnStyle(true)}>{nameSaving ? '...' : 'Save'}</button>
            </Row>
            {nameMsg && <div style={msgStyle(nameMsg.error)}>{nameMsg.text}</div>}

            {setTickerVisible && (
              <Row label="Show ticker" t={t}>
                <button
                  onClick={() => setTickerVisible(v => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0,
                    background: tickerVisible ? '#30D158' : t.border, position: 'relative',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10,
                    background: '#fff', transition: 'left 0.2s ease',
                    left: tickerVisible ? 22 : 2,
                  }} />
                </button>
              </Row>
            )}

            <div style={{ marginTop: 24 }}>
              <button onClick={logout} style={{ ...btnStyle(false), color: '#ef4444', borderColor: '#ef444433' }}>Sign Out</button>
            </div>
          </>
        )}

        {section === 'security' && user && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 }}>Account Security</div>

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
          </>
        )}

        {section === 'tally' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 }}>BC Self-Serve</div>
            {tallyConnected ? (
              <>
                <Row label="Status" t={t}><span style={{ fontSize: 12, color: '#30d158', fontFamily: font }}>Connected</span></Row>
                <div style={{ marginTop: 16 }}>
                  <button onClick={handleTallyDisconnect} style={{ ...btnStyle(false), color: '#ef4444', borderColor: '#ef444433' }}>Disconnect</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 8px' }}>Connect your Tally account to see payment info in your portfolio.</p>
                <input value={tallyUsername} onChange={e => setTallyUsername(e.target.value)} placeholder="Username" autoCapitalize="none" style={inputStyle} />
                <input type="password" value={tallyPassword} onChange={e => setTallyPassword(e.target.value)} placeholder="Password" style={inputStyle} />
                <button onClick={handleTallyConnect} disabled={tallyConnecting || !tallyUsername || !tallyPassword} style={btnStyle(true)}>{tallyConnecting ? '...' : 'Connect'}</button>
                {tallyMsg && <div style={msgStyle(tallyMsg.error)}>{tallyMsg.text}</div>}
              </div>
            )}
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
            <Row label="Version" t={t}><span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>v1.1.0</span></Row>
            <Row label="Name" t={t}><span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>Epiphany</span></Row>
          </>
        )}
      </div>
    </div>
  );
}
