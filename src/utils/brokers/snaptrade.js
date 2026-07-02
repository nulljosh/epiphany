// SnapTrade adapter — brokerage sync (holdings, balances) + order routing.
// Server-side only (node:crypto + fetch). Official aggregator API, ToS-clean.
// Covers Wealthsimple/Questrade (CA) + US brokers under one connection.
// Docs: https://docs.snaptrade.com — request signing is HMAC-SHA256 over
// { content, path, query }, base64-encoded, sent as the `Signature` header.
//
// Order routing is premium-gated upstream (autopilot endpoint + cron both
// check isPro); live mode is per-user opt-in, paper is the default.

import crypto from 'node:crypto';

const BASE = 'https://api.snaptrade.com';
const API = '/api/v1';

export class SnapTradeAdapter {
  constructor(config = {}) {
    this.name = 'snaptrade';
    this.clientId = config.clientId || process.env.SNAPTRADE_CLIENT_ID || null;
    this.consumerKey = config.consumerKey || process.env.SNAPTRADE_CONSUMER_KEY || null;
    this.userId = config.userId || null;
    this.userSecret = config.userSecret || null;
    this.connected = false;
  }

  static isConfigured() {
    return Boolean(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY);
  }

  _sign(path, query, content) {
    const sigObject = { content: content ?? null, path, query };
    const payload = JSON.stringify(sigObject);
    return crypto.createHmac('sha256', this.consumerKey).update(payload).digest('base64');
  }

