import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePolymarket, MARKET_CATEGORIES } from './hooks/usePolymarket';
import { useLivePrices, formatLastUpdated } from './hooks/useLivePrices';
import { useStocks } from './hooks/useStocks';
import { getTheme } from './utils/theme';
import { defaultAssets } from './utils/assets';
import { saveRun, getStats } from './utils/runHistory';
import { calculateKelly, detectEdge } from './utils/trading';
import { tldr } from './utils/helpers';
import { StatusBar, Card, MobileMenu, MobileMenuItem, MobileMenuDivider } from './components/ui';
import Ticker from './components/Ticker';
import PricingPage from './components/PricingPage';
import FinancePanel from './components/FinancePanel';
import LiveMapBackdrop from './components/LiveMapBackdrop';
import SituationMonitor from './components/SituationMonitor';
import { useSubscription } from './hooks/useSubscription';
import { useAuth } from './hooks/useAuth';
import { useWatchlist } from './hooks/useWatchlist';
import { useWeather } from './hooks/useWeather';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ResetPasswordPage from './components/ResetPasswordPage';

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


// Keyword mappings for category filters
const categoryKeywords = {
  politics: ['trump', 'biden', 'election', 'president', 'congress', 'senate', 'republican', 'democrat', 'vote', 'governor', 'political', 'white house', 'supreme court', 'legislation', 'poll'],
  crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'token', 'blockchain', 'solana', 'xrp', 'dogecoin', 'altcoin', 'defi', 'nft'],
  sports: ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'super bowl', 'championship', 'playoffs', 'world cup', 'olympics', 'ufc', 'boxing', 'tennis', 'golf'],
  finance: ['stock', 'market', 'fed', 'interest rate', 'inflation', 'gdp', 'recession', 'earnings', 's&p', 'nasdaq', 'dow', 'treasury', 'bond', 'ipo', 'merger'],
  culture: ['oscar', 'grammy', 'emmy', 'movie', 'film', 'music', 'celebrity', 'award', 'netflix', 'spotify', 'tiktok', 'twitter', 'elon', 'kanye', 'taylor swift'],
};


