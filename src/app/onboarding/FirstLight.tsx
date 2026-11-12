// First-light composition (DOCS/RUBRIC-landing-firstlight-2026-11-08.md,
// F1–F7): the signed-in, no-chart-yet onboarding, mounted by the app shell
// through the account-owned progress seam. The five-question intake retains
// the src/onboarding-original/FirstLight.tsx presentation; everything here is
// glue around it — the atelier scene, the welcome stage, the honest casting
// moment while the ephemeris computes, and Natally's voice (gesture-gated,
// with a truthful notice whenever audio is not admitted).
//
// Casting completes → the chart is handed straight to the app stage
// (onSitDown): no separate wheel is ever drawn over Natally; the only chart
// on screen is the stage's, where she reads it aloud as her first message.
import { useEffect, useRef, useState } from 'react';
import { natalChart } from '../../astro/chart';
import { AtelierScene } from '../../atelier-original/components/atelier/AtelierScene';
import type { NatalChart } from '../../shared/types';
import type { Voice, VoiceState } from '../../voice';
import { loadGazetteer } from '../../services/gazetteer';
import type { IntakeDraft } from '../../services/onboarding';
import { getPreloadedVoice } from '../../services/supertonicTts';
import OriginalFirstLight from '../../onboarding-original/FirstLight';
import { completeOnboardingProgress, createOnboardingProgress, intakeDraftFromProgress, saveOnboardingProgress, type OnboardingProgress } from '../../services/onboardingProgress';
import './onboarding.css';

const GREETING =
 "Hi hi — I'm Natally. Tell me when and where you were born and we'll cast your first chart together; I already cleared a space on the table for you, and the candles are behaving.";

type Phase = 'welcome' | 'intake' | 'casting';

export interface OnboardingProps {
 accountUid: string;
 initialProgress: OnboardingProgress | null;
 storageError: string | null;
 onSitDown: (chart: NatalChart) => boolean;
 onCancel?: () => void;
 onStorageError?: (message: string) => void;
}

