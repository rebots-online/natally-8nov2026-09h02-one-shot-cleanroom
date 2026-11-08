// Presentation cues (DOCS/ARCHITECTURE.md §First reveal and speech-driven
// presentation). Natally's replies carry hidden commands at the passage they
// govern:  [[view:chart]]  [[view:atelier]]  [[chart:Sun;Moon]]  [[chart:clear]]
// They are removed from display and speech; each keeps the exact offset in
// the cleaned text where it takes effect.

import type { PresentationView } from '../../atelier-original/services/presentation';

export type CueAction =
 | { type: 'focus'; targets: string[] }
 | { type: 'clear' }
 | { type: 'view'; view: PresentationView };

export interface Cue {
 /** Offset in the cleaned text where the action takes effect. */
 offset: number;
 action: CueAction;
}

export interface ParsedReply {
 /** Text with every cue removed: what is shown and spoken. */
 text: string;
 cues: Cue[];
}

const CUE = /\[\[(chart|view):([^\]\r\n]*)\]\]/gi;
const MAX_TARGETS = 6;

/**
 * Strip cues from (possibly partial) streamed text. An unterminated `[[…`
 * at the end is held back so half a command is never shown or spoken.
 * Targets outside `inventory` are dropped; a focus cue with none left is
 * discarded.
 */
export function parseReply(raw: string, inventory: ReadonlySet<string>): ParsedReply {
 const open = raw.lastIndexOf('[[');
 if (open >= 0 && raw.indexOf(']]', open) < 0) raw = raw.slice(0, open);
 else if (raw.endsWith('[')) raw = raw.slice(0, -1);

 const cues: Cue[] = [];
 let text = '';
 let cursor = 0;
 for (const match of raw.matchAll(CUE)) {
  text += raw.slice(cursor, match.index);
  cursor = match.index! + match[0].length;
  const kind = match[1].toLowerCase();
  const payload = match[2].trim();
  let action: CueAction | null = null;
  if (kind === 'view') {
   const view = payload.toLowerCase();
   if (view === 'chart' || view === 'atelier') action = { type: 'view', view };
  } else if (payload.toLowerCase() === 'clear') {
   action = { type: 'clear' };
  } else {
   const targets = [...new Set(payload.split(';').map(t => t.trim()))]
    .filter(t => inventory.has(t))
    .slice(0, MAX_TARGETS);
   if (targets.length > 0) action = { type: 'focus', targets };
  }
  if (action) cues.push({ offset: text.length, action });
 }
 text += raw.slice(cursor);
 return { text, cues };
}
