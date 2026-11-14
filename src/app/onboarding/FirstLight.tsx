import { useEffect, useId, useRef, useState } from 'react';
import { natalChart } from '../../astro/chart';
import type { NatalChart } from '../../shared/types';
import type { Voice } from '../../voice';
import { loadGazetteer } from '../../services/gazetteer';
import type { IntakeDraft } from '../../services/onboarding';
import { getPreloadedVoice } from '../../services/supertonicTts';
import OriginalFirstLight from '../../onboarding-original/FirstLight';
import {
 completeFirebaseOnboardingProgress, completeOnboardingProgress, createOnboardingProgress,
 firstMissingOnboardingStep, intakeDraftFromProgress, ONBOARDING_STEPS,
 saveFirebaseOnboardingStep, saveOnboardingProgress,
 type OnboardingProgress, type OnboardingStep,
} from '../../services/onboardingProgress';
import { AtelierRail } from '../prototype/ImmersiveLayout';
import './onboarding.css';

const GREETING = 'Let’s find your sky.';
type Phase = 'intake' | 'casting' | 'error';

export interface OnboardingProps {
 accountUid: string;
 initialProgress: OnboardingProgress | null;
 storageError: string | null;
 onSitDown: (chart: NatalChart) => boolean;
 onCancel?: () => void;
 onStorageError?: (message: string) => void;
 onProgress?: (progress: OnboardingProgress) => void;
}

