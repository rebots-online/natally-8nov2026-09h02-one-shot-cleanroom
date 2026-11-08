// Build-time version stamp, inlined from the frozen version.json contract.
// The JSON is imported with Vite's ?raw suffix so its bytes are baked into
// the bundle at build time (build_all.sh stamps `builtAt` per release); no
// runtime fetch and no vite `define` replacement is needed.

import versionJson from '../../version.json?raw';

const stamp: { version: string; builtAt: string | null } = JSON.parse(versionJson);

/** SemVer of the running build, mirrored from version.json. */
export const version: string = stamp.version;

/** ISO build timestamp; null until a release build stamps it. */
export const builtAt: string | null = stamp.builtAt ?? null;

