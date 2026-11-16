import Stripe from 'stripe';
import { getKv } from './_kv.js';
import { isProByEmail } from './gates.js';

let stripe;
function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

const BASE_URL = 'https://epiphany.jaybulb.com';
const TRIAL_DAYS = 7;

// Epiphany Pro: $1.99 a month or $14.99 a year, same as the App Store. The server owns the price ids.
function priceFor(plan) {
  return plan === 'yearly' ? process.env.STRIPE_PRICE_ID_YEARLY : process.env.STRIPE_PRICE_ID_MONTHLY;
}

function getSessionToken(req) {
  const cookie = req.headers?.cookie || '';
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

// Every action works on the signed-in account only; nothing trusts a customer id from the client.
async function sessionUser(kv, req) {
  const token = getSessionToken(req);
  const session = token ? await kv.get(`session:${token}`) : null;
  if (!session?.email) return null;
  return { email: session.email, user: (await kv.get(`user:${session.email}`)) || { email: session.email } };
}

// Routes (all need a signed-in session):
//   POST ?action=checkout         { plan: 'monthly'|'yearly' } → Stripe Checkout URL
//   POST ?action=portal                                       → billing portal URL (cancel, change card)
//   POST ?action=resolve-session  { sessionId }               → links a finished checkout to this account
//   GET  ?action=status                                       → this account's subscription record
export default async function handler(req, res) {
  const kv = await getKv();
  if (!kv) return res.status(503).json({ error: 'Storage unavailable' });
  const { action } = req.query;
  const me = await sessionUser(kv, req);

  if (req.method === 'GET' && action === 'status') {
    const cid = me?.user?.stripe_customer_id;
    const sub = cid ? await kv.get(`sub:${cid}`) : null;
    const pro = me ? await isProByEmail(me.email, req) : false;
    return res.status(200).json({ ...(sub || { status: null }), tier: pro ? 'pro' : 'free' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!me) return res.status(401).json({ error: 'Sign in first' });

  if (action === 'checkout') {
    try {
      if (await isProByEmail(me.email, req)) return res.status(409).json({ error: 'Already Pro' });
      const price = priceFor(req.body?.plan);
      if (!price) return res.status(500).json({ error: 'Stripe prices not configured' });
      const cid = me.user.stripe_customer_id;
      const params = {
        mode: 'subscription',
        line_items: [{ price, quantity: 1 }],
        success_url: `${BASE_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: BASE_URL,
        client_reference_id: me.email,
        allow_promotion_codes: true,
        // One free week per account, ever.
        subscription_data: me.user.stripeTrialUsed ? {} : { trial_period_days: TRIAL_DAYS },
        ...(cid ? { customer: cid } : { customer_email: me.email }),
      };
      // Optional promo applied server-side (comp links, e2e). Stripe's own promo box stays on otherwise.
      if (req.body?.promo) {
        const codes = await getStripe().promotionCodes.list({ code: String(req.body.promo), active: true, limit: 1 });
        if (codes.data[0]) { params.discounts = [{ promotion_code: codes.data[0].id }]; delete params.allow_promotion_codes; }
      }
      const session = await getStripe().checkout.sessions.create(params);
      return res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (err) {
      console.error('[STRIPE/checkout] Error:', err.message);
      return res.status(500).json({ error: 'Checkout session creation failed' });
    }
  }

  if (action === 'resolve-session') {
    try {
      const { sessionId } = req.body || {};
      if (!sessionId) return res.status(400).json({ error: 'Session ID required' });
      const session = await getStripe().checkout.sessions.retrieve(String(sessionId));
      // Only the account that started the checkout can claim it.
      if (session.client_reference_id !== me.email) return res.status(403).json({ error: 'Checkout belongs to another account' });
      if (session.customer && me.user.stripe_customer_id !== session.customer) {
        await kv.set(`user:${me.email}`, { ...me.user, stripe_customer_id: session.customer });
      }
      return res.status(200).json({ customerId: session.customer });
    } catch (err) {
      console.error('[STRIPE/resolve-session] Error:', err.message);
      return res.status(500).json({ error: 'Failed to resolve session' });
    }
  }

  if (action === 'portal') {
    try {
      const cid = me.user.stripe_customer_id;
      if (!cid) return res.status(404).json({ error: 'No billing account' });
      const session = await getStripe().billingPortal.sessions.create({ customer: cid, return_url: BASE_URL });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('[STRIPE/portal] Error:', err.message);
      return res.status(500).json({ error: 'Failed to create portal session' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
