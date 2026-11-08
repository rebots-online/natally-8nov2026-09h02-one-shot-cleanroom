// Truthful PWA registration: /sw.js is registered only when the origin
// actually serves it. This repo deliberately ships no sw.js — shipping one
// is a later operator decision — so on current deploys this resolves false
// and installs nothing, rather than registering a worker that does not exist.

/**
 * Registers the service worker at /sw.js if, and only if, the file is
 * actually served. Resolves true when a worker was registered; false when
 * /sw.js is missing (HEAD fails), the browser lacks service-worker support,
 * or the browser rejects the registration.
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const probe = await fetch('/sw.js', { method: 'HEAD' });
    if (!probe.ok) return false;
    await navigator.serviceWorker.register('/sw.js');
    return true;
  } catch {
    // Unreachable origin, wrong MIME type, insecure context — no worker was
    // installed, so report that truthfully instead of throwing.
    return false;
  }
}
