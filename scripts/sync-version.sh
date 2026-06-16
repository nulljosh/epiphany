#!/bin/bash
set -e

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
if [ -z "$VERSION" ]; then
  echo "⚠️  No version found in package.json"
  exit 0
fi

echo "🔄 Syncing version $VERSION to iOS/macOS project files..."

# macOS
if [ -f "macos/project.yml" ]; then
  sed -i '' "s/MARKETING_VERSION: .*/MARKETING_VERSION: $VERSION/" macos/project.yml
  echo "✅ macOS: MARKETING_VERSION = $VERSION"
fi

# iOS
if [ -f "ios/project.yml" ]; then
  sed -i '' "s/MARKETING_VERSION: .*/MARKETING_VERSION: $VERSION/" ios/project.yml
  echo "✅ iOS: MARKETING_VERSION = $VERSION"
fi

echo "Done."
