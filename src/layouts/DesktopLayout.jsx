import { MobileMenu, MobileMenuItem, MobileMenuDivider } from '../components/ui';
import { formatLastUpdated } from '../hooks/useLivePrices';
import Ticker from '../components/Ticker';
import { TabIcon } from './MobileLayout';

const FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

export default function DesktopLayout({
  t, dark, tickerItems, weather, isMobileNav,
  stocksReliability, lastUpdated,
  activeTab, desktopPanelOpen, handleDesktopTabSelect,
  desktopNavRef, desktopPanelRef,
  TAB_PILLS, glassButton,
  showAlerts, setShowAlerts, activeCount,
  isFree, setShowPricing, logout,
  panelContent, onTickerItemClick,
  tickerVisible = true,
}) {
  return (
    <>
      {/* Ticker */}
      {/* FIX: persist scroll state across visibility transitions — recurring bug */}
      {/* Ticker stays mounted at all times; visibility is controlled via CSS height/opacity   */}
      {/* so offsetRef, animationRef, and rAF loop are never torn down on toggle.             */}
      <div className="epiphany-ticker" style={{ gridColumn: '1 / -1', minHeight: tickerVisible ? 28 : 0, maxHeight: tickerVisible ? 36 : 0, overflow: 'hidden', transition: 'min-height 0.2s ease, max-height 0.2s ease' }}>
        {tickerItems.length > 0
          ? <Ticker items={tickerItems} theme={t} onItemClick={onTickerItemClick} />
          : tickerVisible && (
            <div style={{ height: 28, background: t.glass, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: t.textTertiary, fontFamily: FONT }}>Loading ticker...</span>
            </div>
          )
        }
      </div>

      {/* Header */}
      <header className="epiphany-header" style={{ gridColumn: '1 / -1', padding: '10px 16px', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}`, background: dark ? 'rgba(2,6,23,0.55)' : 'rgba(255,255,255,0.62)', backdropFilter: 'blur(24px) saturate(170%)', WebkitBackdropFilter: 'blur(24px) saturate(170%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: t.text, fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>epiphany</span>
          <span style={{ width: 1, height: 14, background: t.border, marginLeft: 8 }} />
          <span style={{ fontSize: 10, color: t.textTertiary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            updated {formatLastUpdated(stocksReliability?.lastSuccessAt ? new Date(stocksReliability.lastSuccessAt) : lastUpdated)}
          </span>
          {weather && !isMobileNav && (
            <>
              <span style={{ width: 1, height: 14, background: t.border }} />
              <span style={{ fontSize: 11, color: t.textSecondary, whiteSpace: 'nowrap' }}>
                {weather.icon} {weather.temp}&deg;C {weather.description}
              </span>
            </>
          )}
        </div>
        <div ref={desktopNavRef} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Segmented control */}
          <div style={{ display: 'flex', gap: 0, background: glassButton.background, borderRadius: 8, border: glassButton.border, overflow: 'hidden', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            {/* Alerts bell inline */}
            <button
              onClick={() => setShowAlerts(true)}
              style={{
                position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                color: t.textSecondary, fontSize: 16, padding: '4px 8px', lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = t.text}
              onMouseLeave={e => e.currentTarget.style.color = t.textSecondary}
              title="Price Alerts"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {activeCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0, background: '#ef4444',
                  color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: '50%',
                  width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{activeCount}</span>
              )}
            </button>
            {!isMobileNav && isFree && (
              <button
                onClick={() => setShowPricing(true)}
                style={{
                  padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  fontFamily: FONT, background: '#0071e3', color: '#fff', border: 'none',
                  borderLeft: `1px solid ${t.border}`,
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                UPGRADE
              </button>
            )}
            {!isMobileNav && (
              <button
                onClick={logout}
                style={{
                  padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  fontFamily: FONT, background: 'transparent', color: '#f87171', border: 'none',
                  borderLeft: `1px solid ${t.border}`,
                }}
              >
                LOGOUT
              </button>
            )}
          </div>
          {isMobileNav && (
            <MobileMenu t={t} font={FONT}>
              {weather && (
                <>
                  <MobileMenuItem t={t} font={FONT} style={{ color: t.textTertiary, fontSize: 11, cursor: 'default' }}>
                    {weather.icon} {weather.temp}&deg;C {weather.description}
                  </MobileMenuItem>
                  <MobileMenuDivider t={t} />
                </>
              )}
              {isFree && (
                <MobileMenuItem t={t} font={FONT} onClick={() => setShowPricing(true)} style={{ color: '#0071e3' }}>
                  UPGRADE
                </MobileMenuItem>
              )}
              <MobileMenuDivider t={t} />
              <MobileMenuItem t={t} font={FONT} onClick={logout} style={{ color: '#ef4444' }}>
                LOGOUT
              </MobileMenuItem>
            </MobileMenu>
          )}
        </div>
      </header>

      {/* Panel cell */}
      <div ref={desktopPanelRef} className="epiphany-panel" style={{ gridColumn: isMobileNav ? '1 / -1' : '2', overflow: 'auto', minHeight: 0 }}>
        {desktopPanelOpen && panelContent}
        {/* Room for the last rows to scroll clear of the tab bar. */}
        {desktopPanelOpen && !isMobileNav && <div aria-hidden="true" style={{ height: 88 }} />}
      </div>

      {/* Bottom tab bar, the same one the Mac app has: icons and labels on glass. */}
      {!isMobileNav && (
        <nav aria-label="Sections" style={{
          position: 'fixed', zIndex: 1000, left: '50%', transform: 'translateX(-50%)', bottom: 44,
          width: 'min(calc(100% - 48px), 560px)', display: 'flex', gap: 2, padding: 6, borderRadius: 22,
          background: dark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        }}>
          {TAB_PILLS.map((pill) => {
            const active = activeTab === pill.key && desktopPanelOpen;
            return (
              <button key={pill.key} type="button" onClick={() => handleDesktopTabSelect(pill.key)} aria-current={active ? 'page' : undefined}
                title={pill.label}
                style={{
                  flex: 1, minHeight: 48, borderRadius: 16, border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  background: active ? (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)') : 'transparent',
                  color: active ? '#0a84ff' : t.textSecondary,
                }}>
                <TabIcon name={pill.key} />
                {pill.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Footer */}
      <footer className="epiphany-footer" style={{ gridColumn: '1 / -1', gridRow: 4, padding: '12px 16px', justifyContent: 'center', alignItems: 'center', gap: 16, borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.textSecondary }}>
        <span>&copy; 2026 Joshua Trommel</span>
        <a href="https://github.com/nulljosh/epiphany/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style={{ color: t.textTertiary, textDecoration: 'underline', textDecorationColor: t.border, textUnderlineOffset: '3px', transition: 'opacity 0.4s ease-out' }} onMouseEnter={e => e.target.style.opacity = '0.5'} onMouseLeave={e => e.target.style.opacity = '1'}>Apache 2.0</a>
        <a href="https://github.com/nulljosh/epiphany" target="_blank" rel="noopener noreferrer" style={{ color: t.textTertiary, textDecoration: 'underline', textDecorationColor: t.border, textUnderlineOffset: '3px', transition: 'opacity 0.4s ease-out' }} onMouseEnter={e => e.target.style.opacity = '0.5'} onMouseLeave={e => e.target.style.opacity = '1'}>GitHub</a>
        <a href="https://github.com/nulljosh/epiphany/tree/main/ios" target="_blank" rel="noopener noreferrer" style={{ color: t.textTertiary, textDecoration: 'underline', textDecorationColor: t.border, textUnderlineOffset: '3px', transition: 'opacity 0.4s ease-out' }} onMouseEnter={e => e.target.style.opacity = '0.5'} onMouseLeave={e => e.target.style.opacity = '1'}>iOS</a>
      </footer>
    </>
  );
}
