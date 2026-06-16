#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"
ENVS=("production" "preview" "development")

# Keys managed by Vercel runtime — skip these
SKIP_KEYS=(
  "VERCEL_URL" "VERCEL_ENV" "VERCEL_REGION" "VERCEL_OIDC_TOKEN"
  "NODE_ENV" "NEXT_PUBLIC_VERCEL_URL"
  "KV_URL" "KV_REST_API_URL" "KV_REST_API_TOKEN" "KV_REST_API_READ_ONLY_TOKEN"
)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.local not found at $ENV_FILE"
  exit 1
fi

if ! command -v vercel &>/dev/null; then
  echo "ERROR: vercel CLI not found. Run: npm i -g vercel"
  exit 1
fi

should_skip() {
  local key="$1"
  for skip in "${SKIP_KEYS[@]}"; do
    [[ "$key" == "$skip" ]] && return 0
  done
  [[ "$key" == VERCEL_* ]] && return 0
  [[ "$key" == NEXT_PUBLIC_VERCEL_* ]] && return 0
  return 1
}

echo "=== Syncing .env.local → Vercel ==="
echo ""

pushed=0
skipped=0

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and blank lines
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

  KEY="${line%%=*}"
  VALUE="${line#*=}"

  if should_skip "$KEY"; then
    ((skipped++)) || true
    continue
  fi

  echo "  Pushing $KEY..."
  # Strip surrounding quotes from value
  CLEAN_VALUE=$(echo "$VALUE" | sed 's/^"//;s/"$//')
  for env in "${ENVS[@]}"; do
    vercel env rm "$KEY" "$env" --yes 2>/dev/null || true
    vercel env add "$KEY" "$env" --value "$CLEAN_VALUE" --yes 2>/dev/null || true
  done
  ((pushed++)) || true

done < "$ENV_FILE"

echo ""
echo "Done. $pushed keys pushed to [${ENVS[*]}]. $skipped skipped (Vercel-managed)."
echo ""
echo "Deploy to pick up new keys:"
echo "  cd apps/epiphany && vercel --prod"
