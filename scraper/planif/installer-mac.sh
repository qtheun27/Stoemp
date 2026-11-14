#!/bin/bash
# Planifie le robot de prix chaque dimanche à 10 h 23 sur ce Mac (relancé au réveil si le Mac dormait).
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM="$(command -v npm)"
PLIST="$HOME/Library/LaunchAgents/be.stoemp.robot-prix.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>be.stoemp.robot-prix</string>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>ProgramArguments</key><array><string>$NPM</string><string>run</string><string>robot:local</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$NPM"):/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin</string></dict>
  <key>StartCalendarInterval</key><dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>23</integer></dict>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/stoemp-robot.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/stoemp-robot.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✅ Robot planifié chaque dimanche à 10 h 23. Journal : ~/Library/Logs/stoemp-robot.log"
echo "   Lancer tout de suite : launchctl start be.stoemp.robot-prix"
