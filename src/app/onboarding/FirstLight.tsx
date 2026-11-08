// First Light — the staged welcome a signed-in customer without a chart
// enters (DOCS/ARCHITECTURE.md §Surfaces; rubric F1–F7). The intake itself
// is the operator-imported original onboarding (src/onboarding-original),
// mounted unmodified — typewriter prompts and all. This wrapper is the glue
// the original's own header comment assigns to the composition: it feeds the
// gazetteer, turns the intake draft into a BirthInput and casts it with
// natalChart() (busy/error flow back into the original UI), then stages the
// reveal over the atelier scene and hands the chart to the app shell when
// the customer sits down. Voice is gesture-gated end to end: the greeting
// buffers until a real gesture admits audio, and until then the UI says so.

import { useEffect, useState } from 'react';
import { natalChart } from '../../astro/chart';
import { AstroChart } from '../../chart/AstroChart';
import { getLesson } from '../../content/lessons';
import OriginalFirstLight from '../../onboarding-original/FirstLight';
import { loadGazetteer } from '../../services/gazetteer';
import type { IntakeDraft } from '../../services/onboarding';
import { getPreloadedVoice } from '../../services/supertonicTts';
import type { NatalChart, ZodiacSign } from '../../shared/types';
import { VOICE_NOT_ADMITTED, type VoiceState } from '../../voice';
import AtelierBackdrop from '../AtelierBackdrop';
import './onboarding.css';

/** F1/F5: her greeting line — shown as the staged kicker, spoken once admitted. */
const GREETING = 'First light. Let me set the table.';

const ZODIAC: readonly ZodiacSign[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

function signOf(longitude: number): ZodiacSign {
  const normalized = ((longitude % 360) + 360) % 360;
  return ZODIAC[Math.floor(normalized / 30)];
}

/** The essence clause of a lesson title ('Sun — The Core Flame' → 'The Core Flame'). */
function essence(bodyKey: 'Sun' | 'Moon' | 'Ascendant'): string {
  const title = getLesson(bodyKey).title;
  const clause = title.split('—')[1]?.trim();
  return clause ? clause.toLowerCase() : bodyKey.toLowerCase();
}

/** F4: the placements headline and the warm one-line reading (from getLesson). */
function revealReading(chart: NatalChart): { headline: string; line: string } {
  const sun = chart.bodies.find(body => body.key === 'Sun');
  const moon = chart.bodies.find(body => body.key === 'Moon');
  const ascendant = signOf(chart.ascendant.longitude);
  if (!sun || !moon) {
    return {
      headline: `${ascendant} rising`,
      line: `${ascendant} rising at ${essence('Ascendant')} — the first page of your sky.`,
    };
  }
  return {
    headline: `Sun in ${sun.sign} · Moon in ${moon.sign} · ${ascendant} rising`,
    line: `A ${sun.sign} ${essence('Sun')}, a ${moon.sign} ${essence('Moon')}, ${ascendant} rising at ${essence('Ascendant')} — the first page of your sky.`,
  };
}

interface FirstLightProps {
  /** Called when the customer sits down: hands the finished chart upward. */
  onSitDown: (chart: NatalChart) => void;
}

export default function FirstLight({ onSitDown }: FirstLightProps) {
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [casting, setCasting] = useState(false);
  const [castError, setCastError] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    admitted: false,
    speaking: false,
    error: null,
  });

  // F5: speak the greeting through the preloaded streaming voice. Before any
  // gesture the engine buffers it and reports 'voice not admitted' — shown,
  // never hidden. The first pointerdown/keydown anywhere admits audio and the
  // buffered line starts speaking.
  useEffect(() => {
    const voice = getPreloadedVoice();
    const off = voice.onState(setVoiceState);
    voice.speakStream(GREETING);
    const admitOnGesture = () => voice.admit();
    window.addEventListener('pointerdown', admitOnGesture, { capture: true });
    window.addEventListener('keydown', admitOnGesture, { capture: true });
    return () => {
      off();
      window.removeEventListener('pointerdown', admitOnGesture, { capture: true });
      window.removeEventListener('keydown', admitOnGesture, { capture: true });
      voice.stop();
    };
  }, []);

  // The composition-owned seam: draft → BirthInput → natalChart(). While the
  // ephemeris computes, `busy` renders the original's own honest waiting
  // state plus the scene-level casting veil; failures flow back as `error`.
  async function onCreate(draft: IntakeDraft) {
    setCasting(true);
    setCastError(null);
    try {
      const entry = loadGazetteer().find(place => place.id === draft.placeId);
      if (!entry) throw new Error('Choose a birth place from the list.');
      const computed = await natalChart({
        ...(draft.name !== '' ? { name: draft.name } : {}),
        dateIso: draft.date,
        timeIso: draft.unknownTime ? null : draft.time,
        place: {
          label: `${entry.name}, ${entry.countryCode}`,
          latitude: entry.lat,
          longitude: entry.lon,
          timezoneIana: entry.tzid,
        },
      });
      setChart(computed);
      getPreloadedVoice().speakStream(revealReading(computed).line, { flush: true });
    } catch (error) {
      setCastError(
        error instanceof Error ? error.message : 'The chart could not be computed. Please try again.',
      );
    } finally {
      setCasting(false);
    }
  }

  const reading = chart === null ? null : revealReading(chart);
  const voiceNote = voiceState.speaking
    ? 'Natally is speaking…'
    : !voiceState.admitted
      ? 'Her voice waits on your first touch — the greeting speaks once you tap or press anything.'
      : voiceState.error && voiceState.error !== VOICE_NOT_ADMITTED
        ? `Voice: ${voiceState.error}`
        : null;

  return (
    <div className="first-light-glue">
      <AtelierBackdrop />

      {chart === null ? (
        <>
          <p className="first-light-greeting" aria-label={`Natally says: ${GREETING}`}>
            {GREETING}
          </p>
          <OriginalFirstLight
            gazetteer={loadGazetteer()}
            busy={casting}
            error={castError}
            onCreate={onCreate}
          />
          {casting && (
            <div className="first-light-veil" role="status" aria-live="polite">
              <span className="first-light-veil__ring" aria-hidden="true" />
              <p className="first-light-veil__line">Casting your chart…</p>
              <p className="first-light-veil__sub">
                Computing your planets with the Swiss Ephemeris, right here on your device.
              </p>
            </div>
          )}
        </>
      ) : (
        <section className="first-light-reveal" aria-label="Your chart, revealed">
          <p className="first-light-reveal__kicker">First light · the reveal</p>
          <h2 className="first-light-reveal__title">Here is your sky</h2>
          <div className="first-light-reveal__chart">
            <AstroChart chart={chart} />
          </div>
          {reading && (
            <>
              <p className="first-light-reveal__headline">{reading.headline}</p>
              <p className="first-light-reveal__line">{reading.line}</p>
            </>
          )}
          <button
            type="button"
            className="btn primary wide first-light-reveal__cta"
            onClick={() => onSitDown(chart)}
          >
            Sit down with Natally
          </button>
        </section>
      )}

      {voiceNote && (
        <p className="first-light-voice" role="status" aria-live="polite">
          {voiceNote}
        </p>
      )}
    </div>
  );
}
