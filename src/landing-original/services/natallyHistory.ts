import { accountStorageKey } from './accountStorage';
import { clearAccountReadingAudio } from './readingAudio';
import { eraseAtelierHistory } from './atelierMemories';
import { announceHistoryErasure, finishHistoryErasure } from './historyLifecycle';

const onboardingRestartKey = (accountUid: string) => accountStorageKey('natally_onboarding_restart_v1', accountUid)!;

export function requiresFreshOnboarding(accountUid: string): boolean {
  return !!accountUid && localStorage.getItem(onboardingRestartKey(accountUid)) === 'required';
}

export function completeFreshOnboarding(accountUid: string): void {
  localStorage.removeItem(onboardingRestartKey(accountUid));
}

/** This checkout stores conversation/lore/audio/atelier locally; cloud intake is preserved. */
export async function eraseWholeNatallyHistory(accountUid: string, isCurrentAccount: () => boolean): Promise<void> {
  if (!accountUid || !isCurrentAccount()) throw new Error('Sign in to the account whose history you want to erase.');
  const operation = crypto.randomUUID();
  const erased: string[] = [];
  try {
    announceHistoryErasure({ accountUid, operation, phase: 'erasing' });
    await clearAccountReadingAudio(accountUid, isCurrentAccount);
    erased.push('saved reading audio');
    const stores = [
      ['astrosphere_natally_chat_history_v3', 'conversation history'],
      ['natally_user_disclosures_v1', 'user disclosures'],
      ['natally_character_lore_v1', 'Natally’s character memories'],
      ['astrosphere_user_lore_v1', 'profile lore'],
    ];
    for (const [base, label] of stores) {
      if (!isCurrentAccount()) throw new Error('The account changed during erasure.');
      const key = accountStorageKey(base, accountUid)!;
      localStorage.removeItem(key);
      if (localStorage.getItem(key) !== null) throw new Error(`${label} could not be erased.`);
      erased.push(label);
    }
    if (!isCurrentAccount()) throw new Error('The account changed during erasure.');
    // Damage may disappear only together with all preceding Natally history.
    eraseAtelierHistory(accountUid);
    erased.push('atelier history');
    localStorage.setItem(onboardingRestartKey(accountUid), 'required');
    finishHistoryErasure({ accountUid, operation, phase: 'complete' });
  } catch (error) {
    try { finishHistoryErasure({ accountUid, operation, phase: 'failed' }); } catch { /* Preserve the actual erasure failure below. */ }
    const reason = error instanceof Error ? error.message : 'Browser storage could not be accessed.';
    throw new Error(erased.length
      ? `Erasure was only partial. Erased: ${erased.join(', ')}. ${erased.includes('atelier history') ? 'The atelier was also reset.' : 'The atelier history has not been reset.'} ${reason} Retry whole-history erasure to finish.`
      : `No history was erased. ${reason}`);
  }
}
