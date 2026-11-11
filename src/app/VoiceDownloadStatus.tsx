// Voice download status bar (ARCHITECTURE §8.1 item 1) — port of the
// original VoiceDownloadStatus/VoiceProgress (reference:
// LIBS/reference/VoiceDownloadStatus.natally-ai-studio.tsx, from
// rebots-online/natally-ai-studio), restyled with plain CSS in the app
// palette (mirrors src/shared/tokens.css; vars carry literal fallbacks so
// the bar is in-palette even where the tokens sheet is not loaded). Local
// addition over the original: the download percentage beside "x / y MB"
// (§8.1) and a Retry control on the error phase ("errors shown and
// retryable", §8.1). Styles are injected by the component itself — this
// file owns no stylesheet import.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  initSupertonic,
  subscribeVoiceStatus,
  type VoiceStatus,
} from '../atelier-original/services/supertonicTts';

// Plain CSS, no Tailwind. Palette: deep plum wash, brass accent, parchment
// text (src/shared/tokens.css). Class prefix nv- is private to this file.
const VOICE_STATUS_CSS = `
.nv-bar {
  position: fixed;
  bottom: calc(12px + env(safe-area-inset-bottom));
  right: 12px;
  width: min(360px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  box-sizing: border-box;
  overflow: auto;
  z-index: 100;
  background: var(--plum-deep, #1c1122);
  background: color-mix(in srgb, var(--plum-deep, #1c1122) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--brass, #c9a45c) 30%, transparent);
  border-radius: 12px;
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  color: var(--parchment, #f3ead8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 10px;
  line-height: 1.6;
  pointer-events: none;
}
.nv-bar button,
.nv-bar summary,
.nv-bar details[open] {
  pointer-events: auto;
}
.nv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 4px;
}
.nv-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brass, #c9a45c);
  flex: 0 0 auto;
  animation: nv-ack 1.2s ease-out;
}
.nv-text {
  flex: 1 1 auto;
  min-width: 0;
}
.nv-nums {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.nv-pct {
  color: var(--brass-bright, #d9b878);
}
.nv-retry {
  flex: 0 0 auto;
  font: inherit;
  font-size: 10px;
  color: var(--brass-bright, #d9b878);
  background: transparent;
  border: 1px solid var(--brass-dim, #6f5a35);
  border-radius: 999px;
  padding: 1px 10px;
  cursor: pointer;
}
.nv-retry:hover {
  border-color: var(--brass, #c9a45c);
  color: var(--parchment, #f3ead8);
}
.nv-dev {
  padding: 0 12px 2px;
  font-variant-numeric: tabular-nums;
}
.nv-files {
  padding: 0 12px 4px;
  max-height: min(180px, 30vh);
  overflow: auto;
}
.nv-files summary {
  cursor: pointer;
}
.nv-file-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}
.nv-progress {
  display: block;
  width: 100%;
  height: 2px;
  margin: 0;
  border: 0;
  accent-color: var(--brass, #c9a45c);
}
.nv-progress-file {
  display: block;
  width: 100%;
  height: 4px;
  margin: 0;
  border: 0;
  accent-color: var(--brass, #c9a45c);
}
@keyframes nv-ack {
  from {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--brass, #c9a45c) 80%, transparent);
  }
  to {
    box-shadow: 0 0 0 6px transparent;
  }
}
`;

function formatMb(bytes: number): string {
  return (bytes / 1000000).toFixed(1);
}

export function VoiceDownloadStatus() {
  const [status, setStatus] = useState<VoiceStatus>({ phase: 'idle', message: '' });
  useEffect(() => subscribeVoiceStatus(setStatus), []);
  return (
    <>
      <style>{VOICE_STATUS_CSS}</style>
      <VoiceProgress status={status} />
    </>
  );
}

