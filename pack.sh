#!/bin/sh
# Builds the Chrome Web Store upload: only the files the extension runs (no tests, docs or design notes).
set -e
cd "$(dirname "$0")"

FILES="manifest.json background.js content.js upwork.js panel.html panel.js views.js keywords.js gig.js jobs.js profile.js lib/jspdf.umd.min.js icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png"

for f in $FILES; do [ -f "$f" ] || { echo "missing: $f"; exit 1; }; done
node --check background.js && node --check content.js && node --check upwork.js && node --check panel.js && node --check views.js
node keywords.test.js > /dev/null

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/gig-spy-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -q -X "$OUT" $FILES
echo "Built $OUT ($(du -h "$OUT" | cut -f1)) with $(unzip -Z1 "$OUT" | wc -l | tr -d ' ') files"