  // SnapTrade verifies the signature against the body re-serialized with
  // sorted keys, so multi-key bodies 401 (code 1076) unless we sign AND send
  // the same sorted serialization.
  _sortKeysDeep(value) {
    if (Array.isArray(value)) return value.map((v) => this._sortKeysDeep(v));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map((k) => [k, this._sortKeysDeep(value[k])]));
    }
    return value;
  }

  async _request(method, path, { query = {}, body = null } = {}) {
    if (!this.clientId || !this.consumerKey) throw new Error('[SnapTrade] Missing clientId or consumerKey');

    const params = new URLSearchParams({
      clientId: this.clientId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      ...query,
    });
    const queryString = params.toString();
    const fullPath = `${API}${path}`;
    const sortedBody = body ? this._sortKeysDeep(body) : null;
    const signature = this._sign(fullPath, queryString, sortedBody);

    const res = await fetch(`${BASE}${fullPath}?${queryString}`, {
      method,
      headers: { 'Content-Type': 'application/json', Signature: signature },
      ...(sortedBody ? { body: JSON.stringify(sortedBody) } : {}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[SnapTrade] ${method} ${path} failed: ${res.status} ${text}`);
    }
    // DELETE (and some 204s) return an empty body — res.json() would throw
    // "Unexpected end of JSON input".
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // Register a SnapTrade user. Returns { userId, userSecret } — persist the secret.
  async registerUser(userId) {
    const data = await this._request('POST', '/snapTrade/registerUser', { body: { userId } });
    this.userId = data.userId;
    this.userSecret = data.userSecret;
    return data;
  }

  // Hosted connection portal URL for the user to link a brokerage.
  // Pass a SnapTrade broker slug (e.g. WEALTHSIMPLE, QUESTRADE) to deep-link
  // that brokerage's login; omit to let the user choose in the portal.
  async loginLink(broker = null) {
    this._requireUser();
    const data = await this._request('POST', '/snapTrade/login', {
      query: { userId: this.userId, userSecret: this.userSecret },
      // v4 portal renders the full searchable broker list; the older default
      // showed only a handful and "More" fell back to Wealthsimple.
      // connectionType 'trade' so autopilot can place orders — read-only
      // connections 403 (code 3007) on /trade/impact.
      body: { connectionType: 'trade', connectionPortalVersion: 'v4', ...(broker ? { broker } : {}) },
    });
    return data.redirectURI;
  }

  async connect() {
    this._requireUser();
    this.connected = true;
    return true;
  }

  async listAccounts() {
    this._requireUser();
    const accounts = await this._request('GET', '/accounts', {
      query: { userId: this.userId, userSecret: this.userSecret },
    });
    // SnapTrade can return the same account twice (pagination/connection
    // overlap). Dedupe by id here so every caller (holdings, balances,
    // accounts) stops double-counting — this was the phantom-holdings bug.
    const seen = new Set();
    return (accounts ?? []).filter((a) => {
      if (!a?.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }

  // Linked brokerage connections: [{ id, brokerName, disabled }]
  async listConnections() {
    this._requireUser();
    const auths = await this._request('GET', '/authorizations', {
      query: { userId: this.userId, userSecret: this.userSecret },
    });
    return (auths ?? []).map(a => ({
      id: a.id,
      brokerName: a.brokerage?.display_name || a.brokerage?.name || a.name || 'Brokerage',
      disabled: Boolean(a.disabled),
    }));
  }

  async removeConnection(authorizationId) {
    this._requireUser();
    return this._request('DELETE', `/authorizations/${authorizationId}`, {
      query: { userId: this.userId, userSecret: this.userSecret },
    });
  }

  // Normalized holdings across all linked accounts: { symbol, shares, marketValue, account }.
  // Uses /positions — the combined /holdings endpoint was retired by SnapTrade (410 Gone).
  async getHoldings() {
    const accounts = await this.listAccounts();
    const holdings = [];
    for (const acct of accounts) {
      const positions = await this._request('GET', `/accounts/${acct.id}/positions`, {
        query: { userId: this.userId, userSecret: this.userSecret },
      });
      for (const pos of positions ?? []) {
        const symbol = pos.symbol?.symbol?.symbol ?? pos.symbol?.symbol ?? pos.symbol ?? null;
        if (!symbol) continue;
        // SnapTrade reports price 0/null for thinly-synced symbols (e.g. RL) --
        // treat 0 as missing so the client-side quote fallback kicks in.
        const price = Number(pos.price) > 0 ? Number(pos.price) : null;
        const units = Number(pos.units ?? 0);
        if (units <= 0) continue;
        holdings.push({
          symbol,
          shares: units,
          marketValue: price != null ? price * units : null,
          account: acct.name || acct.id,
          accountId: acct.id,
        });
      }
    }
    // Merge duplicate rows within one account, keyed by account ID (names can
    // collide across accounts and would wrongly sum).
    const merged = new Map();
    for (const h of holdings) {
      const key = `${h.symbol}::${h.accountId}`;
      const prev = merged.get(key);
      if (!prev) { merged.set(key, { ...h }); continue; }
      prev.shares += h.shares;
      prev.marketValue = (prev.marketValue != null || h.marketValue != null)
        ? (prev.marketValue ?? 0) + (h.marketValue ?? 0) : null;
    }
    return Array.from(merged.values());
  }

  // Total cash across accounts plus per-account/currency breakdown.
  async getBalance() {
    const accounts = await this.listAccounts();
    let total = 0;
    const accountsOut = [];
    for (const acct of accounts) {
      const balances = await this._request('GET', `/accounts/${acct.id}/balances`, {
        query: { userId: this.userId, userSecret: this.userSecret },
      });
      for (const b of balances ?? []) {
        const cash = Number(b.cash ?? 0);
        total += cash;
        accountsOut.push({ account: acct.name || acct.id, currency: b.currency?.code ?? null, cash });
      }
    }
    return { total, accounts: accountsOut };
  }

  // Registered/tax-advantaged account names imply an "investment" account;
  // everything else (chequing/spend accounts like Wealthsimple's "Vacation"
  // sub-account) is "cash". SnapTrade doesn't reliably expose a usable type
  // field across brokerages, so we infer from the account name.
  static inferAccountType(name) {
    return /tfsa|rrsp|resp|rrif|lira|fhsa|margin|individual/i.test(name || '') ? 'investment' : 'cash';
  }

  // One row per linked account: id, name, type, and total balance (cash +
  // holdings market value). This is what should be persisted/displayed --
  // getBalance()/getHoldings() alone only give partial, unmerged pictures.
  async getAccounts() {
    const accounts = await this.listAccounts();
    const out = [];
    for (const acct of accounts) {
      const name = acct.name || acct.id;
      const [balances, positions] = await Promise.all([
        this._request('GET', `/accounts/${acct.id}/balances`, {
          query: { userId: this.userId, userSecret: this.userSecret },
        }),
        this._request('GET', `/accounts/${acct.id}/positions`, {
          query: { userId: this.userId, userSecret: this.userSecret },
        }),
      ]);
      const cash = (balances ?? []).reduce((sum, b) => sum + Number(b.cash ?? 0), 0);
      const holdingsValue = (positions ?? []).reduce((sum, pos) => {
        const price = Number(pos.price) > 0 ? Number(pos.price) : null;
        const units = Number(pos.units ?? 0);
        return sum + (price != null ? price * units : 0);
      }, 0);
      out.push({
        id: acct.id,
        name,
        type: SnapTradeAdapter.inferAccountType(name),
        balance: cash + holdingsValue,
      });
    }
    return out;
  }

  // Resolve a ticker to a universal symbol id tradable at this account's brokerage.
  async findSymbolId(accountId, ticker) {
    const results = await this._request('POST', `/accounts/${accountId}/symbols`, {
      query: { userId: this.userId, userSecret: this.userSecret },
      body: { substring: ticker },
    });
    const upper = ticker.toUpperCase();
    const exact = (results ?? []).find((s) => (s.symbol ?? s.universal_symbol?.symbol) === upper);
    const id = exact?.id ?? exact?.universal_symbol?.id;
    if (!id) throw new Error(`[SnapTrade] Symbol not tradable here: ${ticker}`);
    return id;
  }

  // Checked order flow: /trade/impact validates against the account, then
  // /trade/{id} places it. Market/Day only — autopilot keeps orders simple.
  // Dry-run: SnapTrade computes the order's impact and returns a tradeId,
  // but nothing executes until /trade/{tradeId} is confirmed.
  async tradeImpact({ accountId, symbol, side, qty }) {
    this._requireUser();
    const universalSymbolId = await this.findSymbolId(accountId, symbol);
    return this._request('POST', '/trade/impact', {
      query: { userId: this.userId, userSecret: this.userSecret },
      body: {
        account_id: accountId,
        action: side.toUpperCase(), // BUY | SELL
        order_type: 'Market',
        time_in_force: 'Day',
        units: qty,
        universal_symbol_id: universalSymbolId,
        price: null,
        stop: null,
      },
    });
  }

  async placeOrder({ accountId, symbol, side, qty }) {
    const impact = await this.tradeImpact({ accountId, symbol, side, qty });
    const tradeId = impact?.trade?.id ?? impact?.id ?? impact?.trade_id;
    if (!tradeId) {
      console.error('[SnapTrade] Trade impact missing id. Response:', JSON.stringify(impact, null, 2));
      throw new Error('[SnapTrade] Trade impact returned no trade id — check logs');
    }
    const result = await this._request('POST', `/trade/${tradeId}`, {
      query: { userId: this.userId, userSecret: this.userSecret },
    });
    return result;
  }

  _requireUser() {
    if (!this.userId || !this.userSecret) {
      throw new Error('[SnapTrade] No userId/userSecret — call registerUser() first');
    }
  }
}
