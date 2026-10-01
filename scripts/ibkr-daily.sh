#!/bin/zsh
# Daily paper run for the IBKR demo account, meant to start Mon-Fri at 1:15pm Pacific (after the US close).
# Runs scripts/ibkr-run.py --go at most once per New York day, logs to ~/Library/Logs/EpiphanyIBKR.log,
# and pops a macOS notification if the Gateway is not logged in. The runner refuses real accounts without --live.
cd "$HOME/Documents/Code/epiphany" || exit 1
LOG="$HOME/Library/Logs/EpiphanyIBKR.log"
today=$(TZ=America/New_York date +%F)
last=$(python3 -c "import json;print(json.load(open('tradingview/ibkr-state.json')).get('lastGo',''))" 2>/dev/null)
if [ "$last" = "$today" ]; then echo "$(date '+%F %R') already ran for $today" >> "$LOG"; exit 0; fi
{ echo "=== $(date '+%F %R')"; "$HOME/.local/bin/uv" run --quiet --with ib_async python3 scripts/ibkr-run.py --go; } >> "$LOG" 2>&1
if [ $? -ne 0 ]; then
  osascript -e 'display notification "IB Gateway is not logged in, or the run failed. See ~/Library/Logs/EpiphanyIBKR.log" with title "Epiphany practice account"'
fi