export default function App() {
  const { user, loading: authLoading, error: authError, isAuthenticated, login, register, logout } = useAuth();
  const resetToken = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);
  const [authView, setAuthView] = useState(resetToken ? 'reset' : 'login'); // 'login' | 'register' | 'reset'

  const [dark, setDark] = useState(true);
  const [activeTab, setActiveTab] = useState('simulator');
  const [mapLayers, setMapLayers] = useState({ flights: true, earthquakes: true, news: true, traffic: true, predictions: true, weather: true });
  const mapInstanceRef = useRef(null);
  const t = getTheme(dark);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const [showPricing, setShowPricing] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobileNav(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const { isPro, isFree } = useSubscription();
  const { watchlist, addSymbol, removeSymbol, toggleSymbol } = useWatchlist(user);
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
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const targetTrillion = true;
  const trends = useRef(Object.fromEntries(SYMS.map(s => [s, 0])));
  const [tradeStats, setTradeStats] = useState({ wins: {}, losses: {} });
  const cooldownSyms = useRef({});  // sym -> tick when cooldown expires
  const [runStats, setRunStats] = useState(() => getStats());
  const hasSavedRun = useRef(false);
  const [apiCostPerDay] = useState(2.89);
  const [pmTrades, setPmTrades] = useState([]);
  const lastPmScan = useRef(0);
  const [pmBalance, setPmBalance] = useState(0); // Track prediction market P&L separately
  const lastPmBetRef = useRef({}); // { marketId: timestamp }

  // Broker state
  const DEFAULT_BROKER_CONFIG = { broker: 'ctrader', clientId: '', clientSecret: '', refreshToken: '', accountId: '', webhookUrl: '', accessToken: '' };
  const [brokerConfig, setBrokerConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('opticon_broker_config')) || DEFAULT_BROKER_CONFIG; }
    catch { return DEFAULT_BROKER_CONFIG; }
  });
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [signalLog, setSignalLog] = useState([]);
  const [autoSend, setAutoSend] = useState(() => {
    try { return JSON.parse(localStorage.getItem('opticon_broker_autosend')) || false; }
    catch { return false; }
  });
  const brokerRef = useRef(null);

  // Milestone state management
  const [currentMilestone, setCurrentMilestone] = useState(1e9); // Start at $1B
  const [nextMilestone, setNextMilestone] = useState(null);
  const [showChart, setShowChart] = useState(false); // Default hide chart

  // Animation refs for smooth 60fps rendering
  const animationRef = useRef(null);
  const lastFrameTime = useRef(0);
  const pricesRef = useRef(prices);
  const tickRef = useRef(0);
  const liveStocksRef = useRef({});

  // Prediction Market State
  const [pmCategory, setPmCategory] = useState('all');
  const [showHighProb, setShowHighProb] = useState(false);
  const [show15Min, setShow15Min] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(true);
  const [hoveredMarket, setHoveredMarket] = useState(null);
  const [tappedMarket, setTappedMarket] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { prices: liveAssets, lastUpdated } = useLivePrices(defaultAssets);
  const { markets, loading: pmLoading, error: pmError } = usePolymarket();
  const { stocks, reliability: stocksReliability } = useStocks(undefined, { enabled: isAuthenticated });

  // Sync live stock prices into ref for simulator access
  useEffect(() => {
    if (stocks) liveStocksRef.current = stocks;
  }, [stocks]);

  // Prediction market scanning - every 10s when running
  useEffect(() => {
    if (!running || !markets || markets.length === 0) return;

    const scanInterval = setInterval(() => {
      // Find markets with strong edges (>90% probability)
      const opportunities = markets
        .map(m => ({ ...m, ...detectEdge(m) }))
        .filter(m => m.hasEdge)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 3);

      if (opportunities.length > 0 && balance > 1) {
        const opp = opportunities[0];
        const kellyFraction = calculateKelly(opp.prob / (1 - opp.prob), opp.prob);
        const betSize = Math.min(balance * kellyFraction, balance * 0.05); // Max 5% per PM bet

        if (betSize > 0.50) {
          // Simulate trade (use actual probability with some noise for realism)
          const win = Math.random() < opp.prob * 0.95; // Slight house edge
          const payout = win ? betSize * (1 / opp.prob - 1) : -betSize;

          setBalance(b => Math.max(0.5, b + payout));
          setPmBalance(pb => pb + payout);
          lastPmBetRef.current[opp.id || opp.slug] = Date.now();
          setPmTrades(prev => {
            const updated = [...prev, {
              type: win ? 'PM_WIN' : 'PM_LOSS',
              market: opp.question,
              side: opp.side,
              size: betSize,
              pnl: payout.toFixed(2),
              prob: (opp.prob * 100).toFixed(0)
            }];
            return updated.length > 50 ? updated.slice(-50) : updated;
          });

          // Add to main trades log with [PM] prefix
          setTrades(t => {
            const updated = [...t, {
              type: win ? 'PM_WIN' : 'PM_LOSS',
              sym: `[PM] ${opp.side}`,
              pnl: payout.toFixed(2)
            }];
            return updated.length > 100 ? updated.slice(-100) : updated;
          });
        }
      }
    }, 10000); // Scan every 10s

    return () => clearInterval(scanInterval);
  }, [running, markets, balance]);

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
    setStartTime(null);
    setElapsedTime(0);
    setPmTrades([]);
    setPmBalance(0);
    setCurrentMilestone(1e9);
    setNextMilestone(null);
    trends.current = Object.fromEntries(SYMS.map(s => [s, 0]));
    cooldownSyms.current = {};
  }, []);

  // Timer logic
  useEffect(() => {
    if (running && !startTime) {
      setStartTime(Date.now());
    }
    if (!running && startTime) {
      setElapsedTime(Date.now() - startTime);
    }
  }, [running, startTime]);

  useEffect(() => {
    if (!running || !startTime) return;
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 500); // Update timer less frequently (was 100ms)
    return () => clearInterval(timer);
  }, [running, startTime]);

  // Auto-save run when sim ends (win or bust)
  useEffect(() => {
    const target = targetTrillion ? 1000000000000 : 1000000000;
    const isWon = balance >= target;
    const isBusted = balance <= 0.5;

    if ((isWon || isBusted) && !hasSavedRun.current && tick > 0) {
      hasSavedRun.current = true;
      const exits = trades.filter(t => t.pnl);
      const wins = exits.filter(t => parseFloat(t.pnl) > 0);
      saveRun({
        won: isWon,
        finalBalance: balance,
        duration: elapsedTime,
        tradeCount: exits.length,
        tradeWinRate: exits.length ? (wins.length / exits.length * 100) : 0,
        ticks: tick,
        target: target,
      });
      setRunStats(getStats());
    }
  }, [balance, tick]);

  // Reset save flag on new run
  useEffect(() => {
    if (running) hasSavedRun.current = false;
  }, [running]);

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
  const pmExits = pmTrades.length;
  const pmWins = pmTrades.filter(t => t.type === 'PM_WIN').length;
  const pmWinRate = pmExits > 0 ? (pmWins / pmExits * 100) : 0;

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

  // Calculate real-world time (each tick = 5min real trading)
  const realWorldTime = (ticks) => {
    const tradingMinutes = ticks * 5; // 5min per tick
    const tradingHours = tradingMinutes / 60;
    const tradingDays = tradingHours / 6.5; // 6.5hr trading day
    const tradingWeeks = tradingDays / 5; // 5 trading days per week
    const tradingMonths = tradingDays / 21; // ~21 trading days per month
    const tradingYears = tradingDays / 252; // 252 trading days per year

    if (tradingYears >= 1) return `${tradingYears.toFixed(1)} years`;
    if (tradingMonths >= 1) return `${tradingMonths.toFixed(1)} months`;
    if (tradingWeeks >= 1) return `${tradingWeeks.toFixed(1)} weeks`;
    if (tradingDays >= 1) return `${tradingDays.toFixed(1)} days`;
    if (tradingHours >= 1) return `${tradingHours.toFixed(1)} hours`;
    return `${tradingMinutes} minutes`;
  };

  // Chart - memoized for performance
  const W = 320, H = 120;
  const chartData = useMemo(() => {
    // Normalize against first price in array (live price at sim start), not static ASSETS
    const allNorm = SYMS.flatMap(s => {
      const base = prices[s][0] || ASSETS[s].price;
      return prices[s].map(p => (p - base) / base);
    });
    const nMin = Math.min(...allNorm, -0.02);
    const nMax = Math.max(...allNorm, 0.02);
    const toY = v => H - ((v - nMin) / (nMax - nMin || 0.01)) * H;

    const paths = {};
    SYMS.forEach(sym => {
      const base = prices[sym][0] || ASSETS[sym].price;
      if (prices[sym].length > 1) {
        paths[sym] = prices[sym].map((p, i) => {
          const norm = (p - base) / base;
          return `${i ? 'L' : 'M'} ${(i / 99) * W} ${toY(norm)}`;
        }).join(' ');
      }
    });

    return { paths, toY, nMin, nMax };
  }, [prices]);

  const { paths: chartPaths, toY } = chartData;
  const makePath = sym => {
    // Fallback for unmemoized case
    return chartPaths[sym] || prices[sym].map((p, i) => {
      const base = prices[sym][0] || ASSETS[sym].price;
      const norm = (p - base) / base;
      return `${i ? 'L' : 'M'} ${(i / 99) * W} ${toY(norm)}`;
    }).join(' ');
  };

  // Prediction Markets Logic
  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMarketClick = (e, market) => {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile && tappedMarket?.id !== market.id) {
      e.preventDefault();
      setTappedMarket(market);
      setMousePos({ x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 });
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => setTappedMarket(null);
    if (tappedMarket) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [tappedMarket]);

  // Keyboard shortcuts for trading simulator
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Space bar: Reset if busted/won, otherwise toggle start/stop
      if (e.code === 'Space') {
        e.preventDefault();
        if (busted || won) {
          reset();
        } else {
          setRunning(r => !r);
        }
      }

      // R key: Reset
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [busted, won, reset]);

  // Memoize ticker items - use live stock data
  const tickerItems = useMemo(() => {
    if (!stocks || Object.keys(stocks).length === 0) {
      return [];
    }

    // Filter by watchlist if set, otherwise show all
    const symbols = watchlist && watchlist.length > 0
      ? watchlist.filter(s => stocks[s])
      : Object.keys(stocks);

    return symbols.map(sym => {
      const stock = stocks[sym];
      return {
        key: stock.symbol,
        name: stock.symbol,
        price: stock.price,
        change: stock.changePercent || 0,
      };
    });
  }, [stocks, watchlist]);

  const filteredMarkets = useMemo(() => {
    let filtered = markets;
    if (pmCategory !== 'all') {
      const keywords = categoryKeywords[pmCategory] || [];
      filtered = filtered.filter(m => {
        const text = `${m.question || ''} ${m.description || ''} ${m.category || ''}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });
    }
    if (showHighProb) {
      filtered = filtered.filter(m => m.probability >= 0.90 || m.probability <= 0.10);
    }
    if (show15Min) {
      const cutoff = Date.now() + 30 * 60 * 1000; // next 30 min
      filtered = filtered.filter(m => m.endDate && new Date(m.endDate).getTime() <= cutoff);
    }
    return filtered;
  }, [markets, pmCategory, showHighProb, show15Min]);

  // SIMULATIONS DISABLED - NOT NEEDED FOR POLYMARKET VIEW
  // const assetToSymbol = {
  //   btc: 'BTC-USD', eth: 'ETH-USD', gold: 'GC=F', silver: 'SI=F', oil: 'CL=F', nas100: 'NQ=F', us500: 'ES=F',
  //   aapl: 'AAPL', msft: 'MSFT', googl: 'GOOGL', amzn: 'AMZN', meta: 'META', tsla: 'TSLA', nvda: 'NVDA'
  //  };
  // const { history: priceHistory, loading: historyLoading } = useStockHistory(assetToSymbol[asset] || 'GC=F', '1y');
  //
  // const runSim = useCallback((key, sc) => {
  //   const a = liveAssets[key];
  //   if (!a) return { pctData: [], probs: [], finals: [] };
  //   const { drift, volMult } = scenarios[sc];
  //   return runMonteCarlo(a.spot, a.vol, drift, volMult, a.targets, horizons, simSeed);
  // }, [liveAssets, simSeed]);
  //
  // const res = useMemo(() => runSim(asset, scenario), [asset, scenario, runSim]);
  //
  // const a = liveAssets[asset];
  // const fmt = formatPrice;
  // const pCol = (p) => getProbColor(p, t);
  //
  // const scenarioColors = {
  //   bull: t.green,
  //   base: t.accent,
  //   bear: t.red
  // };

  // Log-scale progress $1→$1T
  const bgProgress = balance <= 0.5 ? 0 : balance < 1.001 ? 0 : Math.min(Math.log10(balance) / Math.log10(1e12), 1);

  // P&L background tint: progressively greener from $1 → $1T
  const pnlBg = (() => {
    if (balance <= 0.5) return 'linear-gradient(rgba(255,69,58,0.16),rgba(255,69,58,0.16))';
    if (balance < 1.001) return 'transparent';
    const opacity = bgProgress * 0.24;
    return `linear-gradient(rgba(48,209,88,${opacity.toFixed(3)}),rgba(48,209,88,${opacity.toFixed(3)}))`;
  })();

  // Keep hero text shadow stable during live ticks to avoid perceived flashing.
  const heroTextShadow = dark ? '0 2px 8px rgba(0,0,0,0.35)' : 'none';

  // P&L positive color: stays readable in light mode as bg greens out
  const pnlGreen = dark ? t.green : bgProgress > 0.2 ? '#0c6b27' : t.green;

  const handleMapReady = useCallback((map) => {
    mapInstanceRef.current = map;
  }, []);

  // Auth gate
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#888', fontSize: 14, fontFamily: font }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'reset' && resetToken) {
      return (
        <ResetPasswordPage
          token={resetToken}
          onBack={() => { window.history.replaceState({}, '', '/'); setAuthView('login'); }}
        />
      );
    }
    if (authView === 'register') {
      return (
        <RegisterPage
          onRegister={register}
          onSwitchToLogin={() => setAuthView('login')}
          error={authError}
        />
      );
    }
    return (
      <LoginPage
        onLogin={login}
        onSwitchToRegister={() => setAuthView('register')}
        error={authError}
        theme={t}
      />
    );
  }

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
    { key: 'simulator', label: 'SIM' },
    { key: 'portfolio', label: 'PORT' },
    { key: 'situation', label: 'SIT' },
  ];

  return (
    <div className="opticon-root" style={{
      height: '100dvh',
      display: 'grid',
      gridTemplateRows: 'auto auto 1fr auto',
      gridTemplateColumns: '1fr',
      overflow: 'hidden',
      backgroundColor: t.bg,
      backgroundImage: pnlBg === 'transparent' ? 'none' : pnlBg,
      color: t.text,
      fontFamily: font,
      transition: running ? 'none' : 'background-color 220ms ease, background-image 220ms ease',
    }}>
      <style>{`
        .opticon-panel { display: none; }
        @media (min-width: 768px) {
          .opticon-root {
            grid-template-rows: auto auto 1fr auto !important;
            grid-template-columns: 1fr 420px !important;
          }
          .opticon-map { grid-row: 3; grid-column: 1; height: auto !important; }
          .opticon-panel { display: block; grid-row: 3; grid-column: 2; }
        }
      `}</style>

      {/* Ticker */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Ticker items={tickerItems} theme={t} />
      </div>

      {/* Header */}
      <header style={{ gridColumn: '1 / -1', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: t.text, fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>opticon</span>
          <span style={{ width: 1, height: 14, background: t.border, marginLeft: 8 }} />
          <StatusBar t={t} reliability={stocksReliability} />
          {weather && !isMobileNav && (
            <>
              <span style={{ width: 1, height: 14, background: t.border }} />
              <span style={{ fontSize: 11, color: t.textSecondary, whiteSpace: 'nowrap' }}>
                {weather.icon} {weather.temp}°C {weather.description}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Tab pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TAB_PILLS.map(pill => (
              <button
                key={pill.key}
                onClick={() => setActiveTab(pill.key)}
                style={{
                  padding: '4px 10px', borderRadius: 100, fontSize: 10, fontWeight: 600,
                  fontFamily: font, cursor: 'pointer', border: 'none',
                  background: activeTab === pill.key ? t.text : t.glass,
                  color: activeTab === pill.key ? t.bg : t.textSecondary,
                  transition: 'all 0.15s ease',
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>
          {!isMobileNav && (
            <>
              <span style={{ width: 1, height: 14, background: t.border }} />
              <span style={{ fontSize: 10, color: t.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{formatLastUpdated(lastUpdated)}</span>
              {isFree && (
                <button
                  onClick={() => setShowPricing(true)}
                  style={{ background: '#0071e3', border: 'none', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  UPGRADE
                </button>
              )}
              <button
                onClick={() => setDark(!dark)}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{ background: t.surface, border: 'none', borderRadius: 6, padding: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {dark ? (
                    <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
                  ) : (
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  )}
                </svg>
              </button>
              <button
                onClick={logout}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '5px 10px', color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
              >
                LOGOUT
              </button>
            </>
          )}
          {isMobileNav && (
            <MobileMenu t={t} font={font}>
              {weather && (
                <>
                  <MobileMenuItem t={t} font={font} style={{ color: t.textTertiary, fontSize: 11, cursor: 'default' }}>
                    {weather.icon} {weather.temp}°C {weather.description}
                  </MobileMenuItem>
                  <MobileMenuDivider t={t} />
                </>
              )}
              {isFree && (
                <MobileMenuItem t={t} font={font} onClick={() => setShowPricing(true)} style={{ color: '#0071e3' }}>
                  UPGRADE
                </MobileMenuItem>
              )}
              <MobileMenuItem t={t} font={font} onClick={() => setDark(!dark)}>
                {dark ? 'LIGHT MODE' : 'DARK MODE'}
              </MobileMenuItem>
              <MobileMenuDivider t={t} />
              <MobileMenuItem t={t} font={font} onClick={logout} style={{ color: '#ef4444' }}>
                LOGOUT
              </MobileMenuItem>
            </MobileMenu>
          )}
        </div>
      </header>

      {/* Map cell */}
      <div className="opticon-map" style={{ gridColumn: '1 / -1', height: '100%', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <LiveMapBackdrop
          dark={dark}
          mapLayers={mapLayers}
          setMapLayers={setMapLayers}
          onMapReady={handleMapReady}
          livePrices={liveAssets}
        />
      </div>

      {/* Panel cell */}
      <div className="opticon-panel" style={{ gridColumn: '1 / -1', overflow: 'auto', minHeight: 0 }}>
        {activeTab === 'simulator' && (
          <div style={{ padding: 16 }}>
            {busted ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 'clamp(36px, 8vw, 56px)', fontWeight: 700, color: t.red, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px', lineHeight: 1 }}>BUSTED</div>
                <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8 }}>
                  {formatNumber(balance)} -- {realWorldTime(tick)} of trading -- {exits.length} trades
                </div>
              </div>
            ) : won ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 'clamp(36px, 8vw, 56px)', fontWeight: 700, color: t.green, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px', lineHeight: 1 }}>
                  {targetTrillion ? '$1T' : '$1B'}
                </div>
                <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8 }}>
                  {exits.length} trades -- {winRate.toFixed(0)}% wins -- {formatTime(elapsedTime)}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 'clamp(36px, 8vw, 56px)', fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px', lineHeight: 1, textShadow: heroTextShadow }}>
                  {formatNumber(equity)}
                </div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  <span style={{ color: pnl >= 0 ? pnlGreen : t.red }}>
                    {pnl >= 0 ? '+' : ''}{formatNumber(Math.abs(pnl)).replace('$', '')}
                  </span>
                  {position
                    ? <span style={{ color: t.textSecondary, fontSize: 12 }}> -- in {position.sym}</span>
                    : <span style={{ color: t.textTertiary, fontSize: 12 }}> -- {winRate.toFixed(0)}% WR -- {exits.length} trades</span>
                  }
                </div>
              </div>
            )}

            {/* Chart toggle */}
            <div style={{ textAlign: 'center', marginBottom: showChart ? 12 : 0 }}>
              <button
                onClick={() => setShowChart(!showChart)}
                style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: '5px 14px', fontSize: 11, color: t.textSecondary, cursor: 'pointer', fontFamily: font }}
              >
                {showChart ? 'Hide Chart' : 'Show Chart'}
              </button>
            </div>

            {showChart && (
              <div style={{ background: t.surface, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <svg width="100%" height="120" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  <line x1="0" y1={toY(0)} x2={W} y2={toY(0)} stroke={t.border} strokeDasharray="4" />
                  {SYMS.map(sym => prices[sym].length > 1 && (
                    <path
                      key={sym}
                      d={makePath(sym)}
                      fill="none"
                      stroke={ASSETS[sym].color}
                      strokeWidth={position?.sym === sym ? 2.5 : 1}
                      opacity={position ? (position.sym === sym ? 1 : 0.15) : 0.5}
                    />
                  ))}
                </svg>
              </div>
            )}

            {/* Start / Stop + Reset */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={() => setRunning(!running)}
                disabled={busted || won}
                style={{ padding: '12px 32px', borderRadius: 100, border: 'none', fontSize: 14, fontWeight: 600, fontFamily: font, background: (busted || won) ? t.border : running ? t.red : t.green, color: '#fff', cursor: (busted || won) ? 'default' : 'pointer', minWidth: 120 }}
              >
                {busted ? 'Busted' : won ? 'Won!' : running ? 'Stop' : 'Start'}
              </button>
              <button
                onClick={reset}
                style={{ padding: '12px 18px', borderRadius: 100, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontFamily: font, fontSize: 18, cursor: 'pointer' }}
              >
                ↺
              </button>
            </div>
            <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 8, textAlign: 'center' }}>
              [Space] Start/Stop -- [R] Reset
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <FinancePanel dark={dark} t={t} stocks={stocks} isAuthenticated={isAuthenticated} />
        )}

        {activeTab === 'situation' && (
          <SituationMonitor
            dark={dark} t={t} font={font}
            sim={simData}
            pmEdges={pmEdges}
            lastPmBetMap={lastPmBetRef.current}
            trades={trades}
            pmExits={pmExits}
            mapFlyTo={(params) => mapInstanceRef.current?.flyTo(params)}
            mapLayers={mapLayers}
            setMapLayers={setMapLayers}
          />
        )}
      </div>

      {/* Pricing Modal */}
      {showPricing && <PricingPage dark={dark} t={t} onClose={() => setShowPricing(false)} />}

      {/* Footer */}
      <footer style={{ gridColumn: '1 / -1', padding: '12px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.textSecondary }}>
        <span>&copy; 2026 Opticon</span>
        <a href="https://github.com/nulljosh/opticon/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style={{ color: t.textTertiary, textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => e.target.style.color = t.text} onMouseLeave={e => e.target.style.color = t.textTertiary}>Apache 2.0</a>
        <a href="https://github.com/nulljosh/opticon" target="_blank" rel="noopener noreferrer" style={{ color: t.textTertiary, textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => e.target.style.color = t.text} onMouseLeave={e => e.target.style.color = t.textTertiary}>GitHub</a>
      </footer>
    </div>
  );
}
