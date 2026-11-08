// App shell for /app.html (DOCS/ARCHITECTURE.md §Surfaces + §First reveal
// and speech-driven presentation). State machine:
//   signed-out (onAuthChange)  → Google sign-in card over the verbatim
//                                atelier scene (src/atelier-original)
//   signed-in without a chart  → first-light onboarding: welcome, the
//                                verbatim FirstLight intake, an honest
//                                casting moment — casting hands the chart
//                                straight to this stage (no separate wheel)
//   signed-in with a chart     → the verbatim ReadingStage (hero-scale
//                                Natally, breakable trinkets, armillary)
//                                with the chart in our clean-room inset
//                                and ChatPanel in the conversation slot.
// The stage opens with Natally reading the chart aloud as her first chat
// message (gesture-gated audio, truthful note when not admitted); her
// hidden cues drive highlight → focus → un-highlight and the chart⇄inset
// swap as her voice reaches them; a manual view choice stops automatic
// view cues. The chart is kept per-customer in localStorage so a reload
// doesn't demand re-entering birth data.

import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { authUnavailable, googleSignIn, onAuthChange } from '../platform/firebase';
import type { BirthInput, ChartBodyKey, NatalChart } from '../shared/types';
import { composeLiveReading } from '../chart/liveReading';
import type { KaraokeDetail, Voice } from '../voice';
import { getPreloadedVoice } from '../services/supertonicTts';
import { computeAstrolabeChart, type NatalChartResult } from '../chart/astrolabeInput';
import { Astrolabe3D } from '../atelier-original/components/Astrolabe3D';
import { getLesson } from '../content/lessons';
import { ReadingStage } from '../atelier-original/components/ReadingStage';
import { Inset } from './stage/Inset';
import { useStageVisualHeight } from './stage/stageMetrics';
import { AtelierScene } from '../atelier-original/components/atelier/AtelierScene';
import type { PresentationView as StageView } from '../atelier-original/services/presentation';
import {
  initialPresentation,
  presentationReducer,
  type PresentationState,
  type PresentationView,
} from './presentation/state';
import { createPlayback, type PlaybackDriver } from './presentation/playback';
import { parseReply, type Cue } from './presentation/cues';
import { openingReading } from './presentation/opening';
import { chartTargets } from './chat/context';
import type { ReplyEvent } from './chat/useChat';
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
  const [presentation, dispatch] = useReducer(presentationReducer, initialPresentation);
  const stageRootRef = useRef<HTMLDivElement | null>(null);
  const stageVisualHeight = useStageVisualHeight(stageRootRef);
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

  // Her voice, warmed by the onboarding's preload seam.
  const voiceRef = useRef<Voice | null>(null);
  if (voiceRef.current === null) voiceRef.current = getPreloadedVoice();
  const voice = voiceRef.current;

  const chartKey =
    chart === null
      ? ''
      : `${chart.input.dateIso}|${chart.input.place.label}|${chart.input.timeIso ?? 'unknown'}`;

  // A new chart on the table resets the stage.
  useEffect(() => {
    if (chartKey !== '') dispatch({ type: 'chart', key: chartKey });
  }, [chartKey]);

  // The opening reading: her first chat message, spoken as the stage opens.
  const opening = useMemo(() => (chart === null ? null : openingReading(chart)), [chart]);
  const openingClean = useMemo(() => {
    if (chart === null || opening === null) return null;
    return parseReply(opening, chartTargets(chart)).text;
  }, [chart, opening]);

  // Cues cross as her voice reaches them: the driver applies each one, the
  // karaoke word boundaries set the frontier, speech's end flushes the rest.
  const sawCueViewRef = useRef(false);
  const driverRef = useRef<PlaybackDriver | null>(null);
  if (driverRef.current === null) {
    driverRef.current = createPlayback((cue: Cue) => {
      if (cue.action.type === 'view') {
        sawCueViewRef.current = true;
        dispatch({ type: 'view', view: cue.action.view });
      } else if (cue.action.type === 'focus') {
        dispatch({ type: 'focus', targets: cue.action.targets });
      } else {
        dispatch({ type: 'clear' });
      }
    });
  }

  const handleReplyEvent = (event: ReplyEvent) => {
    const driver = driverRef.current;
    if (driver === null) return;
    if (event.phase === 'begin') driver.begin(voice.admitted);
    else if (event.phase === 'delta') driver.update(event.text, event.cues);
    else if (event.phase === 'final') driver.end();
    else driver.finish();
  };

  // Her spoken word boundaries advance the cues.
  useEffect(() => {
    const onKaraoke = (event: Event) => {
      const detail = (event as CustomEvent<KaraokeDetail>).detail;
      if (detail !== undefined) {
        driverRef.current?.spoken({
          line: detail.line,
          wordIndex: detail.wordIndex,
          wordCount: detail.wordCount,
        });
      }
    };
    window.addEventListener('natally-karaoke', onKaraoke);
    return () => window.removeEventListener('natally-karaoke', onKaraoke);
  }, []);

  // When her speech ends, whatever it never reached is applied now.
  const speakingRef = useRef(false);
  useEffect(
    () =>
      voice.onState(state => {
        if (speakingRef.current && !state.speaking) driverRef.current?.finish();
        speakingRef.current = state.speaking;
      }),
    [voice],
  );

  // Gesture-gated opening speech: browsers keep audio silent until a real
  // pointer/key gesture admits it; already-admitted sessions speak at once.
  const openingSpokenRef = useRef(false);
  useEffect(() => {
    openingSpokenRef.current = false;
    sawCueViewRef.current = false;
  }, [chartKey]);
  useEffect(() => {
    if (openingClean === null || voice.admitted || openingSpokenRef.current) return;
    const admit = () => {
      if (openingSpokenRef.current) return;
      openingSpokenRef.current = true;
      voice.admit();
      voice.speakStream(openingClean, { flush: true });
    };
    window.addEventListener('pointerdown', admit, { once: true });
    window.addEventListener('keydown', admit, { once: true });
    return () => {
      window.removeEventListener('pointerdown', admit);
      window.removeEventListener('keydown', admit);
    };
  }, [openingClean, voice]);
  useEffect(() => {
    if (openingClean !== null && voice.admitted && !openingSpokenRef.current) {
      openingSpokenRef.current = true;
      voice.speakStream(openingClean, { flush: true });
    }
  }, [openingClean, voice]);

  // First-load inversion (a stage too small for both panes): the chart
  // takes focus and Natally becomes the inset, until she or the customer
  // drives the stage themselves.
  const handleAutoInvert = (invert: boolean) => {
    if (sawCueViewRef.current) return;
    dispatch({ type: 'view', view: invert ? 'chart' : 'atelier' });
  };

  // A manual view choice (the stage's own controls) always wins.
  const handleStageView = (next: StageView) => {
    if (next === 'chart' || next === 'atelier') {
      sawCueViewRef.current = true;
      dispatch({ type: 'view', view: next, manual: true });
    }
  };

  const chatStage = useMemo(
    () => ({ voice, opening, onReply: handleReplyEvent }),
    [voice, opening],
  );

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
  const view = presentation.view;
  // The body she is highlighting (if any) lights up in the wheel itself;
  // every target also rides the inset's bar as brass chips.
  const focusBody =
    chart.bodies.find(body => presentation.focusTargets.includes(body.key))?.key ?? null;

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

        <div className="app-stage stage-inset-root" ref={stageRootRef}>
          <ReadingStage
            accountUid={auth.uid}
            presentation={presentation}
            phase="idle"
            paused={paused}
            onPause={setPaused}
            onView={handleStageView}
            chart={null}
            conversation={
              <>
                <ChatPanel chart={chart} onTopUp={() => setTopUpOpen(true)} stage={chatStage} />
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
          {/* The clean-room inset (ARCHITECTURE §Chart inset): the chart
              floats over the stage here, in place of the verbatim stage's
              own chart pane; when the chart is focused the wheel fills the
              visual area and Natally becomes the floating pane. */}
          <div
            className="stage-inset-layer"
            data-mode={view === 'chart' ? 'fill' : 'float'}
          >
            <Inset
              storageKey={`natally.inset.v1:${auth.uid}`}
              label="Your wheel"
              focused={view === 'chart'}
              fillHeight={stageVisualHeight}
              targets={presentation.focusTargets}
              onAutoInvert={handleAutoInvert}
            >
              {astrolabe ? (
                <Astrolabe3D
                  chart={astrolabe}
                  isSpinning={false}
                  resetTrigger={0}
                  selectedPlanetName={hoveredKey ?? focusBody}
                  onSelectPlanet={explainPlanet}
                />
              ) : (
                <div className="chart-loading" role="status">
                  Casting the wheel…
                </div>
              )}
            </Inset>
          </div>
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
