import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePolymarket } from './hooks/usePolymarket';
import { useLivePrices } from './hooks/useLivePrices';
import { useStocks } from './hooks/useStocks';
import { applyResolvedTheme, getTheme, resolveAutoTheme } from './utils/theme';
import { defaultAssets } from './utils/assets';
import { tldr } from './utils/helpers';
import { useElapsedTime } from './hooks/useElapsedTime';
import { useRunHistory } from './hooks/useRunHistory';
import { useTradeShortcuts } from './hooks/useTradeShortcuts';
import { usePredictionMarketTrading } from './hooks/usePredictionMarketTrading';
import PricingPage from './components/PricingPage';
import FinancePanel from './components/FinancePanel';
import LiveMapBackdrop from './components/LiveMapBackdrop';
import SituationMonitor from './components/SituationMonitor';
import MarketsPanel from './components/MarketsPanel';
import { useSubscription } from './hooks/useSubscription';
import { useAuth } from './hooks/useAuth';
import { useWatchlist } from './hooks/useWatchlist';
import { useAlerts } from './hooks/useAlerts';
import AlertsPanel from './components/AlertsPanel';
import { useWeather } from './hooks/useWeather';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Settings from './components/Settings';
import PeoplePanel from './components/PeoplePanel';
import CommandBar from './components/CommandBar';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import DesktopLayout from './layouts/DesktopLayout';
import MobileLayout from './layouts/MobileLayout';

