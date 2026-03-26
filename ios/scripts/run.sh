#!/bin/bash
set -e
cd "$(dirname "$0")/.."
xcodegen generate 2>/dev/null
xcodebuild -scheme Monica -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -1
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
APP=$(find ~/Library/Developer/Xcode/DerivedData/Monica-*/Build/Products/Debug-iphonesimulator/Monica.app -maxdepth 0 2>/dev/null | head -1)
if [ -n "$APP" ]; then
    xcrun simctl install "iPhone 17 Pro" "$APP"
    xcrun simctl launch "iPhone 17 Pro" com.heyitsmejosh.monica
    echo "Installed and launched on iPhone 17 Pro simulator"
else
    echo "Build succeeded but app not found in DerivedData"
fi
