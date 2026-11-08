// Playback drive (DOCS/ARCHITECTURE.md §First reveal and speech-driven
// presentation). The voice engine emits `natally-karaoke` word-boundary
// events per spoken line; those offsets advance through the reply's cues so
// each crossed cue is applied as her voice reaches it — highlight → focus →
// un-highlight track what she is saying. Without audio, cues apply at
// text-stream offsets instead. `finish()` flushes whatever the speech never
// reached, so the final state always matches the last cue.

import type { Cue } from './cues';

/** One spoken-line word boundary, the engine's karaoke payload. */
export interface SpokenBoundary {
  line: string;
  wordIndex: number;
  wordCount: number;
}

export interface PlaybackDriver {
  /** A new utterance begins. `audio` true when speech is expected. */
  begin(audio: boolean): void;
  /** Latest cleaned text and cues of the utterance so far. */
  update(text: string, cues: readonly Cue[]): void;
  /** A spoken word boundary arrived; cues follow the voice from here on. */
  spoken(boundary: SpokenBoundary): void;
  /** The text ended: flush now only when speech never drove it. */
  end(): void;
  /** Speech ended (or never came): flush every cue left. */
  finish(): void;
}

export function createPlayback(apply: (cue: Cue) => void): PlaybackDriver {
  let text = '';
  let cues: readonly Cue[] = [];
  let applied = 0;
  /** Speech-driven frontier in `text`; null while only the stream drives. */
  let spokenCursor: number | null = null;
  /** Where to keep searching for the next spoken line (monotonic). */
  let searchFrom = 0;

  const applyThrough = (frontier: number): void => {
    while (applied < cues.length && cues[applied].offset <= frontier) {
      apply(cues[applied]);
      applied += 1;
    }
  };

  const driver: PlaybackDriver = {
    begin(audio) {
      text = '';
      cues = [];
      applied = 0;
      spokenCursor = audio ? 0 : null;
      searchFrom = 0;
    },
    update(nextText, nextCues) {
      text = nextText;
      cues = nextCues;
      // No speech yet (or none coming): the streamed text is the frontier.
      if (spokenCursor === null) applyThrough(text.length);
      else applyThrough(spokenCursor);
    },
    spoken(boundary) {
      if (spokenCursor === null) spokenCursor = 0;
      // Locate the spoken line inside the cleaned text, searching forward
      // from the end of the previous one; the engine speaks in order.
      let at = text.indexOf(boundary.line, searchFrom);
      if (at < 0) at = text.indexOf(boundary.line);
      if (at < 0) return;
      const words = [...boundary.line.matchAll(/\S+/g)];
      const wordStart =
        boundary.wordIndex >= 0 && boundary.wordIndex < words.length
          ? words[boundary.wordIndex].index ?? boundary.line.length
          : boundary.line.length;
      const cursor = at + wordStart;
      if (cursor > spokenCursor) spokenCursor = cursor;
      searchFrom = at + boundary.line.length;
      applyThrough(spokenCursor);
    },
    end() {
      // Text-stream end only flushes when the voice never took over; with
      // speech still running, the karaoke frontier keeps leading.
      if (spokenCursor === null) applyThrough(Number.POSITIVE_INFINITY);
    },
    finish() {
      applyThrough(Number.POSITIVE_INFINITY);
    },
  };
  return driver;
}
