#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Regenerating Xcode project"
xcodegen generate

if [ -f ../.env.accounts.local ]; then
  set -a
  source <(grep '^DEMO_' ../.env.accounts.local | sed 's/^DEMO_/SNAPSHOT_/')
  set +a
fi

echo "==> Running fastlane snapshot"
fastlane snapshot

DEVICE="iPhone 17 Pro"
SHOTS=("1-situation" "2-markets" "4-portfolio" "5-settings")

echo "==> Copying screenshots into screenshots/appstore"
for shot in "${SHOTS[@]}"; do
  cp "fastlane/screenshots/en-US/${DEVICE}-${shot}.png" "screenshots/appstore/${shot}.png"
done

echo "==> Staging screenshots + README"
cd ..
for shot in "${SHOTS[@]}"; do
  git add -f "ios/screenshots/appstore/${shot}.png"
done
git add ios/README.md

if git diff --cached --quiet; then
  echo "==> No changes to commit"
  exit 0
fi

echo "==> Committing"
git commit -m "$(cat <<'EOF'
Update Epiphany iOS App Store screenshots

Regenerated via fastlane snapshot (3-stock-detail not automated yet -- requires
drilling into a stock row, left as a manual/stale shot for now).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

echo "==> Pushing"
git push

echo "==> Done"
