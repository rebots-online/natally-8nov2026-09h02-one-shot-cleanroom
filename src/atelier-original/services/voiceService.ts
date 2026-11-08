import { supertonicSpeak, splitSpeechText, reportVoiceStatus, initSupertonic } from './supertonicTts';

export const NATALLY_VOICE_SAMPLE = "Okay, tiny cosmic plot twist. Your psychic is still figuring things out too. Let's take it one thing at a time. Honestly, the planets can wait. Let’s make this make sense.";

export interface VoiceSettings {
  resourceMode: 'auto' | 'gentle';
  tone: 'natural' | 'soft' | 'warm';
  readingAloud: boolean; // Default true (reading aloud by default)
  language: string; // 'ro-MD' | 'mo-MD' | 'ro-RO' | 'ru' | 'uk' | 'en-US'
  accentMode: 'moldavian' | 'slavic' | 'standard';
  rate: number; // 0.8 - 1.4
  pitch: number; // 0.8 - 1.4
  ttsModel: 'supertonic-onnx';
  aiVoiceName: string; // 'The Cheeky Sidekick 2'
  kawaiiMode: 'cheeky_sidekick' | 'kawaii_chibi' | 'moldavian_confidante' | 'celestial_oracle' | 'natural_companion';
  kawaiiIntensity: number; // 0 - 100
  spriteMode: 'wander' | 'follow' | 'docked';
  customAvatarUrl?: string | null;
}

const STORAGE_KEY = 'astrosphere_natally_voice_config_v3';
const SUPPORTED_VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2'];

export function getVoicePreset(env: Record<string, string | undefined>) {
  const pitch = Number(env.VITE_NATALLY_VOICE_PITCH);
  const rate = Number(env.VITE_NATALLY_VOICE_RATE);
  return {
    aiVoiceName: SUPPORTED_VOICES.includes(env.VITE_NATALLY_VOICE ?? '') ? env.VITE_NATALLY_VOICE! : 'F4',
    pitch: Number.isFinite(pitch) && pitch >= 0.8 && pitch <= 1.4 ? pitch : 1.15,
    rate: Number.isFinite(rate) && rate >= 0.8 && rate <= 1.4 ? rate : 0.9,
  };
}

const voicePreset = getVoicePreset(import.meta.env ?? {});
const voicePresetVersion = `${voicePreset.aiVoiceName}:${voicePreset.pitch}:${voicePreset.rate}`;
const configuredChunkSize = Number(import.meta.env?.VITE_NATALLY_SPEECH_CHUNK_CHARS);
const speechChunkSize = Number.isInteger(configuredChunkSize) && configuredChunkSize >= 100 && configuredChunkSize <= 800 ? configuredChunkSize : 240;

// Capability hints are only conservative starting bounds, never CPU benchmarks.
export function getSpeechPolicy(
  mode: VoiceSettings['resourceMode'],
  capabilities: { hardwareConcurrency?: number; deviceMemory?: number },
  realTimeFactor?: number,
): { chunkChars: number; prefetch: boolean } {
  const limited = mode === 'gentle' || !Number.isFinite(capabilities.deviceMemory) ||
    capabilities.deviceMemory! <= 4 || !Number.isFinite(capabilities.hardwareConcurrency) || capabilities.hardwareConcurrency! <= 4;
  const slow = Number.isFinite(realTimeFactor) && realTimeFactor! >= 0.7;
  return {
    chunkChars: Math.min(speechChunkSize, limited || slow ? 180 : 240),
    prefetch: mode !== 'gentle',
  };
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  resourceMode: 'auto',
  tone: 'soft',
  readingAloud: true, // Enabled by default
  language: 'en-US',
  accentMode: 'standard',
  ...voicePreset,
  ttsModel: 'supertonic-onnx',
  kawaiiMode: 'kawaii_chibi',
  kawaiiIntensity: 85,
  spriteMode: 'wander',
  customAvatarUrl: null,
};

