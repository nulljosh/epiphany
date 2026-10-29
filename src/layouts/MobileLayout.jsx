const FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

export default function MobileLayout({
  t, dark, isMobileNav,
  activeTab, mobileTabsOpen, setMobileTabsOpen,
  mobilePanelOpen, setMobilePanelOpen,
  handleMobileTabSelect,
  TAB_PILLS,
  weather, isFree, setShowPricing, logout,
  panelContent,
}) {
  return (
    <>
      {/* Floating mobile nav */}
      <div className="epiphany-mobile-nav" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 'calc(env(safe-area-inset-left, 0px) + 12px)', right: 'calc(env(safe-area-inset-right, 0px) + 12px)', zIndex: 5, justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none' }}>
        {/* Left: tab pills (toggled) */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => setMobileTabsOpen(p => !p)}
            aria-label="Menu"
            style={{
              width: 44, height: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'none', overflow: 'visible',
            }}
          >
            {mobileTabsOpen
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
            }
          </button>
          {mobileTabsOpen && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 10, padding: 4,
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: 'none',
            }}>
              {TAB_PILLS.map(pill => (
                <button
                  key={pill.key}
                  onClick={() => handleMobileTabSelect(pill.key)}
                  style={{
                    padding: '10px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, minHeight: 44,
                    fontFamily: FONT, cursor: 'pointer', border: 'none', textAlign: 'left',
                    background: activeTab === pill.key ? t.text : 'transparent',
                    color: activeTab === pill.key ? t.bg : t.textSecondary,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {pill.label}
                </button>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '2px 4px' }} />
              {weather && (
                <div style={{ padding: '8px 16px', fontSize: 11, color: t.textTertiary, fontFamily: FONT }}>
                  {weather.icon} {weather.temp}&deg;C {weather.description}
                </div>
              )}
              {isFree && (
                <button
                  onClick={() => setShowPricing(true)}
                  style={{ padding: '10px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, minHeight: 44, fontFamily: FONT, cursor: 'pointer', border: 'none', textAlign: 'left', background: 'transparent', color: '#0071e3' }}
                >
                  UPGRADE
                </button>
              )}
              <button
                onClick={logout}
                style={{ padding: '10px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, minHeight: 44, fontFamily: FONT, cursor: 'pointer', border: 'none', textAlign: 'left', background: 'transparent', color: '#ef4444' }}
              >
                LOGOUT
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile tabs backdrop */}
      {isMobileNav && mobileTabsOpen && (
        <div
          onClick={() => setMobileTabsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'transparent',
            zIndex: 4,
          }}
        />
      )}
      {/* Mobile bottom sheet backdrop */}
      {isMobileNav && mobilePanelOpen && (
        <div
          onClick={() => {
            setMobilePanelOpen(false);
            setMobileTabsOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 9,
          }}
        />
      )}
      {/* Mobile bottom sheet */}
      {isMobileNav && (
        <div
          className={`epiphany-mobile-panel ${mobilePanelOpen ? 'open' : ''}`}
          style={{
            background: t.bg,
            borderTop: `1px solid ${t.border}`,
            boxShadow: 'none',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', position: 'relative', cursor: 'pointer' }}
            onClick={() => setMobilePanelOpen(false)}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border }} />
            <button
              onClick={(e) => { e.stopPropagation(); setMobilePanelOpen(false); }}
              style={{
                position: 'absolute',
                right: 12,
                top: 4,
                background: 'transparent',
                border: 'none',
                color: t.textSecondary,
                fontSize: 22,
                cursor: 'pointer',
                padding: '4px 8px',
                lineHeight: 1,
              }}
            >{'\u00d7'}</button>
          </div>
          {panelContent}
          {/* Room to scroll the last rows clear of the floating tab bar. */}
          <div aria-hidden="true" style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 88px)', flexShrink: 0 }} />
        </div>
      )}

      {/* Bottom tab bar, same four tabs as the iOS app. Map closes the panel to show the map itself. */}
      {isMobileNav && (
        <nav className="epiphany-mobile-tabbar" aria-label="Tabs" style={{
          position: 'fixed', zIndex: 1000, left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', width: 'min(calc(100% - 32px), 420px)',
          display: 'flex', padding: 4, borderRadius: 100, gap: 2,
          background: dark ? 'rgba(28,28,30,0.78)' : 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          {TAB_PILLS.map(pill => {
            const isMap = pill.key === 'situation';
            const active = isMap ? !mobilePanelOpen : (mobilePanelOpen && activeTab === pill.key);
            return (
              <button
                key={pill.key}
                onClick={() => (isMap ? setMobilePanelOpen(false) : handleMobileTabSelect(pill.key))}
                aria-current={active ? 'page' : undefined}
                style={{
                  flex: 1, minHeight: 48, borderRadius: 100, border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  background: active ? (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)') : 'transparent',
                  color: active ? '#0a84ff' : t.textSecondary,
                }}
              >
                <TabIcon name={pill.key} />
                {isMap ? 'Map' : pill.label}
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

export function TabIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'situation') return <svg {...common}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>;
  if (name === 'markets') return <svg {...common}><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>;
  if (name === 'portfolio') return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
  if (name === 'people') return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
}
