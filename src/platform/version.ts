// Running build identity (vite.config.ts buildIdentity plugin): the stamped
// version from version.json plus the commit the code came from, so every
// change is visibly a different identity on every surface.

import identity from 'virtual:natally-identity';

/** MAJOR.MINOR.BUILD stamped by build_all.sh. */
export const version: string = identity.version;

/** Short commit hash of the running code. */
export const commit: string = identity.commit;

/** Badge text: version, commit, and "+edits" when serving uncommitted work. */
export const versionLabel: string = identity.label;
