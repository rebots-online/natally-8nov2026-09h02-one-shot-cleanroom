// All public application entries share the frozen live-atelier composition.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { scheduleSupertonicPreload } from './atelier-original/services/supertonicTts';
import { registerServiceWorker } from './platform/pwa';
import { displayVersion } from './platform/version';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Natally entry: #root element not found.');
document.querySelector('meta[name="natally-version"]')?.setAttribute('content', `v${displayVersion}`);
scheduleSupertonicPreload();

function reportLoadFailure(surface: string, error: unknown): void {
  console.error(`Natally entry: failed to load ${surface}.`, error);
}

void import('./app/AppShell')
  .then(({ default: AppShell }) => {
    createRoot(rootElement).render(<StrictMode><AppShell /></StrictMode>);
  })
  .catch(error => { reportLoadFailure('the app shell', error); });

void registerServiceWorker();
