import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MoneyGlance from '../../src/components/MoneyGlance.jsx';
import { leftThisMonth } from '../../src/utils/moneyGlance.js';

const t = { text: '#000', textSecondary: '#555', textTertiary: '#999', border: '#ddd', green: 'green', red: 'red' };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('bills calendar', () => {
  it('marks the due day of a bill this month', () => {
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    render(<MoneyGlance recurring={[{ merchant: 'rent', name: 'Rent', amount: 900, cadence: 'monthly', nextDate: iso(due), priceDelta: 0 }]} t={t} />);
    const day = Math.min(due.getDate(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    const cell = screen.getAllByText(String(day)).find((el) => el.style.background.includes('255, 159, 10'));
    expect(cell).toBeTruthy();
  });
});

describe('left this month', () => {
  it('is money in minus out, and names an older month', () => {
    const now = new Date(2026, 9, 29);
    expect(leftThisMonth([{ month: '2026-09', in: 1, out: 1 }, { month: '2026-10', in: 3000, out: 2200 }], now))
      .toEqual({ title: 'Left this month', left: 800, in: 3000, out: 2200 });
    expect(leftThisMonth([{ month: '2026-09', in: 100, out: 250 }], now).title).toBe('Left in September');
    expect(leftThisMonth([], now)).toBeNull();
  });
});
