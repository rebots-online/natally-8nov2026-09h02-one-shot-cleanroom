export const SUPERTONIC_MODEL_FILES: Readonly<Record<string, number>> = Object.freeze({
  'config.json': 247,
  'tokenizer.json': 2038,
  'tokenizer_config.json': 119,
  'onnx/latent_denoiser.onnx': 398102,
  'onnx/latent_denoiser.onnx_data': 132098880,
  'onnx/text_encoder.onnx': 433169,
  'onnx/text_encoder.onnx_data': 28426752,
  'onnx/voice_decoder.onnx': 59921,
  'onnx/voice_decoder.onnx_data': 101353472,
});

export class SupertonicDownloadProgress {
  private readonly loaded = new Map<string, number>();
  private readonly sources = new Map<string, 'cache' | 'network' | 'unknown'>();
  private readonly attemptBytes = new Map<string, number>();
  readonly totalBytes = Object.values(SUPERTONIC_MODEL_FILES).reduce((total, size) => total + size, 0);

  update(event: { file?: string; status?: string; loaded?: number; source?: 'cache' | 'network' | 'unknown' }) {
    const size = event.file ? SUPERTONIC_MODEL_FILES[event.file] : undefined;
    if (size !== undefined) {
      if (event.status === 'download') this.attemptBytes.set(event.file!, 0);
      if (event.source) this.sources.set(event.file!, event.source);
      const received = Number.isFinite(event.loaded) ? event.loaded! : 0;
      if (Number.isFinite(event.loaded)) this.attemptBytes.set(event.file!, received);
      this.loaded.set(event.file!, Math.max(this.loaded.get(event.file!) || 0, Math.max(0, received)));
    }
    return { loadedBytes: [...this.loaded.values()].reduce((total, size) => total + size, 0), totalBytes: this.totalBytes };
  }
  lastReadBytes(file: string) { return this.attemptBytes.get(file); }
  files() { return Object.entries(SUPERTONIC_MODEL_FILES).map(([file, totalBytes]) => ({ file, totalBytes, loadedBytes: this.loaded.get(file) || 0, source: this.sources.get(file) || 'unknown' as const })); }
}
