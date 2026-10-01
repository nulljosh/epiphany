import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSubscription } from '../../src/hooks/useSubscription.js';

describe('useSubscription', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ tier: 'starter', status: 'active' }) }));
  });

  it('knows a paid account on a device that never saw the checkout redirect', async () => {
    const { result } = renderHook(() => useSubscription({ stripeCustomerId: 'cus_123', tier: 'free' }));
    await waitFor(() => expect(result.current.isStarter).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/stripe?action=status&customerId=cus_123');
  });

  it('is free with no customer anywhere', async () => {
    const { result } = renderHook(() => useSubscription({ tier: 'free' }));
    await waitFor(() => expect(result.current.isFree).toBe(true));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
