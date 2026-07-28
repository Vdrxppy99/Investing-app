#!/bin/bash
# The native app and the web app are ONE app on two platforms.
#
# The shell loads the live GitHub Pages build, so their CONTENT is identical by
# construction. This keeps the reported VERSION identical too, which it was not:
# the shell said 1.0 while the web said 4.3.1.
#
# Run before any native build. index.html is the single source of truth.
set -euo pipefail
cd "$(dirname "$0")/.."

WEB=$(grep -o 'appVer">v[0-9.]*' index.html | sed 's/.*v//')
[ -n "$WEB" ] || { echo "✗ could not read the version from index.html"; exit 1; }

SW=$(grep -o "pt-v[0-9.]*" sw.js | head -1 | sed 's/pt-v//')
if [ "$SW" != "$WEB" ]; then
  echo "✗ sw.js is pt-v$SW but index.html is v$WEB — bump them together"
  exit 1
fi

/usr/bin/sed -i '' "s/MARKETING_VERSION: \"[^\"]*\"/MARKETING_VERSION: \"$WEB\"/" native/project.yml
echo "✓ all three at v$WEB (index.html · sw.js · native shell)"
