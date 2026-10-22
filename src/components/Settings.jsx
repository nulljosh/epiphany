import { useState, useEffect, useRef, useCallback } from 'react';
import { SYSTEM_FONT as font } from '../utils/formatting';
import { fileToBase64 } from '../utils/helpers';
import { usePremium, showPricing } from '../context/PremiumContext.js';

const BASE_NAV = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'brokerage', label: 'Brokerage' },
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

  // Read-only brokerage sync via SnapTrade. One button: registers the user, opens the
  // hosted connection portal if nothing is linked, otherwise pulls holdings + cash.
  const isPro = usePremium();
  const [brokerSyncing, setBrokerSyncing] = useState(false);
  const [brokerSnapshot, setBrokerSnapshot] = useState(null);
  const [brokerMsg, setBrokerMsg] = useState(null);

  const [brokerDisconnecting, setBrokerDisconnecting] = useState(false);
  const handleBrokerDisconnect = async (connectionId) => {
    if (!window.confirm('Disconnect this brokerage? Holdings will stop syncing.')) return;
    setBrokerDisconnecting(true); setBrokerMsg(null);
    try {
      const res = await fetch('/api/broker/disconnect', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId }) });
      const d = await res.json();
      if (d.ok) { setBrokerSnapshot(null); setBrokerMsg({ error: false, text: 'Brokerage disconnected' }); }
      else setBrokerMsg({ error: true, text: d.error || 'Disconnect failed' });
    } catch { setBrokerMsg({ error: true, text: 'Network error' }); }
    setBrokerDisconnecting(false);
  };

  const handleBrokerSync = async ({ auto = false, force = false, action = null } = {}) => {
    // Free keeps one portfolio; linking another is Premium.
    if (action === 'connect-additional' && !isPro) { setBrokerMsg({ error: false, text: 'Connecting another brokerage is a Premium feature. $1, once.' }); showPricing(); return; }
    setBrokerSyncing(true); if (!auto) setBrokerMsg(null);
    try {
      const res = await fetch('/api/broker/sync', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force, ...(action ? { action } : {}) }) });
      const d = await res.json();
      if (d.upgradeRequired) {
        setBrokerMsg({ error: false, text: 'Connecting another brokerage is a Premium feature. Upgrade in Settings → Subscription.' });
      } else if (d.skipped) { if (!auto) setBrokerMsg({ error: false, text: 'Brokerage sync not configured yet' }); }
      else if (d.linkUrl) {
        // Auto-check on tab open must not pop the connection portal uninvited.
        if (!auto) {
          window.open(d.linkUrl, '_blank', 'noopener');
          setBrokerMsg({ error: false, text: 'Finish linking in the popup, then press Sync again' });
        }
      } else if (d.linked) {
        setBrokerSnapshot(d);
        setBrokerMsg({ error: false, text: `Synced ${new Date(d.syncedAt).toLocaleTimeString()}` });
      } else if (!auto) { setBrokerMsg({ error: true, text: d.error || 'Sync failed' }); }
    } catch { if (!auto) setBrokerMsg({ error: true, text: 'Network error' }); }
    setBrokerSyncing(false);
  };

  // "One and done": opening the Brokerage tab pulls status from the 25min KV
  // cache so connection state + holdings render without a click.
  useEffect(() => {
    if (section === 'brokerage' && !brokerSnapshot) handleBrokerSync({ auto: true });
  }, [section]);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);
  const avatarMsgTimerRef = useRef(null);
  const [avatarVersion, setAvatarVersion] = useState(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(null);
  const [imgError, setImgError] = useState(false);
  const baseAvatarUrl = localAvatarUrl || user?.avatarUrl;
  // Data URLs carry their own bytes, so a cache-buster would only corrupt the base64.
  const avatarUrl = !baseAvatarUrl ? null
    : baseAvatarUrl.startsWith('data:') ? baseAvatarUrl
    : `${baseAvatarUrl}?v=${avatarVersion || user?.avatarUpdatedAt || '1'}`;
  useEffect(() => { setImgError(false); }, [avatarUrl]);

  // 9 Greek gods from public-domain museum busts x 12 duotones = 108 avatars, served from /avatars/gods. Same set as iOS.
  const GODS = ['aphrodite', 'ares', 'artemis', 'athena', 'demeter', 'dionysus', 'hera', 'hermes', 'zeus'];
  const randomGodAvatar = () => `/avatars/gods/${GODS[Math.floor(Math.random() * GODS.length)]}-${Math.floor(Math.random() * 12)}.jpg`;

  const showAvatarMsg = useCallback((msg) => {
    if (avatarMsgTimerRef.current) clearTimeout(avatarMsgTimerRef.current);
    setAvatarMsg(msg);
    avatarMsgTimerRef.current = setTimeout(() => setAvatarMsg(null), 3000);
  }, []);

  const handleGenerateAvatar = async () => {
    const path = randomGodAvatar();
    setLocalAvatarUrl(path);
    setAvatarUploading(true);
    try {
      const bytes = new Uint8Array(await (await fetch(path)).arrayBuffer());
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      const res = await fetch('/api/avatar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: btoa(binary), format: 'jpeg' }) });
      const data = await res.json();
      if (data.ok && data.avatarUrl) { setLocalAvatarUrl(data.avatarUrl); setAvatarVersion(Date.now()); showAvatarMsg({ text: 'Saved', error: false }); }
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
  const tierColor = subscription?.plan === 'pro' ? '#C2A878' : subscription?.plan === 'starter' ? '#0071e3' : t.textTertiary;

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
    <div className="settings-shell" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Phones: the side list becomes a row of tabs on top so the form gets the full width. */}
      <style>{`@media (max-width: 640px) {
        .settings-shell { flex-direction: column !important; }
        .settings-side { width: auto !important; display: flex; gap: 4px; overflow-x: auto; padding: 8px 12px !important; border-right: none !important; border-bottom: 1px solid ${t.border}; }
        .settings-side .settings-side-title { display: none; }
        .settings-side button { width: auto !important; white-space: nowrap; flex-shrink: 0; }
      }`}</style>
      {/* Sidebar */}
      <div className="settings-side" style={{ width: 140, flexShrink: 0, padding: '16px 8px', borderRight: `1px solid ${t.border}` }}>
        <div className="settings-side-title" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, padding: '0 12px', marginBottom: 8 }}>Settings</div>
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
                {avatarUrl && !imgError ? <img key={avatarVersion} src={avatarUrl} alt="Profile" style={{ width: '78%', height: '78%', objectFit: 'contain' }} onError={() => setImgError(true)} /> : null}
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

            {/* Read-only API toggle hidden from Settings -- the endpoint still
                honours user.readOnlyApiEnabled, it's just not user-facing. */}
          </>
        )}

        {section === 'brokerage' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 }}>Read-only sync</div>
            <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 12px' }}>Link a brokerage through SnapTrade — you pick which one (Wealthsimple, Questrade, Interactive Brokers, and more) in the connection portal. Holdings auto-refresh every few minutes while the app is open.</p>
            {/* No manual "Sync now": the tab auto-syncs on open and FinancePanel
                polls every 5 min while visible. Only the connect action is manual. */}
            {!brokerSnapshot?.linked && (
              <button onClick={() => handleBrokerSync()} disabled={brokerSyncing} style={btnStyle(true)}>{brokerSyncing ? '...' : 'Connect brokerage'}</button>
            )}
            {brokerMsg && <div style={msgStyle(brokerMsg.error)}>{brokerMsg.text}</div>}
            {brokerSnapshot?.linked && (
              <div style={{ marginTop: 16 }}>
                {Array.from(new Map((brokerSnapshot.connections ?? []).map(c => [c.brokerName, c])).values()).map(c => (
                  <Row key={c.id} label={`Connected: ${c.brokerName}`} t={t}>
                    <button onClick={() => handleBrokerDisconnect(c.id)} disabled={brokerDisconnecting} style={{ ...btnStyle(false), color: '#ef4444', borderColor: '#ef444433' }}>{brokerDisconnecting ? '...' : 'Disconnect'}</button>
                  </Row>
                ))}
                <button onClick={() => handleBrokerSync({ action: 'connect-additional' })} disabled={brokerSyncing} style={{ ...btnStyle(false), marginTop: 8 }}>
                  {brokerSyncing ? '...' : 'Connect another brokerage'}
                </button>
                {/* Holdings live in Portfolio, not Settings. Connection state only here. */}
                <Row label="Last synced" t={t}>
                  <span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>{brokerSnapshot.syncedAt ? new Date(brokerSnapshot.syncedAt).toLocaleString() : '—'}</span>
                </Row>
                <Row label="Dividends, last 12 months" t={t}>
                  <span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>{(brokerSnapshot.dividends12m ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'CAD' })}</span>
                </Row>
                {(brokerSnapshot.activities ?? []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 6 }}>Recent activity</div>
                    {brokerSnapshot.activities.slice(0, 10).map((a, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.textSecondary, padding: '4px 0', borderBottom: `1px solid ${t.border}` }}>
                        <span>{a.date?.slice(0, 10)} {a.type.toLowerCase()} {a.symbol ?? ''}{a.units ? ` ×${Math.abs(a.units)}` : ''}</span>
                        <span>{Math.abs(a.amount).toLocaleString(undefined, { style: 'currency', currency: a.currency || 'CAD' })}</span>
                      </div>
                    ))}
                  </div>
                )}
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
            <Row label="Version" t={t}><span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>v1.7.0</span></Row>
            <Row label="Name" t={t}><span style={{ fontSize: 12, color: t.textSecondary, fontFamily: font }}>Epiphany</span></Row>
          </>
        )}
      </div>
    </div>
  );
}
