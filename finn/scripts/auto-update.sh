#!/bin/bash
# Auto-update Monica portfolio from balance check

MONICA_DIR="$HOME/Documents/Code/monica"
cd "$MONICA_DIR"

# Get current balances (placeholder - would parse from screenshot/API)
CHEQUING=$(osascript -e 'display dialog "Current chequing balance (CAD):" default answer "582"' -e 'text returned of result' 2>/dev/null)
TFSA=$(osascript -e 'display dialog "Current TFSA cash (CAD):" default answer "101"' -e 'text returned of result' 2>/dev/null)

if [ -z "$CHEQUING" ] || [ -z "$TFSA" ]; then
  echo "Cancelled or no input"
  exit 0
fi

# Calculate USD equivalent (rough rate: 1.37)
CAD_TOTAL=$(echo "$CHEQUING + $TFSA" | bc)
USD_TOTAL=$(echo "scale=0; $CAD_TOTAL / 1.37" | bc)

# Update index.html
sed -i '' "s/<td>\$[0-9.]* CAD<\/td><\/tr>/<td>\$$CHEQUING CAD<\/td><\/tr>/" index.html
sed -i '' "s/<td>\$[0-9.]* CAD<\/td><\/tr>/<td>\$$TFSA CAD<\/td><\/tr>/" index.html
sed -i '' "s/<tr class=\"t\"><td>Total<\/td><td>~\$[0-9]* USD<\/td><\/tr>/<tr class=\"t\"><td>Total<\/td><td>~\$$USD_TOTAL USD<\/td><\/tr>/" index.html

# Commit and push
git add index.html
git commit -m "Update balances: \$$CAD_TOTAL CAD (~\$$USD_TOTAL USD)"
git push

echo "Monica updated: \$$CAD_TOTAL CAD"