export default function FirstLight({ accountUid, initialProgress, storageError, onSitDown, onCancel, onStorageError }: OnboardingProps) {
 const progress = useRef(initialProgress ?? createOnboardingProgress(accountUid));
 const [phase, setPhase] = useState<Phase>(initialProgress ? 'intake' : 'welcome');
 const [saveError, setSaveError] = useState<string | null>(storageError);
 const alive = useRef(false);
 const attempt = useRef(0);
 const [error, setError] = useState<string | null>(null);
 const [castSeconds, setCastSeconds] = useState(0);
 const [voiceState, setVoiceState] = useState<VoiceState>({
  admitted: false,
  speaking: false,
  error: null,
 });
 // True only while a real computation is in flight. A bfcache/back
 // restore can resurrect a 'casting' phase whose promise died with the
 // page — that stale state must fall back to the intake (whose answers
 // the restore also preserved), never wedge.
 const castInFlight = useRef(false);

 // The line Natally should be speaking right now; updated as phases change
 // so the FIRST user gesture both admits audio and speaks it.
 const currentLine = useRef(GREETING);

 // The shared voice controller (same instance the intake's preload seam
 // warmed on mount) speaks for the whole flow, mouth and captions follow.
 const voiceRef = useRef<Voice | null>(null);
 if (voiceRef.current === null) voiceRef.current = getPreloadedVoice();
 const voice = voiceRef.current;

 useEffect(() => voice.onState(setVoiceState), [voice]);

 // First user gesture anywhere in the flow admits audio and speaks the
 // current line. Browsers require this to run inside a real event handler.
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

 // Honest elapsed time while the ephemeris works — no fake progress bar.
 useEffect(() => {
  if (phase !== 'casting') return;
  setCastSeconds(0);
  const startedAt = performance.now();
  const timer = window.setInterval(() => {
   setCastSeconds(Math.floor((performance.now() - startedAt) / 1000));
  }, 1000);
  return () => window.clearInterval(timer);
 }, [phase]);

 // Back/forward recovery: a bfcache restore can resurrect a 'casting'
 // phase whose computation died with the previous page. Any 'casting'
 // state without a live computation falls back to the intake — answers
 // survive the restore, so the customer resumes exactly where they were.
 useEffect(() => {
  const recover = () => {
   if (!castInFlight.current) setPhase(current => (current === 'casting' ? 'intake' : current));
  };
  window.addEventListener('pageshow', recover);
  document.addEventListener('visibilitychange', recover);
  return () => {
   window.removeEventListener('pageshow', recover);
   document.removeEventListener('visibilitychange', recover);
  };
 }, []);


 const reportProgress = (next: OnboardingProgress) => {
  progress.current = next;
  setSaveError(saveOnboardingProgress(next));
 };

 const onCreate = async (draft: IntakeDraft) => {
  const submitted = { ...progress.current, status: 'submitted' as const };
  reportProgress(submitted);
  const generation = ++attempt.current;
  setError(null);
  castInFlight.current = true;
  setPhase('casting');
  try {
   const place = loadGazetteer().find(entry => entry.id === draft.placeId);
   if (!place) throw new Error('That birth place is no longer in the gazetteer — pick it again from the suggestions.');
   const computed = await natalChart({
    name: draft.name || undefined,
    dateIso: draft.date,
    timeIso: draft.unknownTime ? null : draft.time,
    place: {
     label: `${place.name}, ${place.countryCode}`,
     latitude: place.lat, longitude: place.lon, timezoneIana: place.tzid,
    },
   });
   if (!alive.current || generation !== attempt.current) return;
   // The shell writes the UID-owned chart synchronously before this completes
   // the answer record. A failed chart write keeps the submitted recovery data.
   if (onSitDown(computed)) {
    const failure = completeOnboardingProgress(submitted);
    if (failure) { setSaveError(failure); onStorageError?.(failure); }
   } else {
    setError('Your replacement chart could not be saved. Your existing chart and submitted answers have been kept. You can retry or return to your chart.');
    setPhase('intake');
   }
   voice.stop();
  } catch (failure) {
   if (!alive.current || generation !== attempt.current) return;
   setError(failure instanceof Error ? failure.message : 'Casting failed — please check your answers and try again.');
   setPhase('intake');
  } finally {
   if (generation === attempt.current) castInFlight.current = false;
  }
 };

 // A complete submitted snapshot resumes calculation, never its questions.
 // Cleanup invalidates late promises, including React's development replay.
 useEffect(() => {
  alive.current = true;
  const draft = intakeDraftFromProgress(progress.current, loadGazetteer());
  if (draft && progress.current.status !== 'draft') void onCreate(draft);
  return () => {
   alive.current = false;
   attempt.current += 1;
   castInFlight.current = false;
   voice.stop();
  };
 }, [accountUid]);

 const leave = () => {
  alive.current = false;
  attempt.current += 1;
  onCancel?.();
 };

 if (phase === 'welcome') {
  return (
   <>
    <div className="scene-mount" aria-hidden="true">
     <AtelierScene phase="idle" motionEnabled accountUid={accountUid} />
    </div>
    <div className="onboarding">
     <div className="onboarding-card welcome-card">
      <img
       className="welcome-mascot"
       src="/natally-mascot.webp"
       alt="Natally, the atelier astrologer"
       draggable={false}
      />
      <p className="welcome-kicker">First light</p>
      <h1>Welcome to the atelier — I&rsquo;m Natally.</h1>
      <p className="welcome-line">{GREETING}</p>
      <button
       type="button"
       className="btn primary wide"
       onClick={() => { reportProgress(progress.current); setPhase('intake'); }}
      >
       Cast my first chart
      </button>
      <VoiceNote state={voiceState} />
      {saveError && <p className="note error" role="alert">{saveError}</p>}
     </div>
    </div>
   </>
  );
 }

 return (
  <>
   <div className="scene-mount" aria-hidden="true">
    <AtelierScene phase="idle" motionEnabled accountUid={accountUid} />
   </div>
   {onCancel && (
    <div style={{ position: 'fixed', top: '5rem', left: '1rem', zIndex: 60 }}>
     <button type="button" className="btn ghost small" onClick={leave}>Return to my chart</button>
    </div>
   )}
   {/* Preserve answers for an error retry without covering the reveal
          with the completed full-screen intake. */}
   <div hidden={phase !== 'intake'}>
    <OriginalFirstLight
     gazetteer={loadGazetteer()}
     busy={phase === 'casting'}
     error={error ?? saveError}
     initialProgress={progress.current}
     onProgress={reportProgress}
     onCreate={onCreate}
    />
   </div>
   {phase === 'casting' && (
    <section className="onboarding casting" role="status" aria-live="polite">
     <div className="onboarding-card casting-card">
      <img className="casting-mascot" src="/natally-mascot.webp" alt="" draggable={false} />
      <h2>Casting your chart…</h2>
      <p>
       Swiss Ephemeris, computed right here on your device — no server
       sees your birth data.
      </p>
      {saveError && <p className="note error" role="alert">{saveError}</p>}
      <p className="casting-elapsed" aria-hidden="true">
       {castSeconds}s
      </p>
     </div>
    </section>
   )}
  </>
 );
}

/** Truthful voice status — the unadmitted state is never silently missing. */
function VoiceNote({ state }: { state: VoiceState }) {
 const status = state.admitted
  ? state.speaking
   ? 'Natally is speaking.'
   : 'Voice is on.'
  : 'Voice waits for your first tap or key — browsers keep sound behind a gesture.';
 return (
  <p className="voice-note" role="note">
   {status}
   {state.error ? ` ${state.error}` : ''}
  </p>
 );
}