/** Character identity is configured by the product, never by listener presets. */
export function withNatallyVoice(settings: VoiceSettings): VoiceSettings {
  return { ...settings, ttsModel: 'supertonic-onnx', language: 'en-US', accentMode: 'standard',
    aiVoiceName: DEFAULT_VOICE_SETTINGS.aiVoiceName,
    pitch: DEFAULT_VOICE_SETTINGS.pitch, tone: DEFAULT_VOICE_SETTINGS.tone,
    kawaiiMode: DEFAULT_VOICE_SETTINGS.kawaiiMode,
    kawaiiIntensity: DEFAULT_VOICE_SETTINGS.kawaiiIntensity,
    spriteMode: DEFAULT_VOICE_SETTINGS.spriteMode,
  };
}

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_VOICE_SETTINGS };
      const currentPreset = parsed.voicePresetVersion === voicePresetVersion;
      return withNatallyVoice({
        ...DEFAULT_VOICE_SETTINGS, ...parsed,
        resourceMode: parsed.resourceMode === 'gentle' ? 'gentle' : 'auto',
        tone: ['natural', 'soft', 'warm'].includes(parsed.tone) ? parsed.tone : DEFAULT_VOICE_SETTINGS.tone,
        ttsModel: 'supertonic-onnx', language: 'en-US', accentMode: 'standard',
        aiVoiceName: currentPreset && SUPPORTED_VOICES.includes(parsed.aiVoiceName) ? parsed.aiVoiceName : voicePreset.aiVoiceName,
        pitch: currentPreset && Number.isFinite(parsed.pitch) && parsed.pitch >= 0.8 && parsed.pitch <= 1.4 ? parsed.pitch : voicePreset.pitch,
        rate: currentPreset && Number.isFinite(parsed.rate) && parsed.rate >= 0.8 && parsed.rate <= 1.4 ? parsed.rate : voicePreset.rate,
        kawaiiMode: currentPreset ? parsed.kawaiiMode ?? DEFAULT_VOICE_SETTINGS.kawaiiMode : DEFAULT_VOICE_SETTINGS.kawaiiMode,
      });
    }
  } catch (e) {
    console.warn('Could not load voice settings from localStorage:', e);
  }
  return { ...DEFAULT_VOICE_SETTINGS };
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...withNatallyVoice(settings), voicePresetVersion }));
  } catch (e) {
    console.warn('Could not save voice settings to localStorage:', e);
  }
}

// Clean text for speech synthesis so raw markdown symbols and provenance aren't read out literally
export function prepareSpeechText(rawText: string): string {
  return prepareSpeechWithOffsets(rawText).text;
}

