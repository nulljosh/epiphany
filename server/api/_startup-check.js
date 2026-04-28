const REQUIRED = [
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
];

const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.warn(`[startup] Missing env vars: ${missing.join(', ')}`);
}
