import { useMemo, useState } from 'react';
import TransactionRow from '../components/TransactionRow';

export default function Transactions({ transactions }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const categories = useMemo(
    () => ['all', ...new Set(transactions.map((transaction) => transaction.category))],
    [transactions]
  );

  const filtered = useMemo(() => {
    return transactions.filter((transaction) => {
      const text = `${transaction.merchant} ${transaction.description}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesType = type === 'all' ? true : transaction.type === type;
      const matchesCategory = category === 'all' ? true : transaction.category === category;
      const transactionDate = new Date(transaction.date);
      const matchesFrom = fromDate ? transactionDate >= new Date(`${fromDate}T00:00:00`) : true;
      const matchesTo = toDate ? transactionDate <= new Date(`${toDate}T23:59:59`) : true;

      return matchesSearch && matchesType && matchesCategory && matchesFrom && matchesTo;
    });
  }, [transactions, search, type, category, fromDate, toDate]);

  return (
    <div className="page">
      <section className="card">
        <h1>Transactions</h1>
        <div className="filter-grid">
          <input
            type="search"
            placeholder="Search merchant or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">All Types</option>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === 'all' ? 'All Categories' : item}
              </option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </section>

      <section className="card">
        <p className="muted">{filtered.length} results</p>
        <div className="stack compact">
          {filtered.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      </section>
    </div>
  );
}
