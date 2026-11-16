import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RegisterPage from '../../src/components/RegisterPage.jsx';

describe('RegisterPage', () => {
  it('tells browsers it is a new account, so saved passwords are not autofilled', () => {
    render(<RegisterPage onRegister={vi.fn()} onSwitchToLogin={vi.fn()} />);
    expect(screen.getByLabelText('Email').autocomplete).toBe('email');
    expect(screen.getByLabelText('Password').autocomplete).toBe('new-password');
    expect(screen.getByLabelText('Confirm Password').autocomplete).toBe('new-password');
  });

  it('shows the real price: $1.99 a month', () => {
    render(<RegisterPage onRegister={vi.fn()} onSwitchToLogin={vi.fn()} />);
    expect(screen.getByText('$1.99')).toBeTruthy();
    expect(screen.getByText('a month, first 7 days free')).toBeTruthy();
    expect(screen.queryByText(/\/mo/)).toBeNull();
  });

  it('announces a server error', () => {
    render(<RegisterPage onRegister={vi.fn()} onSwitchToLogin={vi.fn()} error="Email already registered" />);
    expect(screen.getByRole('alert').textContent).toBe('Email already registered');
  });
});
