import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Transfer from './pages/Transfer';
import Settings from './pages/Settings';
import { useAccounts } from './hooks/useAccounts';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('bank-theme') || 'dark');
  const accountState = useAccounts();

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('bank-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <HashRouter>
      <div className="app-shell">
        <main>
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  accounts={accountState.accounts}
                  transactions={accountState.transactions}
                  totalBalance={accountState.totalBalance}
                />
              }
            />
            <Route
              path="/transactions"
              element={<Transactions transactions={accountState.transactions} />}
            />
            <Route
              path="/transfer"
              element={<Transfer accounts={accountState.accounts} onTransfer={accountState.transfer} />}
            />
            <Route
              path="/settings"
              element={<Settings theme={theme} onToggleTheme={toggleTheme} />}
            />
          </Routes>
        </main>

        <nav className="bottom-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/transfer">Transfer</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </div>
    </HashRouter>
  );
}
