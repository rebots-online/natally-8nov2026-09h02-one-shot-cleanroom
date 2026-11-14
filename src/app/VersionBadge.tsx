// Subtle version stamp, bottom-right on every surface — mirrors the
// original's build-stamp presence (operator directive 2026-11-08). Reads
// the frozen version.json contract through src/platform/version (W13).

import { displayVersion } from '../platform/version';

export default function VersionBadge() {
  return (
    <p className="version-badge" aria-hidden="true">
      v{displayVersion}
    </p>
  );
}
