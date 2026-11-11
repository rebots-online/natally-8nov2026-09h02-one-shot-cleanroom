import { useEffect, useState } from 'react';
import { subscribeVoiceStatus, type VoiceStatus } from '../services/supertonicTts';

export function VoiceDownloadStatus() {
  const [status, setStatus] = useState<VoiceStatus>({ phase: 'idle', message: '' });
  useEffect(() => subscribeVoiceStatus(setStatus), []);
  return <VoiceProgress status={status} />;
}

export function VoiceProgress({ status }: { status: VoiceStatus }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!['loading', 'preparing', 'synthesizing'].includes(status.phase)) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [status.phase]);
  if (!['loading', 'preparing', 'synthesizing', 'error'].includes(status.phase)) return null;
  if (!import.meta.env.DEV && status.phase === 'synthesizing') return null;
  const hasByteProgress = ['loading', 'preparing'].includes(status.phase) && !!status.totalBytes;
  const format = (bytes: number) => (bytes / 1000000).toFixed(1);
  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] bg-[#180f26]/95 border-t border-[#d4af37]/30 text-[#e6d8be] font-mono text-[10px]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between gap-3 px-3 py-1">
        {status.phase !== 'error' && <span key={status.confirmedAt} aria-hidden="true" className="voice-measurement-ack h-2 w-2 rounded-full bg-[#d4af37] shrink-0" />}
        <span role="status">{import.meta.env.DEV || status.phase === 'error' ? status.message : hasByteProgress ? 'Downloading Natally’s voice for this device…' : 'Preparing Natally’s voice…'}</span>
        {hasByteProgress && <span className="shrink-0 tabular-nums">
          {format(status.loadedBytes || 0)} / {format(status.totalBytes!)} MB
        </span>}
      </div>
      {import.meta.env.DEV && status.phase !== 'error' && status.startedAt && <div className="px-3 pb-1 tabular-nums">
        {(Math.max(0, now - status.startedAt) / 1000).toFixed(1)}s elapsed · last work measurement {(Math.max(0, now - (status.confirmedAt || status.startedAt)) / 1000).toFixed(1)}s ago
        {status.heartbeatAt && <> · <span key={status.heartbeatAt} className="voice-measurement-ack inline-block">worker responded</span> {(Math.max(0, now - status.heartbeatAt) / 1000).toFixed(1)}s ago</>}
      </div>}
      {import.meta.env.DEV && (status.files || status.graphs) && <details className="px-3 pb-1 max-h-[40vh] overflow-auto">
        <summary className="cursor-pointer">Actual files and ONNX graphs{status.file ? ` · ${status.file}` : ''}</summary>
        {status.files?.map(file => <div key={file.file} className="py-1">
          <div className="flex justify-between gap-2"><span>{file.file} · {file.source === 'cache' ? 'saved cache' : file.source === 'network' ? 'network response' : 'source not yet measured'}</span><span>{format(file.loadedBytes)} / {format(file.totalBytes)} MB</span></div>
          <progress aria-label={file.file + ' bytes read'} max={file.totalBytes} value={file.loadedBytes} className="block w-full h-1 accent-[#d4af37]" />
        </div>)}
        {status.graphs?.map(graph => <div key={graph.operation + graph.file + graph.backend} className="py-1">
          <span>{graph.file} · {graph.backend} · {graph.operation === 'session' ? 'initialization' : 'execution'} · {graph.completed}{graph.expected ? '/' + graph.expected : ''} completed{graph.state === 'start' ? ' · waiting for runtime completion' : graph.state === 'error' ? ' · failed' : ''}{graph.durationMs !== undefined ? ` · last operation ${(graph.durationMs / 1000).toFixed(3)}s` : ''}</span>
          {graph.expected && <progress aria-label={graph.file + ' ' + graph.operation + ' completions'} max={graph.expected} value={graph.completed} className="block w-full h-1 accent-[#d4af37]" />}
        </div>)}
      </details>}
      {['loading', 'preparing'].includes(status.phase) && <progress aria-label={hasByteProgress ? 'Voice model bytes loaded' : 'Preparing local voice runtime'}
        max={hasByteProgress ? status.totalBytes : undefined}
        value={hasByteProgress ? status.loadedBytes || 0 : undefined}
        className="block w-full h-[2px] accent-[#d4af37]" />}
    </div>
  );
}
