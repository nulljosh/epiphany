import AccountCard from '../components/AccountCard';
import TransactionRow from '../components/TransactionRow';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const greetingForHour = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function Dashboard({ accounts, transactions, totalBalance }) {
  return (
    <div className="page">
      <section className="card summary-card">
        <p className="muted">{greetingForHour()}</p>
        <h1>Total Balance</h1>
        <p className="summary-balance">{formatCurrency(totalBalance)}</p>
      </section>

      <section>
        <h2>Accounts</h2>
        <div className="stack">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <button type="button">Send</button>
          <button type="button">Request</button>
          <button type="button">Pay Bill</button>
        </div>
      </section>

      <section className="card">
        <h2>Recent Transactions</h2>
        <div className="stack compact">
          {transactions.slice(0, 5).map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      </section>
    </div>
  );
}
