// Bridge between the clean-room voice rail (src/voice) and the verbatim
// atelier character rig + karaoke captions: AtelierCharacter animates
// Natally's mouth from `natally-voice-performance` events, and the karaoke
// caption glows word-by-word from `natally-karaoke` events — both driven
// from one schedule mirrored off each speakStream utterance. Our engine
// exposes gesture-gated sentence playback but no per-word callbacks, so
// utterances are paced by their own text (≈55 ms per character, the model's
// conversational cadence): sentence windows first, then word windows inside
// each sentence. Warm/classic pacing — no hurrying.

import type { SpeakOptions, Voice } from '../voice';

interface PerformanceDetail {
  state: 'started' | 'word' | 'ended';
  charIndex?: number;
  text?: string;
  durationMs?: number;
}

export interface KaraokeDetail {
  line: string;
  wordIndex: number;
  wordCount: number;
}

const SENTENCE_CHUNK = /[^.!?…]+[.!?…]*/g;
const MS_PER_CHAR = 55;

function dispatchPerformance(detail: PerformanceDetail): void {
  window.dispatchEvent(new CustomEvent<PerformanceDetail>('natally-voice-performance', { detail }));
}

function dispatchKaraoke(detail: KaraokeDetail): void {
  window.dispatchEvent(new CustomEvent<KaraokeDetail>('natally-karaoke', { detail }));
}

/** Wrap the shared controller so its speech also drives the rig + captions. */
export function withPerformanceEvents(voice: Voice): Voice {
  let timers: number[] = [];
  const clearTimers = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
  };
  return {
    speakStream(text: string, opts?: SpeakOptions) {
      if (text.trim().length > 0) {
        clearTimers();
        dispatchPerformance({ state: 'started' });
        const sentences = text.match(SENTENCE_CHUNK) ?? [text];
        let at = 0;
        let charIndex = 0;
        const words = text.trim().split(/\s+/);
        let wordCursor = 0;
        for (const sentence of sentences) {
          const sentenceMs = Math.max(360, sentence.length * MS_PER_CHAR);
          const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean);
          const weight = sentenceWords.reduce((sum, word) => sum + word.length + 2, 0) || 1;
          let wordAt = at;
          for (const word of sentenceWords) {
            const wordMs = (sentenceMs * (word.length + 2)) / weight;
            const atChar = charIndex;
            const atWord = wordCursor;
            const atMs = wordAt;
            timers.push(
              window.setTimeout(() => {
                dispatchPerformance({ state: 'word', text: word, charIndex: atChar, durationMs: wordMs });
                dispatchKaraoke({ line: text.trim(), wordIndex: atWord, wordCount: words.length });
              }, atMs),
            );
            wordAt += wordMs;
            charIndex += word.length + 1;
            wordCursor += 1;
          }
          at += sentenceMs;
        }
        timers.push(window.setTimeout(() => dispatchPerformance({ state: 'ended' }), at + 120));
      }
      voice.speakStream(text, opts);
    },
    stop() {
      clearTimers();
      dispatchPerformance({ state: 'ended' });
      voice.stop();
    },
    admit: () => voice.admit(),
    get admitted() {
      return voice.admitted;
    },
    onState: cb => voice.onState(cb),
  };
}
