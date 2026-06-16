import { vi } from 'vitest';

// Shared mock setup to reduce duplication across test files
const kvStore = new Map();
let tokenCounter = 0;
let uuidCounter = 0;

function matchesPattern(key, pattern) {
  if (!pattern || pattern === '*') return true;
  const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return regex.test(key);
}

export function createMockKV() {
  return {
    get: vi.fn(async (key) => kvStore.get(key)),
    set: vi.fn(async (key, value, options = {}) => {
      kvStore.set(key, value);
      return { ok: true };
    }),
    del: vi.fn(async (key) => {
      kvStore.delete(key);
      return { ok: true };
    }),
    keys: vi.fn(async (pattern = '*') => Array.from(kvStore.keys()).filter((key) => matchesPattern(key, pattern))),
  };
}

export function createReqRes({
  method = 'POST',
  action,
  body = {},
  cookie = '',
  query = {},
  remoteAddress = '127.0.0.1',
  headers = {},
} = {}) {
  const req = {
    method,
    query: action ? { action, ...query } : query,
    body,
    headers: {
      cookie,
      ...headers,
    },
    socket: { remoteAddress },
  };

  const res = {
    statusCode: null,
    data: null,
    headers: {},
    writeHeadHeaders: null,
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((data) => {
      res.data = data;
      return res;
    }),
    setHeader: vi.fn((name, value) => {
      res.headers[name] = value;
      return res;
    }),
    writeHead: vi.fn((code, headers) => {
      res.statusCode = code;
      res.writeHeadHeaders = headers;
      return res;
    }),
    end: vi.fn(() => res),
  };

  return { req, res };
}

export function seedUser(overrides = {}) {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed:password123',
    verified: false,
    tier: 'free',
    stripeCustomerId: null,
    watchlist: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  kvStore.set(`user:${user.email}`, user);
  return user;
}

export function resetAllMocks() {
  kvStore.clear();
  tokenCounter = 0;
  uuidCounter = 0;
}

export function getKVStore() {
  return kvStore;
}

export function getCounters() {
  return { tokenCounter, uuidCounter };
}
