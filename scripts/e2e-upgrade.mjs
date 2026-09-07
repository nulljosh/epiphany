// End-to-end live purchase check: login → checkout session → Stripe hosted checkout with
// a 100%-off promo code (no card, $0, no fee) → resolve-session → webhook wrote sub:active.
// Usage: node scripts/e2e-upgrade.mjs [PROMO_CODE]   (default FREETEST)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const env = {};
for (const f of ['.env.accounts.local', '.env.tui.local']) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
const BASE = 'https://epiphany.heyitsmejosh.com';
const PROMO = process.argv[2] || 'FREETEST';
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok:', m); };

// 1. session: minted straight into KV (the on-disk password drifts; the KV token does not)
const kvUrl = env.KV_REST_API_URL, kvTok = env.KV_REST_API_TOKEN;
const userRes = await (await fetch(`${kvUrl}/get/user:${env.DEV_EMAIL}`, { headers: { Authorization: `Bearer ${kvTok}` } })).json();
const user = JSON.parse(userRes.result || 'null');
assert(user?.id, `user record for ${env.DEV_EMAIL}`);
const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
const session = { userId: user.id, email: user.email, tier: user.tier || 'free', expiresAt: Date.now() + 3600_000 };
let r = await fetch(`${kvUrl}/set/session:${token}?EX=3600`, { method: 'POST', headers: { Authorization: `Bearer ${kvTok}` }, body: JSON.stringify(session) });
assert(r.ok, 'session minted in KV');
const cookie = `epiphany_session=${token}`;
const H = { 'Content-Type': 'application/json', Cookie: cookie };

// 2. checkout session: no priceId, exactly like the web client (server owns the price)
r = await fetch(`${BASE}/api/stripe?action=checkout`, { method: 'POST', headers: H, body: JSON.stringify({ promo: PROMO }) });
const { url, sessionId } = await r.json();
assert(r.ok && url, `checkout session ${sessionId}`);

// 3. hosted checkout
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText(/\$0\.00/).first().waitFor({ timeout: 15000 });
  const email = page.locator('input[name="email"]').first();
  if (await email.isVisible()) await email.fill(env.DEV_EMAIL);
  await page.locator('[data-testid="hosted-payment-submit-button"]').first().click();
  await page.waitForURL(/session_id=/, { timeout: 30000 });
  console.log('ok: checkout completed', page.url());
} catch (e) {
  await page.screenshot({ path: 'e2e-upgrade-fail.png', fullPage: true });
  await browser.close();
  assert(false, `hosted checkout: ${e.message} (see e2e-upgrade-fail.png)`);
}
await browser.close();

// 4. resolve-session (what the app does after redirect)
r = await fetch(`${BASE}/api/stripe?action=resolve-session`, { method: 'POST', headers: H, body: JSON.stringify({ sessionId }) });
const { customerId } = await r.json();
assert(r.ok && customerId, `resolve-session → ${customerId}`);

// 5. webhook wrote sub:<customer> active
let status;
for (let i = 0; i < 15; i++) {
  status = await (await fetch(`${BASE}/api/stripe?action=status&customerId=${customerId}`)).json();
  if (status.status === 'active') break;
  await new Promise(s => setTimeout(s, 2000));
}
assert(status?.status === 'active', `webhook → status ${status?.status} tier ${status?.tier}`);
console.log('PASS');
