#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.local not found at $ENV_FILE"
  exit 1
fi

source "$ENV_FILE" 2>/dev/null || true

echo "=== Epiphany Key Rotation ==="
echo ""
echo "Opening all rotation dashboards simultaneously..."
echo ""

# Open all dashboards in parallel
open "https://dashboard.stripe.com/apikeys"
open "https://resend.com/api-keys"
open "https://console.upstash.com"

echo "Keys to rotate (update .env.local after visiting each dashboard):"
echo ""
echo "  STRIPE_SECRET_KEY        → stripe.com/apikeys (roll the sk_live_ key)"
echo "  STRIPE_WEBHOOK_SECRET    → stripe.com/webhooks (reveal/rotate the whsec_ secret)"
echo "  RESEND_API_KEY           → resend.com/api-keys (delete old, create new)"
echo "  SPARK_SERVICE_KEY        → spark-api Worker: wrangler secret put SERVICE_KEY there, then the same value here"
echo "  KV_REST_API_TOKEN        → upstash.com → Redis → Reset Token"
echo "  KV_REST_API_URL          → upstash.com (update if endpoint changes)"
echo "  REDIS_URL                → upstash.com (update if password changes)"
echo "  CRON_SECRET              → generate: openssl rand -hex 32"
echo "  WEBHOOK_SECRET           → generate: openssl rand -hex 32"
echo ""
echo "For CRON_SECRET and WEBHOOK_SECRET, run:"
echo "  openssl rand -hex 32"
echo ""
echo "Then push each one to the Worker: npx wrangler secret put <NAME>"
