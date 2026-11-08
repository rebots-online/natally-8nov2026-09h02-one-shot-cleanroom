// First-light composition (DOCS/RUBRIC-landing-firstlight-2026-11-08.md,
// F1–F7): the signed-in, no-chart-yet onboarding, mounted by the app shell
// as <FirstLight onSitDown={setChart} />. The five-question intake itself is
// the VERBATIM src/onboarding-original/FirstLight.tsx; everything here is
// glue around it — the atelier scene, the welcome stage, the honest casting
// moment while the ephemeris computes, the reveal of the real chart with a
// warm one-line reading, and Natally's voice (gesture-gated, with a truthful
// notice whenever audio is not admitted).
//
// Completion hands the computed NatalChart to the shell (onSitDown), which
// persists it per-customer and mounts the atelier layout — chart panel plus
// the chat that reads from the same chart state.
import { useEffect, useRef, useState } from 'react';
import { natalChart } from '../../astro/chart';
import { computeAstrolabeChart, type NatalChartResult } from '../../chart/astrolabeInput';
import { Astrolabe3D } from '../../atelier-original/components/Astrolabe3D';
import { AtelierScene } from '../../atelier-original/components/atelier/AtelierScene';
import type { NatalChart, ZodiacSign } from '../../shared/types';
import type { Voice, VoiceState } from '../../voice';
import { loadGazetteer } from '../../services/gazetteer';
import type { IntakeDraft } from '../../services/onboarding';
import { getPreloadedVoice } from '../../services/supertonicTts';
import { withPerformanceEvents } from '../voicePerformance';
import OriginalFirstLight from '../../onboarding-original/FirstLight';
import './onboarding.css';

const SIGNS: readonly ZodiacSign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

/** Tropical sign of an ecliptic longitude in degrees. */
function signOf(longitude: number): ZodiacSign {
  return SIGNS[Math.floor((((longitude % 360) + 360) % 360) / 30)];
}

const GREETING =
  "Hi hi — I'm Natally. Tell me when and where you were born and we'll cast your first chart together; I already cleared a space on the table. Oh, and the stuff on my shelves? Grabbable. All of it. I only side-eye a little.";

/** The one-line reveal reading: the real luminaries and ascendant. */
function revealLine(chart: NatalChart): string {
  const sun = chart.bodies.find(body => body.key === 'Sun')?.sign;
  const moon = chart.bodies.find(body => body.key === 'Moon')?.sign;
  const rising = signOf(chart.ascendant.longitude);
  const name = chart.input.name ? `, ${chart.input.name}` : '';
  return (
    `First light${name}: Sun in ${sun ?? '…'}, Moon in ${moon ?? '…'}, ${rising} rising — ` +
    "okay so that's main-character warmth, secretly-soft insides, and a door that opens onto adventure? Unfair, actually. This wheel is yours — want to walk it together?"
  );
}

type Phase = 'welcome' | 'intake' | 'casting' | 'reveal';

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
  const [phase, setPhase] = useState<Phase>('welcome');
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [wheel, setWheel] = useState<NatalChartResult | null>(null);
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
  const resumed = useRef(false);

  // The line Natally should be speaking right now; updated as phases change
  // so the FIRST user gesture both admits audio and speaks it.
  const currentLine = useRef(GREETING);

  // The shared voice controller (same instance the intake's preload seam
  // warmed on mount) speaks for the whole flow, mouth and captions follow.
  const voiceRef = useRef<Voice | null>(null);
  if (voiceRef.current === null) voiceRef.current = withPerformanceEvents(getPreloadedVoice());
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

  // At the reveal, the current line becomes the reading (spoken at once when
  // audio is admitted, or on the next gesture when it is not).
  useEffect(() => {
    if (phase === 'reveal' && chart) {
      const line = revealLine(chart);
      currentLine.current = line;
      if (voice.admitted) {
        voice.stop();
        voice.speakStream(line, { flush: true });
      }
    }
  }, [phase, chart, voice]);

  // Never leave speech running when the flow goes away.
  useEffect(() => () => voice.stop(), [voice]);

  const onCreate = async (draft: IntakeDraft) => {
    setError(null);
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
      const [computed, wheel] = await Promise.all([
        natalChart(birth),
        computeAstrolabeChart(birth),
      ]);
      clearStashedDraft();
      setChart(computed);
      setWheel(wheel);
      setPhase('reveal');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Casting failed — please check your answers and try again.',
      );
      setPhase('intake');
    } finally {
      castInFlight.current = false;
    }
  };

  // Reload/back recovery: a submitted-but-uncompleted draft is stashed;
  // recompute it idempotently (same input, same wheel) so the journey
  // resumes at the reveal instead of a dead end.
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const draft = unstashDraft();
    if (draft) void onCreate(draft);
  }, []);

  const enterAtelier = () => {
    if (!chart) return;
    voice.stop();
    onSitDown(chart);
  };

  if (phase === 'welcome') {
    return (
      <>
        <div className="scene-mount" aria-hidden="true">
          <AtelierScene phase="idle" motionEnabled accountUid={null} />
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
              onClick={() => setPhase('intake')}
            >
              Cast my first chart
            </button>
            <VoiceNote state={voiceState} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="scene-mount" aria-hidden="true">
        <AtelierScene phase="idle" motionEnabled accountUid={null} />
      </div>
      {/* The verbatim intake; kept mounted (hidden) while casting so a failed
          cast returns to the customer's answers exactly as they left them. */}
      <div hidden={phase === 'casting'}>
        <OriginalFirstLight
          gazetteer={loadGazetteer()}
          busy={phase === 'casting'}
          error={error}
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
            <p className="casting-elapsed" aria-hidden="true">
              {castSeconds}s
            </p>
          </div>
        </section>
      )}

      {phase === 'reveal' && chart && (
        <section className="onboarding reveal" aria-live="polite">
          <div className="onboarding-card reveal-card">
            <div className="reveal-chart" data-chart-callout-boundary data-chart-inset="true">
              {wheel ? (
                <Astrolabe3D chart={wheel} isSpinning={false} resetTrigger={0} />
              ) : (
                <div className="chart-loading" role="status">
                  Casting the wheel…
                </div>
              )}
            </div>
            <p className="welcome-kicker">First light</p>
            <h2>{chart.input.name ? `First light, ${chart.input.name}.` : 'First light.'}</h2>
            <p className="reveal-line">{revealLine(chart)}</p>
            <button type="button" className="btn primary wide" onClick={enterAtelier}>
              Talk with Natally
            </button>
            <VoiceNote state={voiceState} />
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
