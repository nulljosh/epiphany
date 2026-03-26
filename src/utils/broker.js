// Broker abstraction layer
// Supports: cTrader (OAuth2 REST), TradingView (alert format), IBKR (stub)
//
// NOTE: cTrader API calls require CORS proxy in browser context.
// In production, route through /api/ctrader-proxy serverless function.

// ─── Base Class ───────────────────────────────────────────────────────────────

class BrokerAdapter {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
    this.name = 'base';
  }

  async connect() { throw new Error('connect() not implemented'); }
  async disconnect() { this.connected = false; }
  async placeOrder(signal) { throw new Error('placeOrder() not implemented'); }
  async getPositions() { return []; }
  async getBalance() { return null; }

  _validate(signal) {
    if (!signal.sym || !signal.action) throw new Error('Signal missing sym or action');
  }
}

// ─── cTrader Adapter ──────────────────────────────────────────────────────────
// cTrader Open API v2 — REST + WebSocket
// Docs: https://help.ctrader.com/open-api/

class CTraderAdapter extends BrokerAdapter {
  constructor(config) {
    super(config);
    this.name = 'ctrader';
    this.baseUrl = 'https://api.spotware.com';
    this.accessToken = config.accessToken || null;
    this.accountId = config.accountId || null;

    // Monica symbol -> cTrader symbol name mapping
    this.symbolMap = {
      AAPL: 'AAPL', MSFT: 'MSFT', GOOGL: 'GOOGL', AMZN: 'AMZN',
      NVDA: 'NVDA', META: 'META', TSLA: 'TSLA', NFLX: 'NFLX',
      NAS100: 'NAS100', SP500: 'SPX500', US30: 'DJ30',
      XAU: 'XAUUSD', XAG: 'XAGUSD',
      BTC: 'BTCUSD', ETH: 'ETHUSD',
    };
  }

