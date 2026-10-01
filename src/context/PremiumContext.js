import { createContext, useContext } from 'react';

// True when the signed-in web user bought Premium. Signed-out visitors and free accounts get false.
export const PremiumContext = createContext(false);
export const usePremium = () => useContext(PremiumContext);

// Opens the pricing modal from anywhere (App listens for this event).
export const showPricing = () => window.dispatchEvent(new Event('epiphany:show-pricing'));

// Free keeps the basic overlays; the rest of the indicator suite is Premium.
export const PREMIUM_INDICATORS = new Set(['bb', 'rsi', 'macd', 'stoch', 'atr']);
