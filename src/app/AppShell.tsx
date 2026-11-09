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

import {
 Suspense,
 lazy,
 useEffect,
 useLayoutEffect,
 useMemo,
 useReducer,
 useRef,
 useState,
 type MouseEvent as ReactMouseEvent,
} from 'react';
import type { User } from 'firebase/auth';
import {
 authUnavailable,
 describeSignInFailure,
 googleSignIn,
 onAuthChange,
 redirectSignInFailure,
 signOutNow,
} from '../platform/firebase';
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
import { useAllowance, type ReplyEvent } from './chat/useChat';
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
 | {
  status: 'signedIn';
  uid: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
 };

/** Close the nearest <details> menu after one of its items is used. */
function closeMenuDetails(event: ReactMouseEvent<HTMLElement>): void {
 event.currentTarget.closest('details')?.removeAttribute('open');
}

/** The one signed-in top bar (NAV-1): wordmark home left, credit balance
 *  and the account avatar right — Account / Top up / Keepsake report /
 *  Sign out — folding into a standard menu button on narrow screens. */
function StageHeader({
 auth,
 balanceCr,
 onAccount,
 onTopUp,
 onKeepsake,
 onSignOut,
 front = false,
}: {
 auth: Extract<AuthState, { status: 'signedIn' }>;
 balanceCr: string;
 onAccount: () => void;
 onTopUp: () => void;
 onKeepsake: () => void;
 onSignOut: () => void;
 front?: boolean;
}) {
 const avatar = auth.photoUrl !== null
  ? <img className="app-avatar" src={auth.photoUrl} alt="" referrerPolicy="no-referrer" />
  : <span className="app-avatar app-avatar--initial" aria-hidden="true">
   {auth.name.slice(0, 1).toUpperCase()}
  </span>;
 const menuItems = [
  { label: 'Account', run: onAccount },
  { label: 'Top up', run: onTopUp },
  { label: 'Keepsake report', run: onKeepsake },
  { label: 'Sign out', run: onSignOut },
 ];
 return (
  <header className={front ? 'app-header app-header--front' : 'app-header'}>
   <a className="app-brand" href="/">
    Natally <span className="app-brand-sub">· the atelier</span>
   </a>
   <div className="app-header-actions">
    {balanceCr !== '' && (
     <button
      type="button"
      className="app-balance"
      onClick={onTopUp}
      aria-label={`Credit balance ${balanceCr}. Open Top up.`}
     >
      {balanceCr}
     </button>
    )}
    <details className="app-account">
     <summary aria-label={`Account — ${auth.name}`}>{avatar}</summary>
     <div className="app-account__menu">
      <span className="app-account__name">{auth.name}</span>
      {menuItems.map(item => (
       <button
        key={item.label}
        type="button"
        className="app-menuitem"
        onClick={event => {
         closeMenuDetails(event);
         item.run();
        }}
       >
        {item.label}
       </button>
      ))}
     </div>
    </details>
    <details className="app-burger">
     <summary aria-haspopup="menu" aria-label="Menu">☰</summary>
     <div className="app-burger__panel">
      {balanceCr !== '' && <span className="app-burger__balance">{balanceCr}</span>}
      <span className="app-account__name">{auth.name}</span>
      {menuItems.map(item => (
       <button
        key={item.label}
        type="button"
        className="app-menuitem"
        onClick={event => {
         closeMenuDetails(event);
         item.run();
        }}
       >
        {item.label}
       </button>
      ))}
     </div>
    </details>
   </div>
  </header>
 );
}

/** Account panel opened from the avatar menu: who is signed in, their live
 *  credit balance, and the account actions. Every action is wired. */