export function prepareSpeechWithOffsets(rawText: string): { text: string; sourceOffsets: number[] } {
  const end = rawText.indexOf('---ASTROLOGICAL PROVENANCE---');
  let characters = rawText.slice(0, end < 0 ? rawText.length : end).split('').map((char, index) => ({ char, index }));
  characters = characters.filter(({ char }) => !/[*#_~`>☉☽♂☿♀♃♄♅♆♇⚷☊♈♉♊♋♌♍♎♏♐♑♒♓]/.test(char));
  const intermediate = characters.map(({ char }) => char).join('');
  const excluded = new Set<number>();
  for (const match of intermediate.matchAll(/\[([^\]]+)\]\([^)]+\)/g)) {
    excluded.add(match.index!);
    for (let index = match.index! + 1 + match[1].length; index < match.index! + match[0].length; index++) excluded.add(index);
  }
  characters = characters.filter((_, index) => !excluded.has(index));
  // Speak angular units explicitly: TTS can otherwise collapse 1°20′ into 120.
  // Keep a monotonic map into the original display text for chart/karaoke cues.
  const angularText = characters.map(item => item.char).join('');
  const expanded: typeof characters = [];
  let copied = 0;
  for (const match of angularText.matchAll(/\b(\d+(?:\.\d+)?)\s*°(?:\s*(\d{1,2})(?:\s*[′’'])?(?:\s*(\d{1,2})\s*[″"])?)?/g)) {
    const start = match.index!;
    expanded.push(...characters.slice(copied, start));
    const degrees = Number(match[1]);
    const spoken = `${degrees} ${degrees === 1 ? 'degree' : 'degrees'}`
      + (match[2] === undefined ? '' : `, ${Number(match[2])} ${Number(match[2]) === 1 ? 'arcminute' : 'arcminutes'}`)
      + (match[3] === undefined ? '' : `, ${Number(match[3])} ${Number(match[3]) === 1 ? 'arcsecond' : 'arcseconds'}`);
    expanded.push(...spoken.split('').map((char, offset) => ({char, index:characters[start + Math.min(match[0].length - 1, Math.floor(offset * match[0].length / spoken.length))].index})));
    copied = start + match[0].length;
  }
  if(copied){expanded.push(...characters.slice(copied));characters=expanded;}
  const compact: typeof characters = [];
  for (const item of characters) {
    if (/\s/.test(item.char)) {
      if (compact.length && compact[compact.length - 1].char !== ' ') compact.push({ char: ' ', index: item.index });
    } else compact.push(item);
  }
  if (compact[compact.length - 1]?.char === ' ') compact.pop();
  return { text: compact.map(item => item.char).join(''), sourceOffsets: compact.map(item => item.index) };
}

let sharedAudioContext: AudioContext | null = null;
let currentBufferSource: AudioBufferSourceNode | null = null;
let generation = 0;
let finishPlayback: (() => void) | null = null;
let finishUtterance: (() => void) | null = null;
export const SPEECH_ACTIVITY_EVENT = 'natally-speech-activity';
export interface SpeechOwner { isCurrent: () => boolean; release: () => void; cancel: () => void }
let speechOwner: SpeechOwner | null = null;
const notifySpeechActivity = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SPEECH_ACTIVITY_EVENT));
};
export function isSpeechBusy(): boolean { return speechOwner !== null; }
/** Ownership lasts through synthesis and silent gaps, not just audible chunks. */
export function claimSpeechOwner(idle = false): SpeechOwner | null {
  if (idle && isSpeechBusy()) return null;
  stopSpeaking();
  const owner: SpeechOwner = {
    isCurrent: () => speechOwner === owner,
    release: () => { if (speechOwner === owner) stopSpeaking(); },
    cancel: () => { if (speechOwner === owner) stopSpeaking(); },
  };
  speechOwner = owner;notifySpeechActivity();
  return owner;
}

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!sharedAudioContext && AudioContextClass) sharedAudioContext = new AudioContextClass({ latencyHint: 'playback' });
    return sharedAudioContext;
  } catch { return null; }
}
export function unlockAudio(): void {
  const context = getSharedAudioContext();
  if (!mishapOwner && context?.state === 'suspended') context.resume().catch(() => {});
}
if (typeof window !== 'undefined') {
  for (const event of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(event, unlockAudio, { capture: true, passive: true });
  }
}

