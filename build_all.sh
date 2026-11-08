#!/usr/bin/env bash
# Canonical build entry for the clean-room rewrite (web only).
set -euo pipefail
cd "$(dirname "$0")"

npm install --no-audit --no-fund
npm run lint
npx vite build --outDir dist-web
echo "Web build complete → dist-web/"
