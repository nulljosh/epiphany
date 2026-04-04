import { useState, useEffect, useCallback } from 'react';
import { SYSTEM_FONT as font } from '../utils/formatting';

const PRICE_IDS = {
  starter: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER || import.meta.env.VITE_STRIPE_PRICE_ID_PRO,
  pro: import.meta.env.VITE_STRIPE_PRICE_ID_PRO,
  weekly: import.meta.env.VITE_STRIPE_PRICE_ID_WEEKLY,
};

const Check = () => <span style={{ color: '#34c759', marginRight: 8, fontWeight: 700 }}>&#10003;</span>;
const Cross = () => <span style={{ color: '#86868b', marginRight: 8, fontWeight: 700 }}>&#10005;</span>;

export default function PricingPage({ dark, t, onClose, subscription }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const currentTier = subscription?.tier || 'free';

  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const handleUpgrade = async (plan) => {
    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      alert('Missing Stripe price ID for selected plan.');
      return;
    }
    setLoadingPlan(plan);

    try {
      const response = await fetch('/api/stripe?action=checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    const customerId = localStorage.getItem('stripe_customer_id');
    if (!customerId) return;
    try {
      const response = await fetch('/api/stripe?action=portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Portal error:', err);
      alert('Failed to open subscription portal. Please try again.');
    }
  };

  const tierRank = { free: 0, starter: 1, weekly: 1, pro: 2 };
  const isCurrentOrLower = (plan) => tierRank[plan] <= tierRank[currentTier];

  const glassCard = {
    background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
    borderRadius: 20,
    border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    padding: 32,
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const CurrentBadge = () => (
    <div style={{
      padding: '8px 20px',
      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: 100,
      textAlign: 'center',
      color: t.textTertiary,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: font,
      letterSpacing: '0.02em',
    }}>
      Current Plan
    </div>
  );

  const UpgradeButton = ({ plan, label, bgColor }) => {
    if (isCurrentOrLower(plan)) {
      return currentTier === plan ? <CurrentBadge /> : null;
    }
    return (
      <button
        onClick={() => handleUpgrade(plan)}
        disabled={loadingPlan !== null}
        style={{
          width: '100%',
          padding: '14px 24px',
          background: bgColor,
          color: '#fff',
          border: 'none',
          borderRadius: 100,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: font,
          cursor: loadingPlan ? 'not-allowed' : 'pointer',
          opacity: loadingPlan ? 0.6 : 1,
          letterSpacing: '0.01em',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
        }}
        onMouseEnter={(e) => { if (!loadingPlan) e.target.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; }}
      >
        {loadingPlan === plan ? 'Loading...' : label}
      </button>
    );
  };

  const FeatureItem = ({ included, children }) => (
    <li style={{ marginBottom: 10, color: included ? t.text : t.textTertiary, fontSize: 13, fontFamily: font, display: 'flex', alignItems: 'center' }}>
      {included ? <Check /> : <Cross />}
      {children}
    </li>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: 940,
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
        maxHeight: 'calc(100dvh - 40px)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
        }}>
          <div>
            <h1 style={{
              fontSize: 36,
              fontWeight: 700,
              color: t.text,
              margin: 0,
              fontFamily: font,
              letterSpacing: '-0.02em',
            }}>Monica Pro</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: t.textSecondary, fontFamily: font }}>
              Unlock the full intelligence platform.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: 'none',
              color: t.textSecondary,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={(e) => { e.target.style.transform = 'scale(1.1)'; }}
            onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
          >{'\u00d7'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { key: 'free', name: 'Free', price: '$0', period: 'forever', plan: null, features: ['Map + all data layers', 'Situation monitor (read)', 'Stock data + ticker', 'Weather/quakes/traffic'] },
            { key: 'starter', name: 'Weekly', price: '$1', period: 'per week', plan: 'starter', label: 'Get Weekly -- $1/wk', recommended: true, features: ['Everything in Free', 'AI Analyst (Claude)', 'Portfolio + watchlist', 'Deep news + crime data', 'Situation monitor'] },
            { key: 'pro', name: 'Pro', price: '$20', period: 'per month', plan: 'pro', label: 'Get Pro -- $20/mo', features: ['Everything in Weekly', 'Ontology writes + batch', 'Priority data refresh', 'API access'] },
          ].map(tier => (
            <div key={tier.key} style={{
              ...glassCard,
              width: '100%',
              boxShadow: 'none',
              border: tier.recommended
                ? `2px solid ${t.accent || '#0071e3'}`
                : currentTier === tier.key
                  ? `2px solid ${t.accent}`
                  : `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              {tier.recommended && (
                <div style={{ fontSize: 11, fontWeight: 600, color: t.accent || '#0071e3', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: font }}>Recommended</div>
              )}
              <h3 style={{ fontSize: 20, fontWeight: 600, color: t.text, margin: 0, marginBottom: 4, fontFamily: font }}>{tier.name}</h3>
              <div style={{ fontSize: 44, fontWeight: 700, color: t.text, fontFamily: font, fontVariantNumeric: 'tabular-nums', marginBottom: 2 }}>{tier.price}</div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 24, fontFamily: font }}>{tier.period}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 24 }}>
                {tier.features.map(f => <FeatureItem key={f} included>{f}</FeatureItem>)}
              </ul>
              {tier.plan
                ? <UpgradeButton plan={tier.plan} label={tier.label} bgColor={t.accent || '#0071e3'} />
                : currentTier === tier.key && <CurrentBadge />
              }
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20,
          padding: '16px 24px',
          background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 16,
          border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <p style={{
            margin: 0,
            color: t.textSecondary,
            fontSize: 13,
            lineHeight: 1.6,
            fontFamily: font,
          }}>
            Cancel anytime. No contracts. Secure payments via Stripe.
            <br />
            Apple Pay available on compatible devices.
          </p>
          {currentTier !== 'free' && (
            <button
              onClick={handleManageSubscription}
              style={{
                padding: '8px 20px',
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: t.textSecondary,
                border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 100,
                fontSize: 13,
                fontFamily: font,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; }}
            >
              Manage Subscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
