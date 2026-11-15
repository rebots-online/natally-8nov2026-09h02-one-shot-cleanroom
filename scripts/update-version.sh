#!/usr/bin/env bash
# =============================================================================
# ~/Admin-Manual/versioning/update-version.sh — THE canonical version stamper
#
# Lineage: Kintsugi-Unbroken tauri2/scripts/update-version.sh (the WORKING
# variant — the root-level Kintsugi script and every read-only re-invention
# are dead ends). Copy this file into <project>/scripts/, fill in the three
# PRODUCT_* variables, wire it into the build (`prebuild` npm hook / gradle /
# make). DO NOT re-derive this logic per project.
#
# THE ONE INVARIANT RE-INVENTIONS KEEP LOSING:
#   >>> The bump lives INSIDE the stamper. <<<
#   A stamper that only READS a version file produces v1.0.x forever.
#
# Scheme (BUILD_CONVENTIONS):
#   MAJOR = manual milestone (edit version.txt by hand, once per milestone)
#   MINOR = auto-bumped UNCONDITIONALLY on every invocation (the heartbeat;
#           resets to 0 when MAJOR changes)
#   BUILD = epoch-minutes % 100000, 5-digit zero-padded (display only)
#
#   versionName = MAJOR.MINOR.BUILD      e.g. 1.28.06942
#   versionCode = MAJOR*100000 + MINOR   (BUILD excluded — Play needs monotonic)
#
# Canonical file: version.txt (single line). Runtime mirror: version.json.
# release.lock (sourced shell: MAJOR= MINOR= BUILD_NUM=) freezes values so
# multi-artifact releases stamp identical strings; delete to resume bumping.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ── Fill these in per project (identifier: no underscores, no hyphens — must ──
# ── equal tauri.conf.json "identifier" / applicationId EXACTLY) ──────────────
PRODUCT_NAME="Natally"
INTERNAL_NAME="natally-ai-studio"
PACKAGE_NAME="mba.robin.astronatally"

LOCK_FILE="$PROJECT_ROOT/release.lock"
if [ -f "$LOCK_FILE" ]; then
  echo "[update-version] Using frozen release.lock values"
  # shellcheck source=/dev/null
  source "$LOCK_FILE" # sets MAJOR, MINOR, BUILD_NUM
