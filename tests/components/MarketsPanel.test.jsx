import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarketsPanel from '../../src/components/MarketsPanel';

const mockTheme = {
  bg: '#111', surface: '#222', glass: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)', cardBorder: 'rgba(255,255,255,0.1)',
  text: '#e8e8e8', textSecondary: 'rgba(255,255,255,0.5)',
  textTertiary: 'rgba(255,255,255,0.25)',
};

const mockStocks = {
  AAPL: { symbol: 'AAPL', price: 175.50, changePercent: 1.25 },
  MSFT: { symbol: 'MSFT', price: 420.00, changePercent: -0.50 },
  TSLA: { symbol: 'TSLA', price: 250.00, changePercent: 3.10 },
};

const mockLiveAssets = {
  gold: { name: 'Gold', full: 'Gold (XAU)', spot: 2350.00, chgPct: 0.45 },
  btc: { name: 'BTC', full: 'Bitcoin', spot: 65000.00, chgPct: 2.10 },
};

describe('MarketsPanel', () => {
  it('renders market status indicator', () => {
    render(<MarketsPanel dark t={mockTheme} stocks={mockStocks} liveAssets={mockLiveAssets} watchlist={[]} toggleSymbol={() => {}} isAuthenticated={false} />);
    const statusLabels = ['Market Open', 'Market Closed', 'Pre-Market', 'After Hours'];
    const found = statusLabels.some(label => screen.queryByText(label));
    expect(found).toBe(true);
  });

  it('renders all stocks and assets', () => {
    render(<MarketsPanel dark t={mockTheme} stocks={mockStocks} liveAssets={mockLiveAssets} watchlist={[]} toggleSymbol={() => {}} isAuthenticated={false} />);
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MSFT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gold (XAU)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bitcoin').length).toBeGreaterThan(0);
  });

  it('filters by search', () => {
    render(<MarketsPanel dark t={mockTheme} stocks={mockStocks} liveAssets={mockLiveAssets} watchlist={[]} toggleSymbol={() => {}} isAuthenticated={false} />);
    const searchInput = screen.getByLabelText('Search markets');
    fireEvent.change(searchInput, { target: { value: 'AAPL' } });
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(screen.queryByText('MSFT')).toBeNull();
    expect(screen.queryByText('TSLA')).toBeNull();
  });

  it('shows watchlist section when items are watchlisted', () => {
    render(<MarketsPanel dark t={mockTheme} stocks={mockStocks} liveAssets={mockLiveAssets} watchlist={['AAPL']} toggleSymbol={() => {}} isAuthenticated={true} />);
    expect(screen.getByText('Watchlist')).toBeDefined();
  });

  it('hides watchlist section when empty', () => {
    render(<MarketsPanel dark t={mockTheme} stocks={mockStocks} liveAssets={mockLiveAssets} watchlist={[]} toggleSymbol={() => {}} isAuthenticated={true} />);
    expect(screen.queryByText('Watchlist')).toBeNull();
  });

  it('calls toggleSymbol when star is clicked', () => {
    const toggle = vi.fn();
    render(<MarketsPanel dark t={mockTheme} stocks={mockStocks} liveAssets={mockLiveAssets} watchlist={['AAPL']} toggleSymbol={toggle} isAuthenticated={true} />);
    const starButtons = screen.getAllByLabelText(/watchlist/i);
    fireEvent.click(starButtons[0]);
    expect(toggle).toHaveBeenCalled();
  });

  it('toggles sort direction', () => {
    render(<MarketsPanel dark t={mockTheme} stocks={mockStocks} liveAssets={mockLiveAssets} watchlist={[]} toggleSymbol={() => {}} isAuthenticated={false} />);
    const sortBtn = screen.getByText('DESC');
    fireEvent.click(sortBtn);
    expect(screen.getByText('ASC')).toBeDefined();
  });

  it('handles null stocks and liveAssets gracefully', () => {
    render(<MarketsPanel dark t={mockTheme} stocks={null} liveAssets={null} watchlist={[]} toggleSymbol={() => {}} isAuthenticated={false} />);
    expect(screen.getByText('No results')).toBeDefined();
  });
});
