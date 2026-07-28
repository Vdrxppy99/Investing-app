#!/bin/bash
# Builds and installs the native Portfolio app on the paired iPhone.
#
#   ./native/build-ios.sh              simulator (no Apple ID needed)
#   ./native/build-ios.sh device       build + install to the phone
#
# This app loads the LIVE GitHub Pages build, so pushing to GitHub updates it on
# the next launch — you only need to rerun this when the Swift shell changes, or
# weekly when free provisioning expires.
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-simulator}"
command -v xcodegen >/dev/null || { echo "✗ brew install xcodegen"; exit 1; }

# One app, two platforms: the shell must report the same version as the web build.
../scripts/sync-version.sh 2>/dev/null || "$(cd .. && pwd)/scripts/sync-version.sh"

echo "→ generating Xcode project…"
xcodegen generate --quiet

if [ "$MODE" != "device" ]; then
  xcodebuild -project Portfolio.xcodeproj -scheme Portfolio -configuration Debug \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath build build
  echo "✓ build/Build/Products/Debug-iphonesimulator/Portfolio.app"
  exit 0
fi

TEAM="${DEVELOPMENT_TEAM:-$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null \
  | sed -n 's/.*teamID = \([A-Z0-9]*\);.*/\1/p' | head -1)}"
[ -n "$TEAM" ] || { echo "✗ No Apple ID in Xcode → Settings → Accounts."; exit 1; }

echo "→ building for device (team $TEAM)…"
xcodebuild -project Portfolio.xcodeproj -scheme Portfolio -configuration Debug \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" -derivedDataPath build build

APP="build/Build/Products/Debug-iphoneos/Portfolio.app"
UDID=$(xcrun devicectl list devices 2>/dev/null | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)
[ -n "$UDID" ] || { echo "✗ No connected iPhone. Unlock it and plug it in."; exit 1; }

echo "→ installing…"
for i in 1 2 3; do
  xcrun devicectl device install app --device "$UDID" "$APP" 2>&1 | grep -E "bundleID|ERROR" && break
  sleep 5
done

echo
echo "✓ Portfolio installed."
echo "  Your PWA stays on the home screen and keeps receiving notifications."
echo "  This app starts with an empty container — restore your holdings from the"
echo "  encrypted cloud backup (vault) once, and it persists from then on."
