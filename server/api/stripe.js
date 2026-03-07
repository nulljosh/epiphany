import Stripe from 'stripe';
import { kv } from '@vercel/kv';

let stripe;
function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

function getTierFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_ID_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro';
  return 'pro'; // backward compat default
}

// Helper: extract session token from cookie header
function getSessionToken(req) {
  const cookie = req.headers?.cookie || '';
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

// Routes:
//   POST ?action=checkout         { priceId }    → create checkout session
//   POST ?action=portal           { customerId } → create billing portal session
//   POST ?action=resolve-session  { sessionId }  → resolve checkout session → customerId
//   GET  ?action=status&customerId=...           → subscription status

export default async function handler(req, res) {
  const { action, customerId } = req.query;
  const allowedPriceIds = new Set(
    [process.env.STRIPE_PRICE_ID_STARTER, process.env.STRIPE_PRICE_ID_PRO].filter(Boolean)
  );

  // GET: subscription status
  if (req.method === 'GET' && action === 'status') {
    try {
      if (!customerId) {
        return res.status(200).json({ status: null, tier: 'free' });
      }
      const subscription = await kv.get(`sub:${customerId}`);
      if (!subscription) {
        return res.status(200).json({ status: null, tier: 'free' });
      }
      const tier = subscription.status === 'active'
        ? getTierFromPriceId(subscription.priceId)
        : 'free';
      return res.status(200).json({ ...subscription, tier });
    } catch (err) {
      console.error('[STRIPE/status] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST: checkout
  if (action === 'checkout') {
    try {
      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ error: 'Price ID required' });
      if (allowedPriceIds.size > 0 && !allowedPriceIds.has(priceId)) {
        return res.status(400).json({ error: 'Invalid price ID' });
      }
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://opticon-production.vercel.app';

      // Link checkout to authenticated user if session cookie exists
      const sessionToken = getSessionToken(req);
      let clientReferenceId;
      if (sessionToken) {
        const sessionData = await kv.get(`session:${sessionToken}`);
        if (sessionData?.email) {
          clientReferenceId = sessionData.email;
        }
      }

      const sessionParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: baseUrl,
        customer_creation: 'always',
        allow_promotion_codes: true,
      };
      if (clientReferenceId) {
        sessionParams.client_reference_id = clientReferenceId;
      }

      const session = await getStripe().checkout.sessions.create(sessionParams);
      return res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (err) {
      console.error('[STRIPE/checkout] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: resolve-session (after checkout redirect)
  if (action === 'resolve-session') {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const stripeCustomerId = session.customer;

      // Persist stripe_customer_id to user's KV record if authenticated
      const sessionToken = getSessionToken(req);
      if (sessionToken) {
        const sessionData = await kv.get(`session:${sessionToken}`);
        if (sessionData?.email) {
          const user = await kv.get(`user:${sessionData.email}`);
          if (user) {
            await kv.set(`user:${sessionData.email}`, {
              ...user,
              stripe_customer_id: stripeCustomerId,
            });
          }
        }
      }

      return res.status(200).json({ customerId: stripeCustomerId });
    } catch (err) {
      console.error('[STRIPE/resolve-session] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: portal
  if (action === 'portal') {
    try {
      const { customerId: cid } = req.body;
      if (!cid) return res.status(400).json({ error: 'Customer ID required' });
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://opticon-production.vercel.app';
      const session = await getStripe().billingPortal.sessions.create({
        customer: cid,
        return_url: baseUrl,
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('[STRIPE/portal] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
