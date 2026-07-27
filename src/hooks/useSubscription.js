import { useState, useEffect, useCallback } from 'react';

// `user` is the authenticated account record from /api/auth?action=me. Its `tier`
// is the source of truth when it's a paid tier -- Stripe is only consulted for
// accounts that don't already carry one (e.g. grandfathered/comped accounts).
export function useSubscription(user) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    const customerId = localStorage.getItem('stripe_customer_id');

    if (!customerId) {
      setSubscription({ tier: 'free', status: null });
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/stripe?action=status&customerId=${customerId}`)
      .then(r => r.json())
      .then(data => {
        setSubscription(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch subscription:', err);
        setSubscription({ tier: 'free', status: null });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const accountTier = user?.tier && user.tier !== 'free' ? user.tier : null;
  const tier = accountTier || subscription?.tier;

  return {
    isPro: tier === 'pro' || tier === 'premium',
    isStarter: tier === 'starter',
    isFree: !tier || tier === 'free',
    subscription: accountTier ? { ...subscription, tier: accountTier } : subscription,
    loading,
    refetch: fetchStatus,
  };
}
