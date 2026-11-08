// Landing entry: renders the VERBATIM original marketing implementation
// (src/landing-original/marketing.tsx, operator-authorized port of the
// deployed original v1.42). The module self-mounts into
// #marketing-experience-root (provided by landing.html together with the
// site header and #marketing-account-root) and redirects app-entry query
// params to /app.html, so this entry only loads the port.
//
// The port's own badge code fills [data-natally-version-badge] from a
// meta[name="natally-version"]; this build's identity (stamped version +
// commit, "+edits" for uncommitted dev work) comes from the live identity
// module, so the meta is planted here before the port loads.

import { versionLabel } from '../platform/version';

export { };

let meta = document.querySelector<HTMLMetaElement>('meta[name="natally-version"]');
if (!meta) {
  meta = document.createElement('meta');
  meta.name = 'natally-version';
  document.head.appendChild(meta);
}
meta.content = versionLabel;
const badge = document.querySelector<HTMLElement>('[data-natally-version-badge]');
if (badge) {
  badge.textContent = versionLabel;
  badge.hidden = false;
}

void import('../landing-original/marketing');
