/**
 * Synthesis worker for the voice surface: Supertonic text-to-speech, running
 * fully locally through ONNX Runtime Web via transformers.js.
 *
 * NOTE ON THE CDN IMPORT: `@huggingface/transformers` is deliberately not a
 * package.json dependency — src/voice/** owns no manifest, and the dependency
 * graph stays install-light. The library is loaded at runtime from jsDelivr
 * (floating `@3.x`) with a dynamic `import()`. A literal URL specifier would
 * make bundlers try to resolve it at build time, so the URL travels through a
 * variable annotated `@vite-ignore`; TypeScript sees an unresolvable module
 * and yields `any`, which is cast to the minimal local surface used here
 * (`pipeline`). Model and speaker embeddings are fetched by the library from
 * the `onnx-community/Supertonic-TTS-ONNX` repo on huggingface.co.
 */

import type { FromWorker, SynthRequest, ToWorker } from './speech';

const TRANSFORMERS_CDN_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.x';
const MODEL_ID = 'onnx-community/Supertonic-TTS-ONNX';
/** Model card guidance: 5 steps is the quality/speed sweet spot (1–50). */
const NUM_INFERENCE_STEPS = 5;
/** Slightly quicker than neutral, per the model card's conversational example. */
const SPEED = 1.05;

/** Minimal local typing of the CDN module surface this worker consumes. */
interface TransformersCdnModule {
  pipeline(task: 'text-to-speech', model: string): Promise<TtsPipeline>;
}

interface TtsPipeline {
  (
    text: string,
    options: {
      speaker_embeddings: string;
      num_inference_steps: number;
      speed: number;
    },
  ): Promise<TtsOutput>;
}

interface TtsOutput {
  /** `<ArrayBuffer>` so the PCM buffer can be posted as a transferable. */
  audio: Float32Array<ArrayBuffer>;
  sampling_rate: number;
}

/** The DOM lib in this project has no WebWorker scope: type what we use. */
interface WorkerScope {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ToWorker>) => void,
  ): void;
}

const scope = globalThis as unknown as WorkerScope;

let pipelinePromise: Promise<TtsPipeline> | null = null;

function loadPipeline(): Promise<TtsPipeline> {
  if (pipelinePromise === null) {
    const specifier = TRANSFORMERS_CDN_URL; // variable: keep the bundler off the CDN import
    const load = async (): Promise<TtsPipeline> => {
      const cdn = (await import(/* @vite-ignore */ specifier)) as TransformersCdnModule;
      return cdn.pipeline('text-to-speech', MODEL_ID);
    };
    pipelinePromise = load().catch((err: unknown) => {
      pipelinePromise = null; // let a later sentence retry (CDN offline, OOM, …)
      throw err;
    });
  }
  return pipelinePromise;
}

/** Queued synthesis requests; drained strictly in order. */
const waiting: SynthRequest[] = [];
/** Mirrors the main thread's stop() epoch; superseded work is dropped. */
let epoch = 0;
let draining = false;

scope.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'reset') {
    epoch = msg.epoch;
    waiting.length = 0;
    return;
  }
  waiting.push(msg);
  void drain();
});

/** Serialize synthesis so sentences are generated and posted in order. */
async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (waiting.length > 0) {
      const req = waiting.shift();
      if (req === undefined || req.epoch !== epoch) continue;
      try {
        const tts = await loadPipeline();
        const out = await tts(req.text, {
          speaker_embeddings: `https://huggingface.co/${MODEL_ID}/resolve/main/voices/${req.voice}.bin`,
          num_inference_steps: NUM_INFERENCE_STEPS,
          speed: SPEED,
        });
        if (req.epoch !== epoch) continue;
        // Transfer the PCM buffer — the worker keeps no copy.
        scope.postMessage(
          {
            type: 'audio',
            id: req.id,
            epoch: req.epoch,
            sampleRate: out.sampling_rate,
            audio: out.audio,
          },
          [out.audio.buffer],
        );
      } catch (err) {
        if (req.epoch !== epoch) continue;
        scope.postMessage({
          type: 'error',
          id: req.id,
          epoch: req.epoch,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    draining = false;
  }
}