export function VoiceProgress({ status }: { status: VoiceStatus }) {
  const [now, setNow] = useState(Date.now());
  const [retrying, setRetrying] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (overlay === null) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const width = overlay.offsetWidth;
      const height = overlay.offsetHeight;
      const maxX = Math.max(12, window.innerWidth - width - 12);
      const maxY = Math.max(12, window.innerHeight - height - 12);
      const occupied = Array.from(document.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, summary, .app-header, .karaoke-caption, .chart-inset[data-chart-inset="true"], .chart-inset__resizer',
      )).filter(element => !overlay.contains(element)).map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight);
      const ys = [maxY, 12, ...occupied.flatMap(rect => [rect.top - height - 8, rect.bottom + 8])];
      let best = { x: maxX, y: maxY, overlap: Number.POSITIVE_INFINITY, distance: Number.POSITIVE_INFINITY };
      for (const rawY of ys) {
        const y = Math.max(12, Math.min(rawY, maxY));
        for (const x of [maxX, 12]) {
          const overlap = occupied.reduce((sum, rect) => sum + Math.max(0, Math.min(x + width, rect.right + 4) - Math.max(x, rect.left - 4))
            * Math.max(0, Math.min(y + height, rect.bottom + 4) - Math.max(y, rect.top - 4)), 0);
          const distance = Math.abs(maxX - x) + Math.abs(maxY - y);
          if (overlap < best.overlap || (overlap === best.overlap && distance < best.distance)) best = { x, y, overlap, distance };
        }
      }
      Object.assign(overlay.style, { left: `${best.x}px`, top: `${best.y}px`, right: 'auto', bottom: 'auto' });
    };
    const schedule = () => { if (frame === 0) frame = window.requestAnimationFrame(place); };
    const resize = new ResizeObserver(schedule);
    resize.observe(overlay);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    place();
    return () => {
      resize.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [status.phase]);
  useEffect(() => {
    if (!['loading', 'preparing', 'synthesizing'].includes(status.phase)) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [status.phase]);
  useEffect(() => {
    if (status.phase !== 'error') setRetrying(false);
  }, [status.phase]);
  if (!['loading', 'preparing', 'synthesizing', 'error'].includes(status.phase)) return null;
  const hasByteProgress = ['loading', 'preparing'].includes(status.phase) && !!status.totalBytes;
  const percent =
    hasByteProgress && status.totalBytes
      ? Math.min(100, Math.floor(((status.loadedBytes || 0) / status.totalBytes) * 100))
      : null;
  const message =
    status.phase === 'error'
      ? status.message
      : status.phase === 'synthesizing'
        ? 'Preparing speech…'
        : status.phase === 'preparing'
          ? 'Preparing Natally’s voice…'
          : hasByteProgress
            ? 'Downloading Natally’s voice…'
            : 'Preparing Natally’s voice…';
  const retry = () => {
    setRetrying(true);
    void initSupertonic()
      .catch(() => {})
      .finally(() => setRetrying(false));
  };
  return (
    <div className="nv-bar" ref={overlayRef}>
      <div className="nv-row">
        {status.phase !== 'error' && (
          <span key={status.confirmedAt} aria-hidden="true" className="nv-dot" />
        )}
        <span className="nv-text" role="status">
          {message}
        </span>
        {hasByteProgress && (
          <span className="nv-nums">
            {formatMb(status.loadedBytes || 0)} / {formatMb(status.totalBytes!)} MB{' '}
            <span className="nv-pct">· {percent}%</span>
          </span>
        )}
        {status.phase === 'error' && (
          <button type="button" className="nv-retry" onClick={retry} disabled={retrying}>
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>
      {import.meta.env.DEV && (status.startedAt || status.files || status.graphs) && (
        <details className="nv-files">
          <summary>Voice details</summary>
          <p>{status.message}</p>
          {status.phase !== 'error' && status.startedAt && (
            <div className="nv-dev">
              {(Math.max(0, now - status.startedAt) / 1000).toFixed(1)}s elapsed · last work
              measurement {(Math.max(0, now - (status.confirmedAt || status.startedAt)) / 1000).toFixed(1)}s
              ago
              {status.heartbeatAt && (
                <>
                  {' '}
                  · <span key={status.heartbeatAt}>worker responded</span>{' '}
                  {(Math.max(0, now - status.heartbeatAt) / 1000).toFixed(1)}s ago
                </>
              )}
            </div>
          )}
          {status.files?.map((file) => (
            <div key={file.file} style={{ padding: '2px 0' }}>
              <div className="nv-file-row">
                <span>
                  {file.file} ·{' '}
                  {file.source === 'cache'
                    ? 'saved cache'
                    : file.source === 'network'
                      ? 'network response'
                      : 'source not yet measured'}
                </span>
                <span className="nv-nums">
                  {formatMb(file.loadedBytes)} / {formatMb(file.totalBytes)} MB
                </span>
              </div>
              <progress
                aria-label={file.file + ' bytes read'}
                max={file.totalBytes}
                value={file.loadedBytes}
                className="nv-progress-file"
              />
            </div>
          ))}
          {status.graphs?.map((graph) => (
            <div key={graph.operation + graph.file + graph.backend} style={{ padding: '2px 0' }}>
              <span>
                {graph.file} · {graph.backend} ·{' '}
                {graph.operation === 'session' ? 'initialization' : 'execution'} · {graph.completed}
                {graph.expected ? '/' + graph.expected : ''} completed
                {graph.state === 'start'
                  ? ' · waiting for runtime completion'
                  : graph.state === 'error'
                    ? ' · failed'
                    : ''}
                {graph.durationMs !== undefined
                  ? ` · last operation ${(graph.durationMs / 1000).toFixed(3)}s`
                  : ''}
              </span>
              {graph.expected && (
                <progress
                  aria-label={graph.file + ' ' + graph.operation + ' completions'}
                  max={graph.expected}
                  value={graph.completed}
                  className="nv-progress-file"
                />
              )}
            </div>
          ))}
        </details>
      )}
      {['loading', 'preparing'].includes(status.phase) && (
        <progress
          aria-label={hasByteProgress ? 'Voice model bytes loaded' : 'Preparing local voice runtime'}
          max={hasByteProgress ? status.totalBytes : undefined}
          value={hasByteProgress ? status.loadedBytes || 0 : undefined}
          className="nv-progress"
        />
      )}
    </div>
  );
}
