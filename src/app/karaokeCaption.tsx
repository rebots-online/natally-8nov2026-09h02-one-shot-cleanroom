// Karaoke caption: the line Natally is speaking, its current word glowing
// in brass, paced by the original voice engine's word boundaries — the same
// audio-timed schedule that drives her mouth. Renders nothing until a line
// is under way; the unadmitted truth is the caller's voice-note chip.

import { useEffect, useState } from 'react';
import type { KaraokeDetail } from '../voice';

interface KaraokeState extends KaraokeDetail {
  /** Epoch ms of the last event, so stale lines expire. */
  at: number;
}

export default function KaraokeCaption() {
  const [state, setState] = useState<KaraokeState | null>(null);

  useEffect(() => {
    const onKaraoke = (event: Event) => {
      const detail = (event as CustomEvent<KaraokeDetail>).detail;
      setState({ ...detail, at: Date.now() });
    };
    const onEnd = () => {
      window.setTimeout(() => {
        setState(previous => (previous && Date.now() - previous.at > 1200 ? null : previous));
      }, 1400);
    };
    window.addEventListener('natally-karaoke', onKaraoke);
    window.addEventListener('natally-voice-performance', onEnd);
    return () => {
      window.removeEventListener('natally-karaoke', onKaraoke);
      window.removeEventListener('natally-voice-performance', onEnd);
    };
  }, []);

  if (!state) return null;
  const words = state.line.split(/\s+/);
  return (
    <p className="karaoke-caption" aria-live="off" role="status">
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className={index === state.wordIndex ? 'is-glowing' : undefined}>
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
