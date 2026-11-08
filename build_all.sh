#!/usr/bin/env bash
# Canonical full-matrix entry: web build/deploy first, then native packages.
set -euo pipefail
cd "$(dirname "$0")"
if [ "${NATALLY_BUILD_ENV_RESOLVED:-0}" != 1 ]; then
  exec node scripts/build-environment.mjs bash "$0" "$@"
fi
mkdir -p build
exec 9>build/build-all.lock
flock -n 9 || { echo "Another canonical build is running." >&2; exit 1; }
export NATALLY_CANONICAL_BUILD=1
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

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
node scripts/build-native.mjs prepare
git add version.json version.txt package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -qm "Stamp shared web, desktop and Android release identity" || true
git push origin HEAD
npm run lint
npx vite build --outDir dist-web
cp dist-web/landing.html dist-web/index.html
echo "Web build complete → dist-web/"
# Both dated hosts receive this exact frontend before any native compiler starts.
npx surge dist-web natally-8nov2026.robin.mba
npx surge dist-web natally-8nov2026.surge.sh
exec node scripts/build-native.mjs
