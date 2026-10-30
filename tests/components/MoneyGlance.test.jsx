import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MoneyGlance from '../../src/components/MoneyGlance.jsx';

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
