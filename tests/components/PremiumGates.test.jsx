import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertsPanel from '../../src/components/AlertsPanel.jsx';
import { PremiumContext, PREMIUM_INDICATORS } from '../../src/context/PremiumContext.js';

function setup(isPro) {
  const onAdd = vi.fn();
  const pricing = vi.fn();
  window.addEventListener('epiphany:show-pricing', pricing);
  render(
    <PremiumContext.Provider value={isPro}>
      <AlertsPanel onClose={vi.fn()} alerts={[]} onAdd={onAdd} onRemove={vi.fn()} onClearTriggered={vi.fn()} watchlist={['AAPL']} />
    </PremiumContext.Provider>
  );
  fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'AAPL' } });
  fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: isPro ? 'Add' : 'Unlock' }));
  return { onAdd, pricing };
}

describe('web freemium: price alerts are Premium', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a free account is sent to pricing and no alert is created', () => {
    const { onAdd, pricing } = setup(false);
    expect(onAdd).not.toHaveBeenCalled();
    expect(pricing).toHaveBeenCalled();
    expect(screen.getByText(/part of Premium/)).toBeTruthy();
  });

  it('a Premium account creates the alert', () => {
    const { onAdd, pricing } = setup(true);
    expect(onAdd).toHaveBeenCalledWith('AAPL', 200, 'above');
    expect(pricing).not.toHaveBeenCalled();
  });

  it('keeps the basic overlays free and the rest of the suite Premium', () => {
    expect([...PREMIUM_INDICATORS].sort()).toEqual(['atr', 'bb', 'macd', 'rsi', 'stoch']);
    expect(PREMIUM_INDICATORS.has('sma')).toBe(false);
  });
});
