import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEMO_HOLDINGS, DEMO_ACCOUNTS, DEMO_BUDGET, DEMO_DEBT,
  DEMO_GOALS, DEMO_SPENDING, DEMO_GIVING, DEMO_INCOME_PHASES, DEMO_SUBSCRIPTIONS,
  normalizePortfolioData,
  normalizeSpendingMonth, normalizeSpendingMonths, validatePortfolioData,
} from '../utils/financeData';

const STORAGE_KEY = 'epiphany_portfolio';
const EMPTY_PORTFOLIO = {
  holdings: DEMO_HOLDINGS,
  accounts: DEMO_ACCOUNTS,
  budget: DEMO_BUDGET,
  debt: DEMO_DEBT,
  goals: DEMO_GOALS,
  spending: DEMO_SPENDING,
  giving: DEMO_GIVING,
  incomePhases: DEMO_INCOME_PHASES,
  subscriptions: DEMO_SUBSCRIPTIONS,
};

// Accounts come exclusively from brokerage sync -- drop stale
// manually-seeded rows (old TFSA/Vacation balances) from persisted data.
// The scrubbed copy is written back on the next persistPortfolio call.
function scrubManualAccounts(data) {
  if (!data || !Array.isArray(data.accounts)) return data;
  return { ...data, accounts: data.accounts.filter(a => a.source === 'broker') };
}