export default function FirstLight({
 accountUid, initialProgress, storageError, onSitDown, onCancel, onStorageError, onProgress,
}: OnboardingProps) {
 const id = useId();
 const progress = useRef(initialProgress ?? createOnboardingProgress(accountUid));
 const needsQuestions = firstMissingOnboardingStep(progress.current, loadGazetteer()) < ONBOARDING_STEPS.length;
 const [phase, setPhase] = useState<Phase>(needsQuestions ? 'intake' : 'casting');
 const [saveError, setSaveError] = useState<string | null>(storageError);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [castSeconds, setCastSeconds] = useState(0);
 const alive = useRef(true);
 const attempt = useRef(0);
 const castInFlight = useRef(false);
 const currentLine = useRef(GREETING);
 const voiceRef = useRef<Voice | null>(null);
 if (voiceRef.current === null) voiceRef.current = getPreloadedVoice();
 const voice = voiceRef.current;

 useEffect(() => {
  if (phase !== 'intake') document.getElementById(id + '-title')?.focus({ preventScroll: true });
 }, [phase, id]);

 useEffect(() => {
  const admit = () => {
   if (voice.admitted) return;
   voice.admit();
   voice.speakStream(currentLine.current, { flush: true });
  };
  window.addEventListener('pointerdown', admit, { once: true });
  window.addEventListener('keydown', admit, { once: true });
  return () => {
   window.removeEventListener('pointerdown', admit);
   window.removeEventListener('keydown', admit);
  };
 }, [voice]);

 useEffect(() => {
  if (phase !== 'casting') return;
  setCastSeconds(0);
  const start = performance.now();
  const timer = window.setInterval(() => setCastSeconds(Math.floor((performance.now() - start) / 1000)), 1000);
  return () => window.clearInterval(timer);
 }, [phase]);

 useEffect(() => {
  const recover = () => {
   if (!castInFlight.current) setPhase(current => current === 'casting' ? 'error' : current);
  };
  window.addEventListener('pageshow', recover);
  document.addEventListener('visibilitychange', recover);
  return () => {
   window.removeEventListener('pageshow', recover);
   document.removeEventListener('visibilitychange', recover);
  };
 }, []);

 const reportProgress = (next: OnboardingProgress) => {
  if (!alive.current || next.accountUid !== accountUid) return;
  progress.current = next;
  const warning = saveOnboardingProgress(next);
  setSaveError(warning);
  onProgress?.(next);
  if (warning) onStorageError?.(warning);
 };

 const accept = async (next: OnboardingProgress, step: OnboardingStep) => {
  if (!alive.current || next.accountUid !== accountUid) throw new Error('Onboarding was closed.');
  const generation = attempt.current;
  setSaving(true);
  try {
   await saveFirebaseOnboardingStep(next, step);
   if (!alive.current || generation !== attempt.current) throw new Error('Onboarding was closed.');
   reportProgress(next);
  } finally {
   if (alive.current && generation === attempt.current) setSaving(false);
  }
 };

 const onCreate = async (_draft: IntakeDraft) => {
  if (!alive.current || castInFlight.current) return;
  const draft = intakeDraftFromProgress(progress.current, loadGazetteer());
  if (!draft) return;
  const submitted = { ...progress.current, status: 'submitted' as const };
  reportProgress(submitted);
  const generation = ++attempt.current;
  castInFlight.current = true;
  setError(null);
  setPhase('casting');
  try {
   const place = loadGazetteer().find(entry => entry.id === draft.placeId);
   if (!place) throw new Error('Choose your birthplace from the suggestions.');
   const computed = await natalChart({
    name: draft.name || undefined, dateIso: draft.date,
    timeIso: draft.unknownTime ? null : draft.time,
    place: {
     label: place.name + ', ' + place.countryCode,
     latitude: place.lat, longitude: place.lon, timezoneIana: place.tzid,
    },
   });
   if (!alive.current || generation !== attempt.current) return;
   if (!onSitDown(computed)) {
    setError('Your replacement chart could not be saved. Your existing chart and submitted answers have been kept.');
    setPhase('error');
    return;
   }
   const completion = completeFirebaseOnboardingProgress(submitted);
   const warning = completeOnboardingProgress(submitted);
   progress.current = { ...submitted, status: 'complete' };
   onProgress?.(progress.current);
   if (warning) onStorageError?.(warning);
   void completion.catch(failure => {
    if (!alive.current || generation !== attempt.current) return;
    const message = failure instanceof Error ? failure.message : 'Your chart is ready, but its completion status could not be saved.';
    setSaveError(message);
    onStorageError?.(message);
   });
   voice.stop();
  } catch (failure) {
   if (!alive.current || generation !== attempt.current) return;
   setError(failure instanceof Error ? failure.message : 'Casting failed. Your completed answers have been kept.');
   setPhase('error');
  } finally {
   if (generation === attempt.current) castInFlight.current = false;
  }
 };

 useEffect(() => {
  alive.current = true;
  const draft = intakeDraftFromProgress(progress.current, loadGazetteer());
  if (draft) void onCreate(draft);
  return () => {
   alive.current = false;
   attempt.current += 1;
   castInFlight.current = false;
   voice.stop();
  };
 }, [accountUid]);

 const leave = () => {
  if (saving) return;
  alive.current = false;
  attempt.current += 1;
  voice.stop();
  onCancel?.();
 };

 return (
  <div className="onboarding-flow">
   {onCancel && <button type="button" className="atelier-btn-secondary" disabled={saving} onClick={leave}>Return to my chart</button>}
   {saveError && <p className="atelier-status-banner error" role="alert">{saveError}</p>}
   {needsQuestions && <div hidden={phase !== 'intake'}>
    <OriginalFirstLight
     gazetteer={loadGazetteer()} busy={phase !== 'intake' || saving} error={error}
     initialProgress={progress.current} onProgress={reportProgress}
     onAccept={accept} onCreate={onCreate} onBack={onCancel ? leave : undefined}
    />
   </div>}
   {phase === 'casting' && <AtelierRail title="Casting your chart…" labelledBy={id + '-title'}>
    <p className="atelier-secondary-text" data-bind="elapsed" role="status">{castSeconds}s</p>
   </AtelierRail>}
   {phase === 'error' && <AtelierRail title="Your chart could not be calculated." labelledBy={id + '-title'}>
    <div className="atelier-status-banner error" data-bind="error" role="alert">{error ?? 'Chart preparation was interrupted. Your completed answers are ready.'}</div>
    <button type="button" className="atelier-btn-primary" data-action="calculate-chart" onClick={() => {
     const draft = intakeDraftFromProgress(progress.current, loadGazetteer());
     if (draft) void onCreate(draft);
    }}>Try again</button>
   </AtelierRail>}
  </div>
 );
}
