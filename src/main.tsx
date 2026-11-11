// Entry dispatcher for app.html. The same bundle may also be loaded on a
// landing document (any pathname containing "landing"); there the landing
// entry module is dynamically imported instead — it default-exports the
// landing root and self-mounts into #root, so importing it is the render.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VoiceDownloadStatus } from './app/VoiceDownloadStatus';
import { scheduleSupertonicPreload } from './atelier-original/services/supertonicTts';
import { registerServiceWorker } from './platform/pwa';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Natally entry: #root element not found.');

// §8.1 items 1–2: the voice download-status bar is mounted once for every
// page (app and landing documents alike). It lives in its own host beside
// #root with its own root — the landing branch below hands #root to a
// self-mounting entry, so the bar must not compete for it. Preload starts
// on every page load: idle-scheduled and Save-Data-respecting inside the
// scheduler, so the model is on its way before the first click.
const voiceStatusHost = document.createElement('div');
document.body.appendChild(voiceStatusHost);
createRoot(voiceStatusHost).render(
  <StrictMode>
    <VoiceDownloadStatus />
  </StrictMode>,
);
scheduleSupertonicPreload();

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
