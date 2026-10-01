import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('effectiveTier', () => {
  beforeEach(() => { vi.resetModules(); process.env.ADMIN_EMAILS = 'boss@example.test, other@example.test'; });

  it('shows admin accounts as Pro so the web does not lock out the owner', async () => {
    const { effectiveTier } = await import('../../server/api/gates.js');
    expect(effectiveTier('boss@example.test', 'free')).toBe('pro');
    expect(effectiveTier('other@example.test', undefined)).toBe('pro');
  });

  it('leaves everyone else on their own tier', async () => {
    const { effectiveTier } = await import('../../server/api/gates.js');
    expect(effectiveTier('someone@example.test', 'premium')).toBe('premium');
    expect(effectiveTier('someone@example.test', undefined)).toBe('free');
  });
});