  // OAuth2: exchange refresh_token for access_token
  async connect() {
    const { clientId, clientSecret, refreshToken } = this.config;

    if (this.accessToken) {
      this.connected = true;
      console.log('[BROKER] cTrader: using cached access token');
      return true;
    }

    if (!clientId || !clientSecret) {
      throw new Error('[BROKER] cTrader: missing clientId or clientSecret');
    }
    if (!refreshToken) {
      throw new Error('[BROKER] cTrader: missing refreshToken (complete OAuth2 flow first)');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch('https://connect.spotware.com/apps/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[BROKER] cTrader OAuth2 failed: ${res.status} ${err}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.connected = true;
    console.log('[BROKER] cTrader: connected via OAuth2');
    return true;
  }

  async disconnect() {
    this.accessToken = null;
    this.connected = false;
    console.log('[BROKER] cTrader: disconnected');
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  _mapSymbol(sym) {
    return this.symbolMap[sym] || sym;
  }

  async placeOrder(signal) {
    this._validate(signal);
    if (!this.connected) throw new Error('[BROKER] cTrader: not connected');

    const symbolName = this._mapSymbol(signal.sym);
    const orderType = signal.orderType || 'MARKET';
    const tradeSide = signal.action === 'buy' ? 'BUY' : 'SELL';

    const body = {
      symbolName,
      tradeSide,
      // cTrader volume is in units; 1 lot = 100,000 units for forex, 1 unit for stocks
      volume: signal.size ? Math.round(signal.size) : 1,
      orderType,
      ...(orderType === 'LIMIT' && { limitPrice: signal.entry }),
      ...(signal.stop && { stopLoss: signal.stop }),
      ...(signal.target && { takeProfit: signal.target }),
      comment: signal.comment || 'monica',
    };

    console.log('[BROKER] cTrader: placing order', JSON.stringify(body));

    const res = await fetch(
      `${this.baseUrl}/v2/webserv/tradingaccounts/${this.accountId}/orders`,
      { method: 'POST', headers: this._headers(), body: JSON.stringify(body) }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[BROKER] cTrader order failed: ${res.status} ${errText}`);
    }

    const result = await res.json();
    console.log('[BROKER] cTrader: order placed, id:', result.orderId);
    return { ok: true, orderId: result.orderId, broker: 'ctrader' };
  }

  async getPositions() {
    if (!this.connected) return [];
    const res = await fetch(
      `${this.baseUrl}/v2/webserv/tradingaccounts/${this.accountId}/positions`,
      { headers: this._headers() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.position || [];
  }

  async getBalance() {
    if (!this.connected) return null;
    const res = await fetch(
      `${this.baseUrl}/v2/webserv/tradingaccounts/${this.accountId}`,
      { headers: this._headers() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.balance != null ? data.balance / 100 : null; // cTrader returns cents
  }
}

// ─── TradingView Adapter ──────────────────────────────────────────────────────
// Formats Monica signals as TradingView Pine Script-compatible alert JSON.
// Optional: POST to a custom webhook bridge URL.

class TradingViewAdapter extends BrokerAdapter {
  constructor(config) {
    super(config);
    this.name = 'tradingview';
    this.webhookUrl = config.webhookUrl || null;
  }

  async connect() {
    this.connected = true;
    console.log('[BROKER] TradingView: connected (no auth required)');
    return true;
  }

  // Format Monica signal as TradingView-compatible alert payload
  formatAlert(signal) {
    return {
      ticker: signal.sym,
      action: signal.action,
      price: signal.entry,
      qty: signal.size,
      stop: signal.stop,
      target: signal.target,
      strategy: 'Monica',
      timeframe: '1m',
      comment: signal.comment || `Monica signal: ${signal.action.toUpperCase()} ${signal.sym}`,
      timestamp: new Date().toISOString(),
    };
  }

  async placeOrder(signal) {
    this._validate(signal);
    const alert = this.formatAlert(signal);
    console.log('[BROKER] TradingView: alert payload', JSON.stringify(alert));

    if (this.webhookUrl) {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
      if (!res.ok) throw new Error(`[BROKER] TradingView webhook POST failed: ${res.status}`);
    }

    return { ok: true, alert, broker: 'tradingview' };
  }
}

// ─── Alpaca Adapter ───────────────────────────────────────────────────────────
// Paper trading: api-paper.alpaca.markets | Live: api.alpaca.markets
// Keys: ALPACA_API_KEY + ALPACA_API_SECRET from alpaca.markets → paper account

class AlpacaAdapter extends BrokerAdapter {
  constructor(config) {
    super(config);
    this.name = 'alpaca';
    this.baseUrl = config.baseUrl || 'https://paper-api.alpaca.markets';
  }

  _headers() {
    return {
      'APCA-API-KEY-ID': this.config.apiKey || '',
      'APCA-API-SECRET-KEY': this.config.apiSecret || '',
      'Content-Type': 'application/json',
    };
  }

  async connect() {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('[BROKER] Alpaca: missing apiKey or apiSecret');
    }
    const r = await fetch(`${this.baseUrl}/v2/account`, { headers: this._headers() });
    if (!r.ok) throw new Error(`[BROKER] Alpaca: auth failed ${r.status}`);
    this.connected = true;
    console.log('[BROKER] Alpaca: connected (paper trading)');
    return true;
  }

  async placeOrder(signal) {
    this._validate(signal);
    if (!this.connected) throw new Error('[BROKER] Alpaca: not connected');
    const r = await fetch(`${this.baseUrl}/v2/orders`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        symbol: signal.sym.toUpperCase(),
        qty: String(signal.size || 1),
        side: signal.action,
        type: 'market',
        time_in_force: 'day',
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`[BROKER] Alpaca order failed: ${data.message}`);
    console.log('[BROKER] Alpaca: order placed', data.id);
    return { ok: true, orderId: data.id, broker: 'alpaca' };
  }

  async getPositions() {
    if (!this.connected) return [];
    const r = await fetch(`${this.baseUrl}/v2/positions`, { headers: this._headers() });
    if (!r.ok) return [];
    return r.json();
  }

  async getBalance() {
    if (!this.connected) return null;
    const r = await fetch(`${this.baseUrl}/v2/account`, { headers: this._headers() });
    if (!r.ok) return null;
    const d = await r.json();
    return d.equity ? +d.equity : null;
  }
}

// ─── IBKR Adapter (stub) ──────────────────────────────────────────────────────

class IBKRAdapter extends BrokerAdapter {
  constructor(config) {
    super(config);
    this.name = 'ibkr';
  }

  async connect() {
    throw new Error('[BROKER] IBKR: not yet implemented. Use TWS API or IB Gateway.');
  }

  async placeOrder() {
    throw new Error('[BROKER] IBKR: not yet implemented.');
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export const createBroker = (type, config = {}) => {
  switch (type) {
    case 'ctrader':     return new CTraderAdapter(config);
    case 'tradingview': return new TradingViewAdapter(config);
    case 'alpaca':      return new AlpacaAdapter(config);
    case 'ibkr':        return new IBKRAdapter(config);
    default: throw new Error(`[BROKER] Unknown broker type: ${type}`);
  }
};

export { BrokerAdapter, CTraderAdapter, TradingViewAdapter, AlpacaAdapter, IBKRAdapter };
