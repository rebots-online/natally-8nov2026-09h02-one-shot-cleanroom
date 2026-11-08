// App shell for /app.html (DOCS/ARCHITECTURE.md §Surfaces). State machine:
//   signed-out (onAuthChange)  → Google sign-in card over the verbatim
//                                atelier scene (src/atelier-original)
//   signed-in without a chart  → first-light onboarding: welcome, the
//                                verbatim FirstLight intake, an honest
//                                casting moment, then the chart reveal
//                                (src/app/onboarding hands the chart back)
//   signed-in with a chart     → the verbatim ReadingStage: the original
//                                atelier (hero-scale Natally, breakable
//                                trinkets, armillary) with our AstroChart
//                                as the draggable inset and ChatPanel in
//                                the conversation slot. The chart is kept
//                                per-customer in localStorage so a reload
//                                doesn't demand re-entering birth data.

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { authUnavailable, googleSignIn, onAuthChange } from '../platform/firebase';
import type { BirthInput, ChartBodyKey, NatalChart } from '../shared/types';
import { composeLiveReading } from '../chart/liveReading';
import type { Voice } from '../voice';
import { getPreloadedVoice } from '../services/supertonicTts';
import { withPerformanceEvents } from './voicePerformance';
import { computeAstrolabeChart, type NatalChartResult } from '../chart/astrolabeInput';
import { Astrolabe3D } from '../atelier-original/components/Astrolabe3D';
import { getLesson } from '../content/lessons';
import { ReadingStage } from '../atelier-original/components/ReadingStage';
import { AtelierScene } from '../atelier-original/components/atelier/AtelierScene';
import type { PresentationState, PresentationView } from '../atelier-original/services/presentation';
import { ChatPanel } from './chat/ChatPanel';
import FirstLight from './onboarding/FirstLight';
import VersionBadge from './VersionBadge';
import TopUpSheet from './TopUpSheet';
import './app-shell.css';

// The keepsake tree (report authoring + PDF export) is heavy; the dynamic
// import keeps it out of the app entry chunk and is the seam shared with the
// souvenir task.
const SouvenirDialog = lazy(() =>
  import('../souvenir/SouvenirDialog').then(mod => ({ default: mod.SouvenirDialog })),
);

type AuthState =
  | { status: 'unknown' }
  | { status: 'signedOut'; unavailable: boolean }
  | { status: 'signedIn'; uid: string; name: string };

const CHART_STORE_PREFIX = 'natally.chart.v1:';

function isNatalChart(value: unknown): value is NatalChart {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const input = candidate.input;
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as Record<string, unknown>).dateIso === 'string' &&
    Array.isArray(candidate.bodies)
  );
}

