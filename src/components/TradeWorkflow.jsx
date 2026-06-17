import { useEffect, useMemo, useState } from 'react';
import { Card } from './ui';
import { formatCurrency } from '../utils/formatting';
import { generateRecommendations } from '../utils/recommendations';

const STEPS = ['Connect', 'Sync', 'Recommend', 'Review'];
const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

// Premium auto-trading controls. Self-contained: GET /api/broker/autopilot
// returns the pro flag, settings, and trade log; POST saves settings.
function AutopilotCard({ dark, t }) {
  const [state, setState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/broker/autopilot', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (alive) d.ok ? setState(d) : setErr(d.error || 'Failed to load'); })
      .catch(() => { if (alive) setErr('Failed to load autopilot'); });
    return () => { alive = false; };
  }, []);

  const save = async (patch) => {
    setSaving(true); setErr(null);
    try {
      const r = await fetch('/api/broker/autopilot', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state.settings, ...patch }),
      });
      const d = await r.json();
      if (d.ok) setState((s) => ({ ...s, settings: d.settings }));
      else setErr(d.error || 'Save failed');
    } catch { setErr('Network error'); }
    setSaving(false);
  };

  const label = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary };
  const pill = (active) => ({
    borderRadius: 999, border: `1px solid ${active ? 'transparent' : t.border}`,
    background: active ? t.text : t.glass, color: active ? t.bg : t.text,
    padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font,
  });

  const settings = state?.settings;
  const trades = (state?.trades || []).slice(0, 5);

  return (
    <Card dark={dark} t={t} style={{ marginTop: 24 }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={label}>Autopilot</div>
          {state?.pro && settings && (
            <button
              onClick={() => save({ enabled: !settings.enabled })}
              disabled={saving}
              style={pill(settings.enabled)}
            >
              {settings.enabled ? 'ON' : 'OFF'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
          Buys and sells for you every market morning at 9:30 ET through your linked
          brokerage — even when the app is closed.
        </div>

        {!state && !err && <div style={{ fontSize: 12, color: t.textTertiary }}>Loading…</div>}

        {state && !state.pro && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ fontSize: 12, color: t.textTertiary, marginBottom: 10 }}>🔒 Premium feature</div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('epiphany:show-pricing'))}
              style={{ ...pill(true), padding: '10px 20px', fontSize: 13 }}
            >
              Upgrade to Premium
            </button>
          </div>
        )}

        {state?.pro && settings && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={pill(true)}>Paper</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: t.textTertiary }}>Max / trade</span>
              <input
                type="number"
                defaultValue={settings.maxNotional}
                min={1}
                onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== settings.maxNotional) save({ maxNotional: v }); }}
                style={{ width: 72, padding: '5px 8px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.glass, color: t.text, fontSize: 12, fontFamily: font }}
              />
            </div>
            <div style={{ fontSize: 11, color: t.textTertiary, marginBottom: 10 }}>
              Paper trading only -- simulated fills, no real orders are placed.
            </div>
            {trades.length > 0 && (
              <>
                <div style={{ ...label, marginBottom: 4 }}>Recent auto-trades</div>
                {trades.map((tr, i) => (
                  <div key={`${tr.ts}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
                    <span>
                      <span style={{ fontWeight: 700, color: tr.side === 'buy' ? t.green : t.red, textTransform: 'uppercase', marginRight: 6 }}>{tr.side}</span>
                      {tr.qty != null ? `${tr.qty} ` : ''}{tr.symbol}
                      <span style={{ color: t.textTertiary, marginLeft: 6 }}>{tr.mode}{tr.error ? ' · failed' : ''}</span>
                    </span>
                    <span style={{ color: t.textTertiary }}>{new Date(tr.ts).toLocaleDateString()}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {err && <div style={{ marginTop: 8, fontSize: 12, color: t.red }}>{err}</div>}
      </div>
    </Card>
  );
}

export default function TradeWorkflow({ dark, t, holdings, cashValue, accounts, stocks, brokerSnapshot, syncBroker }) {
  const [step, setStep] = useState(brokerSnapshot?.linked ? 2 : 1);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set());
  const [simulated, setSimulated] = useState(false);

  const sectionStyle = { padding: '16px 20px' };
  const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}` };
  const pillButtonStyle = {
    borderRadius: 999, border: `1px solid ${t.border}`, background: t.glass, color: t.text,
    padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font, boxShadow: 'none',
  };
  const primaryButtonStyle = { ...pillButtonStyle, background: t.text, color: t.bg, borderColor: 'transparent', padding: '10px 20px', fontSize: 13 };

  const handleConnect = async () => {
    setConnecting(true); setMsg(null);
    try {
      const res = await fetch('/api/broker/sync', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }),
      });
      const d = await res.json();
      if (d.skipped) {
        setMsg({ error: false, text: 'Brokerage sync not configured yet' });
      } else if (d.linked === false && d.linkUrl) {
        window.open(d.linkUrl, '_blank', 'noopener');
        setMsg({ error: false, text: 'Finish linking in the popup, then press Connect again' });
      } else if (d.linked) {
        await syncBroker(true);
        setMsg({ error: false, text: 'Brokerage connected' });
        setStep(2);
      } else {
        setMsg({ error: true, text: d.error || 'Sync failed' });
      }
    } catch {
      setMsg({ error: true, text: 'Network error' });
    }
    setConnecting(false);
  };

  const handleSync = async () => {
    setSyncing(true); setMsg(null);
    const result = await syncBroker(true);
    setMsg(result.success
      ? { error: false, text: 'Synced' }
      : { error: true, text: result.error || 'Sync failed' });
    setSyncing(false);
  };

  const result = useMemo(() => generateRecommendations({ holdings, cashValue, stocks }), [holdings, cashValue, stocks]);

  const toggleExcluded = (symbol) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol); else next.add(symbol);
      return next;
    });
  };

  const selected = result.recommendations.filter((r) => !excluded.has(r.symbol));
  const buyTotal = selected.filter((r) => r.action === 'buy').reduce((sum, r) => sum + r.amount, 0);
  const sellTotal = selected.filter((r) => r.action === 'sell').reduce((sum, r) => sum + r.amount, 0);
  const cashAfter = cashValue - buyTotal + sellTotal;

  const actionBadge = (action) => ({
    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
    background: action === 'buy' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)',
    color: action === 'buy' ? t.green : t.red,
  });

  return (
    <>
      <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i < STEPS.length - 1 ? 1 : undefined }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                background: step === i + 1 ? t.text : (step > i + 1 ? t.green : t.glass),
                color: step === i + 1 ? t.bg : (step > i + 1 ? '#fff' : t.textSecondary),
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 11, color: step === i + 1 ? t.text : t.textTertiary, fontWeight: step === i + 1 ? 700 : 500, whiteSpace: 'nowrap' }}>{label}</div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: t.border, marginLeft: 4 }} />}
            </div>
          ))}
        </div>
      </Card>

      {step === 1 && (
        <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20, textAlign: 'center' }}>
          <div style={labelStyle}>Step 1 -- Connect</div>
          <div style={{ fontSize: 14, color: t.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
            Link your brokerage account so Epiphany can read your holdings and cash balance.
          </div>
          <button onClick={handleConnect} disabled={connecting} style={primaryButtonStyle}>
            {connecting ? 'Connecting…' : 'Connect Brokerage'}
          </button>
          {msg && <div style={{ marginTop: 12, fontSize: 12, color: msg.error ? t.red : t.textSecondary }}>{msg.text}</div>}
          {brokerSnapshot?.linked && (
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setStep(2)} style={pillButtonStyle}>Continue →</button>
            </div>
          )}
        </Card>
      )}

      {step === 2 && (
        <>
          <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
            <div style={sectionStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={labelStyle}>Step 2 -- Sync</div>
                <button onClick={handleSync} disabled={syncing} style={pillButtonStyle}>{syncing ? 'Syncing…' : 'Sync now'}</button>
              </div>
              {brokerSnapshot && brokerSnapshot.syncedAt && (
                <div style={{ fontSize: 11, color: t.textTertiary, marginBottom: 8 }}>
                  Last synced {Math.max(0, Math.round((Date.now() - new Date(brokerSnapshot.syncedAt).getTime()) / 60000))}m ago
                </div>
              )}
              {holdings.map((h) => (
                <div key={h.symbol} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{h.symbol}</div>
                    <div style={{ fontSize: 11, color: t.textTertiary }}>{h.shares} shares</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(h.value)}</div>
                </div>
              ))}
              {accounts.map((a, i) => (
                <div key={`${a.name}-${i}`} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: t.textTertiary }}>Cash · {a.type}</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(a.balance, a.currency)}</div>
                </div>
              ))}
              <div style={{ ...rowStyle, borderBottom: 'none', fontWeight: 700, fontSize: 16 }}>
                <span>Liquid cash</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cashValue)}</span>
              </div>
              {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.error ? t.red : t.textSecondary }}>{msg.text}</div>}
            </div>
          </Card>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={pillButtonStyle}>← Back</button>
            <button onClick={() => setStep(3)} style={primaryButtonStyle}>Get Recommendations →</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20, textAlign: 'center' }}>
            <div style={labelStyle}>Available to invest</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cashValue)}</div>
          </Card>

          <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
            <div style={sectionStyle}>
              <div style={labelStyle}>Recommendations</div>
              {result.recommendations.length === 0 && (
                <div style={{ fontSize: 13, color: t.textSecondary, padding: '12px 0' }}>No changes recommended right now.</div>
              )}
              {result.recommendations.map((r) => (
                <div key={r.symbol} style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={!excluded.has(r.symbol)} onChange={() => toggleExcluded(r.symbol)} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={actionBadge(r.action)}>{r.action}</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{r.symbol}</span>
                      </div>
                      <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{r.rationale}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{r.shares} sh · {formatCurrency(r.amount)}</div>
                    <div style={{ fontSize: 11, color: t.textTertiary }}>
                      {(r.currentWeight * 100).toFixed(1)}% → {(r.targetWeight * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 12 }}>{result.disclaimer}</div>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(2)} style={pillButtonStyle}>← Back</button>
            <button onClick={() => setStep(4)} disabled={selected.length === 0} style={primaryButtonStyle}>Review Trade Ticket →</button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
            <div style={sectionStyle}>
              <div style={labelStyle}>Trade ticket</div>
              {selected.map((r) => (
                <div key={r.symbol} style={rowStyle}>
                  <div>
                    <span style={{ ...actionBadge(r.action), marginRight: 8 }}>{r.action}</span>
                    <span style={{ fontWeight: 600 }}>{r.shares} {r.symbol}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(r.amount)}</div>
                </div>
              ))}
              <div style={rowStyle}>
                <span>Cash deployed</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(buyTotal)}</span>
              </div>
              <div style={rowStyle}>
                <span>Proceeds from sells</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sellTotal)}</span>
              </div>
              <div style={{ ...rowStyle, borderBottom: 'none', fontWeight: 700, fontSize: 16 }}>
                <span>Cash remaining</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cashAfter)}</span>
              </div>
            </div>
          </Card>

          {!simulated ? (
            <>
              <div style={{ fontSize: 11, color: t.textTertiary, marginBottom: 16, textAlign: 'center' }}>
                Paper trading only -- live order execution isn't enabled yet.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(3)} style={pillButtonStyle}>← Back</button>
                <button onClick={() => setSimulated(true)} disabled={selected.length === 0} style={primaryButtonStyle}>Simulate Trades</button>
              </div>
            </>
          ) : (
            <Card dark={dark} t={t} style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Simulated</div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 16 }}>No real orders were placed.</div>
              <button onClick={() => { setSimulated(false); setStep(1); setExcluded(new Set()); }} style={pillButtonStyle}>Start over</button>
            </Card>
          )}
        </>
      )}

      <AutopilotCard dark={dark} t={t} />
    </>
  );
}
