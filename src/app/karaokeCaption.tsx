// Karaoke caption: the line Natally is speaking, its current word glowing
// in brass, paced by the original voice engine's word boundaries — the same
// audio-timed schedule that drives her mouth. Renders nothing until a line
// is under way; the unadmitted truth is the caller's voice-note chip.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KaraokeDetail } from '../voice';

interface KaraokeState extends KaraokeDetail {
  /** Epoch ms of the last event, so stale lines expire. */
  at: number;
}

export default function KaraokeCaption() {
  const [state, setState] = useState<KaraokeState | null>(null);
  const captionRef = useRef<HTMLParagraphElement | null>(null);
  const [windowRange, setWindowRange] = useState({ line: '', start: 0, end: 0 });

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

  useLayoutEffect(() => {
    const caption = captionRef.current;
    if (state === null || caption === null) return;
    const context = document.createElement('canvas').getContext('2d');
    if (context === null) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const style = getComputedStyle(caption);
      const available = Math.max(1, caption.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const words = state.line.split(/\s+/);
      const currentWord = Math.max(0, Math.min(state.wordIndex, words.length - 1));
      let start = 0;
      let end = words.length;
      for (let index = 0; index < currentWord; index += 1) {
        if (/[.!?][”"')\]]*$/.test(words[index])) start = index + 1;
      }
      for (let index = currentWord; index < words.length; index += 1) {
        if (/[.!?][”"')\]]*$/.test(words[index])) { end = index + 1; break; }
      }
      let line = 1;
      let lineWidth = 0;
      for (let index = start; index < end; index += 1) {
        const width = context.measureText(`${words[index]} `).width;
        if (lineWidth > 0 && lineWidth + width > available) {
          line += 1;
          lineWidth = 0;
        }
        if (line > 2) {
          if (currentWord < index) {
            end = index;
            break;
          }
          start = index;
          line = 1;
        }
        lineWidth += width;
      }
      setWindowRange(previous => previous.line === state.line && previous.start === start && previous.end === end
        ? previous : { line: state.line, start, end });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(caption);
    measure();
    void document.fonts.ready.then(measure);
    return () => { active = false; observer.disconnect(); };
  }, [state?.line, state?.wordIndex]);

  if (!state) return null;
  const words = state.line.split(/\s+/);
  const start = windowRange.line === state.line ? windowRange.start : 0;
  const end = windowRange.line === state.line ? windowRange.end : words.length;
  return (
    <p ref={captionRef} className="karaoke-caption" aria-live="off" role="status">
      {words.slice(start, end).map((word, offset) => (
        <span key={`${word}-${start + offset}`} className={start + offset === state.wordIndex ? 'is-glowing' : undefined}>
          {word}
          {start + offset < end - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
