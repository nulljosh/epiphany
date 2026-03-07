// stripe.config.js — Edit price IDs after creating products in Stripe dashboard
// Dashboard: https://dashboard.stripe.com/products

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: ['Core features', 'Community support', '1 project'],
  },
  pro: {
    name: 'Pro',
    price: 9,
    priceId: 'price_1T8SfBBmnhdgU9sGvUWirw9h',
    features: ['Everything in Free', '10 projects', 'Priority support', 'Analytics'],
  },
  premium: {
    name: 'Premium',
    price: 29,
    priceId: 'price_1T8SfJBmnhdgU9sG7fUJ0J5h',
    features: ['Everything in Pro', 'Unlimited projects', 'Dedicated support', 'API access'],
  },
};

export const PLAN_ORDER = ['free', 'pro', 'premium'];

export function getPlanByPriceId(priceId) {
  return Object.entries(PLANS).find(([, p]) => p.priceId === priceId)?.[0] ?? 'free';
}

export function planHasAccess(userPlan, requiredPlan) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}
