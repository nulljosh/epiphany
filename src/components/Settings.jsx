import { useState, useEffect } from 'react';
import { Card } from './ui';

export default function Settings({ dark, setDark, t, mapLayers, setMapLayers, user, logout, subscription, changeName, changeEmail, changePassword }) {
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 };

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

  const toggleStyle = (enabled) => ({
    borderRadius: 999,
    border: `1px solid ${enabled ? 'transparent' : t.border}`,
    background: enabled ? t.text : t.glass,
    color: enabled ? t.bg : t.textSecondary,
    padding: '6px 14px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font,
    boxShadow: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  });

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: font,
    background: t.glass,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const smallBtnStyle = {
    ...toggleStyle(true),
    padding: '5px 12px',
    fontSize: 10,
  };

  const msgStyle = (isError) => ({
    fontSize: 11,
    color: isError ? '#ef4444' : t.green,
    marginTop: 6,
  });

  const handleNameSave = async () => {
    if (!name.trim() || name === user?.name) return;
    setNameSaving(true);
    setNameMsg(null);
    const result = await changeName(name.trim());
    setNameSaving(false);
    setNameMsg(result.ok ? { text: 'Saved', error: false } : { text: result.error, error: true });
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !emailPassword) return;
    setEmailSaving(true);
    setEmailMsg(null);
    const result = await changeEmail(newEmail.trim(), emailPassword);
    setEmailSaving(false);
    if (result.ok) {
      setEmailMsg({ text: 'Email updated', error: false });
      setShowEmailForm(false);
      setNewEmail('');
      setEmailPassword('');
    } else {
      setEmailMsg({ text: result.error, error: true });
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPw || !newPw) return;
    if (newPw !== confirmPw) {
      setPwMsg({ text: 'Passwords do not match', error: true });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    const result = await changePassword(currentPw, newPw);
    setPwSaving(false);
    if (result.ok) {
      setPwMsg({ text: 'Password updated', error: false });
      setShowPasswordForm(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } else {
      setPwMsg({ text: result.error, error: true });
    }
  };

  const tierLabel = subscription?.plan === 'pro' ? 'Pro' : subscription?.plan === 'starter' ? 'Starter' : 'Free';
  const tierColor = subscription?.plan === 'pro' ? '#8b5cf6' : subscription?.plan === 'starter' ? '#0071e3' : t.textTertiary;

  return (
    <div style={{ padding: '16px' }}>
      {user && (
        <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={labelStyle}>Account</div>


          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: font }}>{user.email}</div>
              <div style={{
                display: 'inline-block',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: tierColor,
                background: `${tierColor}18`,
                padding: '2px 8px',
                borderRadius: 999,
                marginTop: 4,
              }}>
                {tierLabel}
              </div>
            </div>
          </div>


          <div style={{ marginBottom: 12 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Full Name</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              />
              <button onClick={handleNameSave} disabled={nameSaving} style={smallBtnStyle}>
                {nameSaving ? '...' : 'Save'}
              </button>
            </div>
            {nameMsg && <div style={msgStyle(nameMsg.error)}>{nameMsg.text}</div>}
          </div>


          <div style={{ marginBottom: 12 }}>
            {!showEmailForm ? (
              <button onClick={() => setShowEmailForm(true)} style={{ ...toggleStyle(false), fontSize: 10, padding: '4px 10px' }}>
                Change Email
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ ...labelStyle, marginBottom: 2 }}>New Email</div>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" style={inputStyle} />
                <input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Current password" style={inputStyle} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleEmailChange} disabled={emailSaving} style={smallBtnStyle}>
                    {emailSaving ? '...' : 'Update'}
                  </button>
                  <button onClick={() => { setShowEmailForm(false); setEmailMsg(null); }} style={{ ...toggleStyle(false), padding: '5px 12px', fontSize: 10 }}>
                    Cancel
                  </button>
                </div>
                {emailMsg && <div style={msgStyle(emailMsg.error)}>{emailMsg.text}</div>}
              </div>
            )}
          </div>


          <div style={{ marginBottom: 12 }}>
            {!showPasswordForm ? (
              <button onClick={() => setShowPasswordForm(true)} style={{ ...toggleStyle(false), fontSize: 10, padding: '4px 10px' }}>
                Change Password
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ ...labelStyle, marginBottom: 2 }}>Change Password</div>
                <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" style={inputStyle} />
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password" style={inputStyle} />
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" style={inputStyle} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handlePasswordChange} disabled={pwSaving} style={smallBtnStyle}>
                    {pwSaving ? '...' : 'Update'}
                  </button>
                  <button onClick={() => { setShowPasswordForm(false); setPwMsg(null); }} style={{ ...toggleStyle(false), padding: '5px 12px', fontSize: 10 }}>
                    Cancel
                  </button>
                </div>
                {pwMsg && <div style={msgStyle(pwMsg.error)}>{pwMsg.text}</div>}
              </div>
            )}
          </div>

          <button
            onClick={logout}
            style={{
              ...toggleStyle(false),
              color: '#ef4444',
              borderColor: '#ef444433',
              width: '100%',
            }}
          >
            Sign Out
          </button>
        </Card>
      )}

      <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={labelStyle}>Map Layers</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(mapLayers).map(([key, enabled]) => (
            <button
              key={key}
              aria-pressed={enabled}
              aria-label={`Toggle ${key} layer`}
              onClick={() => setMapLayers(prev => ({ ...prev, [key]: !prev[key] }))}
              style={toggleStyle(enabled)}
            >
              {key}
            </button>
          ))}
        </div>
      </Card>

      <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={labelStyle}>Appearance</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            aria-pressed={!dark}
            onClick={() => { localStorage.setItem('monica_theme', 'light'); setDark(false); }}
            style={toggleStyle(!dark)}
          >
            Light
          </button>
          <button
            aria-pressed={dark}
            onClick={() => { localStorage.setItem('monica_theme', 'dark'); setDark(true); }}
            style={toggleStyle(dark)}
          >
            Dark
          </button>
        </div>
      </Card>

      <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={labelStyle}>About</div>
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          Monica v3.0.0
        </div>
      </Card>
    </div>
  );
}
