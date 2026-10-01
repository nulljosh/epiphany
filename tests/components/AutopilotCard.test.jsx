import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AutopilotCard } from '../../src/components/TradeWorkflow.jsx';

const t = { text: '#fff', bg: '#000', glass: '#111', border: '#222', textTertiary: '#888', textSecondary: '#aaa', green: '#0f0', red: '#f00' };
const state = (pro) => ({ ok: true, pro, settings: { enabled: false, mode: 'paper', maxNotional: 1 }, trades: [] });

describe('web Autopilot card', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('shows the upgrade prompt, not the controls, to a Free account', async () => {
    global.fetch = vi.fn(async () => ({ json: async () => state(false) }));
    render(<AutopilotCard dark t={t} />);
    await waitFor(() => expect(screen.getByText('Upgrade to Premium')).toBeTruthy());
    expect(screen.queryByText('Paper')).toBeNull();
  });

  it('gives Premium paper mode by default with live as an explicit choice', async () => {
    global.fetch = vi.fn(async () => ({ json: async () => state(true) }));
    render(<AutopilotCard dark t={t} />);
    await waitFor(() => expect(screen.getByText('Paper')).toBeTruthy());
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText(/Paper trading -- simulated fills/)).toBeTruthy();
  });
});
