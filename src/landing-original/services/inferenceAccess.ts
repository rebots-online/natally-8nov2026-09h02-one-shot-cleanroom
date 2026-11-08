import { accountStorageKey } from './accountStorage';

const keyStorageBase = 'natally_openrouter_user_key_v1';
const sourceStorageBase = 'natally_openrouter_user_key_source_v1';
export type InferenceKeySource = 'personal' | 'managed' | 'development';

export function loadInferenceKeySource(uid: string): InferenceKeySource {
  const sourceKey = accountStorageKey(sourceStorageBase, uid);
  try {
    const record = JSON.parse(sourceKey ? localStorage.getItem(sourceKey) || 'null' : 'null');
    return ['managed', 'development'].includes(record?.source) && record.key === loadInferenceKey(uid) ? record.source : 'personal';
  } catch { return 'personal'; }
}

export function loadInferenceKey(uid: string): string {
  const storageKey = accountStorageKey(keyStorageBase, uid);
  const key = storageKey ? localStorage.getItem(storageKey) || '' : '';
  const sourceKey = accountStorageKey(sourceStorageBase, uid);
  try {
    const record = JSON.parse(sourceKey ? localStorage.getItem(sourceKey) || 'null' : 'null');
    if (['development','managed'].includes(record?.source) && record.expiresAt && record.key === key && !(record.expiresAt > Date.now())) return '';
  } catch { /* Existing personal keys predate provenance records. */ }
  return key;
}

/** Personal and future billing-issued user keys share this installation contract. */
export async function installInferenceKey(uid: string, key: string, isCurrentSession: () => boolean, source: InferenceKeySource = 'personal', expiresAt?: number): Promise<void> {
  const storageKey = accountStorageKey(keyStorageBase, uid);
  if (!storageKey || !isCurrentSession()) throw new Error('The account changed. Open Account settings again.');
  const normalized = key.trim();
  if (!normalized) throw new Error('Enter your OpenRouter user key.');
  if (source === 'development' && !(Number.isFinite(expiresAt) && expiresAt! > Date.now())) throw new Error('Development reading access has expired.');
  const response = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: 'Bearer ' + normalized }, signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'OpenRouter could not validate this key.');
  if (!result.data || result.data.is_management_key) throw new Error('Use a user inference key here, rather than a management key.');
  if (!isCurrentSession()) throw new Error('The account changed. Open Account settings again.');
  const sourceKey = accountStorageKey(sourceStorageBase, uid);
  // Bind provenance to this exact key; a failed save cannot relabel an older key.
  if (sourceKey) localStorage.setItem(sourceKey, JSON.stringify({ key: normalized, source, ...(['development','managed'].includes(source) ? { expiresAt } : {}) }));
  localStorage.setItem(storageKey, normalized);
  if (loadInferenceKey(uid) !== normalized) throw new Error('This browser could not save your session. Please retry.');
}

export function removeInferenceKey(uid: string): void {
  const storageKey = accountStorageKey(keyStorageBase, uid);
  if (storageKey) localStorage.removeItem(storageKey);
  const sourceKey = accountStorageKey(sourceStorageBase, uid);
  if (sourceKey) localStorage.removeItem(sourceKey);
}
