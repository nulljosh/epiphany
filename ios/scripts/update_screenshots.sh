#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Regenerating Xcode project"
xcodegen generate

# xcodebuild does NOT forward arbitrary host env into the simulator test runner.
# It DOES forward vars prefixed TEST_RUNNER_, stripping the prefix -- so the test
# process sees SNAPSHOT_EMAIL/SNAPSHOT_PASSWORD and passes them to the app.
if [ -f ../.env.accounts.local ]; then
  set -a
  # ponytail: eval, not `source <(...)` -- process substitution silently sourced
  # nothing here, which is how the run ended up on an empty demo account.
  eval "$(grep '^DEMO_' ../.env.accounts.local | sed 's/^DEMO_/TEST_RUNNER_SNAPSHOT_/')"
  set +a
fi
: "${TEST_RUNNER_SNAPSHOT_EMAIL:?missing DEMO_EMAIL in .env.accounts.local}"
: "${TEST_RUNNER_SNAPSHOT_PASSWORD:?missing DEMO_PASSWORD in .env.accounts.local}"

echo "==> Running fastlane snapshot"
fastlane snapshot

DEVICE="iPhone 11 Pro Max"
SHOTS=("1-situation" "2-markets" "3-stock-detail" "4-portfolio" "5-settings")

echo "==> Copying screenshots into screenshots/appstore"
for shot in "${SHOTS[@]}"; do
  cp "fastlane/screenshots/en-US/${DEVICE}-${shot}.png" "screenshots/appstore/${shot}.png"
done

echo "==> Copying screenshots into public/ for the landing page"
# ponytail: fastlane shot name -> landing-page image name (bash 3.2, no assoc arrays)
for shot in "${SHOTS[@]}"; do
  case "$shot" in
    1-situation)   name=situation ;;
    2-markets)     name=markets ;;
    3-stock-detail) name=stocks ;;
    4-portfolio)   name=portfolio ;;
    5-settings)    name=settings ;;
  esac
  cp "fastlane/screenshots/en-US/${DEVICE}-${shot}.png" "../public/screenshots/screenshot-${name}-new.png"
done

echo "==> Uploading to App Store Connect"
VERSION="$(awk '/MARKETING_VERSION:/ {print $2; exit}' project.yml)"
for device in IPHONE_65 IPHONE_67; do
  asc screenshots upload --app 6779522175 --version "$VERSION" \
    --path fastlane/screenshots --device-type "$device" --replace --confirm \
    || echo "!! ASC upload failed for $device, screenshots still updated locally"
done

echo "==> Staging screenshots + README"
cd ..
for shot in "${SHOTS[@]}"; do
  git add -f "ios/screenshots/appstore/${shot}.png"
done
git add ios/README.md public/screenshots

if git diff --cached --quiet; then
  echo "==> No changes to commit"
  exit 0
fi

echo "==> Committing"
git commit -m "$(cat <<'EOF'
Update Epiphany iOS App Store screenshots

Regenerated via fastlane snapshot, including 3-stock-detail.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

echo "==> Pushing"
git push

echo "==> Done"
