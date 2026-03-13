const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function AccountCard({ account }) {
  return (
    <article className="card account-card">
      <div className="account-card-header">
        <span className="account-type">{account.type}</span>
        {account.primary ? <span className="badge">Primary</span> : null}
      </div>
      <p className="account-number">{account.number}</p>
      <p className="account-balance">{formatCurrency(account.balance)}</p>
      <button className="ghost-button" type="button">
        View
      </button>
    </article>
  );
}
