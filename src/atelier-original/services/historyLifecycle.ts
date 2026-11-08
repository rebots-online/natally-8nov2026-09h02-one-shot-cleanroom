export const HISTORY_ERASURE_EVENT = 'natally-whole-history-erasure';
const PREFIX = 'natally.history-erasure.v1:';
export type HistoryErasureNotice = { accountUid: string; phase: 'erasing' | 'complete' | 'failed'; operation: string };
const pending = new Set<string>();
const settled = new Map<string, string>();

function publish(notice: HistoryErasureNotice) {
  if (notice.phase === 'erasing') { pending.add(notice.accountUid); settled.delete(notice.accountUid); }
  else { pending.delete(notice.accountUid); settled.set(notice.accountUid, notice.operation); }
  window.dispatchEvent(new CustomEvent<HistoryErasureNotice>(HISTORY_ERASURE_EVENT, { detail: notice }));
}

export function isNatallyHistoryErasing(uid: string | null | undefined): boolean {
  if (!uid) return false;
  if (pending.has(uid)) return true;
  try {
    const notice = JSON.parse(localStorage.getItem(PREFIX + encodeURIComponent(uid)) || 'null');
    return notice?.phase === 'erasing' && settled.get(uid) !== notice.operation;
  }
  catch { return false; }
}

export function announceHistoryErasure(notice: HistoryErasureNotice): void {
  // Notify other tabs before deletion, so stale requests cannot repopulate memory.
  localStorage.setItem(PREFIX + encodeURIComponent(notice.accountUid), JSON.stringify(notice));
  publish(notice);
}

export function finishHistoryErasure(notice: HistoryErasureNotice): void {
  try { localStorage.setItem(PREFIX + encodeURIComponent(notice.accountUid), JSON.stringify(notice)); }
  finally { publish(notice); }
}

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (!event.key?.startsWith(PREFIX) || !event.newValue) return;
  try {
    const value = JSON.parse(event.newValue) as HistoryErasureNotice;
    if (typeof value.accountUid === 'string' && ['erasing', 'complete', 'failed'].includes(value.phase)) publish(value);
  } catch { /* A malformed coordination notice cannot authorize deletion. */ }
});
