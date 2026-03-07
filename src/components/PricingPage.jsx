import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Card } from './ui';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const PRICE_IDS = {
  starter: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER || import.meta.env.VITE_STRIPE_PRICE_ID_PRO,
  pro: import.meta.env.VITE_STRIPE_PRICE_ID_PRO,
};

export default function PricingPage({ dark, t, onClose }) {
  const [loadingPlan, setLoadingPlan] = useState(null);

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
        body: JSON.stringify({
          priceId,
        }),
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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        maxWidth: 900,
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
        maxHeight: 'calc(100dvh - 40px)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            color: t.text,
            margin: 0,
          }}>Opticon Pro</h1>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: t.textSecondary,
              fontSize: 24,
              cursor: 'pointer',
              padding: 8,
            }}
          >×</button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          gap: 20,
        }}>
          {/* Free Tier */}
          <Card t={t} dark={dark} style={{ padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{
                fontSize: 24,
                fontWeight: 600,
                color: t.text,
                margin: 0,
                marginBottom: 8,
              }}>Free</h3>
              <div style={{
                fontSize: 48,
                fontWeight: 700,
                color: t.text,
                fontFamily: 'tabular-nums',
              }}>$0</div>
              <div style={{
                fontSize: 14,
                color: t.textSecondary,
              }}>Forever free</div>
            </div>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              marginBottom: 24,
            }}>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Prediction markets (Polymarket)</li>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Live stock data (US50)</li>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Monte Carlo simulations</li>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Trading simulator</li>
              <li style={{ marginBottom: 12, color: t.textTertiary }}>✗ Real-time cTrader signals</li>
              <li style={{ marginBottom: 12, color: t.textTertiary }}>✗ TradingView webhooks</li>
              <li style={{ marginBottom: 12, color: t.textTertiary }}>✗ Advanced analytics</li>
            </ul>

            <div style={{
              padding: '6px 16px',
              background: t.backgroundSecondary,
              borderRadius: 100,
              textAlign: 'center',
              color: t.textTertiary,
              fontSize: 12,
              fontWeight: 500,
              width: 'fit-content',
              margin: '0 auto',
            }}>
              Current Plan
            </div>
          </Card>

          {/* Starter Tier */}
          <Card t={t} dark={dark} style={{
            padding: 32,
            border: `1px solid ${t.border}`,
          }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{
                fontSize: 24,
                fontWeight: 600,
                color: t.text,
                margin: 0,
                marginBottom: 8,
              }}>Starter</h3>
              <div style={{
                fontSize: 48,
                fontWeight: 700,
                color: t.text,
                fontFamily: 'tabular-nums',
              }}>$20</div>
              <div style={{
                fontSize: 14,
                color: t.textSecondary,
              }}>per month</div>
            </div>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              marginBottom: 24,
            }}>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Everything in Free</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Broker panel unlock</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ cTrader + TradingView signal forwarding</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Priority queue for API jobs</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Basic auto-send controls</li>
            </ul>

            <button
              onClick={() => handleUpgrade('starter')}
              disabled={loadingPlan !== null}
              style={{
                width: '100%',
                padding: 16,
                background: t.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: loadingPlan ? 'not-allowed' : 'pointer',
                opacity: loadingPlan ? 0.6 : 1,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
              }}
            >
              {loadingPlan === 'starter' ? 'Loading...' : 'Upgrade to Starter'}
            </button>
          </Card>

          {/* Pro Tier */}
          <Card t={t} dark={dark} style={{
            padding: 32,
            border: `2px solid ${t.blue}`,
            boxShadow: `0 0 12px ${t.blue}20`,
          }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{
                fontSize: 24,
                fontWeight: 600,
                color: t.text,
                margin: 0,
                marginBottom: 8,
              }}>Pro</h3>
              <div style={{
                fontSize: 48,
                fontWeight: 700,
                color: t.text,
                fontFamily: 'tabular-nums',
              }}>$50</div>
              <div style={{
                fontSize: 14,
                color: t.textSecondary,
              }}>per month</div>
            </div>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              marginBottom: 24,
            }}>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Everything in Starter</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Full broker automation controls</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Higher signal throughput</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Expanded risk + execution settings</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Priority support and onboarding</li>
            </ul>

            <button
              onClick={() => handleUpgrade('pro')}
              disabled={loadingPlan !== null}
              style={{
                width: '100%',
                padding: 16,
                background: t.blue,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: loadingPlan ? 'not-allowed' : 'pointer',
                opacity: loadingPlan ? 0.6 : 1,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
              }}
            >
              {loadingPlan === 'pro' ? 'Loading...' : 'Upgrade to Pro'}
            </button>
          </Card>
        </div>

        <div style={{
          marginTop: 24,
          padding: 24,
          background: t.backgroundSecondary,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
        }}>
          <p style={{
            margin: 0,
            color: t.textSecondary,
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            Cancel anytime. No contracts. Secure payments powered by Stripe.
            <br />
            Apple Pay appears automatically on compatible Apple devices/browsers after Stripe domain verification.
          </p>
        </div>
      </div>
    </div>
  );
}
