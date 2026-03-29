import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEMO_HOLDINGS, DEMO_ACCOUNTS, DEMO_BUDGET, DEMO_DEBT,
  DEMO_GOALS, DEMO_SPENDING, DEMO_GIVING, DEMO_INCOME_PHASES,
  normalizePortfolioData,
  normalizeSpendingMonth, normalizeSpendingMonths, validatePortfolioData,
} from '../utils/financeData';

const STORAGE_KEY = 'monica_portfolio';
const EMPTY_PORTFOLIO = {
  holdings: DEMO_HOLDINGS,
  accounts: DEMO_ACCOUNTS,
  budget: DEMO_BUDGET,
  debt: DEMO_DEBT,
  goals: DEMO_GOALS,
  spending: DEMO_SPENDING,
  giving: DEMO_GIVING,
  incomePhases: DEMO_INCOME_PHASES,
};

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const { valid } = validatePortfolioData(data);
    return valid ? normalizePortfolioData(data) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save portfolio:', err);
  }
}

async function fetchServerPortfolio() {
  try {
    const res = await fetch('/api/portfolio?action=get', { credentials: 'include' });
    if (!res.ok) { console.warn('[portfolio] fetch failed:', res.status); return null; }
    const data = await res.json();
    if (data.empty) return null;
    const { valid, error } = validatePortfolioData(data);
    if (!valid) { console.warn('[portfolio] validation failed:', error); }
    return valid ? normalizePortfolioData(data) : null;
  } catch (err) {
    console.warn('[portfolio] fetch error:', err);
    return null;
  }
}

async function pushToServer(data) {
  try {
    await fetch('/api/portfolio?action=update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...data, _fullReplace: true }),
    });
  } catch {
    // best-effort server sync
  }
}

export function usePortfolio(stocks, isAuthenticated) {
  const [customData, setCustomData] = useState(() => loadFromStorage());
  const [serverLoaded, setServerLoaded] = useState(false);
  const isDemo = !customData;

  const persistPortfolio = useCallback((nextData) => {
    const normalized = normalizePortfolioData(nextData);
    setCustomData(normalized);
    saveToStorage(normalized);
    if (isAuthenticated) pushToServer(normalized);
    return normalized;
  }, [isAuthenticated]);

  // Fetch from server when authenticated
  useEffect(() => {
    if (!isAuthenticated || serverLoaded) return;
    fetchServerPortfolio().then(data => {
      setServerLoaded(true);
      if (data) {
        setCustomData(data);
        saveToStorage(data);
      }
    });
  }, [isAuthenticated, serverLoaded]);

  const holdings = customData?.holdings ?? DEMO_HOLDINGS;
  const accounts = customData?.accounts ?? DEMO_ACCOUNTS;
  const budget = customData?.budget ?? DEMO_BUDGET;
  const debt = customData?.debt ?? DEMO_DEBT;
  const goals = customData?.goals ?? DEMO_GOALS;
  const spending = customData?.spending ?? DEMO_SPENDING;
  const giving = customData?.giving ?? DEMO_GIVING;
  const incomePhases = customData?.incomePhases ?? DEMO_INCOME_PHASES;

  // Merge live stock prices with holdings for real-time valuation
  const valuedHoldings = useMemo(() => {
    if (!stocks) return holdings.map(h => ({ ...h, currentPrice: h.costBasis, value: h.shares * h.costBasis, gain: 0, gainPercent: 0 }));

    return holdings.map(h => {
      const live = stocks[h.symbol];
      const currentPrice = live?.price ?? h.costBasis;
      const value = h.shares * currentPrice;
      const cost = h.shares * h.costBasis;
      const gain = value - cost;
      const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
      return { ...h, currentPrice, value, gain, gainPercent, changePercent: live?.changePercent ?? 0 };
    });
  }, [holdings, stocks]);

  const stocksValue = useMemo(() => valuedHoldings.reduce((sum, h) => sum + h.value, 0), [valuedHoldings]);
  const cashValue = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);
  const totalDebt = useMemo(() => debt.reduce((sum, d) => sum + d.balance, 0), [debt]);

  const totalIncome = useMemo(() => budget.income.reduce((sum, i) => sum + i.amount, 0), [budget]);
  const totalExpenses = useMemo(() => budget.expenses.reduce((sum, e) => sum + e.amount, 0), [budget]);
  const surplus = totalIncome - totalExpenses;

  const netWorth = stocksValue + cashValue - totalDebt;

  const importData = useCallback((data) => {
    const { valid, error } = validatePortfolioData(data);
    if (!valid) return { success: false, error };
    persistPortfolio(data);
    return { success: true };
  }, [persistPortfolio]);

  const importSpendingMonth = useCallback((monthData) => {
    const normalizedMonth = normalizeSpendingMonth(monthData);
    if (!normalizedMonth) {
      return { success: false, error: 'Invalid statement data' };
    }

    const base = customData || EMPTY_PORTFOLIO;

    const nextSpending = [...(base.spending || [])]
      .filter((entry) => entry.month !== normalizedMonth.month)
      .concat(normalizedMonth)
      .sort((a, b) => String(a.sortKey || a.month).localeCompare(String(b.sortKey || b.month)));

    const nextData = { ...base, spending: nextSpending };
    persistPortfolio(nextData);
    return { success: true };
  }, [customData, persistPortfolio]);

  const syncSpendingMonths = useCallback((months) => {
    if (!Array.isArray(months)) return { success: false, error: 'Invalid statement list' };

    const validMonths = normalizeSpendingMonths(months);
    if (validMonths.length === 0) return { success: true, changed: false };

    const base = customData || EMPTY_PORTFOLIO;

    const nextByMonth = new Map((base.spending || []).map((entry) => [entry.month, entry]));
    let changed = false;

    for (const monthData of validMonths) {
      const nextEntry = monthData;
      const prevEntry = nextByMonth.get(monthData.month);
      if (JSON.stringify(prevEntry) !== JSON.stringify(nextEntry)) {
        changed = true;
        nextByMonth.set(monthData.month, nextEntry);
      }
    }

    if (!changed) return { success: true, changed: false };

    const nextData = {
      ...base,
      spending: Array.from(nextByMonth.values()).sort((a, b) => String(a.sortKey || a.month).localeCompare(String(b.sortKey || b.month))),
    };
    persistPortfolio(nextData);
    return { success: true, changed: true };
  }, [customData, persistPortfolio]);

  const exportData = useCallback(() => {
    return customData || EMPTY_PORTFOLIO;
  }, [customData]);

  const saveData = useCallback((data) => {
    const { valid, error } = validatePortfolioData(data);
    if (!valid) return { success: false, error };
    persistPortfolio(data);
    return { success: true };
  }, [persistPortfolio]);

  const resetToDemo = useCallback(() => {
    setCustomData(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    holdings: valuedHoldings,
    accounts,
    budget,
    debt,
    goals,
    spending,
    giving,
    incomePhases,
    stocksValue,
    cashValue,
    totalDebt,
    totalIncome,
    totalExpenses,
    surplus,
    netWorth,
    isDemo,
    importData,
    importSpendingMonth,
    syncSpendingMonths,
    exportData,
    saveData,
    resetToDemo,
  };
}
