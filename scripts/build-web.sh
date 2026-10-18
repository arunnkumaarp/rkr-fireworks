#!/bin/sh
# Builds the public website (website/) and the app's web screens (app/, served under /shop) into dist/.
#   API_URL=https://api.example.com/api/v1 scripts/build-web.sh
set -e
cd "$(dirname "$0")/.."
API_URL="${API_URL:-http://localhost:8000/api/v1}"
rm -rf dist && mkdir -p dist
(cd website && API_URL="$API_URL" SHOP_URL=/shop node build.mjs)
cp -R website/index.html website/styles.css website/app.js website/base.css website/base.js website/favicon.png website/assets dist/
(cd app && EXPO_PUBLIC_API_URL="$API_URL" npx expo export --platform web --output-dir ../dist/shop >/dev/null)
echo "dist/ ready: website at /, app at /shop"
