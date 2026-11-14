// Legacy landing entry aliases the same canonical AppShell, retaining URL
// query/fragment handoffs and padded version metadata. Retired source stays preserved.
import { displayVersion } from '../platform/version';

export {};

const existingMeta = document.querySelector('meta[name="natally-version"]');
if (existingMeta) {
  existingMeta.setAttribute('content', `v${displayVersion}`);
} else {
  const meta = document.createElement('meta');
  meta.name = 'natally-version';
  meta.content = `v${displayVersion}`;
  document.head.appendChild(meta);
}

void import('../main');
