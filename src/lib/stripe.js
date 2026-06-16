import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

/**
 * Get or create a Stripe customer for a user.
 * Call this before creating checkout sessions.
 *
 * @param {object} opts
 * @param {string} opts.userId  - Your internal user ID (stored in metadata)
 * @param {string} opts.email   - User's email address
 * @param {string} [opts.existingCustomerId] - Pass if you already have one stored
 * @returns {Promise<string>} Stripe customer ID (cus_xxx)
 */
export async function getOrCreateCustomer({ userId, email, existingCustomerId }) {
  if (existingCustomerId) {
    // Verify it still exists
    try {
      const existing = await stripe.customers.retrieve(existingCustomerId);
      if (!existing.deleted) return existingCustomerId;
    } catch {}
  }

  // Search for existing customer by email
  const list = await stripe.customers.list({ email, limit: 1 });
  if (list.data.length > 0) return list.data[0].id;

  // Create new
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });
  return customer.id;
}

/**
 * Get a user's active subscription plan name.
 * @param {string} customerId
 * @returns {Promise<'free'|'pro'|'premium'>}
 */
export async function getActivePlan(customerId) {
  if (!customerId) return 'free';
  const { getPlanByPriceId } = await import('../stripe.config.js');
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
  const active = subs.data[0];
  return active ? getPlanByPriceId(active.items.data[0]?.price.id) : 'free';
}
