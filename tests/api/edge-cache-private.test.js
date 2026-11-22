// The Worker edge-caches GET responses by URL only (worker/index.js), before any auth runs.
// A route in the gateway's CACHE_TTL that reads the session would hand one user's data to anyone.
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const gateway = readFileSync(resolve('api/gateway.js'), 'utf8');
const block = gateway.match(/const CACHE_TTL = \{([\s\S]*?)\};/)[1];
const routes = [...block.matchAll(/'?([\w-]+)'?\s*:/g)].map((m) => m[1]);

describe('edge cache', () => {
  it('never caches a route that reads the session', () => {
    expect(routes.length).toBeGreaterThan(10);
    for (const r of routes) {
      const src = readFileSync(resolve(`server/api/${r}.js`), 'utf8');
      expect(src, `${r} reads the session but is edge-cached`).not.toMatch(/getSessionUser|isPro\(/);
    }
  });
});
