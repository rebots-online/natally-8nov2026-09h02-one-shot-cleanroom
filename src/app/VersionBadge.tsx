// Subtle version stamp, bottom-right on every surface — mirrors the
// original's build-stamp presence (operator directive 2026-11-08). Reads
// the live build identity (version + commit, "+edits" for uncommitted dev
// work) so every change is visibly a different build.

import { versionLabel } from '../platform/version';

export default function VersionBadge() {
  return (
    <p className="version-badge" aria-label="Build version">
      {versionLabel}
    </p>
  );
}
