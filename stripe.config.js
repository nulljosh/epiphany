const PRICE_MAP = {
  [process.env.STRIPE_PRICE_ID_STARTER]: 'starter',
  [process.env.STRIPE_PRICE_ID_PRO]: 'pro',
};

export function getPlanByPriceId(priceId) {
  return PRICE_MAP[priceId] || 'free';
}
