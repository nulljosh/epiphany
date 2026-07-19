#!/bin/bash
# Edit a user's portfolio or account record directly in Upstash KV, bypassing login/UI.
# Usage:
#   ./scripts/kv-portfolio-edit.sh get <email>                 # dump current portfolio JSON
#   ./scripts/kv-portfolio-edit.sh set <email> <file.json>     # overwrite portfolio with file contents
#   ./scripts/kv-portfolio-edit.sh user <email>                # dump the user:<email> record (plan, flags, id...)
#   ./scripts/kv-portfolio-edit.sh set-user <email> <file.json> # overwrite user record with file contents
set -euo pipefail
cd "$(dirname "$0")/.."

ACTION="${1:?usage: kv-portfolio-edit.sh <get|set> <email> [file.json]}"
EMAIL="${2:?email required}"

TMPENV=$(mktemp)
npx --yes vercel env pull "$TMPENV" --environment=production --yes >/dev/null 2>&1
KV_URL=$(grep KV_REST_API_URL "$TMPENV" | sed 's/KV_REST_API_URL="//;s/\\n"//')
KV_TOKEN=$(grep '^KV_REST_API_TOKEN' "$TMPENV" | sed 's/KV_REST_API_TOKEN="//;s/\\n"//')
rm -f "$TMPENV"

USER_JSON=$(curl -s "$KV_URL/get/user:$EMAIL" -H "Authorization: Bearer $KV_TOKEN")
USER_ID=$(python3 -c "import json,sys; print(json.loads(json.loads(sys.stdin.read())['result'])['id'])" <<< "$USER_JSON")

case "$ACTION" in
  get)
    curl -s "$KV_URL/get/portfolio:$USER_ID" -H "Authorization: Bearer $KV_TOKEN" \
      | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; d=json.loads(r); d=json.loads(d[0]) if isinstance(d,list) else d; print(json.dumps(d, indent=2))"
    ;;
  set)
    FILE="${3:?file.json required for set}"
    curl -s -X POST "$KV_URL/set/portfolio:$USER_ID" -H "Authorization: Bearer $KV_TOKEN" \
      -H "Content-Type: application/json" --data-binary "@$FILE"
    echo
    ;;
  user)
    python3 -c "import json,sys; print(json.dumps(json.loads(json.loads(sys.stdin.read())['result']), indent=2))" <<< "$USER_JSON"
    ;;
  set-user)
    FILE="${3:?file.json required for set-user}"
    curl -s -X POST "$KV_URL/set/user:$EMAIL" -H "Authorization: Bearer $KV_TOKEN" \
      -H "Content-Type: application/json" --data-binary "@$FILE"
    echo
    ;;
  *)
    echo "unknown action: $ACTION" >&2; exit 1
    ;;
esac
