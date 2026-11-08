import type { VoiceSettings } from './voiceService';

const DATABASE = 'natally-retained-reading-audio-v1';
const STORE = 'readings';
const SAMPLE_RATE = 24000;
const MAX_RECORD_BYTES = 64 * 1024 * 1024;
const MAX_ACCOUNT_BYTES = 192 * 1024 * 1024;
const MAX_RECORDINGS = 6;
export const READING_AUDIO_EVENT = 'natally-reading-audio-changed';

export interface ReadingAudioSegment {
  samples: Float32Array;
  sampleRate: number;
  sourceOffset: number;
  sourceEnd: number;
  pitch: number;
}
export interface ReadingAudioStatus {
  state: 'recording' | 'saving' | 'saved' | 'error' | 'discarded';
  message: string;
}
export interface ReadingAudioRecord {
  key: string;
  version: 1;
  accountUid: string;
  messageId: string;
  text: string;
  createdAt: string;
  complete: true;
  sampleRate: number;
  duration: number;
  bytes: number;
  voiceSettings: Pick<VoiceSettings, 'ttsModel' | 'aiVoiceName' | 'pitch' | 'rate' | 'language' | 'tone'>;
  segments: Array<{ sourceOffset: number; sourceEnd: number; frames: number }>;
  wav: Blob;
}

function keyFor(accountUid: string, messageId: string) { return JSON.stringify([accountUid, messageId]); }
function changed(accountUid: string) {
  window.dispatchEvent(new CustomEvent(READING_AUDIO_EVENT, { detail: { accountUid } }));
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser cannot retain reading audio.')); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'key' });
      store.createIndex('accountUid', 'accountUid');
    };
    request.onerror = () => reject(new Error('Reading-audio storage is unavailable. Check browser storage permissions.'));
    request.onblocked = () => reject(new Error('Close older Natally tabs to unlock reading-audio storage.'));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}

export async function loadReadingAudio(accountUid: string, messageId: string): Promise<ReadingAudioRecord | null> {
  if (!accountUid || !messageId) return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(keyFor(accountUid, messageId));
    let result: ReadingAudioRecord | null = null;
    request.onsuccess = () => {
      const value = request.result as ReadingAudioRecord | undefined;
      if (value?.version === 1 && value.accountUid === accountUid && value.messageId === messageId && value.complete === true && value.wav instanceof Blob) result = value;
    };
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(new Error('The saved reading could not be opened. Check browser storage access.')); };
    transaction.onabort = transaction.onerror;
  });
}

export async function clearReadingAudio(accountUid: string, messageId: string, isCurrentSession: () => boolean = () => true): Promise<void> {
  if (!accountUid || !isCurrentSession()) return;
  const db = await openDatabase();
  if (!isCurrentSession()) { db.close(); return; }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(keyFor(accountUid, messageId));
    transaction.oncomplete = () => { db.close(); changed(accountUid); resolve(); };
    transaction.onerror = () => { db.close(); reject(new Error('The saved audio could not be cleared. Check browser storage access and try again.')); };
    transaction.onabort = transaction.onerror;
  });
}

/** Whole-history erasure only; each ordinary recording also has its own clear action. */
export async function clearAccountReadingAudio(accountUid: string, isCurrentAccount: () => boolean): Promise<void> {
  if (!accountUid || !isCurrentAccount()) throw new Error('The account changed before audio could be erased.');
  const db = await openDatabase();
  if (!isCurrentAccount()) { db.close(); throw new Error('The account changed before audio could be erased.'); }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const request = transaction.objectStore(STORE).index('accountUid').openCursor(accountUid);
    request.onsuccess = () => {
      if (!isCurrentAccount()) { transaction.abort(); return; }
      const cursor = request.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    transaction.oncomplete = () => { db.close(); changed(accountUid); resolve(); };
    transaction.onerror = () => { db.close(); reject(new Error('Saved reading audio could not be erased. Check browser storage access and retry.')); };
    transaction.onabort = transaction.onerror;
  });
}

