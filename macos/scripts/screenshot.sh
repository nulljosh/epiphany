#!/bin/bash
# Capture the macOS app window: build, launch with snapshot args, screencapture by window id.
# ponytail: XCUITest could not see the window (stale bundle-id registrations); CGWindowList can.
set -e
cd "$(dirname "$0")/.."
set -a; source ../.env.accounts.local; set +a
xcodegen generate >/dev/null
xcodebuild -project Epiphany.xcodeproj -scheme Epiphany -destination 'platform=macOS' -derivedDataPath build build -quiet
APP=build/Build/Products/Debug/Epiphany.app/Contents/MacOS/Epiphany
pkill -x Epiphany 2>/dev/null || true
SNAPSHOT_EMAIL="$DEMO_EMAIL" SNAPSHOT_PASSWORD="$DEMO_PASSWORD" \
  "$APP" UITEST_SNAPSHOT -app_theme dark -situation.mapLayer standard -ApplePersistenceIgnoreState YES &
PID=$!
sleep "${WAIT:-30}"
WID=$(swift - "$PID" <<'SWIFT'
import CoreGraphics
let pid = Int32(CommandLine.arguments[1])!
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w["kCGWindowOwnerPID"] as? Int32) == pid && (w["kCGWindowLayer"] as? Int) == 0 {
    print(w["kCGWindowNumber"] as! Int); break
}
SWIFT
)
mkdir -p fastlane/screenshots/mac
screencapture -o -l "$WID" fastlane/screenshots/mac/1-main.png
kill $PID
echo "saved fastlane/screenshots/mac/1-main.png (window $WID)"