let performingSource: AudioBufferSourceNode | null = null;
let performanceCharIndex = 0;
let mishapTimer: ReturnType<typeof setTimeout> | null = null;
let mishapOwner: symbol | null = null;
export type NatallyVoicePerformance = { state: 'started' | 'word' | 'ended'; charIndex?: number; text?: string; durationMs?: number };
export function dispatchNatallyVoicePerformance(detail: NatallyVoicePerformance): void {
  if (detail.state === 'word') performanceCharIndex = detail.charIndex ?? performanceCharIndex;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<NatallyVoicePerformance>('natally-voice-performance',{detail}));
}
if (typeof window !== 'undefined') window.addEventListener('natally-atelier-mishap', event => {
  const detail = (event as CustomEvent<{durationMs:number;itemId:string}>).detail;
  const context = sharedAudioContext;
  const source = performingSource;
  if (!context || !source || !detail || !Number.isFinite(detail.durationMs)) return;
  const sourceGeneration = generation;
  const owner = Symbol('atelier-pause');
  // Claim before suspend resolves so pointer/key unlock cannot bypass the pause.
  mishapOwner = owner;
  if (mishapTimer) clearTimeout(mishapTimer);
  void context.suspend().then(() => {
    if (mishapOwner !== owner || generation !== sourceGeneration || performingSource !== source) {
      if (mishapOwner === owner) mishapOwner = null;
      // stopSpeaking already stopped the old node. Undo only this abandoned
      // context suspension; never restart that node or override a newer pause.
      if (!mishapOwner && context.state === 'suspended') void context.resume().catch(() => {});
      return;
    }
    dispatchNatallyVoicePerformance({state:'ended'});
    mishapTimer = setTimeout(() => {
      mishapTimer = null;
      if (mishapOwner !== owner) return;
      mishapOwner = null;
      if (generation !== sourceGeneration || performingSource !== source) {
        if(context.state === 'suspended') void context.resume().catch(() => {});
        return;
      }
      void context.resume().then(() => {
        if (!mishapOwner && generation === sourceGeneration && performingSource === source && context.state === 'running') dispatchNatallyVoicePerformance({state:'started',charIndex:performanceCharIndex});
      }).catch(() => {});
    },Math.max(200,Math.min(7500,detail.durationMs)));
  }).catch(() => {if(mishapOwner === owner)mishapOwner=null;});
});
export interface NatallyAudioSegment { samples: Float32Array; sampleRate: number; sourceOffset: number; sourceEnd: number; pitch: number }
export interface NatallySpeechOptions {
  owner?: SpeechOwner | null;
  idle?: boolean;
  onAdmitted?: () => void;
  signal?: AbortSignal;
  onAudioSegment?: (segment: NatallyAudioSegment) => void;
  onPreparing?: (preparing: boolean) => void;
  preparedAudio?: ReturnType<typeof supertonicSpeak>;
}
let externalPlaybackStop: (() => void) | null = null;
export function registerExternalPlaybackStop(stop: () => void, existingOwner?: SpeechOwner | null): () => void {
  const owner = existingOwner ?? claimSpeechOwner();
  if (!owner?.isCurrent()) { stop();return () => {}; }
  stopPlayback();
  externalPlaybackStop = stop;
  return () => { if (externalPlaybackStop === stop) { externalPlaybackStop = null;if (!existingOwner) owner.release(); } };
}
const WAITING_PHRASES = [
  {id:'look-v3',text:'Let me take a closer look.'},
  {id:'moment-v3',text:'Give me a moment.'},
  {id:'thread-v3',text:'Let me follow that thread.'},
];
let waitingIndex = -1;
const waitingBuffers = new Map<string,Promise<AudioBuffer>>();
function loadWaitingBuffer(id:string):Promise<AudioBuffer> {
  let pending = waitingBuffers.get(id);
  if (!pending) {
    pending = (async () => {
      const context=getSharedAudioContext();
      if (!context) throw new Error('Audio unavailable');
      const response=await fetch('/voice/waiting/'+id+'.wav');
      if (!response.ok) throw new Error('Prepared waiting voice unavailable');
      return context.decodeAudioData(await response.arrayBuffer());
    })().catch(error => {waitingBuffers.delete(id);throw error;});
    waitingBuffers.set(id,pending);
  }
  return pending;
}
/** Ready, bundled Supertonic PCM only. This never queues model inference. */
export function prepareWaitingVoice(settings:VoiceSettings):void {
  settings = withNatallyVoice(settings);
  if (settings.readingAloud) void initSupertonic().catch(() => {});
  if (!settings.readingAloud || settings.aiVoiceName !== 'F4') return;
  for(const phrase of WAITING_PHRASES) void loadWaitingBuffer(phrase.id).catch(()=>{});
}
export function startWaitingUtterance(settings:VoiceSettings, owner?:SpeechOwner|null):{caption:string;cancel:()=>void} {
  settings = withNatallyVoice(settings);
  const phrase=WAITING_PHRASES[++waitingIndex % WAITING_PHRASES.length];
  let cancelled=false;
  let source:AudioBufferSourceNode|null=null;
  let timer:ReturnType<typeof setInterval>|null=null;
  let started=false;
  let unregister=()=>{};
  const cancel=()=>{
    if(cancelled)return;
    cancelled=true;
    if(timer)clearInterval(timer);
    if(source){if(performingSource===source)performingSource=null;source.onended=null;try{source.stop();source.disconnect();}catch{}}
    if(started)dispatchNatallyVoicePerformance({state:'ended'});
    unregister();
  };
  if(settings.readingAloud && settings.aiVoiceName==='F4') {
    unregister=registerExternalPlaybackStop(cancel,owner);
    void (async()=>{
      try{
        const buffer=await loadWaitingBuffer(phrase.id);
        const context=getSharedAudioContext();
        if(cancelled || !context)return;
        await context.resume();
        if(cancelled || context.state!=='running')return;
        source=context.createBufferSource();source.buffer=buffer;
        const pitch=Math.max(.8,Math.min(1.4,settings.pitch));
        source.playbackRate.value=pitch * Math.max(.8,Math.min(1.4,settings.rate))/.9;
        source.connect(context.destination);source.onended=cancel;
        source.start();started=true;performingSource=source;
        dispatchNatallyVoicePerformance({state:'started'});
        const words=[...phrase.text.matchAll(/\S+/g)];let word=0;
        const emit=()=>{if(context.state!=='running')return;const next=words[word++];if(next)dispatchNatallyVoicePerformance({state:'word',charIndex:next.index,text:next[0],durationMs:buffer.duration/source!.playbackRate.value*1000/words.length});};
        emit();timer=setInterval(emit,Math.max(20,buffer.duration/source.playbackRate.value*1000/words.length));
      }catch{cancel();} // The visible caption remains usable without audio.
    })();
  }
  return {caption:phrase.text,cancel};
}