// Trading Simulator Assets (US50 + Indices + Crypto)
// Fallback prices - live prices auto-loaded from Yahoo Finance via useStocks
// Last manual update: Feb 4, 2026
const ASSETS = {
  // Indices (live via commodities.js / useLivePrices)
  NAS100: { name: 'Nasdaq 100', price: 21600, color: '#00d4ff' },
  SP500:  { name: 'S&P 500',   price: 6120,  color: '#ff6b6b' },
  US30:   { name: 'Dow Jones', price: 44200,  color: '#4ecdc4' },
  XAU:    { name: 'Gold',      price: 2943,   color: '#FFD700' },
  XAG:    { name: 'Silver',    price: 32.8,   color: '#A0A0A0' },
  // Top 100 stocks — seed prices Feb 20 2026 (replaced by live data on load)
  AAPL:   { name: 'Apple',          price: 245,   color: '#555'     },
  MSFT:   { name: 'Microsoft',      price: 416,   color: '#00A2ED'  },
  GOOGL:  { name: 'Google',         price: 196,   color: '#4285F4'  },
  AMZN:   { name: 'Amazon',         price: 228,   color: '#FF9900'  },
  NVDA:   { name: 'Nvidia',         price: 136,   color: '#76B900'  },
  META:   { name: 'Meta',           price: 705,   color: '#0668E1'  },
  TSLA:   { name: 'Tesla',          price: 338,   color: '#CC0000'  },
  'BRK-B':{ name: 'Berkshire',      price: 499,   color: '#004080'  },
  LLY:    { name: 'Eli Lilly',      price: 803,   color: '#DC143C'  },
  V:      { name: 'Visa',           price: 349,   color: '#1A1F71'  },
  UNH:    { name: 'UnitedHealth',   price: 514,   color: '#002677'  },
  XOM:    { name: 'Exxon',          price: 109,   color: '#FF0000'  },
  JPM:    { name: 'JPMorgan',       price: 269,   color: '#117ACA'  },
  WMT:    { name: 'Walmart',        price: 98,    color: '#0071CE'  },
  JNJ:    { name: 'J&J',            price: 157,   color: '#D32F2F'  },
  MA:     { name: 'Mastercard',     price: 553,   color: '#EB001B'  },
  PG:     { name: 'P&G',            price: 162,   color: '#003DA5'  },
  AVGO:   { name: 'Broadcom',       price: 218,   color: '#E60000'  },
  HD:     { name: 'Home Depot',     price: 415,   color: '#F96302'  },
  CVX:    { name: 'Chevron',        price: 153,   color: '#0033A0'  },
  MRK:    { name: 'Merck',          price: 95,    color: '#0033A0'  },
  COST:   { name: 'Costco',         price: 1005,  color: '#0066B2'  },
  ABBV:   { name: 'AbbVie',         price: 207,   color: '#071D49'  },
  KO:     { name: 'Coca-Cola',      price: 64,    color: '#F40009'  },
  PEP:    { name: 'PepsiCo',        price: 149,   color: '#004B93'  },
  AMD:    { name: 'AMD',            price: 117,   color: '#ED1C24'  },
  ADBE:   { name: 'Adobe',          price: 432,   color: '#FF0000'  },
  CRM:    { name: 'Salesforce',     price: 314,   color: '#00A1E0'  },
  NFLX:   { name: 'Netflix',        price: 1023,  color: '#E50914'  },
  CSCO:   { name: 'Cisco',          price: 58,    color: '#049FD9'  },
  TMO:    { name: 'Thermo Fisher',  price: 544,   color: '#00457C'  },
  ORCL:   { name: 'Oracle',         price: 189,   color: '#C74634'  },
  ACN:    { name: 'Accenture',      price: 335,   color: '#A100FF'  },
  INTC:   { name: 'Intel',          price: 21,    color: '#0071C5'  },
  NKE:    { name: 'Nike',           price: 72,    color: '#000000'  },
  TXN:    { name: 'Texas Instruments', price: 215, color: '#8B0000' },
  QCOM:   { name: 'Qualcomm',       price: 147,   color: '#3253DC'  },
  PM:     { name: 'Philip Morris',  price: 138,   color: '#003DA5'  },
  DHR:    { name: 'Danaher',        price: 195,   color: '#005EB8'  },
  INTU:   { name: 'Intuit',         price: 668,   color: '#393A56'  },
  UNP:    { name: 'Union Pacific',  price: 238,   color: '#004098'  },
  RTX:    { name: 'Raytheon',       price: 145,   color: '#00205B'  },
  HON:    { name: 'Honeywell',      price: 215,   color: '#DC1E35'  },
  SPGI:   { name: 'S&P Global',     price: 466,   color: '#FF8200'  },
  // S&P 500 Extended - Financials
  BAC: { name: 'Bank of America', price: 43, color: '#E31837' },
  GS: { name: 'Goldman Sachs', price: 570, color: '#6495ED' },
  MS: { name: 'Morgan Stanley', price: 135, color: '#002B5B' },
  C: { name: 'Citigroup', price: 73, color: '#056DAE' },
  WFC: { name: 'Wells Fargo', price: 73, color: '#D71E28' },
  BLK: { name: 'BlackRock', price: 1050, color: '#1A1A1A' },
  SCHW: { name: 'Schwab', price: 78, color: '#00AEEF' },
  AXP: { name: 'Amex', price: 300, color: '#007BC1' },
  // S&P 500 Extended - Healthcare
  PFE: { name: 'Pfizer', price: 27, color: '#00549F' },
  AMGN: { name: 'Amgen', price: 310, color: '#0D6EAD' },
  BMY: { name: 'Bristol-Myers', price: 60, color: '#6B2D8B' },
  MDT: { name: 'Medtronic', price: 88, color: '#CE1126' },
  BSX: { name: 'Boston Scientific', price: 95, color: '#005EB8' },
  ELV: { name: 'Elevance Health', price: 420, color: '#00427A' },
  CVS: { name: 'CVS Health', price: 58, color: '#CC0000' },
  // S&P 500 Extended - Industrials
  UPS: { name: 'UPS', price: 115, color: '#351C15' },
  FDX: { name: 'FedEx', price: 270, color: '#4D148C' },
  BA: { name: 'Boeing', price: 175, color: '#1D428A' },
  CAT: { name: 'Caterpillar', price: 355, color: '#FFCD11' },
  DE: { name: 'John Deere', price: 430, color: '#367C2B' },
  LMT: { name: 'Lockheed Martin', price: 495, color: '#00205B' },
  GE: { name: 'GE Aerospace', price: 195, color: '#0066CC' },
  // S&P 500 Extended - Media & Telecom
  DIS: { name: 'Disney', price: 112, color: '#113CCF' },
  CMCSA: { name: 'Comcast', price: 37, color: '#CD1426' },
  VZ: { name: 'Verizon', price: 40, color: '#CD040B' },
  T: { name: 'AT&T', price: 22, color: '#00A8E0' },
  TMUS: { name: 'T-Mobile', price: 255, color: '#E20074' },
  // S&P 500 Extended - Utilities
  NEE: { name: 'NextEra Energy', price: 67, color: '#00A3E0' },
  DUK: { name: 'Duke Energy', price: 112, color: '#006BB6' },
  SO: { name: 'Southern Co', price: 78, color: '#FDB813' },
  // S&P 500 Extended - Consumer
  TGT: { name: 'Target', price: 128, color: '#CC0000' },
  LOW: { name: "Lowe's", price: 240, color: '#004990' },
  SBUX: { name: 'Starbucks', price: 98, color: '#00704A' },
  MCD: { name: "McDonald's", price: 295, color: '#DA291C' },
  YUM: { name: 'Yum Brands', price: 140, color: '#EE3124' },
  F: { name: 'Ford', price: 9, color: '#003476' },
  GM: { name: 'General Motors', price: 52, color: '#0170CE' },
  // S&P 500 Extended - REITs & Other
  AMT: { name: 'American Tower', price: 205, color: '#0072BC' },
  PLD: { name: 'Prologis', price: 110, color: '#005EB8' },
  CME: { name: 'CME Group', price: 230, color: '#D0021B' },
  WM: { name: 'Waste Management', price: 225, color: '#005A2B' },
  XYZ: { name: 'Block Inc', price: 68, color: '#3D3D3D' },
  // Popular stocks
  COIN: { name: 'Coinbase', price: 265, color: '#0052FF' },
  PLTR: { name: 'Palantir', price: 138, color: '#9d4edd' },
  HOOD: { name: 'Robinhood', price: 86, color: '#00C805' },
  // Meme coins
  FARTCOIN: { name: 'FartCoin', price: 0.85, color: '#8B4513' },
  WIF: { name: 'dogwifhat', price: 1.92, color: '#FF69B4' },
  BONK: { name: 'Bonk', price: 0.00002, color: '#FFA500' },
  PEPE: { name: 'Pepe', price: 0.000012, color: '#00FF00' },
  DOGE: { name: 'Dogecoin', price: 0.31, color: '#C2A633' },
  SHIB: { name: 'Shiba Inu', price: 0.000021, color: '#FFA500' },
};
const SYMS = Object.keys(ASSETS);

