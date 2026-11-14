import { useEffect, useId, useRef, useState } from 'react';
import { natalChart } from '../../astro/chart';
import type { NatalChart } from '../../shared/types';
import type { Voice } from '../../voice';
import { loadGazetteer } from '../../services/gazetteer';
import type { IntakeDraft } from '../../services/onboarding';
import { getPreloadedVoice } from '../../services/supertonicTts';
import OriginalFirstLight from '../../onboarding-original/FirstLight';
import { AtelierRail } from '../prototype/ImmersiveLayout';
import './onboarding.css';

const GREETING = 'Let’s find your sky.';

type Phase = 'welcome' | 'intake' | 'casting' | 'error';

/** Partial-intake stash: a submitted draft survives reloads/back so the
 * flow never dead-ends; cleared once the chart lands. */
const DRAFT_STASH = 'natally.firstlight.draft.v1';

function stashDraft(draft: IntakeDraft): void {
 try {
  sessionStorage.setItem(DRAFT_STASH, JSON.stringify(draft));
 } catch {
  // Storage unavailable: the in-memory flow still works.
 }
}

function unstashDraft(): IntakeDraft | null {
 try {
  const raw = sessionStorage.getItem(DRAFT_STASH);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return null;
  return parsed as IntakeDraft;
 } catch {
  return null;
 }
}

function clearStashedDraft(): void {
 try {
  sessionStorage.removeItem(DRAFT_STASH);
 } catch {
  // Nothing to clear.
 }
}

export default function FirstLight({ onSitDown }: { onSitDown: (chart: NatalChart) => void }) {
 const id = useId();
 const [phase, setPhase] = useState<Phase>('welcome');
 const submittedDraft = useRef<IntakeDraft | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [castSeconds, setCastSeconds] = useState(0);
 // True only while a real computation is in flight. A bfcache/back
 // restore can resurrect a 'casting' phase whose promise died with the
 // page — that stale state must fall back to the intake (whose answers
 // the restore also preserved), never wedge.
 const castInFlight = useRef(false);
 const resumed = useRef(false);

 // The line Natally should be speaking right now; updated as phases change
 // so the FIRST user gesture both admits audio and speaks it.
 const currentLine = useRef(GREETING);

 // The shared voice controller (same instance the intake's preload seam
 // warmed on mount) speaks for the whole flow, mouth and captions follow.
 const voiceRef = useRef<Voice | null>(null);
 if (voiceRef.current === null) voiceRef.current = getPreloadedVoice();
 const voice = voiceRef.current;

 useEffect(() => {
  if (phase !== 'intake') document.getElementById(`${id}-title`)?.focus({ preventScroll: true });
 }, [phase, id]);

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


 // Never leave speech running when the flow goes away.
 useEffect(() => () => voice.stop(), [voice]);

 const onCreate = async (draft: IntakeDraft) => {
  setError(null);
  submittedDraft.current = draft;
  stashDraft(draft);
  castInFlight.current = true;
  setPhase('casting');
  try {
   const place = loadGazetteer().find(entry => entry.id === draft.placeId);
   if (!place) {
    throw new Error('That birth place is no longer in the gazetteer — pick it again from the suggestions.');
   }
   const birth = {
    name: draft.name || undefined,
    dateIso: draft.date,
    timeIso: draft.unknownTime ? null : draft.time,
    place: {
     label: `${place.name}, ${place.countryCode}`,
     latitude: place.lat,
     longitude: place.lon,
     timezoneIana: place.tzid,
    },
   };
   const computed = await natalChart(birth);
   clearStashedDraft();
   voice.stop();
   onSitDown(computed);
  } catch (failure) {
   setError(
    failure instanceof Error
     ? failure.message
     : 'Casting failed — please check your answers and try again.',
   );
   setPhase('error');
  } finally {
   castInFlight.current = false;
  }
 };

// Reload/back recovery: a submitted-but-uncompleted draft is stashed;
// recompute it idempotently (same input, same wheel) so the journey
// resumes at the hand-off instead of a dead end.
useEffect(() => {
 if (resumed.current) return;
 resumed.current = true;
 const draft = unstashDraft();
 if (draft) void onCreate(draft);
}, []);

 return (
  <div className="onboarding-flow">
   {phase === 'welcome' && <AtelierRail title="Your birth chart" labelledBy={`${id}-title`}>
    <p className="atelier-body-text">{GREETING}</p>
    <button type="button" className="atelier-btn-primary" onClick={() => setPhase('intake')}>Cast my chart</button>
   </AtelierRail>}
   <div hidden={phase !== 'intake'}>
    <OriginalFirstLight gazetteer={loadGazetteer()} busy={phase !== 'intake'} error={error} onCreate={onCreate} onBack={() => setPhase('welcome')} />
   </div>
   {phase === 'casting' && <AtelierRail title="Casting your chart…" labelledBy={`${id}-title`}>
    <p className="atelier-secondary-text" data-bind="elapsed" role="status">{castSeconds}s</p>
   </AtelierRail>}
   {phase === 'error' && <AtelierRail title="Your chart could not be calculated." labelledBy={`${id}-title`} onBack={() => setPhase('intake')}>
    <div className="atelier-status-banner error" data-bind="error" role="alert">{error}</div>
    <button type="button" className="atelier-btn-primary" data-action="calculate-chart" onClick={() => {
     const draft = submittedDraft.current ?? unstashDraft();
     if (draft) void onCreate(draft);
     else setPhase('intake');
    }}>Try again</button>
    <button type="button" className="atelier-btn-secondary" onClick={() => setPhase('intake')}>Edit birth details</button>
   </AtelierRail>}
  </div>
 );
}
