// Wealthsimple Trade adapter — unofficial reverse-engineered REST API
// No public API exists. Endpoints may break without notice. ToS risk.
// Ref: https://github.com/MarkGalloway/wealthsimple-trade (archived)
//
// Auth flow:
//   1. POST /oauth/v2/token with credentials
//   2. If 2FA required, response 401 + x-wealthsimple-otp header → retry with otp field
//   3. Store access_token + refresh_token

const BASE = 'https://trade-service.wealthsimple.com';
const AUTH_BASE = 'https://api.production.wealthsimple.com/v1/oauth/v2/token';
// Client ID from the WS Trade app — used in all community implementations
const CLIENT_ID = '4da53ac2b03225bed1af';

export class WealthsimpleAdapter {
  constructor(config = {}) {
    this.name = 'wealthsimple';
    this.config = config;
    this.accessToken = config.accessToken || null;
    this.refreshToken = config.refreshToken || null;
    this.accountId = config.accountId || null;
    this.connected = false;
  }

  // Returns { otpRequired: true } if 2FA is needed
  async connect({ otp } = {}) {
    const { email, password } = this.config;
    if (!email || !password) throw new Error('[WS] Missing email or password');

    const body = new URLSearchParams({
      grant_type: 'password',
      username: email,
      password,
      client_id: CLIENT_ID,
      scope: 'invest.read invest.write',
      ...(otp ? { otp } : {}),
    });

    const res = await fetch(AUTH_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (res.status === 401) {
      const otpRequired = res.headers.get('x-wealthsimple-otp');
      if (otpRequired) return { otpRequired: true };
      throw new Error('[WS] Invalid credentials');
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[WS] Auth failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    if (!this.accountId) await this._loadAccount();
    this.connected = true;
    return { ok: true };
  }

  async _refresh() {
    if (!this.refreshToken) throw new Error('[WS] No refresh token — reconnect required');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: CLIENT_ID,
    });
    const res = await fetch(AUTH_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error('[WS] Token refresh failed — re-auth required');
    const data = await res.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
  }

  _headers() {
    return { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };
  }

  async _fetch(url, opts = {}, retry = true) {
    const res = await fetch(url, { ...opts, headers: { ...this._headers(), ...opts.headers } });
    if (res.status === 401 && retry) {
      await this._refresh();
      return this._fetch(url, opts, false);
    }
    return res;
  }

  async _loadAccount() {
    const res = await this._fetch(`${BASE}/account/list`);
    if (!res.ok) return;
    const data = await res.json();
    const accounts = data.results || data;
    // Prefer TFSA or RRSP, fall back to first account
    const account = accounts.find(a => a.account_type === 'ca_tfsa')
      || accounts.find(a => a.account_type === 'ca_rrsp')
      || accounts[0];
    if (account) this.accountId = account.id;
  }

  async _resolveSecurityId(ticker) {
    const res = await this._fetch(`${BASE}/securities?query=${encodeURIComponent(ticker)}&limit=5`);
    if (!res.ok) throw new Error(`[WS] Security lookup failed for ${ticker}`);
    const data = await res.json();
    const results = data.results || data;
    const match = results.find(s => s.stock?.symbol === ticker.toUpperCase())
      || results.find(s => s.stock?.symbol?.startsWith(ticker.toUpperCase()))
      || results[0];
    if (!match) throw new Error(`[WS] No security found for ${ticker}`);
    return match.id;
  }

  async placeOrder(signal) {
    if (!signal.sym || !signal.action) throw new Error('[WS] Signal missing sym or action');
    if (!this.connected) throw new Error('[WS] Not connected');
    if (!this.accountId) throw new Error('[WS] No account ID — call connect() first');

    const securityId = await this._resolveSecurityId(signal.sym);
    const isBuy = signal.action === 'buy';

    const body = {
      account_id: this.accountId,
      security_id: securityId,
      quantity: signal.size || 1,
      order_type: isBuy ? 'buy_quantity' : 'sell_quantity',
      order_sub_type: 'market',
      time_in_force: 'day',
    };

    const res = await this._fetch(`${BASE}/orders`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`[WS] Order failed: ${data.message || JSON.stringify(data)}`);
    console.log('[WS] Order placed:', data.order_id, signal.sym, signal.action, body.quantity);
    return { ok: true, orderId: data.order_id, broker: 'wealthsimple' };
  }

  async getPositions() {
    if (!this.connected || !this.accountId) return [];
    const res = await this._fetch(`${BASE}/positions?account_id=${this.accountId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || data;
    return results.map(p => ({
      symbol: p.stock?.symbol,
      qty: +p.quantity,
      marketValue: +(p.quote?.amount ?? 0) * +p.quantity,
      securityId: p.id,
    }));
  }

  async getBalance() {
    if (!this.connected || !this.accountId) return null;
    const res = await this._fetch(`${BASE}/account/list`);
    if (!res.ok) return null;
    const data = await res.json();
    const accounts = data.results || data;
    const account = accounts.find(a => a.id === this.accountId);
    return account ? +(account.current_balance?.amount ?? 0) : null;
  }
}
