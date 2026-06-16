// Defaults for a signed-out or brand-new account: empty on purpose. Each user's
// budget, bills, goals and subscriptions live in their own KV portfolio
// (server/api/portfolio.js), never in the bundle.
export const USER_HOLDINGS = [];
export const USER_ACCOUNTS = [];
export const USER_BUDGET = { income: [], expenses: [] };
export const USER_DEBT = [];
export const USER_CREDITS = [];
export const USER_TELECOM = null;
export const USER_BILLS = [];
export const USER_GOALS = [];
export const USER_SUBSCRIPTIONS = [];
export const USER_INCOME_PHASES = [];
