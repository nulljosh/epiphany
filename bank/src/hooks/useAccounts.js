import { useEffect, useMemo, useState } from 'react';
import { accounts as initialAccounts, transactions as initialTransactions } from '../utils/mockData';

const STORAGE_KEY = 'bank-app-state-v1';

const readStorage = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { accounts: initialAccounts, transactions: initialTransactions };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      accounts: parsed.accounts ?? initialAccounts,
      transactions: parsed.transactions ?? initialTransactions
    };
  } catch {
    return { accounts: initialAccounts, transactions: initialTransactions };
  }
};

export const useAccounts = () => {
  const [state, setState] = useState(readStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const createAccount = (account) => {
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, { ...account, id: account.id ?? `acc-${Date.now()}` }]
    }));
  };

  const updateAccount = (accountId, updates) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) => (account.id === accountId ? { ...account, ...updates } : account))
    }));
  };

  const deleteAccount = (accountId) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((account) => account.id !== accountId)
    }));
  };

  const addTransaction = (transaction) => {
    setState((prev) => ({
      ...prev,
      transactions: [{ ...transaction, id: transaction.id ?? `txn-${Date.now()}` }, ...prev.transactions]
    }));
  };

  const transfer = ({ fromId, toId, amount, note }) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }
    if (fromId === toId) {
      throw new Error('Choose two different accounts.');
    }

    setState((prev) => {
      const from = prev.accounts.find((account) => account.id === fromId);
      if (!from) {
        throw new Error('Source account not found.');
      }
      if (from.balance < value) {
        throw new Error('Insufficient funds.');
      }

      const timestamp = new Date().toISOString();
      const nextAccounts = prev.accounts.map((account) => {
        if (account.id === fromId) {
          return { ...account, balance: Number((account.balance - value).toFixed(2)) };
        }
        if (account.id === toId) {
          return { ...account, balance: Number((account.balance + value).toFixed(2)) };
        }
        return account;
      });

      const fromTransaction = {
        id: `txn-${Date.now()}-out`,
        merchant: 'Transfer Out',
        description: note || `Transfer to ${toId === 'external' ? 'External Account' : toId}`,
        amount: value,
        type: 'debit',
        category: 'transfer',
        date: timestamp
      };

      const toTransaction =
        toId !== 'external'
          ? {
              id: `txn-${Date.now()}-in`,
              merchant: 'Transfer In',
              description: note || `Transfer from ${fromId}`,
              amount: value,
              type: 'credit',
              category: 'transfer',
              date: timestamp
            }
          : null;

      return {
        accounts: nextAccounts,
        transactions: [fromTransaction, ...(toTransaction ? [toTransaction] : []), ...prev.transactions]
      };
    });
  };

  const totalBalance = useMemo(
    () => state.accounts.reduce((sum, account) => sum + account.balance, 0),
    [state.accounts]
  );

  return {
    accounts: state.accounts,
    transactions: state.transactions,
    totalBalance,
    createAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    transfer
  };
};
