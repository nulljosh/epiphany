import { useState, useEffect } from 'react';

/**
 * usePlan — returns the current user's subscription plan.
 *
 * Usage:
 *   const { plan, isPro, isPremium, loading, refetch } = usePlan(customerId);
 *
 * Returns:
 *   plan        'free' | 'pro' | 'premium'
 *   isPro       boolean (pro OR premium)
 *   isPremium   boolean
 *   loading     boolean
 *   status      Stripe subscription status string
 *   cancelAtPeriodEnd  boolean
 *   refetch     () => void  — manually re-fetch
 */
export function usePlan(customerId) {
  const [state, setState] = useState({ plan: 'free', status: null, cancelAtPeriodEnd: false, loading: true });

  async function fetchPlan() {
    if (!customerId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const res = await fetch(`/api/stripe/subscription?customerId=${encodeURIComponent(customerId)}`);
      const { plan, status, cancelAtPeriodEnd } = await res.json();
      setState({ plan, status, cancelAtPeriodEnd, loading: false });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }

  useEffect(() => { fetchPlan(); }, [customerId]);

  const { plan, loading, status, cancelAtPeriodEnd } = state;
  return {
    plan,
    isPro: plan === 'pro' || plan === 'premium',
    isPremium: plan === 'premium',
    loading,
    status,
    cancelAtPeriodEnd,
    refetch: fetchPlan,
  };
}
