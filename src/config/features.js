// Central feature → tier map. The paywall strategy: keep the ambient
// intelligence (map, events, news, markets) free to drive signups, and gate
// the money features. Flip a feature to 'premium' here as paying users grow —
// see ROADMAP.md "Monetization" for the phased rollout.
export const FEATURES = {
  // Free — acquisition surface
  map: 'free',
  events: 'free',
  news: 'free',
  markets: 'free',
  weather: 'free',

  // Premium — enforced server-side in server/api/broker/autopilot.js
  autopilot: 'premium',

  dailyBrief: 'premium',
  peopleGraph: 'premium',

  // Phase 2 candidates (still free today)
  brokerSync: 'free',
  recommendations: 'free',
};

export const isPremiumFeature = (key) => FEATURES[key] === 'premium';
