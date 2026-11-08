// Landing entry. Runs standalone when landing.html loads this module
// directly, and stays importable by the app shell's router: the component is
// the default export, and the mount is guarded on a #root being present.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './Landing';
import './landing.css';

export default Landing;

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
}
