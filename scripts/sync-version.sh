#!/bin/bash
# The native app and the web app are ONE app on two platforms.
#
# The shell loads the live GitHub Pages build, so their CONTENT is identical by
# construction. This keeps the reported VERSION identical too, which it was not:
# the shell said 1.0 while the web said 4.3.1.
#
# Version scheme is PROUD.NORMAL.SHAME, not semver — see sw.js's header comment
# and CHANGELOG.md. This script doesn't care what the numbers mean, only that
# all three surfaces agree; do not "fix" it back to a semver comment.
#
# Run before any native build. index.html is the single source of truth.
set -euo pipefail
cd "$(dirname "$0")/.."

WEB=$(grep -o 'appVer">v[0-9.]*' index.html | sed 's/.*v//')
[ -n "$WEB" ] || { echo "✗ could not read the version from index.html"; exit 1; }

SW=$(grep -o "pt-[0-9.]*" sw.js | head -1 | sed 's/pt-//')
if [ "$SW" != "$WEB" ]; then
  echo "✗ sw.js is pt-$SW but index.html is v$WEB — bump them together"
  exit 1
fi

/usr/bin/sed -i '' "s/MARKETING_VERSION: \"[^\"]*\"/MARKETING_VERSION: \"$WEB\"/" native/project.yml
echo "✓ all three at v$WEB (index.html · sw.js · native shell)"
