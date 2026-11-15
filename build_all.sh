#!/usr/bin/env bash
# Sole release entry. See DOCS/BUILD-ALL-FLOW.md for the matching flow.
set -euo pipefail
cd "$(dirname "$0")"
WEB_ONLY=0
WEB_DOMAIN=""
while (($#)); do
  case "$1" in
    --web-only) [ "$WEB_ONLY" = 0 ] || { echo "Duplicate --web-only" >&2; exit 2; }; WEB_ONLY=1; shift ;;
    --web-domain) [ -z "$WEB_DOMAIN" ] && [ "$#" -ge 2 ] || { echo "--web-domain requires one domain" >&2; exit 2; }; WEB_DOMAIN="$2"; shift 2 ;;
    --help) [ "$#" = 1 ] && [ "$WEB_ONLY" = 0 ] && [ -z "$WEB_DOMAIN" ] || exit 2; echo "Usage: ./build_all.sh [--web-only --web-domain natally.robin.mba]"; exit 0 ;;
    *) echo "Unknown build argument: $1" >&2; exit 2 ;;
  esac
done
[ "$WEB_ONLY" = 0 ] || [ -n "$WEB_DOMAIN" ] || { echo "Web-only requires --web-domain" >&2; exit 2; }
WEB_DOMAIN="${WEB_DOMAIN:-natally.robin.mba}"
[ "$WEB_DOMAIN" = natally.robin.mba ] || { echo "Only natally.robin.mba is configured for this release" >&2; exit 2; }
IDENTITY_FILES=(version.txt version.json package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json)
[ ! -d src-tauri/gen/android ] || IDENTITY_FILES+=(src-tauri/gen/android/tauri.properties)
if [ "${NATALLY_BUILD_STAMPED:-0}" != 1 ]; then
  mkdir -p build
  exec 9>build/build-all.lock
  flock -n 9 || { echo "Another canonical build is running" >&2; exit 1; }
  git diff --quiet && git diff --cached --quiet || { echo "Commit tracked changes before building" >&2; exit 1; }
  if [ ! -f release.lock ]; then
    LAST_BUILD="$(cut -d. -f3 version.txt)"
    while [ "$(( $(date +%s) / 60 % 100000 ))" -eq "$((10#$LAST_BUILD))" ]; do
      echo "Waiting for the next epoch minute to assign a fresh BUILD"
      sleep "$((60 - $(date +%s) % 60))"
    done
  fi
  bash scripts/update-version.sh
  export BUILT_VERSION="$(<version.txt)"
  if [ "$WEB_ONLY" = 0 ]; then node scripts/build-native.mjs prepare; fi
  git add -- "${IDENTITY_FILES[@]}"
  if ! git diff --cached --quiet; then git commit -m "v${BUILT_VERSION}: Stamp shared release identity [skip ci]"; fi
  git push origin HEAD
  export NATALLY_BUILD_SOURCE_COMMIT="$(git rev-parse HEAD)"
  export NATALLY_BUILD_STAMPED=1 NATALLY_CANONICAL_BUILD=1
  BUILD_ARGS=(--web-domain "$WEB_DOMAIN")
  if [ "$WEB_ONLY" = 1 ]; then BUILD_ARGS+=(--web-only); fi
  # Parent retains fd9/lock until the entire environment child exits.
  node scripts/build-environment.mjs bash "$0" "${BUILD_ARGS[@]}"
  exit "$?"
fi
[ "${NATALLY_BUILD_ENV_RESOLVED:-0}" = 1 ] && [ -n "${BUILT_VERSION:-}" ] && [ -n "${NATALLY_BUILD_SOURCE_COMMIT:-}" ] || { echo "Incomplete internal build context" >&2; exit 1; }
assert_source() {
  [ "$(git rev-parse HEAD)" = "$NATALLY_BUILD_SOURCE_COMMIT" ] && git diff --quiet && git diff --cached --quiet || { echo "Source changed during release; this build is incomplete" >&2; exit 1; }
}
assert_source
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
npx --no-install vite build --outDir dist-web
# Stamp initial loading HTML as well as the mounted app/About surfaces.
node --input-type=module <<'JS'
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const version=process.env.BUILT_VERSION;
if (!/^[1-9]\d*\.\d+\.\d{5}$/.test(version)) throw new Error('Invalid visible release identity');
const label=`<span id="build-release-version" aria-label="Application version" style="position:fixed;right:12px;bottom:10px;z-index:2147483647;padding:3px 7px;border-radius:4px;background:#120c1ce6;color:#f4e7c8;font:12px system-ui;pointer-events:none">v${version}</span>`;
function stampHtml(dir) {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    const path=join(dir,entry.name);
    if(entry.isDirectory()) stampHtml(path);
    else if(entry.name.endsWith('.html')) {
      const html=readFileSync(path,'utf8');
      writeFileSync(path,html.replace(/<body([^>]*)>/i,`<body$1>${label}`));
    }
  }
}
stampHtml('dist-web');
JS
cp dist-web/app.html dist-web/index.html
RELEASE_DIR="dist/natally-v${BUILT_VERSION}"
mkdir -p "$RELEASE_DIR"
tar -czf "$RELEASE_DIR/natally-v${BUILT_VERSION}-web.tar.gz" -C dist-web .
node --input-type=module - "$RELEASE_DIR" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir=process.argv[2], version=process.env.BUILT_VERSION;
const path=`${dir}/natally-v${version}-web.tar.gz`, bytes=readFileSync(path);
writeFileSync(`${dir}/web-inventory.json`,JSON.stringify({version,sourceCommit:process.env.NATALLY_BUILD_SOURCE_COMMIT,publication:'pending',artifacts:[{kind:'web-archive',path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]},null,2)+'\n');
JS
assert_source
npx --yes surge@0.56.0 dist-web "$WEB_DOMAIN" --force https
node --input-type=module - "$RELEASE_DIR/web-inventory.json" "$WEB_DOMAIN" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.argv[2];let manifest;
try { manifest=JSON.parse(readFileSync(path,'utf8')); } catch(cause) { throw new Error('Invalid web inventory',{cause}); }
manifest.publication='published';manifest.domain=process.argv[3];manifest.publishedAt=new Date().toISOString();writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
JS
assert_source
if [ "$WEB_ONLY" = 0 ]; then node scripts/build-native.mjs; fi
assert_source
if [ -f release.lock ]; then echo "Built v${BUILT_VERSION}; frozen source identity retained"; exit 0; fi
NATALLY_STAMP_SOURCE_ONLY=1 bash scripts/update-version.sh
NEXT_VERSION="$(<version.txt)"
git add -- "${IDENTITY_FILES[@]}"
git commit -m "v${NEXT_VERSION}: Advance source after successful build of v${BUILT_VERSION} [skip ci]"
git push origin HEAD
echo "Built version: v${BUILT_VERSION}"
echo "Next source version: v${NEXT_VERSION} (not built)"
