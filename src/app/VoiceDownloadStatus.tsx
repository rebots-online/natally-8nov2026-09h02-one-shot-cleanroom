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

import { useEffect, useState } from 'react';
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
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--plum-deep, #1c1122);
  background: color-mix(in srgb, var(--plum-deep, #1c1122) 95%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--brass, #c9a45c) 30%, transparent);
  color: var(--parchment, #f3ead8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 10px;
  line-height: 1.6;
  padding-bottom: env(safe-area-inset-bottom);
}
.nv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 12px 2px;
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
  max-height: 40vh;
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
  useEffect(() => {
    if (!['loading', 'preparing', 'synthesizing'].includes(status.phase)) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [status.phase]);
  useEffect(() => {
    if (status.phase !== 'error') setRetrying(false);
  }, [status.phase]);
  if (!['loading', 'preparing', 'synthesizing', 'error'].includes(status.phase)) return null;
  if (!import.meta.env.DEV && status.phase === 'synthesizing') return null;
  const hasByteProgress = ['loading', 'preparing'].includes(status.phase) && !!status.totalBytes;
  const percent =
    hasByteProgress && status.totalBytes
      ? Math.min(100, Math.floor(((status.loadedBytes || 0) / status.totalBytes) * 100))
      : null;
  const message =
    import.meta.env.DEV || status.phase === 'error'
      ? status.message
      : hasByteProgress
        ? 'Downloading Natally’s voice for this device…'
        : 'Preparing Natally’s voice…';
  const retry = () => {
    setRetrying(true);
    void initSupertonic()
      .catch(() => {})
      .finally(() => setRetrying(false));
  };
  return (
    <div className="nv-bar">
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
      {import.meta.env.DEV && status.phase !== 'error' && status.startedAt && (
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
      {import.meta.env.DEV && (status.files || status.graphs) && (
        <details className="nv-files">
          <summary>
            Actual files and ONNX graphs{status.file ? ` · ${status.file}` : ''}
          </summary>
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
