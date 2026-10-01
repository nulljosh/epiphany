#!/bin/zsh
# Double-click to run the Epiphany practice-account watcher and daily paper trade. Close the window (or Ctrl-C) to stop.
cd "$HOME/Documents/Code/epiphany" || exit 1
exec caffeinate -i "$HOME/.local/bin/uv" run --quiet --with ib_async python3 scripts/ibkr-live.py
