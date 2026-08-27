import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWebMCP } from './webmcp';

const ctx = () => ({
  watchlist: ['AAPL'],
  addSymbol: vi.fn(),
  removeSymbol: vi.fn(),
  alerts: [{ id: '1', symbol: 'AAPL' }],
  addAlert: vi.fn(),
  removeAlert: vi.fn(),
});

describe('useWebMCP', () => {
  let tools;
  beforeEach(() => {
    tools = new Map();
    document.modelContext = {
      registerTool: vi.fn(async (t) => { tools.set(t.name, t); return { unregister: () => tools.delete(t.name) }; }),
    };
  });

  it('registers read-only and state-changing tools', async () => {
    renderHook(() => useWebMCP(ctx()));
    await waitFor(() => expect(tools.size).toBeGreaterThan(8));
    expect(tools.has('get_watchlist')).toBe(true);
    expect(tools.get('get_watchlist').requiresConfirmation).toBeUndefined();
  });

  it('gates only the consequential tools behind confirmation', async () => {
    renderHook(() => useWebMCP(ctx()));
    await waitFor(() => expect(tools.has('disconnect_broker')).toBe(true));
    const gated = [...tools.values()].filter(t => t.requiresConfirmation).map(t => t.name).sort();
    expect(gated).toEqual(['disconnect_broker', 'set_broker_autopilot']);
  });

  it('delegates to the existing hook callbacks', async () => {
    const c = ctx();
    renderHook(() => useWebMCP(c));
    await waitFor(() => expect(tools.has('add_to_watchlist')).toBe(true));
    await tools.get('add_to_watchlist').execute({ symbol: 'msft' });
    expect(c.addSymbol).toHaveBeenCalledWith('msft');
    expect(await tools.get('get_watchlist').execute({})).toEqual({ symbols: ['AAPL'] });
  });

  it('no-ops in a browser without WebMCP', () => {
    delete document.modelContext;
    expect(() => renderHook(() => useWebMCP(ctx()))).not.toThrow();
  });
});
