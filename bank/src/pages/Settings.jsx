import { useState } from 'react';

export default function Settings({ theme, onToggleTheme }) {
  const [profile, setProfile] = useState({
    name: 'Joshua Clarke',
    email: 'joshua@example.com'
  });
  const [notifications, setNotifications] = useState({
    transactions: true,
    statements: true,
    securityAlerts: true
  });

  return (
    <div className="page">
      <section className="card stack">
        <h1>Settings</h1>

        <h2>Profile</h2>
        <label>
          Name
          <input
            type="text"
            value={profile.name}
            onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={profile.email}
            onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
          />
        </label>
      </section>

      <section className="card stack">
        <h2>Notifications</h2>
        <label className="toggle-row">
          Transaction Alerts
          <input
            type="checkbox"
            checked={notifications.transactions}
            onChange={(event) =>
              setNotifications((prev) => ({ ...prev, transactions: event.target.checked }))
            }
          />
        </label>
        <label className="toggle-row">
          Monthly Statements
          <input
            type="checkbox"
            checked={notifications.statements}
            onChange={(event) => setNotifications((prev) => ({ ...prev, statements: event.target.checked }))}
          />
        </label>
        <label className="toggle-row">
          Security Alerts
          <input
            type="checkbox"
            checked={notifications.securityAlerts}
            onChange={(event) =>
              setNotifications((prev) => ({ ...prev, securityAlerts: event.target.checked }))
            }
          />
        </label>
      </section>

      <section className="card stack">
        <h2>Security</h2>
        <button type="button">Change PIN</button>
      </section>

      <section className="card stack">
        <h2>Theme</h2>
        <button type="button" onClick={onToggleTheme}>
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </button>
      </section>
    </div>
  );
}