async function saveReadingAudio(record: ReadingAudioRecord, isCurrentSession: () => boolean): Promise<void> {
  const db = await openDatabase();
  if (!isCurrentSession()) { db.close(); throw new Error('The account changed before the recording could be retained.'); }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const request = store.index('accountUid').getAll(record.accountUid);
    request.onsuccess = () => {
      if (!isCurrentSession()) { transaction.abort(); return; }
      const retained = (request.result as ReadingAudioRecord[]).filter(value => value.key !== record.key).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      let bytes = retained.reduce((total, value) => total + value.bytes, 0) + record.bytes;
      while (retained.length >= MAX_RECORDINGS || bytes > MAX_ACCOUNT_BYTES) {
        const oldest = retained.shift();
        if (!oldest) break;
        bytes -= oldest.bytes;
        store.delete(oldest.key);
      }
      store.put(record);
    };
    transaction.oncomplete = () => { db.close(); changed(record.accountUid); resolve(); };
    transaction.onerror = () => { db.close(); reject(new Error('The complete reading could not be saved. Free browser storage or clear an older recording, then replay the reading to retain it.')); };
    transaction.onabort = transaction.onerror;
  });
}

function wavHeader(dataBytes: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (at: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, dataBytes + 36, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, dataBytes, true);
  return header;
}

async function applyVoiceTone(parts: ArrayBuffer[], frames: number, tone: VoiceSettings['tone']): Promise<ArrayBuffer[]> {
  if (tone === 'natural') return parts;
  // Use the same Web Audio shelf/gain nodes as live speech, offline: no playback
  // and no synthesis/provider request. Pitch is already applied during capture.
  const context = new OfflineAudioContext(1, frames, SAMPLE_RATE);
  const buffer = context.createBuffer(1, frames, SAMPLE_RATE);
  const samples = buffer.getChannelData(0);
  let offset = 0;
  for (const part of parts) {
    const view = new DataView(part);
    for (let i = 0; i < part.byteLength / 2; i++) samples[offset++] = view.getInt16(i * 2, true) / 32768;
  }
  const source = context.createBufferSource(); source.buffer = buffer;
  const low = context.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 220; low.gain.value = tone === 'warm' ? 2 : 0;
  const high = context.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4000; high.gain.value = tone === 'warm' ? -1 : -2;
  const gain = context.createGain(); gain.gain.value = tone === 'warm' ? 0.79 : 1;
  source.connect(low); low.connect(high); high.connect(gain); gain.connect(context.destination); source.start();
  const output = (await context.startRendering()).getChannelData(0);
  const pcm = new ArrayBuffer(output.length * 2), view = new DataView(pcm);
  for (let i = 0; i < output.length; i++) { const value = Math.max(-1, Math.min(1, output[i])); view.setInt16(i * 2, Math.round(value < 0 ? value * 32768 : value * 32767), true); }
  return [pcm];
}

