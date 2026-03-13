import { categoryIcons } from '../utils/mockData';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));

export default function TransactionRow({ transaction }) {
  const isCredit = transaction.type === 'credit';
  const icon = categoryIcons[transaction.category] ?? '💳';

  return (
    <div className="transaction-row">
      <div className="transaction-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="transaction-main">
        <p className="transaction-merchant">{transaction.merchant}</p>
        <p className="transaction-desc">{transaction.description}</p>
        <p className="transaction-date">{formatDate(transaction.date)}</p>
      </div>
      <div className="transaction-side">
        <p className={`transaction-amount ${isCredit ? 'credit' : 'debit'}`}>
          {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
        </p>
        <p className="transaction-category">{transaction.category}</p>
      </div>
    </div>
  );
}
