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
        </div>
      )}
    </>
  );
}