/** Capture only answer segments. Call complete only when the whole utterance resolves true. */
export function createReadingAudioCapture(options: {
  accountUid: string;
  messageId: string;
  text: string;
  voiceSettings: VoiceSettings;
  isCurrentSession: () => boolean;
  onStatus?: (status: ReadingAudioStatus) => void;
}) {
  let parts: ArrayBuffer[] = [];
  const segments: ReadingAudioRecord['segments'] = [];
  let bytes = 0;
  let stopped = false;
  let failed = false;
  const status = (state: ReadingAudioStatus['state'], message: string) => {
    if (options.isCurrentSession()) options.onStatus?.({ state, message });
  };
  return {
    onAudioSegment(segment: ReadingAudioSegment) {
      if (stopped || failed || !options.accountUid || !options.isCurrentSession()) return;
      try {
        if (!(segment.samples instanceof Float32Array) || !segment.samples.length || !Number.isFinite(segment.sampleRate) || segment.sampleRate <= 0 || !Number.isFinite(segment.pitch) || segment.pitch <= 0 ||
            !Number.isInteger(segment.sourceOffset) || !Number.isInteger(segment.sourceEnd) || segment.sourceEnd <= segment.sourceOffset || (segments.length && segment.sourceOffset < segments[segments.length - 1].sourceEnd)) throw new Error('A reading audio segment was incomplete or out of order. Replay the reading to retain it.');
        const step = segment.sampleRate * segment.pitch / SAMPLE_RATE;
        const frames = Math.max(1, Math.round(segment.samples.length / step));
        if (bytes + frames * 2 + 44 > MAX_RECORD_BYTES) throw new Error('This reading is too long for local audio retention. The spoken reading can continue; use shorter passages to save audio.');
        const pcm = new ArrayBuffer(frames * 2);
        const view = new DataView(pcm);
        for (let i = 0; i < frames; i++) {
          const source = Math.min(segment.samples.length - 1, i * step);
          const lo = Math.floor(source), hi = Math.min(segment.samples.length - 1, lo + 1);
          const sample = segment.samples[lo] + (segment.samples[hi] - segment.samples[lo]) * (source - lo);
          if (!Number.isFinite(sample)) throw new Error('The reading audio contained invalid samples and could not be retained.');
          const bounded = Math.max(-1, Math.min(1, sample));
          view.setInt16(i * 2, Math.round(bounded < 0 ? bounded * 32768 : bounded * 32767), true);
        }
        parts.push(pcm); bytes += pcm.byteLength;
        segments.push({ sourceOffset: segment.sourceOffset, sourceEnd: segment.sourceEnd, frames });
        status('recording', 'Keeping this reading’s audio as it plays.');
      } catch (error) {
        failed = true; parts = [];
        status('error', error instanceof Error ? error.message : 'This reading audio could not be retained.');
      }
    },
    async complete(): Promise<ReadingAudioRecord | null> {
      if (stopped || failed || !parts.length || !options.isCurrentSession()) return null;
      stopped = true;
      status('saving', 'Saving the complete reading on this device…');
      const { ttsModel, aiVoiceName, pitch, rate, language, tone } = options.voiceSettings;
      let processed: ArrayBuffer[];
      try { processed = await applyVoiceTone(parts, bytes / 2, tone); }
      catch { parts = []; status('error', 'The reading played, but its voice tone could not be rendered into the saved WAV. Replay to try retaining it again.'); return null; }
      parts = [];
      if (!options.isCurrentSession()) return null;
      const wav = new Blob([wavHeader(bytes), ...processed], { type: 'audio/wav' });
      const record: ReadingAudioRecord = {
        key: keyFor(options.accountUid, options.messageId), version: 1, accountUid: options.accountUid,
        messageId: options.messageId, text: options.text, createdAt: new Date().toISOString(), complete: true,
        sampleRate: SAMPLE_RATE, duration: bytes / 2 / SAMPLE_RATE, bytes: wav.size,
        voiceSettings: { ttsModel, aiVoiceName, pitch, rate, language, tone }, segments, wav,
      };
      try {
        await saveReadingAudio(record, options.isCurrentSession);
        status('saved', 'Complete reading saved on this device. Replay free below, or view purchase options to download.');
        return record;
      } catch (error) {
        status('error', error instanceof Error ? error.message : 'This reading could not be saved.');
        return null;
      }
    },
    cancel() {
      if (stopped) return;
      stopped = true; parts = [];
      if (!failed) status('discarded', 'Playback stopped. An incomplete recording was not saved.');
    },
  };
}

export function readingAudioFilename(record: Pick<ReadingAudioRecord, 'messageId' | 'createdAt'>): string {
  return `natally-reading-${record.createdAt.slice(0, 10)}-${record.messageId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'audio'}.wav`;
}

export function downloadReadingAudio(record: ReadingAudioRecord): void {
  const url = URL.createObjectURL(record.wav);
  const link = document.createElement('a'); link.href = url; link.download = readingAudioFilename(record); link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