function AccountPanel({
 auth,
 balanceCr,
 onClose,
 onTopUp,
 onKeepsake,
 onSignOut,
}: {
 auth: Extract<AuthState, { status: 'signedIn' }>;
 balanceCr: string;
 onClose: () => void;
 onTopUp: () => void;
 onKeepsake: () => void;
 onSignOut: () => void;
}) {
 useEffect(() => {
  const onKey = (event: KeyboardEvent) => {
   if (event.key === 'Escape') onClose();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
 }, [onClose]);
 return (
  <div className="sheet-backdrop" onClick={onClose}>
   <section
    className="sheet account-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Your account"
    onClick={event => event.stopPropagation()}
   >
    <header className="sheet-head">
     <h2>Your account</h2>
     <button type="button" className="btn ghost small" onClick={onClose}>
      Close
     </button>
    </header>
    <dl className="account-panel__facts">
     <dt>Signed in as</dt>
     <dd>{auth.name}</dd>
     {auth.email !== null && (
      <>
       <dt>Email</dt>
       <dd>{auth.email}</dd>
      </>
     )}
     <dt>Credit balance</dt>
     <dd>{balanceCr === '' ? 'Reading your balance…' : balanceCr}</dd>
    </dl>
    <div className="account-panel__actions">
     <button type="button" className="btn primary" onClick={onTopUp}>
      Top up
     </button>
     <button type="button" className="btn ghost" onClick={onKeepsake}>
      Keepsake report
     </button>
     <button type="button" className="btn ghost" onClick={onSignOut}>
      Sign out
     </button>
    </div>
   </section>
  </div>
 );
}

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
 const [accountOpen, setAccountOpen] = useState(false);
 // Header credit balance (NAV-1): the same ledger the chat reads.
 const allowance = useAllowance();
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

 // The opening reading reveals word by word as she speaks it (karaoke
 // boundaries); null shows the whole line, a number is the visible prefix.
 const [openingReveal, setOpeningReveal] = useState<number | null>(null);
 const revealActiveRef = useRef(false);
 const revealCursorRef = useRef(0);
 const beginOpeningReveal = () => {
  revealCursorRef.current = 0;
  revealActiveRef.current = true;
  setOpeningReveal(0);
 };
 const endOpeningReveal = () => {
  if (!revealActiveRef.current) return;
  revealActiveRef.current = false;
  setOpeningReveal(null);
 };

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
  if (event.phase === 'begin') {
   // A new utterance supersedes the opening: her words are all visible.
   endOpeningReveal();
   driver.begin(voice.admitted);
  } else if (event.phase === 'delta') driver.update(event.text, event.cues);
  else if (event.phase === 'final') driver.end();
  else driver.finish();
 };

 // Her spoken word boundaries advance the cues.
 useEffect(() => {
  const onKaraoke = (event: Event) => {
   const detail = (event as CustomEvent<KaraokeDetail>).detail;
   if (detail === undefined) return;
   driverRef.current?.spoken({
    line: detail.line,
    wordIndex: detail.wordIndex,
    wordCount: detail.wordCount,
   });
   // While she speaks the opening reading, its words appear as said.
   if (revealActiveRef.current && openingClean !== null) {
    let at = openingClean.indexOf(detail.line, revealCursorRef.current);
    if (at < 0) at = openingClean.indexOf(detail.line);
    if (at >= 0) {
     const words = [...detail.line.matchAll(/\S+/g)];
     const wordStart =
      detail.wordIndex >= 0 && detail.wordIndex < words.length
       ? words[detail.wordIndex].index ?? detail.line.length
       : detail.line.length;
     revealCursorRef.current = at + detail.line.length;
     setOpeningReveal(at + wordStart);
    }
   }
  };
  window.addEventListener('natally-karaoke', onKaraoke);
  return () => window.removeEventListener('natally-karaoke', onKaraoke);
 }, [openingClean]);

 // When her speech ends, whatever it never reached is applied now.
 const speakingRef = useRef(false);
 useEffect(
  () =>
   voice.onState(state => {
    if (speakingRef.current && !state.speaking) {
     driverRef.current?.finish();
     endOpeningReveal();
    }
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
   beginOpeningReveal();
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
   beginOpeningReveal();
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
  () => ({
   voice,
   opening,
   onReply: handleReplyEvent,
   revealedOpening:
    openingReveal === null || openingClean === null ? null : openingClean.slice(0, openingReveal),
  }),
  [voice, opening, openingReveal, openingClean],
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
       email: user.email ?? null,
       photoUrl: user.photoURL ?? null,
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
   // Specific, plain-language outcome (cancellation included) shown in
   // the card, right under the button they tapped.
   setSignInError(describeSignInFailure(error));
  }
 }

 // NAV-1 account menu: sign out returns to the sign-in screen; the auth
 // observer clears the chart and identity state.
 const handleSignOut = async () => {
  setAccountOpen(false);
  try {
   await signOutNow();
  } catch {
   // Auth unavailable: nothing is signed in to sign out.
  }
 };

 // A redirect sign-in that came back failed (popup was blocked, domain
 // unauthorized, network…) surfaces here once, where they clicked.
 useEffect(() => {
  if (auth.status !== 'signedOut' || authUnavailable) return;
  let live = true;
  void redirectSignInFailure().then(message => {
   if (live && message !== null) setSignInError(message);
  });
  return () => {
   live = false;
  };
 }, [auth.status]);

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

    {/* NAV-1: one top bar — wordmark home at the left, the account
            action at the right; on narrow screens the action folds into a
            standard menu button. */}
    <header className="app-header app-header--front">
     <a className="app-brand" href="/">
      Natally <span className="app-brand-sub">· the atelier</span>
     </a>
     {!auth.unavailable && (
      <div className="app-header-actions">
       <button
        type="button"
        className="btn primary small app-header__signin"
        disabled={signingIn}
        onClick={() => void signIn()}
       >
        {signingIn ? 'Signing in…' : 'Sign in'}
       </button>
       <details className="app-burger">
        <summary aria-haspopup="menu" aria-label="Menu">☰</summary>
        <div className="app-burger__panel">
         <button
          type="button"
          className="btn primary"
          disabled={signingIn}
          onClick={() => void signIn()}
         >
          {signingIn ? 'Signing in…' : 'Sign in'}
         </button>
         {signInError && (
          <p className="app-burger__error" role="alert">{signInError}</p>
         )}
        </div>
       </details>
      </div>
     )}
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
    {/* The same one top bar stays over first light (NAV-1): overlay, so
            the verbatim intake layout below is untouched. */}
    <StageHeader
     auth={auth}
     balanceCr={allowance.balanceCr}
     onAccount={() => setAccountOpen(true)}
     onTopUp={() => setTopUpOpen(true)}
     onKeepsake={() => setSouvenirOpen(true)}
     onSignOut={() => void handleSignOut()}
     front
    />
    <FirstLight onSitDown={setChart} />
    {accountOpen && (
     <AccountPanel
      auth={auth}
      balanceCr={allowance.balanceCr}
      onClose={() => setAccountOpen(false)}
      onTopUp={() => {
       setAccountOpen(false);
       setTopUpOpen(true);
      }}
      onKeepsake={() => {
       setAccountOpen(false);
       setSouvenirOpen(true);
      }}
      onSignOut={() => void handleSignOut()}
     />
    )}
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
    <StageHeader
     auth={auth}
     balanceCr={allowance.balanceCr}
     onAccount={() => setAccountOpen(true)}
     onTopUp={() => setTopUpOpen(true)}
     onKeepsake={() => setSouvenirOpen(true)}
     onSignOut={() => void handleSignOut()}
    />

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
       bodyCount={chart.bodies.length}
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

   {accountOpen && (
    <AccountPanel
     auth={auth}
     balanceCr={allowance.balanceCr}
     onClose={() => setAccountOpen(false)}
     onTopUp={() => {
      setAccountOpen(false);
      setTopUpOpen(true);
     }}
     onKeepsake={() => {
      setAccountOpen(false);
      setSouvenirOpen(true);
     }}
     onSignOut={() => void handleSignOut()}
    />
   )}

   {souvenirOpen && (
    <Suspense fallback={null}>
     <SouvenirDialog chart={chart} onClose={() => setSouvenirOpen(false)} />
    </Suspense>
   )}
   <VersionBadge />
  </div>
 );
}
