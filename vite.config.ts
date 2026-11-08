import { execFileSync } from 'node:child_process';
import { readFileSync, unwatchFile, watchFile } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Every change must be visibly distinguishable (operator rule 2026-11-08):
// the badge shows the stamped version plus the commit it was built from,
// and in dev also flags uncommitted edits. The identity is recomputed
// whenever HEAD moves (a commit) or a source file changes, and pushed to
// open pages through HMR, so the badge never shows a stale identity.
const VIRTUAL = 'virtual:natally-identity';
const RESOLVED = '\0' + VIRTUAL;

function git(...args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function identity() {
  const { version } = JSON.parse(readFileSync('version.json', 'utf8')) as { version: string };
  const commit = git('rev-parse', '--short', 'HEAD') || 'uncommitted';
  const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
  return { version, commit, dirty, label: `v${version} · ${commit}${dirty ? '+edits' : ''}` };
}

function buildIdentity(): Plugin {
  return {
    name: 'natally-build-identity',
    resolveId: id => (id === VIRTUAL ? RESOLVED : undefined),
    load: id => (id === RESOLVED ? `export default ${JSON.stringify(identity())};` : undefined),
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const mod = server.moduleGraph.getModuleById(RESOLVED);
          if (mod) void server.reloadModule(mod);
        }, 150);
      };
      // Vite never watches .git; poll HEAD's reflog so commits show up.
      watchFile('.git/logs/HEAD', { interval: 500 }, refresh);
      server.httpServer?.once('close', () => unwatchFile('.git/logs/HEAD'));
      server.watcher.on('change', refresh);
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  plugins: [react(), buildIdentity()],
  build: {
    rollupOptions: {
      input: { landing: 'landing.html', app: 'app.html' },
      output: { manualChunks: id => id.includes('three') ? 'three' : id.includes('firebase') ? 'firebase' : undefined },
    },
  },
});
