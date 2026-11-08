#!/usr/bin/env bash
# Canonical build entry for the clean-room rewrite (web only).
set -euo pipefail
cd "$(dirname "$0")"

# Hands-off version stamp: bump MINOR on every invocation (CC2 doctrine) so
# every published artifact is identifiable across dev/staging/prod.
node -e "
const fs = require('fs');
let v = { version: '1.1.0', builtAt: null };
try { v = JSON.parse(fs.readFileSync('version.json','utf8')); } catch {}
let [maj, min] = (v.version || '1.1.0').split('.').map(Number);
maj = Math.max(1, maj || 1); min = (min || 0) + 1;
const build = Math.floor(Date.now() / 86400000) % 10000;
v.version = [maj, min, build].join('.');
v.builtAt = new Date().toISOString();
fs.writeFileSync('version.json', JSON.stringify(v, null, 2) + '\n');
fs.writeFileSync('version.txt', v.version + '\n');
console.log('stamp:', v.version);
"
git add version.json version.txt 2>/dev/null && git commit -qm "stamp v$(cat version.txt)" || true
npm run lint
npx vite build --outDir dist-web
cp dist-web/landing.html dist-web/index.html
echo "Web build complete → dist-web/"
