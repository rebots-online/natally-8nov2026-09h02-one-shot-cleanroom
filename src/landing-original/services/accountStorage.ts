import { isNatallyHistoryErasing } from './historyLifecycle';

/** Personal data always belongs to an explicit account; legacy keys have no owner. */
export function accountStorageKey(base: string, uid: string | null | undefined): string | null {
  return uid?.trim() ? `${base}:${encodeURIComponent(uid)}` : null;
}

export function loadAccountValue<T>(base: string, uid: string | null | undefined, fallback: T): T {
  const key = accountStorageKey(base, uid);
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch { return fallback; }
}

export function saveAccountValue<T>(base: string, uid: string | null | undefined, value: T): void {
  if (isNatallyHistoryErasing(uid)) return;
  const key = accountStorageKey(base, uid);
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
}
