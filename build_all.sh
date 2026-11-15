#!/usr/bin/env bash
# Canonical entry: validate arguments, stamp once, publish web, package native.
set -euo pipefail
cd "$(dirname "$0")"
WEB_ONLY=0
WEB_DOMAIN=""
while (($#)); do
  case "$1" in
    --web-only)
      [ "$WEB_ONLY" = 0 ] || { echo "Duplicate --web-only." >&2; exit 2; }
      WEB_ONLY=1; shift ;;
    --web-domain)
      [ -z "$WEB_DOMAIN" ] && [ "$#" -ge 2 ] || { echo "--web-domain requires one domain." >&2; exit 2; }
      WEB_DOMAIN="$2"; shift 2 ;;
    --help)
      [ "$#" = 1 ] && [ "$WEB_ONLY" = 0 ] && [ -z "$WEB_DOMAIN" ] || { echo "Use --help by itself." >&2; exit 2; }
      echo "Usage: ./build_all.sh [--web-only --web-domain natally.robin.mba]"
      echo "Default: publish natally.robin.mba, then package all native targets."
      exit 0 ;;
    *) echo "Unknown build argument: $1" >&2; exit 2 ;;
  esac
done
if [ "$WEB_ONLY" = 1 ] && [ -z "$WEB_DOMAIN" ]; then
  echo "--web-only requires --web-domain natally.robin.mba." >&2; exit 2
fi
if [ -n "$WEB_DOMAIN" ] && [ "$WEB_DOMAIN" != natally.robin.mba ]; then
  echo "The release destination is natally.robin.mba only." >&2; exit 2
fi
WEB_DOMAIN="${WEB_DOMAIN:-natally.robin.mba}"
if [ "${NATALLY_BUILD_ENV_RESOLVED:-0}" != 1 ]; then
  BUILD_ARGS=()
  if [ "$WEB_ONLY" = 1 ]; then BUILD_ARGS+=(--web-only); fi
  BUILD_ARGS+=(--web-domain "$WEB_DOMAIN")
  exec node scripts/build-environment.mjs bash "$0" "${BUILD_ARGS[@]}"
fi
mkdir -p build
exec 9>build/build-all.lock
flock -n 9 || { echo "Another canonical build is running." >&2; exit 1; }
export NATALLY_CANONICAL_BUILD=1
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
IDENTITY_FILES=(version.txt version.json package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json)
if [ -d src-tauri/gen/android ]; then IDENTITY_FILES+=(src-tauri/gen/android/tauri.properties); fi
# Never accidentally include someone else's staged source in an automatic commit.
if ! git diff --cached --quiet; then
  echo "Commit or unstage existing staged changes before the canonical build." >&2
  exit 1
fi
bash scripts/update-version.sh
BUILT_VERSION="$(<version.txt)"
if [ "$WEB_ONLY" = 0 ]; then node scripts/build-native.mjs prepare; fi
git add -- "${IDENTITY_FILES[@]}"
if ! git diff --cached --quiet; then
  git commit -m "v${BUILT_VERSION}: Stamp shared release identity [skip ci]"
fi
git push origin HEAD
npx --no-install vite build --outDir dist-web
cp dist-web/app.html dist-web/index.html
echo "Web build complete → dist-web/ (v${BUILT_VERSION})"
npx --yes surge@0.56.0 dist-web "$WEB_DOMAIN" --force https
if [ "$WEB_ONLY" = 0 ]; then node scripts/build-native.mjs; fi
# Frozen multi-host releases reuse their fixed identity without advancing source.
if [ -f release.lock ]; then
  echo "Built version: v${BUILT_VERSION} (frozen release.lock; source not advanced)"
  exit 0
fi
NATALLY_STAMP_SOURCE_ONLY=1 bash scripts/update-version.sh
NEXT_VERSION="$(<version.txt)"
git add -- "${IDENTITY_FILES[@]}"
git commit -m "v${NEXT_VERSION}: Advance source after successful build of v${BUILT_VERSION} [skip ci]"
git push origin HEAD
echo "Built version: v${BUILT_VERSION}"
echo "Next source version: v${NEXT_VERSION} (not built)"
