import Stripe from 'stripe';
import { getKv } from './_kv.js';

let stripe;
const getStripe = () => stripe || (stripe = new Stripe(process.env.STRIPE_SECRET_KEY));

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const kv = await getKv();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;

        // One-time payment ($1) — access is permanent, no subscription to track.
        await kv.set(`sub:${customerId}`, {
          status: 'active',
          customerId,
          priceId: session.line_items?.data?.[0]?.price?.id || process.env.STRIPE_PRICE_ID_STARTER,
          createdAt: new Date().toISOString(),
        });

        console.log('[WEBHOOK] One-time purchase completed:', customerId);
        break;
      }

      default:
        console.log('[WEBHOOK] Unhandled event type:', event.type);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK] Error processing event:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