else
  CURRENT_VERSION=$(tr -d '\r\n' < version.txt)
  if [[ ! "$CURRENT_VERSION" =~ ^([1-9][0-9]*)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Invalid canonical version.txt; refusing to reset the release identity." >&2
    exit 1
  fi
  if (( ${#BASH_REMATCH[1]} > 5 || ${#BASH_REMATCH[2]} > 5 || ${#BASH_REMATCH[3]} > 5 )); then
    echo "Canonical version components exceed the supported range." >&2
    exit 1
  fi
  CURRENT_MAJOR=$((10#${BASH_REMATCH[1]}))
  CURRENT_MINOR=$((10#${BASH_REMATCH[2]}))
  MAJOR="$CURRENT_MAJOR"                       # manual milestone lives in version.txt
  MINOR=$((CURRENT_MINOR + 1))                 # THE heartbeat — never remove
  BUILD_NUM=$(( $(date +%s) / 60 % 100000 ))
fi

# A frozen release is still validated before any identity file is changed.
for COMPONENT in MAJOR MINOR BUILD_NUM; do
  VALUE="${!COMPONENT:-}"
  if [[ ! "$VALUE" =~ ^[0-9]+$ ]] || (( ${#VALUE} > 6 )); then
    echo "Invalid release component: $COMPONENT" >&2
    exit 1
  fi
done
MAJOR=$((10#$MAJOR))
MINOR=$((10#$MINOR))
BUILD_NUM=$((10#$BUILD_NUM))
if (( MAJOR < 1 || MINOR >= 100000 || BUILD_NUM >= 100000 || MAJOR * 100000 + MINOR >= 2100000000 )); then
  echo "Release identity exceeds the supported version range." >&2
  exit 1
fi

BUILD_PADDED="$(printf '%05d' "${BUILD_NUM}")"
DISPLAY_VERSION="${MAJOR}.${MINOR}.${BUILD_PADDED}"
VERSION_CODE=$(( MAJOR * 100000 + MINOR ))
NUMERIC_VERSION="${MAJOR}.${MINOR}.${BUILD_NUM}"
BUILD_DATE="$(date -Iseconds)"
BUILT_AT="\"${BUILD_DATE}\""
if [ "${NATALLY_STAMP_SOURCE_ONLY:-0}" = 1 ]; then BUILT_AT=null; fi
echo "Stamping version: ${DISPLAY_VERSION}  (versionCode: ${VERSION_CODE})"

# ── canonical + runtime mirror ────────────────────────────────────────────────
echo "${DISPLAY_VERSION}" > version.txt
cat > version.json << EOF
{
  "version": "${DISPLAY_VERSION}",
  "versionBase": "${MAJOR}.${MINOR}",
  "buildNumber": "${BUILD_PADDED}",
  "versionCode": ${VERSION_CODE},
  "buildDate": "${BUILD_DATE}",
  "builtAt": ${BUILT_AT},
  "productName": "${PRODUCT_NAME}",
  "internalName": "${INTERNAL_NAME}",
  "packageName": "${PACKAGE_NAME}"
}
EOF

# ── stamp whatever manifests the project has (each guarded, no failures) ─────
[ -f package.json ] && command -v jq >/dev/null && {
  jq --arg v "${NUMERIC_VERSION}" '.version = $v' package.json > package.json.tmp
  mv package.json.tmp package.json
}
[ -f src-tauri/tauri.conf.json ] && \
  sed -i 's/"version": "[^"]*"/"version": "'"${NUMERIC_VERSION}"'"/' src-tauri/tauri.conf.json
[ -f src-tauri/Cargo.toml ] && \
  sed -i '0,/^version *= *"[^"]*"/s//version = "'"${NUMERIC_VERSION}"'"/' src-tauri/Cargo.toml
[ -d src-tauri/gen/android ] && cat > src-tauri/gen/android/tauri.properties << EOF
tauri.android.versionCode=${VERSION_CODE}
tauri.android.versionName=${DISPLAY_VERSION}
EOF
# Natally's lockfiles and platform metadata project this same stamped identity.
# This is projection only: the sole increment and clock calculation remain above.
node --input-type=module - "$DISPLAY_VERSION" "$NUMERIC_VERSION" "$VERSION_CODE" <<'JS'
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const [displayVersion, numericVersion, versionCode] = process.argv.slice(2);
const [major, minor, build] = numericVersion.split('.').map(Number);
const msiVersion = `${major}.${minor}.${Math.floor(build / 1000)}.${build % 1000}`;
const read = file => {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (cause) { throw new Error(`Invalid identity JSON: ${file}`, { cause }); }
};
const write = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
if (existsSync('package.json')) {
  const pkg = read('package.json'); pkg.version = numericVersion; write('package.json', pkg);
}
if (existsSync('package-lock.json')) {
  const lock = read('package-lock.json'); lock.version = numericVersion;
  if (lock.packages?.['']) lock.packages[''].version = numericVersion;
  write('package-lock.json', lock);
}
if (existsSync('src-tauri/Cargo.lock')) {
  const file = 'src-tauri/Cargo.lock';
  writeFileSync(file, readFileSync(file, 'utf8').replace(/(name = "natally-ai-studio"\nversion = ")[^"]+/, `$1${numericVersion}`));
}
if (existsSync('src-tauri/tauri.conf.json')) {
  const file = 'src-tauri/tauri.conf.json', config = read(file);
  config.version = numericVersion;
  for (const window of config.app?.windows || []) window.title = `Natally v${displayVersion}`;
  config.bundle.android.versionCode = Number(versionCode);
  config.bundle.windows.wix.version = msiVersion;
  write(file, config);
}
JS
# Gradle-native projects: have build.gradle READ version.txt at configuration
# time (Groovy expression) instead of sed-stamping it.

export PROJECT_VERSION="${DISPLAY_VERSION}"
export PROJECT_VERSION_CODE="${VERSION_CODE}"
echo "Done: ${DISPLAY_VERSION} (versionCode ${VERSION_CODE})"
