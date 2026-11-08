import soul from '../../SOUL.md?raw';
import rubric from '../../READING_RUBRIC.md?raw';

// Legacy profile values remain readable; every new answer uses one standard.
export type ReadingStyle = 'plain' | 'merlin';
export const READING_STYLE_EVENT = 'natally-reading-style-change';
const storageKey = (uid: string) => `natally_reading_style_v1:${encodeURIComponent(uid)}`;
export const normalizeReadingStyle = (_value: unknown): ReadingStyle => 'plain';
export function loadReadingStyle(_accountUid?: string | null, _initialStyle?: ReadingStyle): ReadingStyle { return 'plain'; }
export function saveReadingStyle(accountUid: string, _style: ReadingStyle): void {
  if (!accountUid) return;
  try { localStorage.setItem(storageKey(accountUid), 'plain'); } catch { /* Reading remains available. */ }
  window.dispatchEvent(new Event(READING_STYLE_EVENT));
}
export function clearReadingStyle(accountUid?: string | null): void {
  if (!accountUid) return;
  try { localStorage.removeItem(storageKey(accountUid)); } catch { /* Reading remains available. */ }
  window.dispatchEvent(new Event(READING_STYLE_EVENT));
}
export function readingStylePrompt(_accountUid?: string | null, _initialStyle?: ReadingStyle): string {
  return `PROFESSIONAL READING STANDARD — applies to this answer regardless of old language settings.
${rubric}
Your voice remains the character in SOUL, even when the visitor asks a formal question.
${soul.split('## Your next spoken answer')[1]?.trim() || ''}
Apply the educational rubric while speaking this way. Start with meaning, not a list of coordinates.
`;
}
