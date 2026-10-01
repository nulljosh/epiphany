#!/bin/zsh
# Builds ~/Applications/Epiphany Live.app: a menu bar app with no Dock icon that runs scripts/menubar.py.
APP="$HOME/Applications/Epiphany Live.app"
rm -rf "$APP" && mkdir -p "$APP/Contents/MacOS"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Epiphany Live</string>
  <key>CFBundleIdentifier</key><string>com.heyitsmejosh.epiphany-live</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST
cat > "$APP/Contents/MacOS/launcher" <<'LAUNCH'
#!/bin/zsh
export PATH="/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin"
cd "$HOME/Documents/Code/epiphany" || exit 1
# Quit exits 0 and ends the loop; a crash exits non-zero and the app comes back after a short pause.
until caffeinate -i "$HOME/.local/bin/uv" run --quiet --with rumps --with ib_async python3 scripts/menubar.py; do
  echo "$(date '+%F %T') menubar: exited $?, restarting" >> "$HOME/Library/Logs/EpiphanyIBKR.log"
  sleep 5
done
LAUNCH
chmod +x "$APP/Contents/MacOS/launcher"
codesign --force --sign - "$APP" 2>&1 | tail -1
echo "built $APP"
