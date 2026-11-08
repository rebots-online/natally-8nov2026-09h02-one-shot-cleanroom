// Entry dispatcher for app.html. The same bundle may also be loaded on a
// landing document (any pathname containing "landing"); there the landing
// entry module is dynamically imported instead — it default-exports the
// landing root and self-mounts into #root, so importing it is the render.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerServiceWorker } from './platform/pwa';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Natally entry: #root element not found.');

function reportLoadFailure(surface: string, error: unknown): void {
  console.error(`Natally entry: failed to load ${surface}.`, error);
}

if (location.pathname.includes('landing')) {
  // Dynamic import keeps the landing tree out of the app entry chunk;
  // rendering the landing again here would double-mount #root.
  void import('./landing/main').catch(error => {
    reportLoadFailure('the landing', error);
  });
} else {
  // The app shell contract is still landing; a dynamic import keeps this
  // entry independent of it and code-splits the shell out of the entry
  // chunk. The shell default-exports the app root.
  void import('./app/AppShell')
    .then(({ default: AppShell }) => {
      createRoot(rootElement).render(
        <StrictMode>
          <AppShell />
        </StrictMode>,
      );
    })
    .catch(error => {
      reportLoadFailure('the app shell', error);
    });
}

// Opportunistic, non-blocking: a no-op (false) wherever no /sw.js is served.
void registerServiceWorker();