// Mirror of the server-side scrub in server/api/portfolio.js -- stale Visa /
// "Dad $25" debt rows persist in localStorage and would resurface on load.
function scrubRemovedDebts(data) {
  if (!data || !Array.isArray(data.debt)) return data;
  return {
    ...data,
    debt: data.debt.filter(d => {
      const name = String(d.name || '').toLowerCase();
      if (name.includes('visa')) return false;
      if ((name.includes('dad') || name.includes('mom')) && Number(d.balance) <= 25) return false;
      return true;
    }),
  };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const { valid } = validatePortfolioData(data);
    return valid ? scrubRemovedDebts(scrubManualAccounts(normalizePortfolioData(data))) : null;
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
    return valid ? scrubRemovedDebts(scrubManualAccounts(normalizePortfolioData(data))) : null;
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

// Merge broker balance.accounts ({account, currency, cash}) into the
// user's manual accounts list by case-insensitive name match. Matching
// accounts get their balance/currency synced from the broker; manual
// accounts with no broker match (e.g. a cash envelope) are kept as-is.
function mergeBrokerAccounts(manualAccounts, brokerAccounts) {
  if (!Array.isArray(manualAccounts)) return brokerAccounts || [];
  const result = manualAccounts.map(a => ({ ...a }));
  const used = new Set();
  for (const ba of brokerAccounts || []) {
    const name = ba.account || 'Brokerage';
    const lowerName = name.toLowerCase();
    let idx = result.findIndex((a, i) =>
      !used.has(i) && (a.brokerAlias || []).some(alias => lowerName.includes(alias.toLowerCase()))
    );
    if (idx < 0) {
      idx = result.findIndex((a, i) =>
        !used.has(i) && (a.name.toLowerCase().includes(lowerName) || lowerName.includes(a.name.toLowerCase()))
      );
    }
    const merged = { name, type: 'brokerage', balance: ba.cash, currency: ba.currency || 'CAD', source: 'broker' };
    if (idx >= 0) { result[idx] = { ...result[idx], ...merged, name: result[idx].name }; used.add(idx); }
    else result.push(merged);
  }
  return result;
}

export function usePortfolio(stocks, isAuthenticated) {
  const [customData, setCustomData] = useState(() => loadFromStorage());
  const [serverLoaded, setServerLoaded] = useState(false);
  const [portfolioFetchedAt, setPortfolioFetchedAt] = useState(null);
  const [extraQuotes, setExtraQuotes] = useState({});
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
      setPortfolioFetchedAt(new Date());
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
  const subscriptions = customData?.subscriptions ?? DEMO_SUBSCRIPTIONS;

  // Holdings whose symbols aren't in the main stocks feed (e.g. broker-synced
  // RL) get a one-shot quote fetch so they don't render as $0.
  useEffect(() => {
    const missing = holdings
      .map(h => h.symbol)
      .filter(s => s && !stocks?.[s] && !extraQuotes[s]);
    if (missing.length === 0) return;
    let cancelled = false;
    fetch(`/api/stocks-free?symbols=${encodeURIComponent(missing.join(','))}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        // Endpoint returns { stocks: [...] }; older deploys returned a bare array.
        const list = Array.isArray(data) ? data : data?.stocks;
        if (cancelled || !Array.isArray(list)) return;
        setExtraQuotes(prev => {
          const next = { ...prev };
          // Mark fetched-but-absent symbols too, so a symbol the feed can't
          // resolve doesn't trigger an endless refetch loop.
          missing.forEach(s => { next[s] = next[s] ?? { symbol: s, price: null }; });
          list.forEach(q => { if (q?.symbol) next[q.symbol] = q; });
          return next;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [holdings, stocks, extraQuotes]);

  // Merge live stock prices with holdings for real-time valuation.
  // Broker-synced holdings (source: 'broker') have no cost basis from
  // SnapTrade -- report gain/gainPercent as null rather than fabricating $0.
  const valuedHoldings = useMemo(() => {
    return holdings.map(h => {
      const live = stocks?.[h.symbol] ?? extraQuotes[h.symbol];
      if (h.source === 'broker' && h.costBasis == null) {
        // marketValue of 0 with shares held means SnapTrade omitted it -- fall through to price
        const marketValue = h.marketValue === 0 && h.shares > 0 ? null : h.marketValue;
        const currentPrice = live?.price ?? (marketValue != null && h.shares ? marketValue / h.shares : null);
        const value = live?.price != null && h.shares ? h.shares * live.price : (marketValue ?? (currentPrice != null ? h.shares * currentPrice : null));
        return { ...h, currentPrice, value, gain: null, gainPercent: null, changePercent: live?.changePercent ?? 0 };
      }
      const currentPrice = live?.price ?? h.costBasis;
      const value = h.shares * currentPrice;
      const cost = h.shares * h.costBasis;
      const gain = value - cost;
      const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
      return { ...h, currentPrice, value, gain, gainPercent, changePercent: live?.changePercent ?? 0 };
    });
  }, [holdings, stocks, extraQuotes]);

  const stocksValue = useMemo(() => valuedHoldings.reduce((sum, h) => sum + h.value, 0), [valuedHoldings]);
  const cashValue = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);
  const totalDebt = useMemo(() => debt.reduce((sum, d) => sum + d.balance, 0), [debt]);

  const totalIncome = useMemo(() => (Array.isArray(budget?.income) ? budget.income : []).reduce((sum, i) => sum + i.amount, 0), [budget]);
  const totalExpenses = useMemo(() => (Array.isArray(budget?.expenses) ? budget.expenses : []).reduce((sum, e) => sum + e.amount, 0), [budget]);
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

  const brokerSnapshot = customData?.brokerSnapshot ?? null;

  // Pull the latest brokerage snapshot and, if linked, replace stock
  // holdings + merge cash account balances -- persisted permanently via
  // saveData so it survives reloads until the next sync.
  const syncBroker = useCallback(async (force = false) => {
    if (!isAuthenticated) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch('/api/broker/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!data.ok) return { success: false, error: data.error || 'Sync failed' };

      const base = customData || EMPTY_PORTFOLIO;

      if (!data.linked) {
        persistPortfolio({ ...base, brokerSnapshot: { linked: false } });
        return { success: true, linked: false };
      }

      const nextHoldings = (data.holdings || []).map(h => ({
        symbol: h.symbol, shares: h.shares, costBasis: null,
        marketValue: h.marketValue, account: h.account, source: 'broker',
      }));
      const nextAccounts = mergeBrokerAccounts(base.accounts, data.balance?.accounts);

      persistPortfolio({
        ...base,
        holdings: nextHoldings,
        accounts: nextAccounts,
        brokerSnapshot: { linked: true, syncedAt: data.syncedAt },
      });
      return { success: true, linked: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [isAuthenticated, customData, persistPortfolio]);

  return {
    holdings: valuedHoldings,
    accounts,
    budget,
    debt,
    goals,
    spending,
    giving,
    incomePhases,
    subscriptions,
    stocksValue,
    cashValue,
    totalDebt,
    totalIncome,
    totalExpenses,
    surplus,
    netWorth,
    isDemo,
    portfolioFetchedAt,
    brokerSnapshot,
    syncBroker,
    importData,
    importSpendingMonth,
    syncSpendingMonths,
    exportData,
    saveData,
    resetToDemo,
  };
}
