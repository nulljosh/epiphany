import { useState, useEffect, useCallback } from 'react';

export function useSubscription() {
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

  return {
    isPro: subscription?.tier === 'pro',
    isStarter: subscription?.tier === 'starter',
    isFree: subscription?.tier === 'free' || !subscription,
    subscription,
    loading,
    refetch: fetchStatus,
  };
}
