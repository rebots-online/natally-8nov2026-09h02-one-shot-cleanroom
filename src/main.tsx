// Entry dispatcher for app.html. This bundle may also be loaded on a
// landing document (any pathname containing "landing"); there the landing
// root is dynamically imported and rendered instead of the app shell.

import { createRoot } from 'react-dom/client';
import App from './app/AppShell';
import { registerServiceWorker } from './platform/pwa';

function rootContainer(): HTMLElement {
  const el = document.getElementById('root');
  if (!el) throw new Error('Natally entry: #root element not found.');
  return el;
}

const rootElement = rootContainer();
/**
 * Renders the landing page by dynamically importing src/landing/main.tsx.
 * Dynamic import is required: a static one would merge the landing tree into
 * the app entry chunk, and this path only runs on landing documents — a
 * runtime-selected module, not a build-time dependency of the app shell.
 * The landing entry is the frozen sibling contract: it default-exports the
 * root and self-mounts into #root when present, so loading the module is
 * the render; rendering again here would double-mount the container.
 */
export async function renderLanding(): Promise<void> {
  await import('./landing/main');
}

if (location.pathname.includes('landing')) {
  void renderLanding();
} else {
  createRoot(rootElement).render(<App />);
}

// Opportunistic, non-blocking: a no-op (false) wherever no /sw.js is served.
void registerServiceWorker();