export function stopSpeaking(): void {
  speechOwner = null;
  stopPlayback();
  notifySpeechActivity();
}
function stopPlayback(): void {
  generation++;
  if(mishapTimer){clearTimeout(mishapTimer);mishapTimer=null;}
  mishapOwner=null;
  const stopExternal = externalPlaybackStop; externalPlaybackStop = null; stopExternal?.();
  if (currentBufferSource) {
    try { currentBufferSource.stop(); currentBufferSource.disconnect(); } catch {}
    currentBufferSource = null;
  }
  finishPlayback?.();
  finishPlayback = null;
  finishUtterance?.();
  finishUtterance = null;
}
export async function speakNatallyText(
  text: string,
  settings: VoiceSettings,
  onStart?: () => void,
  onEnd?: () => void,
  onWordBoundary?: (charIndex: number, charLength?: number) => void,
  options: NatallySpeechOptions = {}
): Promise<boolean> {
  if (options.signal?.aborted) return false;
  settings = withNatallyVoice(settings);
  if (!settings.readingAloud) { onEnd?.(); return false; }
  const prepared = prepareSpeechWithOffsets(text);
  const clean = prepared.text;
  if (!clean) { onEnd?.(); return false; }
  const owner = options.owner ?? claimSpeechOwner(options.idle);
  if (!owner?.isCurrent()) return false;
  if (options.owner) stopPlayback();
  const requestGeneration = generation;
  // An obsolete caller may cancel only its own utterance, never a newer
  // reading that has since claimed the shared speech engine.
  const abort = () => { if (requestGeneration === generation) owner.cancel(); };
  options.signal?.addEventListener('abort', abort, { once: true });
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    if (finishUtterance === end) finishUtterance = null;
    options.onPreparing?.(false);
    onEnd?.();
    if (!options.owner) owner.release();
  };
  finishUtterance = end;
  try {
    options.onAdmitted?.();
    const context = getSharedAudioContext();
    if (!context) throw new Error('Web Audio is unavailable in this browser.');
    await context.resume();
    if (context.state !== 'running') throw new Error('Tap voice preview to enable audio playback.');
    if (requestGeneration !== generation) return false;
    const capabilities = typeof navigator === 'undefined' ? {} : navigator;
    let realTimeFactor: number | undefined;
    let policy = getSpeechPolicy(settings.resourceMode, capabilities, realTimeFactor);
    let offset = 0;
    let started = false;
    const pitch = Number.isFinite(settings.pitch) ? Math.max(0.8, Math.min(1.4, settings.pitch)) : 1;
    const synthesize = (chunk: string) => supertonicSpeak(chunk, { voice: settings.aiVoiceName, speed: settings.rate })
      .then(audio => ({ audio, error: null }), error => ({ audio: null, error }));
    let chunk = splitSpeechText(clean, policy.chunkChars)[0];
    let pendingAudio = options.preparedAudio
      ? options.preparedAudio.then(audio => ({ audio, error: null }), error => ({ audio: null, error }))
      : synthesize(chunk);
    while (chunk) {
      if (requestGeneration !== generation) return false;
      options.onPreparing?.(true);
      const result = await pendingAudio;
      if (requestGeneration !== generation) return false;
      if (result.error) throw result.error;
      const audio = result.audio!;
      const durationMs = audio.samples.length / audio.sampleRate / pitch * 1000;
      if (!audio.clipReuse && Number.isFinite(audio.generationMs) && audio.generationMs! > 0) {
        const observed = audio.generationMs! / durationMs;
        // React to a slowdown immediately; recover conservatively after it.
        realTimeFactor = realTimeFactor === undefined ? observed : Math.max(observed, realTimeFactor * 0.75 + observed * 0.25);
      }
      policy = getSpeechPolicy(settings.resourceMode, capabilities, realTimeFactor);
      const chunkOffset = clean.indexOf(chunk, offset);
      offset = chunkOffset + chunk.length;
      options.onAudioSegment?.({ samples:audio.samples, sampleRate:audio.sampleRate, sourceOffset:prepared.sourceOffsets[chunkOffset], sourceEnd:(prepared.sourceOffsets[offset-1] ?? prepared.sourceOffsets[chunkOffset])+1, pitch });
      const nextChunk = splitSpeechText(clean.slice(offset), policy.chunkChars)[0];
      const prefetch = !!nextChunk && policy.prefetch;
      if (prefetch) pendingAudio = synthesize(nextChunk);
      await context.resume();
      if (requestGeneration !== generation) return false;
      if (context.state !== 'running') throw new Error('Audio is paused. Tap replay to resume speech.');
      const buffer = context.createBuffer(1, audio.samples.length, audio.sampleRate);
      buffer.getChannelData(0).set(audio.samples);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = pitch;
      const filters: AudioNode[] = [];
      if (settings.tone === 'soft' || settings.tone === 'warm') {
        const low = context.createBiquadFilter();
        low.type = 'lowshelf'; low.frequency.value = 220;
        low.gain.value = settings.tone === 'warm' ? 2 : 0;
        const high = context.createBiquadFilter();
        high.type = 'highshelf'; high.frequency.value = 4000;
        high.gain.value = settings.tone === 'warm' ? -1 : -2;
        const headroom = context.createGain();
        headroom.gain.value = settings.tone === 'warm' ? 0.79 : 1;
        source.connect(low); low.connect(high); high.connect(headroom); headroom.connect(context.destination);
        filters.push(low, high, headroom);
      } else source.connect(context.destination);
      currentBufferSource = source;
      const words = [...chunk.matchAll(/\S+/g)];
      await new Promise<void>((resolve, reject) => {
        let wordIndex = 0;
        let finished = false;
        const emitWord = () => {
          if(context.state !== 'running') return;
          const word = words[wordIndex++];
          if (word) {
            const position = chunkOffset + word.index!;
            const rawStart = prepared.sourceOffsets[position];
            const rawEnd = prepared.sourceOffsets[position + word[0].length - 1] + 1;
            dispatchNatallyVoicePerformance({state:'word',charIndex:rawStart,text:word[0],durationMs:durationMs/Math.max(1,words.length)});
            onWordBoundary?.(rawStart, rawEnd - rawStart);
          }
        };
        const timer = setInterval(emitWord, Math.max(20, durationMs / Math.max(1, words.length)));
        const finish = () => {
          if (finished) return;
          finished = true;
          clearInterval(timer);
          source.onended = null;
          if (currentBufferSource === source) currentBufferSource = null;
          if (finishPlayback === finish) finishPlayback = null;
          source.disconnect();
          if(performingSource===source)performingSource=null;
          dispatchNatallyVoicePerformance({state:'ended'});
          filters.forEach(filter => filter.disconnect());
          resolve();
        };
        finishPlayback = finish;
        source.onended = finish;
        try { source.start(); } catch (error) { reject(error); finish(); return; }
        performingSource=source;
        options.onPreparing?.(false);
        dispatchNatallyVoicePerformance({state:'started'});
        emitWord();
        if (!started) { started = true; onStart?.(); }
      });
      if (requestGeneration !== generation) return false;
      chunk = nextChunk;
      if (chunk && !prefetch) pendingAudio = synthesize(chunk);
    }
    return requestGeneration === generation;
  } catch (error) {
    if (requestGeneration === generation) reportVoiceStatus({
      phase: 'error',
      message: (error instanceof Error ? error.message : 'Local voice failed.') + ' Retry voice preview; no hosted fallback.',
    });
    return false;
  } finally { options.signal?.removeEventListener('abort', abort); end(); }
}