export default function App() {
  const { user, loading: authLoading, error: authError, isAuthenticated, login, register, logout, refresh, changeName, changeEmail, changePassword } = useAuth();
  const resetToken = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);
  const [authView, setAuthView] = useState(resetToken ? 'reset' : 'login'); // 'login' | 'register' | 'reset'
  const [showLanding, setShowLanding] = useState(true);

  const { showHelp, setShowHelp, SHORTCUTS } = useKeyboardShortcuts();
  const [dark, setDark] = useState(true);
  const [tickerVisible, setTickerVisible] = useState(() => {
    try { return localStorage.getItem('epiphany_ticker_visible') !== 'false'; } catch { return true; }
  });
  const [activeTab, setActiveTab] = useState('situation');
  const [mapLayers, setMapLayers] = useState({ flights: true, earthquakes: true, news: true, traffic: true, predictions: true, weather: true, heatmap: false, incidents: true, crime: true, localEvents: true, wildfires: true, aqi: true });
  const mapInstanceRef = useRef(null);
  useEffect(() => { applyResolvedTheme(dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { try { localStorage.setItem('epiphany_ticker_visible', tickerVisible); } catch {} }, [tickerVisible]);
  const t = getTheme(dark);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const [showPricing, setShowPricing] = useState(false);
  // Deeply nested cards (e.g. TradeWorkflow's Autopilot upsell) open pricing
  // via this event instead of prop-drilling setShowPricing through panels.
  useEffect(() => {
    const open = () => setShowPricing(true);
    window.addEventListener('epiphany:show-pricing', open);
    return () => window.removeEventListener('epiphany:show-pricing', open);
  }, []);
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarStock, setCommandBarStock] = useState(null);
  const desktopPanelRef = useRef(null);
  const desktopNavRef = useRef(null);
  const handleMobileTabSelect = useCallback((nextTab) => {
    const isSameTab = activeTab === nextTab;
    if (!isSameTab) {
      setActiveTab(nextTab);
      setMobilePanelOpen(true);
    } else {
      setMobilePanelOpen((open) => !open);
    }
    setMobileTabsOpen(false);
  }, [activeTab]);
  const handleDesktopTabSelect = useCallback((nextTab) => {
    if (activeTab === nextTab) {
      setDesktopPanelOpen((open) => !open);
      return;
    }
    setActiveTab(nextTab);
    setDesktopPanelOpen(true);
  }, [activeTab]);
  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Cmd+K / Ctrl+K -> command bar
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandBarOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (commandBarOpen) { setCommandBarOpen(false); return; }
        setMobilePanelOpen(false);
        setMobileTabsOpen(false);
        setDesktopPanelOpen(false);
        return;
      }
      // Skip shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Number keys switch tabs
      const numKey = parseInt(e.key);
      if (numKey >= 1 && numKey <= 6) {
        const tabs = ['situation', 'markets', 'portfolio', 'settings'];
        const tab = tabs[numKey - 1];
        setActiveTab(tab);
        if (isMobileNav) setMobilePanelOpen(true);
        else setDesktopPanelOpen(true);
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [commandBarOpen, isMobileNav]);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      setIsMobileNav(e.matches);
      if (e.matches) {
        setDesktopPanelOpen(false);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  useEffect(() => {
    if (isMobileNav || !desktopPanelOpen) return;
    const handleOutside = (e) => {
      const target = e.target;
      if (desktopPanelRef.current?.contains(target) || desktopNavRef.current?.contains(target)) return;
      setDesktopPanelOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [desktopPanelOpen, isMobileNav]);
  const { isPro, isStarter, isFree, subscription, refetch: refetchSubscription } = useSubscription();

  // Capture session_id from Stripe checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;

    // Strip session_id from URL immediately
    const url = new URL(window.location);
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.pathname + url.search);

    fetch('/api/stripe?action=resolve-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.customerId) {
          localStorage.setItem('stripe_customer_id', data.customerId);
          refetchSubscription();
        }
      })
      .catch(err => console.error('Failed to resolve checkout session:', err));
  }, [refetchSubscription]);
  const { watchlist, addSymbol, removeSymbol, toggleSymbol } = useWatchlist(user);
  const { alerts, activeCount, addAlert, removeAlert, clearTriggered, checkAlerts } = useAlerts(user);
  const [showAlerts, setShowAlerts] = useState(false);
  const weather = useWeather();

  // Fibonacci levels from $1 to $10T
  const FIB_LEVELS = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
    10000, 20000, 50000, 100000, 200000, 500000, 1000000,
    2000000, 5000000, 10000000, 20000000, 50000000,
    100000000, 200000000, 500000000, 1000000000,
    // $1B to $10T
    2000000000, 5000000000, 10000000000, 20000000000, 50000000000,
    100000000000, 200000000000, 500000000000, 1000000000000,
    2000000000000, 5000000000000, 10000000000000
  ];

  // Trading Simulator State
  const [balance, setBalance] = useState(1);
  const [position, setPosition] = useState(null);
  const [prices, setPrices] = useState(() => Object.fromEntries(SYMS.map(s => [s, [ASSETS[s].price]])));
  const [trades, setTrades] = useState([]);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [lastTraded, setLastTraded] = useState(null);
  const [perfMode, setPerfMode] = useState(true);
  const targetTrillion = true;
  const trends = useRef(Object.fromEntries(SYMS.map(s => [s, 0])));
  const [tradeStats, setTradeStats] = useState({ wins: {}, losses: {} });
  const cooldownSyms = useRef({});  // sym -> tick when cooldown expires
  const [apiCostPerDay] = useState(2.89);

  // Broker state
  const DEFAULT_BROKER_CONFIG = { broker: 'ctrader', clientId: '', clientSecret: '', refreshToken: '', accountId: '', webhookUrl: '', accessToken: '' };
  const [brokerConfig, setBrokerConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('epiphany_broker_config')) || DEFAULT_BROKER_CONFIG; }
    catch { return DEFAULT_BROKER_CONFIG; }
  });
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [signalLog, setSignalLog] = useState([]);
  const [autoSend, setAutoSend] = useState(() => {
    try { return JSON.parse(localStorage.getItem('epiphany_broker_autosend')) || false; }
    catch { return false; }
  });
  const brokerRef = useRef(null);

  // Milestone state management
  const [currentMilestone, setCurrentMilestone] = useState(1e9); // Start at $1B
  const [nextMilestone, setNextMilestone] = useState(null);

  // Animation refs for smooth 60fps rendering
  const animationRef = useRef(null);
  const lastFrameTime = useRef(0);
  const pricesRef = useRef(prices);
  const tickRef = useRef(0);
  const liveStocksRef = useRef({});

  const { prices: liveAssets, lastUpdated } = useLivePrices(defaultAssets);
  const { markets, whales, loading: pmLoading, error: pmError } = usePolymarket();
  const { stocks, reliability: stocksReliability } = useStocks();

  const { elapsedTime, resetElapsedTime } = useElapsedTime(running);
  const { runStats } = useRunHistory({ running, balance, tick, trades, elapsedTime, targetTrillion });
  const { pmExits, lastPmBetRef, resetPM } = usePredictionMarketTrading({ markets, running, balance, setBalance, setTrades });

  // Sync live stock prices into ref for simulator access
  useEffect(() => {
    if (stocks) liveStocksRef.current = stocks;
  }, [stocks]);

  // Check price alerts on stock updates
  useEffect(() => {
    if (stocks) checkAlerts(stocks);
  }, [stocks, checkAlerts]);

  // Trading Simulator Logic - requestAnimationFrame for smooth 60fps
  useEffect(() => {
    const target = targetTrillion ? 1000000000000 : 1000000000;
    if (!running || balance <= 0.5 || balance >= target) return;

    // Sync ref with current state on start
    pricesRef.current = prices;
    tickRef.current = tick;
    lastFrameTime.current = performance.now();

    // Simulation ticks per visual frame (higher = faster simulation)
    const ticksPerFrame = perfMode ? 50 : 100;

    const animate = (currentTime) => {
      // Run multiple simulation ticks per frame for speed
      for (let t = 0; t < ticksPerFrame; t++) {
        const next = {};
        SYMS.forEach(sym => {
          try {
            if (Math.random() < 0.05) trends.current[sym] = (Math.random() - 0.45) * 0.006;
            const drift = 0.0001;
            const move = drift + trends.current[sym] + (Math.random() - 0.5) * 0.008;
            const prev = pricesRef.current[sym];
            const last = prev[prev.length - 1];
            // Use live Yahoo Finance price as base when available, fallback to static
            const liveStock = liveStocksRef.current[sym];
            const base = (liveStock && typeof liveStock.price === 'number') ? liveStock.price : ASSETS[sym].price;

            if (typeof last !== 'number' || isNaN(last)) {
              next[sym] = [base];
              return;
            }

            const newPrice = Math.max(base * 0.7, Math.min(base * 1.5, last * (1 + move)));
            const priceHistory = prev.length >= 30 ? prev.slice(-29) : prev;
            next[sym] = [...priceHistory, newPrice];
          } catch (err) {
            next[sym] = pricesRef.current[sym] || [ASSETS[sym].price];
          }
        });
        pricesRef.current = next;
        tickRef.current += 1;
      }

      // Batch state update once per frame for React rendering
      setPrices(pricesRef.current);
      setTick(tickRef.current);
      lastFrameTime.current = currentTime;

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running, balance, perfMode, targetTrillion]);

  useEffect(() => {
    if (!position || !running) return;

    const p = prices[position.sym];
    if (!p || p.length === 0) return;

    const current = p[p.length - 1];
    const pnl = (current - position.entry) * position.size;
    const pnlPct = (current - position.entry) / position.entry;

    if (current <= position.stop) {
      setBalance(b => Math.max(0.5, b + pnl));
      setTrades(t => {
        const updated = [...t, { type: 'STOP', sym: position.sym, pnl: pnl.toFixed(2) }];
        return updated.length > 100 ? updated.slice(-100) : updated;
      });
      setTradeStats(s => ({ ...s, losses: { ...s.losses, [position.sym]: (s.losses[position.sym] || 0) + pnl } }));
      // Cooldown: avoid re-entering same symbol for 50 ticks after stop-loss
      cooldownSyms.current[position.sym] = tickRef.current + 50;
      setPosition(null);
      return;
    }

    if (current >= position.target) {
      const newBalance = balance + pnl;

      // Don't cap balance anymore - let it run past milestones
      setBalance(newBalance);
      setTrades(t => {
        const updated = [...t, { type: 'WIN', sym: position.sym, pnl: pnl.toFixed(2) }];
        return updated.length > 100 ? updated.slice(-100) : updated;
      });
      setTradeStats(s => ({ ...s, wins: { ...s.wins, [position.sym]: (s.wins[position.sym] || 0) + pnl } }));
      setPosition(null);

      // Update milestone tracker as balance grows
      if (newBalance >= currentMilestone) {
        const nextMile = FIB_LEVELS.find(level => level > newBalance);
        if (nextMile) setCurrentMilestone(nextMile);
      }
      return;
    }

    if (pnlPct > 0.02) {
      setPosition(pos => ({ ...pos, stop: Math.max(pos.stop, current * 0.97) }));
    }
  }, [tick]);

  useEffect(() => {
    // Stop opening new positions if paused at milestone
    if (!running || position || balance <= 0.5) return;

    // Update next milestone tracker
    const nextMile = FIB_LEVELS.find(level => level > balance);
    if (nextMile && nextMile !== nextMilestone) {
      setNextMilestone(nextMile);
    }

    let best = null;
    SYMS.forEach(sym => {
      if (sym === lastTraded) return;
      // Skip symbols in cooldown after stop-loss
      if (cooldownSyms.current[sym] && tickRef.current < cooldownSyms.current[sym]) return;

      const p = prices[sym];
      if (p.length < 10) return;

      const current = p[p.length - 1];

      const sizePercent = balance < 2 ? 0.70 : balance < 5 ? 0.50 : balance < 10 ? 0.30 : 0.15;
      const positionSize = balance * sizePercent;

      // Allow fractional shares at low balance - skip minShares check entirely at <$2
      // At higher balance, require at least 0.01 shares (prevent dust trades)
      if (balance >= 2 && positionSize / current < 0.01) return;

      // Volatility filter: skip assets with erratic price movement
      const recent = p.slice(-10);
      const avg = recent.reduce((a, b) => a + b, 0) / 10;
      const variance = recent.reduce((a, b) => a + Math.pow((b - avg) / avg, 2), 0) / 10;
      const stddev = Math.sqrt(variance);
      // Skip if stddev > 2.5% (extremely choppy) - relaxed to keep more candidates
      if (stddev > 0.025) return;

      const strength = (current - avg) / avg;

      const minStrength = balance < 2 ? 0.008 : balance < 10 ? 0.009 : balance < 100 ? 0.010 : 0.012;

      // Trend consistency: require at least 7/10 recent bars above their local avg
      // This filters false breakouts and spikes that reverse immediately
      const risingBars = recent.filter((price, i) => {
        if (i === 0) return false;
        return price > recent[i - 1];
      }).length;
      if (risingBars < 5) return; // Need at least 5 up-bars in last 10

      // Dual MA confirmation: current must also be above 20-bar avg (if available)
      if (p.length >= 20) {
        const longAvg = p.slice(-20).reduce((a, b) => a + b, 0) / 20;
        if (current <= longAvg) return; // Short-term momentum must align with longer trend
      }

      // Momentum continuity: previous bar must also show positive strength (no spike entries)
      const prevStrength = (p[p.length - 2] - avg) / avg;
      if (prevStrength <= 0) return;

      if (strength > minStrength && (!best || strength > best.strength)) {
        best = { sym, price: current, strength };
      }
    });

    if (best) {
      // Aggressive reduction at high balances to protect gains
      // With shares-based sizing, PnL scales correctly - can stay aggressive
      // $1T mode: Hyper-aggressive at fibonacci milestones beyond $1B
      let sizePercent;
      if (targetTrillion && balance >= 1e9) {
        // Fibonacci scaling for $1B → $10T journey
        if (balance >= 5e12) sizePercent = 0.35; // $5T+
        else if (balance >= 2e12) sizePercent = 0.38; // $2T-$5T
        else if (balance >= 1e12) sizePercent = 0.40; // $1T-$2T
        else if (balance >= 500e9) sizePercent = 0.45; // $500B-$1T: aggressive final push
        else if (balance >= 200e9) sizePercent = 0.40; // $200B+
        else if (balance >= 100e9) sizePercent = 0.38; // $100B+
        else if (balance >= 50e9) sizePercent = 0.35; // $50B+
        else if (balance >= 20e9) sizePercent = 0.33; // $20B+
        else if (balance >= 10e9) sizePercent = 0.32; // $10B+
        else if (balance >= 5e9) sizePercent = 0.30; // $5B+
        else if (balance >= 2e9) sizePercent = 0.28; // $2B+
        else sizePercent = 0.25; // $1B-$2B: cautious start
      } else {
        // Standard scaling for $1B target or <$1B with $1T enabled
        sizePercent = balance < 100 ? 0.80 :
                      balance < 10000 ? 0.65 :
                      balance < 1000000 ? 0.50 :
                      balance < 100000000 ? 0.35 :
                      0.25;
      }

      // More careful near milestones (reduce position size, tighter stop loss)
      let distanceToMilestone = 1;
      let nearMilestone = false;
      if (nextMilestone && nextMilestone >= 1e9) {
        distanceToMilestone = (nextMilestone - balance) / nextMilestone;
        nearMilestone = distanceToMilestone < 0.05; // Within 5% of milestone
        if (nearMilestone) {
          sizePercent *= 0.7; // 30% reduction
        }
      }

      const size = balance * sizePercent;

      // Convert dollars to shares (fixes PnL scaling across price ranges)
      const shares = size / best.price;

      // Minimum position check
      if (shares < 0.0000001) return;

      // Safety check: don't open position if win would exceed target
      const target = targetTrillion ? 1000000000000 : 1000000000;
      const maxWin = shares * best.price * 0.05; // 5% max gain in dollars
      if (balance + maxWin > target * 1.1) {
        const safeShares = (target - balance) / (best.price * 0.05) * 0.8;
        if (safeShares < shares * 0.5) return;
      }

      // Scale take-profit higher at fibonacci milestones for $1T mode
      let takeProfitMultiplier = 1.05; // Default 5%
      if (targetTrillion && balance >= 1e9) {
        if (balance >= 100e9) takeProfitMultiplier = 1.08; // $100B+: 8% TP
        else if (balance >= 10e9) takeProfitMultiplier = 1.07; // $10B+: 7% TP
        else if (balance >= 5e9) takeProfitMultiplier = 1.06; // $5B+: 6% TP
        else takeProfitMultiplier = 1.055; // $1B-$5B: 5.5% TP
      }

      try {
        // Tighter stop loss near milestones
        const stopLossPercent = nearMilestone ? 0.985 : 0.983; // 1.5% vs 1.7%

        const newPos = {
          sym: best.sym,
          entry: best.price,
          size: shares, // NOW IN SHARES, not dollars
          stop: best.price * stopLossPercent,
          target: best.price * takeProfitMultiplier,
        };
        setPosition(newPos);
        setLastTraded(best.sym);
        setTrades(t => {
          const updated = [...t, { type: 'BUY', sym: best.sym, price: best.price.toFixed(2) }];
          return updated.length > 100 ? updated.slice(-100) : updated;
        });

        // Emit broker signal
        const signal = { action: 'buy', sym: best.sym, entry: best.price, stop: newPos.stop, target: newPos.target, size: shares, ts: Date.now(), sent: false };
        setSignalLog(prev => [...prev.slice(-49), signal]);
        if (autoSend && brokerRef.current?.connected) {
          brokerRef.current.placeOrder(signal).then(() => {
            setSignalLog(prev => prev.map(s => s.ts === signal.ts ? { ...s, sent: true } : s));
          }).catch(err => console.warn('[BROKER] signal send failed:', err.message));
        }
      } catch (err) {
        console.error('Position creation failed:', err);
      }
    }
  }, [tick, running, position, balance, lastTraded, prices]);

  // Get best available price for a symbol (live > static fallback)
  const getLivePrice = useCallback((sym) => {
    const live = liveStocksRef.current[sym];
    return (live && typeof live.price === 'number') ? live.price : ASSETS[sym].price;
  }, []);

const reset = useCallback(() => {
    setBalance(1);
    setPosition(null);
    setPrices(Object.fromEntries(SYMS.map(s => [s, [getLivePrice(s)]])));
    setTrades([]);
    setRunning(false);
    setTick(0);
    setLastTraded(null);
    setTradeStats({ wins: {}, losses: {} });
    resetElapsedTime();
    resetPM();
    setCurrentMilestone(1e9);
    setNextMilestone(null);
    trends.current = Object.fromEntries(SYMS.map(s => [s, 0]));
    cooldownSyms.current = {};
  }, []);

  const pnl = balance - 1;
  const currentPrice = position ? prices[position.sym][prices[position.sym].length - 1] : 0;
  const unrealized = position ? (currentPrice - position.entry) * position.size : 0;
  const equity = balance + unrealized;
  const busted = balance <= 0.5;
  const target = targetTrillion ? 1000000000000 : 1000000000;
  const won = balance >= target;
  const runway = balance / apiCostPerDay;

  // Calculate biggest winner/loser
  const biggestWinner = Object.entries(tradeStats.wins).sort((a, b) => b[1] - a[1])[0];
  const biggestLoser = Object.entries(tradeStats.losses).sort((a, b) => a[1] - b[1])[0];
  const exits = trades.filter(t => t.pnl);
  const wins = exits.filter(t => parseFloat(t.pnl) > 0);
  const winRate = exits.length ? (wins.length / exits.length * 100) : 0;

  const formatNumber = (num) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatTime = (ms) => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${secs % 60}s`;
    return `${secs}s`;
  };

  useTradeShortcuts({ busted, won, reset, setRunning });

  // Memoize ticker items - use live stock data, fallback to static ASSETS when market closed / API down
  const tickerItems = useMemo(() => {
    const hasLive = stocks && Object.keys(stocks).length > 0;

    if (hasLive) {
      let symbols = watchlist && watchlist.length > 0
        ? watchlist.filter(s => stocks[s])
        : Object.keys(stocks);

      // If watchlist filtered everything out, fall back to all stocks
      if (symbols.length === 0) symbols = Object.keys(stocks);

      return symbols
        .sort((a, b) => ((stocks[b]?.changePercent || 0) - (stocks[a]?.changePercent || 0)))
        .map(sym => {
        const stock = stocks[sym];
        return {
          key: stock.symbol,
          name: stock.symbol,
          price: stock.price,
          change: stock.changePercent || 0,
        };
      });
    }

    // Fallback: show static asset prices so ticker is never empty
    return SYMS.slice(0, 30).map(sym => ({
      key: sym,
      name: sym,
      price: ASSETS[sym].price,
      change: 0,
    }));
  }, [stocks, watchlist]);

  const handleMapReady = useCallback((map) => {
    mapInstanceRef.current = map;
  }, []);

  const handleTickerItemClick = useCallback((sym) => {
    setCommandBarStock(sym);
    setActiveTab('markets');
    if (isMobileNav) setMobilePanelOpen(true);
    else setDesktopPanelOpen(true);
  }, [isMobileNav]);

  // Landing page for unauthenticated visitors
  if (!isAuthenticated && !authLoading && showLanding) {
    return (
      <LandingPage
        onRegister={() => { setShowLanding(false); setAuthView('register'); }}
        onLogin={() => { setShowLanding(false); setAuthView('login'); }}
      />
    );
  }

  // Auth gate
  const authGate = AuthPage({ authLoading, isAuthenticated, authView, setAuthView, authError, resetToken, login, register, t });
  if (authGate) return authGate;

  const pmEdges = markets.filter(m => m.probability >= 0.85 || m.probability <= 0.15);

  const simData = running || tick > 0 ? {
    equity: formatNumber(equity),
    pnl: `${pnl >= 0 ? '+' : ''}${formatNumber(Math.abs(pnl))}`,
    pnlPositive: pnl >= 0,
    winRate: `${winRate.toFixed(0)}%`,
    trades: `${exits.length}`,
    runtime: formatTime(elapsedTime),
    allTime: runStats?.bestTime ? formatTime(runStats.bestTime) : null,
    position: position ? {
      sym: position.sym,
      color: ASSETS[position.sym]?.color || t.text,
      entry: position.entry.toFixed(2),
      unrealized: `${unrealized >= 0 ? '+' : ''}${formatNumber(Math.abs(unrealized))}`,
    } : null,
  } : null;

  const TAB_PILLS = [
    { key: 'situation', label: 'Situation' },
    { key: 'markets', label: 'Markets' },
    // hidden - simulator: TradingView MCP integration planned; people: early dev
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'settings', label: 'Settings' },
  ];

  const settingsProps = { dark, setDark, t, mapLayers, setMapLayers, tickerVisible, setTickerVisible, user, logout, subscription, changeName, changeEmail, changePassword, refreshUser: refresh };

  const glassButton = {
    background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
    border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)'}`,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: 'none',
  };

  // Shared panel content rendered in both desktop and mobile layouts
  const renderPanelContent = () => (
    <>
      {activeTab === 'situation' && (
        <SituationMonitor
          dark={dark} t={t} font={font}
          sim={simData} pmEdges={pmEdges}
          lastPmBetMap={lastPmBetRef.current}
          trades={trades} pmExits={pmExits}
          pmWhales={whales}
          mapFlyTo={(params) => mapInstanceRef.current?.flyTo(params)}
          mapLayers={mapLayers}
        />
      )}
      {activeTab === 'markets' && (
        <MarketsPanel
          dark={dark} t={t} stocks={stocks} liveAssets={liveAssets}
          watchlist={watchlist} toggleSymbol={toggleSymbol}
          isAuthenticated={isAuthenticated}
          initialSymbol={commandBarStock}
          onConsumeInitialSymbol={() => setCommandBarStock(null)}
        />
      )}
      {activeTab === 'portfolio' && (
        <FinancePanel dark={dark} t={t} stocks={stocks} isAuthenticated={isAuthenticated} />
      )}
      {activeTab === 'people' && (
        <PeoplePanel dark={dark} t={t} isAuthenticated={isAuthenticated} />
      )}
      {activeTab === 'settings' && (
        <Settings {...settingsProps} />
      )}
    </>
  );

  return (
    <div className="epiphany-root" style={{
      height: '100dvh',
      display: 'grid',
      gridTemplateRows: 'auto auto 1fr auto',
      gridTemplateColumns: '1fr',
      '--desktop-panel-width': desktopPanelOpen ? '420px' : '0px',
      overflow: 'hidden',
      backgroundColor: t.bg,
      backgroundImage: 'none',
      color: t.text,
      fontFamily: font,
      transition: running ? 'none' : 'background-color 220ms ease, background-image 220ms ease',
    }}>
      <style>{`
        .epiphany-ticker { display: block; }
        .epiphany-header, .epiphany-footer, .epiphany-panel { display: none; }
        .epiphany-mobile-nav { display: flex; }
        .epiphany-root {
          grid-template-rows: auto 1fr !important;
          grid-template-columns: 1fr !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
        }
        .epiphany-map { grid-row: 2; grid-column: 1; background: var(--epiphany-bg); }
        .epiphany-mobile-panel {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 60vh;
          overflow-y: auto;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 16px 16px 0 0;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          z-index: 10;
          transform: translateY(100%);
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .epiphany-mobile-panel.open {
          display: block;
          transform: translateY(0);
        }
        @media (min-width: 768px) {
          .epiphany-ticker, .epiphany-header, .epiphany-footer { display: flex; }
          .epiphany-mobile-nav { display: none; }
          .epiphany-mobile-panel { display: none !important; }
          .epiphany-root {
            grid-template-rows: auto auto 1fr auto !important;
            grid-template-columns: 1fr var(--desktop-panel-width) !important;
          }
          .epiphany-map { grid-row: 3; grid-column: 1; height: auto !important; }
          .epiphany-panel { display: block; grid-row: 3; grid-column: 2; }
          .epiphany-footer { grid-row: 4; }
        }
      `}</style>

      <DesktopLayout
        t={t} dark={dark} tickerItems={tickerItems} weather={weather}
        isMobileNav={isMobileNav} stocksReliability={stocksReliability}
        lastUpdated={lastUpdated}
        activeTab={activeTab} desktopPanelOpen={desktopPanelOpen}
        handleDesktopTabSelect={handleDesktopTabSelect}
        desktopNavRef={desktopNavRef} desktopPanelRef={desktopPanelRef}
        TAB_PILLS={TAB_PILLS} glassButton={glassButton}
        showAlerts={showAlerts} setShowAlerts={setShowAlerts}
        activeCount={activeCount}
        isFree={isFree} setShowPricing={setShowPricing} logout={logout}
        panelContent={renderPanelContent()}
        onTickerItemClick={handleTickerItemClick}
        tickerVisible={tickerVisible}
      />

      {/* Map cell */}
      <div className="epiphany-map" style={{ gridColumn: isMobileNav ? '1 / -1' : '1', height: '100%', position: 'relative', overflow: 'hidden', minHeight: 0, background: 'var(--epiphany-bg)' }}>
        {!isMobileNav && (
          <LiveMapBackdrop
            dark={dark}
            mapLayers={mapLayers}
            onMapReady={handleMapReady}
          />
        )}
        <MobileLayout
          t={t} dark={dark} isMobileNav={isMobileNav}
          activeTab={activeTab}
          mobileTabsOpen={mobileTabsOpen} setMobileTabsOpen={setMobileTabsOpen}
          mobilePanelOpen={mobilePanelOpen} setMobilePanelOpen={setMobilePanelOpen}
          handleMobileTabSelect={handleMobileTabSelect}
          TAB_PILLS={TAB_PILLS}
          weather={weather} isFree={isFree} setShowPricing={setShowPricing} logout={logout}
          panelContent={renderPanelContent()}
        />
      </div>

      {/* Pricing Modal */}
      {showPricing && <PricingPage dark={dark} t={t} onClose={() => setShowPricing(false)} subscription={subscription} />}

      {showAlerts && (
        <AlertsPanel
          onClose={() => setShowAlerts(false)}
          alerts={alerts}
          onAdd={addAlert}
          onRemove={removeAlert}
          onClearTriggered={clearTriggered}
          watchlist={watchlist}
        />
      )}

      <CommandBar
        open={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        stocks={stocks}
        markets={markets}
        t={t}
        font={font}
        onSelectStock={(sym) => {
          setCommandBarStock(sym);
          setActiveTab('markets');
          if (isMobileNav) setMobilePanelOpen(true);
          else setDesktopPanelOpen(true);
        }}
        onSelectCity={(city) => {
          mapInstanceRef.current?.flyTo({ center: [city.lon, city.lat], zoom: 11, duration: 1200 });
        }}
        onSelectMarket={(market) => {
          const slug = market.eventSlug || market.slug;
          if (slug) window.open(`https://polymarket.com/event/${slug}`, '_blank');
        }}
        onSelectPeople={(query) => {
          setActiveTab('people');
          if (isMobileNav) setMobilePanelOpen(true);
          else setDesktopPanelOpen(true);
        }}
        onCommand={(cmd) => {
          if (cmd.action === 'toggleDark') setDark(d => !d);
          if (cmd.action === 'toggleLayer') setMapLayers(l => ({ ...l, [cmd.layer]: !l[cmd.layer] }));
          if (cmd.action === 'tab') {
            setActiveTab(cmd.tab);
            if (isMobileNav) setMobilePanelOpen(true);
            else setDesktopPanelOpen(true);
          }
        }}
      />

      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.cardBg || t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: '24px 32px', minWidth: 280, fontFamily: font, position: 'relative' }}>
            <button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: t.textSecondary, fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>{'\u00d7'}</button>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: t.text }}>Keyboard Shortcuts</div>
            {SHORTCUTS.map(s => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                <kbd style={{ background: t.border, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontFamily: 'monospace', color: t.text }}>{s.key}</kbd>
                <span style={{ marginLeft: 16 }}>{s.description}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 11, color: t.textTertiary, textAlign: 'center' }}>Press ? or click outside to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