function loadStoredChart(uid: string): NatalChart | null {
  try {
    const raw = localStorage.getItem(CHART_STORE_PREFIX + uid);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isNatalChart(parsed) ? parsed : null;
  } catch {
    // Unreadable or corrupt storage: fall back to the birth form.
    return null;
  }
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'unknown' });
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [hoveredKey, setHoveredKey] = useState<ChartBodyKey | null>(null);
  const [view, setView] = useState<PresentationView>('atelier');
  const [paused, setPaused] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [souvenirOpen, setSouvenirOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  // The original renderer's view of the same sky: computed with its own
  // pipeline from the same birth data the clean-room chart persists.
  const [astrolabe, setAstrolabe] = useState<NatalChartResult | null>(null);
  // Bespoke click reading: authored lesson + today's sky, computed on the
  // spot when a body is clicked in the wheel.
  const [liveReading, setLiveReading] = useState<{ planet: string; text: string | null } | null>(null);
  const skyForChart = useRef<Promise<NatalChartResult> | null>(null);

  // Today's sky for the click readings: the same verbatim pipeline cast for
  // this moment at the customer's birth place, computed at most once per
  // chart and shared by every click.
  const skyToday = (birth: BirthInput): Promise<NatalChartResult> => {
    skyForChart.current ??= computeAstrolabeChart({
      ...birth,
      dateIso: new Date().toISOString().slice(0, 10),
      timeIso: new Date().toTimeString().slice(0, 5),
    });
    return skyForChart.current;
  };

  useEffect(() => {
    let live = true;
    setAstrolabe(null);
    skyForChart.current = null;
    if (chart !== null) {
      computeAstrolabeChart(chart.input)
        .then(result => {
          if (live) setAstrolabe(result);
        })
        .catch(() => {
          // The renderer pane keeps its honest loading line.
          if (live) setAstrolabe(null);
        });
    }
    return () => {
      live = false;
    };
  }, [chart]);

  // Clicks in the wheel get a bespoke reading: authored lesson + today's
  // sky computed on the spot, spoken in her voice (mouth follows via the
  // performance bridge).
  const voiceRef = useRef<Voice | null>(null);
  if (voiceRef.current === null) voiceRef.current = withPerformanceEvents(getPreloadedVoice());
  const voice = voiceRef.current;

  const explainPlanet = (name: string | null) => {
    const key = (name as ChartBodyKey | null) ?? null;
    setHoveredKey(key);
    if (!key || chart === null) {
      setLiveReading(null);
      return;
    }
    const natalBody = chart.bodies.find(body => body.key === key);
    if (!natalBody) {
      setLiveReading(null);
      return;
    }
    setLiveReading({ planet: key, text: null });
    void skyToday(chart.input)
      .then(today => {
        const current = today.natalBodies.find(body => body.name === key) ?? null;
        const text = composeLiveReading(
          key,
          { sign: natalBody.sign, lon: natalBody.position.longitude },
          current ? { sign: current.signName, lon: current.lon } : null,
        );
        setLiveReading({ planet: key, text });
        if (voice.admitted) {
          voice.stop();
          voice.speakStream(text, { flush: true });
        }
      })
      .catch(() => {
        // Degrade truthfully to the authored lesson alone.
        setLiveReading({
          planet: key,
          text: composeLiveReading(key, { sign: natalBody.sign, lon: natalBody.position.longitude }, null),
        });
      });
  };
  useEffect(() => {
    if (authUnavailable) {
      setAuth({ status: 'signedOut', unavailable: true });
      return;
    }
    try {
      return onAuthChange((user: User | null) => {
        setSignInError(null);
        setSigningIn(false);
        setAuth(
          user
            ? {
                status: 'signedIn',
                uid: user.uid,
                name: user.displayName ?? user.email ?? 'stargazer',
              }
            : { status: 'signedOut', unavailable: false },
        );
      });
    } catch {
      setAuth({ status: 'signedOut', unavailable: true });
    }
  }, []);

  // Load the stored chart on sign-in; drop it from memory on sign-out.
  useEffect(() => {
    if (auth.status !== 'signedIn') {
      setChart(null);
      return;
    }
    setChart(loadStoredChart(auth.uid));
  }, [auth]);

  // Persist the chart for the signed-in customer.
  useEffect(() => {
    if (auth.status !== 'signedIn' || chart === null) return;
    try {
      localStorage.setItem(CHART_STORE_PREFIX + auth.uid, JSON.stringify(chart));
    } catch {
      // Storage unavailable (private mode/quota): the chart lives in memory.
    }
  }, [auth, chart]);

  async function signIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      await googleSignIn();
    } catch (error) {
      setSigningIn(false);
      setSignInError(
        error instanceof Error ? error.message : 'Sign-in failed. Please try again.',
      );
    }
  }

  if (auth.status === 'unknown') {
    return (
      <div className="app-splash" role="status">
        Opening the atelier…
        <VersionBadge />
      </div>
    );
  }

  if (auth.status === 'signedOut') {
    return (
      <>
        <div className="scene-mount" aria-hidden="true">
          <AtelierScene phase="idle" motionEnabled accountUid={null} />
        </div>

        <header className="app-header app-header--front">
          <h1 className="app-brand">
            Natally <span className="app-brand-sub">· the atelier</span>
          </h1>
          <div className="app-header-actions">
            <a className="topbar-link" href="/">
              Back to the landing ↗
            </a>
          </div>
        </header>
        <div className="app-intake">
          <div className="card">
            <img
              className="sign-in-portrait"
              src="/natally-mascot.webp"
              alt="Natally, the atelier astrologer"
            />
            <h1>Natally</h1>
            <p className="card-intro">
              An astrologer who keeps an atelier for your chart. Sign in and she’ll cast it
              with you, then talk it over — planets, houses, and all.
            </p>
            {auth.unavailable ? (
              <p className="note warn">
                Sign-in isn’t available on this deployment — Firebase isn’t configured.
              </p>
            ) : (
              <button
                type="button"
                className="btn primary wide"
                disabled={signingIn}
                onClick={() => void signIn()}
              >
                {signingIn ? 'Signing in…' : 'Sign in with Google'}
              </button>
            )}
            {signInError && (
              <p className="note error" role="alert">
                {signInError}
              </p>
            )}
          </div>
        </div>
        <VersionBadge />
      </>
    );
  }

  if (chart === null) {
    return (
      <>
        <FirstLight onSitDown={setChart} />
        <VersionBadge />
      </>
    );
  }

  const lesson = getLesson(hoveredKey ?? 'general');
  const presentation: PresentationState = {
    chartKey: `${chart.input.dateIso}|${chart.input.place.label}|${chart.input.timeIso ?? 'unknown'}`,
    selectedTargets: [],
    focusTargets: [],
    view,
    panel: 'conversation',
    follow: true,
    sequence: 0,
    lastReceipt: null,
  };

  return (
    <div className="app-main">
      <div className="app-frame">
        <header className="app-header">
          <h1 className="app-brand">
            Natally <span className="app-brand-sub">· the atelier</span>
          </h1>
          <div className="app-header-actions">
            <span className="app-greeting">{auth.name}</span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setSouvenirOpen(true)}
            >
              Keepsake…
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setTopUpOpen(true)}
            >
              Top up
            </button>
          </div>
        </header>

        <div className="app-stage">
          <ReadingStage
            accountUid={auth.uid}
            presentation={presentation}
            phase="idle"
            paused={paused}
            onPause={setPaused}
            onView={setView}
            chart={
              astrolabe ? (
                <Astrolabe3D
                  chart={astrolabe}
                  isSpinning={false}
                  resetTrigger={0}
                  selectedPlanetName={hoveredKey}
                  onSelectPlanet={explainPlanet}
                />
              ) : (
                <div className="chart-loading" role="status">
                  Casting the wheel…
                </div>
              )
            }
            conversation={
              <>
                <ChatPanel chart={chart} onTopUp={() => setTopUpOpen(true)} />
                <section className="lesson-card" aria-live="polite">
                  <p className="lesson-kicker">
                    {liveReading
                      ? `Her reading · ${liveReading.planet}, live`
                      : hoveredKey !== null
                        ? `You’re hovering · ${hoveredKey}`
                        : 'From Natally’s notebook'}
                  </p>
                  <h3>{lesson.title}</h3>
                  <p className="lesson-body">
                    {liveReading?.text ?? lesson.what}
                  </p>
                  {!liveReading && <p className="lesson-question">{lesson.question}</p>}
                </section>
              </>
            }
          />
        </div>
      </div>

      {topUpOpen && <TopUpSheet onClose={() => setTopUpOpen(false)} />}

      {souvenirOpen && (
        <Suspense fallback={null}>
          <SouvenirDialog chart={chart} onClose={() => setSouvenirOpen(false)} />
        </Suspense>
      )}
      <VersionBadge />
    </div>
  );
}
