import { useState } from 'react';

export default function Transfer({ accounts, onTransfer }) {
  const [fromId, setFromId] = useState('acc-chequing');
  const [toId, setToId] = useState('acc-savings');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const accountLabelById = accounts.reduce((map, account) => {
    map[account.id] = account.type;
    return map;
  }, {});

  const submitTransfer = (event) => {
    event.preventDefault();
    setError('');

    try {
      onTransfer({ fromId, toId, amount, note });
      setConfirmation({
        fromLabel: accountLabelById[fromId] ?? fromId,
        toLabel: toId === 'external' ? 'External Account' : accountLabelById[toId] ?? toId,
        amount: Number(amount).toFixed(2)
      });
      setAmount('');
      setNote('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <section className="card">
        <h1>Transfer Funds</h1>
        <form className="stack" onSubmit={submitTransfer}>
          <label>
            From Account
            <select value={fromId} onChange={(event) => setFromId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.type}
                </option>
              ))}
            </select>
          </label>

          <label>
            To Account
            <select value={toId} onChange={(event) => setToId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.type}
                </option>
              ))}
              <option value="external">External</option>
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>

          <label>
            Note
            <input
              type="text"
              placeholder="Optional note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error ? <p className="error">{error}</p> : null}
          <button type="submit">Transfer</button>
        </form>
      </section>

      {confirmation ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="card modal">
            <h2>Transfer Complete</h2>
            <p>
              ${confirmation.amount} moved from {confirmation.fromLabel} to {confirmation.toLabel}.
            </p>
            <button type="button" onClick={() => setConfirmation(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
