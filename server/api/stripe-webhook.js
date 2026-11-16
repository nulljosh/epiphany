import Stripe from 'stripe';
import { getKv } from './_kv.js';
import { bump } from './event.js';

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

// The endpoint was set up for one-time payments. Make sure it also sends renewals and cancels.
const SUB_EVENTS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];
async function ensureSubscriptionEvents() {
  try {
    const { data } = await getStripe().webhookEndpoints.list({ limit: 100 });
    for (const ep of data.filter((e) => /\/api\/stripe-webhook/.test(e.url))) {
      if (ep.enabled_events.includes('*') || SUB_EVENTS.every((e) => ep.enabled_events.includes(e))) continue;
      await getStripe().webhookEndpoints.update(ep.id, { enabled_events: [...new Set([...ep.enabled_events, ...SUB_EVENTS])] });
    }
  } catch (err) { console.error('[WEBHOOK] could not enable subscription events:', err.message); }
}

export default async function handler(req, res) {
  const kv = await getKv();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // On Workers `req` is a plain object from worker/index.js, not a Node stream, so
  // iterating it threw before the try below and every Stripe delivery got a 500 --
  // the card was charged and `sub:<customerId>` was never written.
  const buf = req.rawBody !== undefined ? req.rawBody : await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Async variant: Workers has no synchronous crypto for the signature check.
    event = await getStripe().webhooks.constructEventAsync(
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (!['paid', 'no_payment_required'].includes(session.payment_status)) break;
        const customerId = session.customer;
        if (!customerId || !kv) throw new Error('Payment customer or storage missing');

        // The old $1 one-time payment: access is permanent. A subscription's state comes from
        // customer.subscription.* below; write the first status here so access never waits on event order.
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(String(session.subscription));
          await kv.setStrict(`sub:${customerId}`, { status: sub.status, subscriptionId: sub.id, customerId, priceId: sub.items?.data?.[0]?.price?.id || null, updatedAt: new Date().toISOString() });
          await ensureSubscriptionEvents();
        }
        if (session.mode !== 'subscription') {
          await kv.setStrict(`sub:${customerId}`, {
            status: 'active',
            customerId,
            priceId: session.line_items?.data?.[0]?.price?.id || process.env.STRIPE_PRICE_ID_STARTER,
            createdAt: new Date().toISOString(),
          });
        }

        // Tie the purchase to the account that started checkout, so closing the tab before the redirect
        // back still unlocks it. client_reference_id is the signed-in email (see stripe.js checkout).
        const email = session.client_reference_id;
        if (email) {
          const user = await kv.getStrict(`user:${email}`);
          const isSub = session.mode === 'subscription';
          if (user && (!user.stripe_customer_id || (isSub && !user.stripeTrialUsed))) {
            await kv.setStrict(`user:${email}`, {
              ...user,
              stripe_customer_id: user.stripe_customer_id || customerId,
              ...(isSub ? { stripeTrialUsed: true } : {}),
            });
          }
        }

        console.log('[WEBHOOK] Checkout completed:', customerId, session.mode || 'payment');
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        if (!sub.customer || !kv) throw new Error('Subscription customer or storage missing');
        await kv.setStrict(`sub:${sub.customer}`, {
          status: sub.status,
          subscriptionId: sub.id,
          customerId: sub.customer,
          priceId: sub.items?.data?.[0]?.price?.id || null,
          updatedAt: new Date().toISOString(),
        });
        const was = event.data.previous_attributes?.status;
        if (event.type === 'customer.subscription.created') await bump(kv, sub.status === 'trialing' ? 'trial_started' : 'subscribed');
        else if (was === 'trialing' && sub.status === 'active') await bump(kv, 'subscribed');
        console.log('[WEBHOOK] Subscription', sub.status, sub.customer);
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
