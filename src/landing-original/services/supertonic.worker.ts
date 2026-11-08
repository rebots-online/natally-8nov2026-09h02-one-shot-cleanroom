import { env, pipeline } from '@huggingface/transformers';
import { SupertonicDownloadProgress, SUPERTONIC_MODEL_FILES } from './supertonicDownload';
import type { VoiceStatus, VoiceGraphProgress } from './supertonicTts';
import type { VoiceMeasurement } from './voiceMeasurements';
const MODEL_ID = 'onnx-community/Supertonic-TTS-ONNX';
const REVISION = 'cff123c84b0655d9d647641f1b532c3cbb8f7faa';
// Transformers.js 4.3.1 omits revision in pipeline/tokenizer metadata probes.
// Keep those probes on the same immutable URLs as the already saved model.
env.remotePathTemplate = '{model}/resolve/' + REVISION + '/';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm!.numThreads = 1;
let engine: Promise<any> | null = null;
let backend = 'wasm';
let queue = Promise.resolve();
const voices = new Map<string, Float32Array>();
const clips = new Map<string, { samples: Float32Array; sampleRate: number }>();
let clipBytes = 0;
let current: VoiceStatus = { phase: 'idle', message: '' };
let requestContext = { runId: '', workload: 'preload', memoryReuse: false, start: 0, speed: 1 };
const graphs = new Map<string, VoiceGraphProgress>();
function measure(event: Omit<VoiceMeasurement, 'runId' | 'atMs' | 'revision'>) {
  self.postMessage({ measurement: { ...event, runId: requestContext.runId, atMs: performance.now() - requestContext.start,
    revision: REVISION, workload: requestContext.workload, memoryReuse: requestContext.memoryReuse,
    ...(requestContext.workload === 'preload' ? {} : { speed: requestContext.speed, steps: 5 }) } });
}
function status(phase: VoiceStatus['phase'], message: string, extra: Partial<VoiceStatus> = {}) {
  current = { ...current, phase, message, ...extra };
  self.postMessage({ status: current });
}
(globalThis as any)[Symbol.for('natally.onnx.progress')] = (event: { operation: 'session' | 'run'; state: 'start' | 'complete' | 'error'; file?: string; backend?: string; durationMs?: number }) => {
  const file = event.file || 'ONNX helper graph';
  const key = event.operation + ':' + file + ':' + event.backend;
  const previous = graphs.get(key);
  const expected = event.operation === 'run' ? (file.includes('latent_denoiser') ? 5 : file.includes('text_encoder') || file.includes('voice_decoder') ? 1 : undefined) : 1;
  graphs.set(key, { ...event, file, backend: event.backend || backend, expected,
    completed: (previous?.completed || 0) + (event.state === 'complete' ? 1 : 0),
    startedAt: event.state === 'start' ? Date.now() : previous?.startedAt || Date.now() });
  measure({ ...event, file: event.file, backend: event.backend || backend });
  status(event.state === 'error' ? 'error' : event.operation === 'session' ? 'preparing' : 'synthesizing',
    `${event.operation === 'session' ? 'Initializing' : 'Executing'} ${file} · ${event.state === 'start' ? 'in progress' : event.state}`,
    { file, graphs: [...graphs.values()], startedAt: graphs.get(key)!.startedAt, confirmedAt: Date.now(), runtimeEvent: true });
};
async function loadEngine(forceWasm = false) {
  if (!engine) {
    const loadStart = performance.now();
    measure({ operation: 'load', state: 'start', backend });
    let loading = true;
    const download = new SupertonicDownloadProgress();
    const fileStarts = new Map<string, number>();
    let lastUpdate = 0;
    engine = (async () => {
      status('preparing', 'Checking saved voice model on this device…');
      const modelCache = typeof caches === 'undefined' ? null : await caches.open(env.cacheKey).catch(() => null);
      const savedModel = modelCache ? await Promise.all(Object.keys(SUPERTONIC_MODEL_FILES).map(file =>
        modelCache.match('https://huggingface.co/' + MODEL_ID + '/resolve/' + REVISION + '/' + file)
      )).then(files => files.every(response => response?.ok)).catch(() => false) : false;
      const loadingMessage = savedModel ? 'Loading saved voice model on this device…' : 'Loading voice model · cache or network';
      status('loading', loadingMessage, { ...download.update({}), files: download.files(), startedAt: Date.now(), confirmedAt: Date.now() });
      const progress_callback = (info: any) => {
        if (!loading || !['download', 'progress', 'done'].includes(info.status)) return;
        const bytes = download.update(info);
        if (info.status === 'download') {
          fileStarts.set(info.file, performance.now());
          measure({ operation: 'file', state: 'start', file: info.file, source: info.source || 'unknown', backend });
        }
        if (info.status === 'done') measure({ operation: 'file', state: 'complete', file: info.file,
          source: download.files().find(file => file.file === info.file)?.source || 'unknown', backend,
          durationMs: fileStarts.has(info.file) ? performance.now() - fileStarts.get(info.file)! : undefined,
          bytes: download.lastReadBytes(info.file) });
        const complete = bytes.loadedBytes === bytes.totalBytes;
        if (!complete && info.status === 'progress' && performance.now() - lastUpdate < 120) return;
        lastUpdate = performance.now();
        status(current.runtimeEvent ? current.phase : complete ? 'preparing' : 'loading', current.runtimeEvent ? current.message : complete ? 'Model files loaded · preparing local voice runtime…' : loadingMessage,
          { ...bytes, files: download.files(), file: current.runtimeEvent ? current.file : info.file, confirmedAt: Date.now() });
      };
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
      const adapter = forceWasm ? null : await gpu?.requestAdapter().catch(() => null);
      if (adapter) {
        backend = 'webgpu';
        try {
          const result = await pipeline('text-to-speech', MODEL_ID, { revision: REVISION, device: 'webgpu', dtype: 'fp32', progress_callback });
          backend = 'webgpu';
          return result;
        } catch { status('preparing', 'WebGPU unavailable · preparing local CPU/WASM voice…'); }
      }
      backend = 'wasm';
      return pipeline('text-to-speech', MODEL_ID, { revision: REVISION, device: 'wasm', dtype: 'fp32', progress_callback });
    })().then(result => {
      const sources = new Set(download.files().map(file => file.source));
      measure({ operation: 'load', state: 'complete', backend, durationMs: performance.now() - loadStart,
        source: sources.size === 1 ? download.files()[0].source : 'unknown' });
      return result;
    }).catch(error => { measure({ operation: 'load', state: 'error', backend, durationMs: performance.now() - loadStart }); engine = null; throw error; }).finally(() => { loading = false; });
  }
  return engine;
}
async function synthesize(data: { id: number; text: string; preload?: boolean; voice?: string; speed?: number; forceWasm?: boolean }) {
  let runtimeFailed = false;
  requestContext = { runId: Date.now().toString(36) + '-' + data.id, workload: data.preload ? 'preload' : data.text.length <= 100 ? '1-100' : data.text.length <= 300 ? '101-300' : '301-1000', memoryReuse: !!engine, start: performance.now(), speed: Number.isFinite(data.speed) ? Math.max(0.7, Math.min(1.4, data.speed!)) : 1 };
  graphs.clear();
  current = { phase: 'preparing', message: 'Starting local voice request', startedAt: Date.now(), confirmedAt: Date.now() };
  measure({ operation: 'request', state: 'start', backend });
  const heartbeat = setInterval(() => self.postMessage({ heartbeat: Date.now() }), 1000);
  try {
    if (data.preload) {
      await loadEngine(data.forceWasm);
      status('ready', 'Supertonic loaded in background · ' + backend);
      measure({ operation: 'request', state: 'complete', durationMs: performance.now() - requestContext.start, backend });
      self.postMessage({ id: data.id, preloaded: true });
      return;
    }
    const voice = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2'].includes(data.voice || '') ? data.voice! : 'F1';
    const speed = Number.isFinite(data.speed) ? Math.max(0.7, Math.min(1.4, data.speed!)) : 1;
    const key = JSON.stringify([voice, speed, data.text]);
    let audio = clips.get(key);
    const clipReuse = !!audio;
    let generationMs: number | undefined;
    if (!audio) {
      const tts = await loadEngine(data.forceWasm);
      if (!voices.has(voice)) {
        const url = 'https://huggingface.co/' + MODEL_ID + '/resolve/' + REVISION + '/voices/' + voice + '.bin';
        const cache = typeof caches !== 'undefined' ? await caches.open('natally-supertonic-voices-' + REVISION).catch(() => null) : null;
        const cached = await cache?.match(url).catch(() => undefined);
        const voiceStart = performance.now();
        const file = 'voices/' + voice + '.bin';
        measure({ operation: 'file', state: 'start', file, source: cached ? 'cache' : 'network', backend });
        const voiceFiles = [...(current.files || []), { file, loadedBytes: 0, totalBytes: 101 * 128 * 4, source: cached ? 'cache' as const : 'network' as const }];
        status('loading', 'Loading ' + file + (cached ? ' from saved cache' : ' from network'), { file, files: voiceFiles, loadedBytes: 0, totalBytes: 101 * 128 * 4, runtimeEvent: false, startedAt: Date.now(), confirmedAt: Date.now() });
        const response = cached || await fetch(url);
        if (!response.ok) throw new Error('Voice download failed (HTTP ' + response.status + ').');
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== 101 * 128 * 4) throw new Error('Invalid voice embedding.');
        if (!cached && cache) await cache.put(url, new Response(buffer.slice(0))).catch(() => {});
        voices.set(voice, new Float32Array(buffer));
        status('preparing', file + ' loaded', { loadedBytes: buffer.byteLength, files: voiceFiles.map(entry => entry.file === file ? { ...entry, loadedBytes: buffer.byteLength } : entry), confirmedAt: Date.now() });
        measure({ operation: 'file', state: 'complete', file, source: cached ? 'cache' : 'network', durationMs: performance.now() - voiceStart, bytes: buffer.byteLength, backend });
      }
      status('synthesizing', 'Generating speech on this device (' + backend + ')…', { runtimeEvent: false, startedAt: Date.now(), confirmedAt: Date.now() });
      // The upstream pipeline enables truncation. Fail explicitly rather than
      // reporting success for an utterance whose final tokens were discarded.
      const tokens = tts.tokenizer(data.text, { truncation: false, padding: false });
      if (tokens.input_ids.dims.at(-1) > tts.tokenizer.model_max_length) {
        throw new Error('Speech exceeds the model token limit. Use shorter phrases.');
      }
      runtimeFailed = true;
      const inferenceStart = performance.now();
      const output = await tts(data.text, { speaker_embeddings: voices.get(voice), num_inference_steps: 5, speed });
      generationMs = performance.now() - inferenceStart;
      if (!output.audio?.length || !output.audio.every(Number.isFinite)) throw new Error('Local model returned invalid audio.');
      audio = { samples: new Float32Array(output.audio), sampleRate: output.sampling_rate };
      runtimeFailed = false;
      while (clipBytes + audio.samples.byteLength > 16000000 && clips.size) {
        const oldest = clips.keys().next().value!;
        clipBytes -= clips.get(oldest)!.samples.byteLength;
        clips.delete(oldest);
      }
      if (audio.samples.byteLength <= 16000000) {
        clips.set(key, audio);
        clipBytes += audio.samples.byteLength;
      }
    }
    status('ready', 'Supertonic ready · ' + backend + ' · no speech API calls');
    measure({ operation: 'request', state: 'complete', durationMs: performance.now() - requestContext.start, backend, clipReuse });
    const samples = audio.samples.slice();
    self.postMessage({ id: data.id, samples, sampleRate: audio.sampleRate, generationMs, backend, clipReuse }, { transfer: [samples.buffer] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local voice failed.';
    status('error', message + ' Retry voice preview; no paid fallback is used.');
    measure({ operation: 'request', state: 'error', durationMs: performance.now() - requestContext.start, backend });
    self.postMessage({ id: data.id, error: message, runtimeFailed, backend });
  } finally { clearInterval(heartbeat); }
}
self.onmessage = ({ data }) => { queue = queue.then(() => synthesize(data)); };
