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
// view cues. A tap on a chart component rides that same driver through
// explainTarget; a tap on empty inset swaps the panes. The chart is kept
// per-customer in localStorage so a reload doesn't demand re-entering
// birth data.

import {
 Suspense,
 lazy,
 useCallback,
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
 googleSignInForIdToken,
 onAuthChange,
 redirectSignInFailure,
 signInWithGoogleIdToken,
 signOutNow,
} from '../platform/firebase';
import type { BirthInput, NatalChart } from '../shared/types';
import type { SkyPlacement } from '../chart/liveReading';
import type { KaraokeDetail, Voice } from '../voice';
import { getPreloadedVoice } from '../services/supertonicTts';
import { computeAstrolabeChart, type NatalChartResult } from '../chart/astrolabeInput';
import { natalChart } from '../astro/chart';
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
import { explainTarget } from './presentation/explain';
import { chartTargets } from './chat/context';
import { useAllowance, type ReplyEvent } from './chat/useChat';
import { ChatPanel } from './chat/ChatPanel';
import FirstLight from './onboarding/FirstLight';
import KaraokeCaption from './karaokeCaption';
import { nextSpontaneousStory } from '../content/backstory';
import { LandingCards, LANDING_SECTIONS } from './landing/LandingCards';
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

/* The landing (ARCHITECTURE §12.1 + §16 pending LANDING rows): the
 * signed-out page below is astronatally.com's landing. On the hosts in
 * PRODUCT_LANDING_HOSTS a successful sign-in continues on the app domain,
 * asknatally.online, with the Google ID token handed over in the URL
 * fragment (#gid=… — a fragment is never sent to a server); on any host a
 * signed-out load carrying that fragment consumes it at once. The natal
 * chart on the landing stage is cast from the birth data below through the
 * shared pipeline (computeAstrolabeChart); it carries no person's name. */
/* The room pane while the chart fills the landing stage (§12.1 4c): a
 * corner card showing Natally whole, always inside the window. On narrow
 * screens the stage is the top band (landing.css), so the pane floors at a
 * readable size instead of the desktop formula's ~86 px sliver. */
const LANDING_ROOM_PANE_WIDTH = 'min(22vw, 34vh * 1.6, 320px)';
const LANDING_ROOM_PANE_WIDTH_NARROW = 'min(42vw, 200px)';
const LANDING_ROOM_PANE_ASPECT = 1.6;
/* §12.1 4c: focusing and unfocusing glide — both panes animate together
 * over ~450 ms (eased). The room pane carries this duration on its inline
 * transition; the chart's matching 450 ms rule lives in landing.css
 * (scoped to this stage) beside the inset's own 200 ms default. */
const LANDING_SWAP_MS = 450;
const LANDING_SWAP_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
/* §12.1 5b: her welcome once voice is admitted — her register, and (5c) no
 * word about shelves, trinkets, grabbing or breaking anywhere in it. */
const LANDING_WELCOME =
  "Hello — I'm Natally, and this is my atelier. Sit with me a while. I read natal charts aloud, and I show you every part of yours as I go. When you're ready, we'll cast yours together.";
/* §12.1 5b: her authored stories arrive when the room is quiet — the same
 * sparing cadence the signed-in conversation uses (useChat's idle story). */
const LANDING_STORY_IDLE_MS = 60_000;
/* §12.1 5c (standing operator rule): no story that mentions shelves,
 * trinkets, grabbing, breaking or rehearsing is ever spoken on the landing;
 * discovery stays the customer's. nextSpontaneousStory serves the shared
 * round-robin cursor, so blocked entries are skipped, not deleted. */
const LANDING_STORY_BLOCKLIST = /\b(shel(f|ves)|trinkets?|grab(bed|bing)?|broke(n)?|break(ing|s)?|rehears\w*)\b/i;
const LANDING_STORY_MAX_PICKS = 12;
/* The narrow-screen media query landing.css keys its in-flow stage band to. */
const LANDING_NARROW_QUERY = '(max-width: 760px)';
const PRODUCT_LANDING_HOSTS: readonly string[] = ['astronatally.com', 'www.astronatally.com'];
const GID_FRAGMENT = 'gid';
const EXAMPLE_BIRTH: BirthInput = {
 dateIso: '1988-08-31',
 timeIso: '14:30',
 place: {
  label: 'Toronto, Ontario, Canada',
  latitude: 43.6532,
  longitude: -79.3832,
  timezoneIana: 'America/Toronto',
 },
};
/* First-load placement of the landing's two floating panes (§12.1 4c, 5a),
 * seeded through the placement each pane already restores from — never a
 * second placement system. The chart card opens in a bottom-left corner —
 * the side away from the card column, clear of Natally (her head sits at
 * the horizontal middle of the artwork, so the left third of the stage is
 * empty room) — at a size above the inset's glyph-legibility floor
 * (min(36vw, 64vh) ≥ 461px at both operator widths, floor 460px); her room
 * card opens in the same corner when the chart takes the stage. Each pane
 * keeps its own drag/resize behaviour and the visitor's own saved choice
 * always wins — this only writes the key when it is absent. */
const LANDING_INSET_STORAGE_KEY = 'natally.inset.v1:landing';
const LANDING_ROOM_POSITION_STORAGE_KEY = `${import.meta.env.VITE_APP_NAMESPACE ?? 'natally'}.inset-position.landing`;

function seedLandingPanePlacements(): void {
  try {
    if (localStorage.getItem(LANDING_INSET_STORAGE_KEY) === null) {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      // The inset measures the chart stage's box, and on narrow screens the
      // stage is the in-flow top band (landing.css), not the window — seed
      // fractions against the box the card will actually restore into.
      const stageHeight = window.matchMedia(LANDING_NARROW_QUERY).matches
        ? Math.min(height * 0.62, 560)
        : height;
      const size = Math.min(width * 0.36, stageHeight * 0.64);
      const marginX = Math.max(16, width * 0.04);
      const marginY = Math.max(16, stageHeight * 0.04);
      localStorage.setItem(
        LANDING_INSET_STORAGE_KEY,
        JSON.stringify({
          mode: 'floating',
          x: marginX / width,
          y: (stageHeight - marginY - size) / stageHeight,
          w: size / width,
        }),
      );
    }
    if (localStorage.getItem(LANDING_ROOM_POSITION_STORAGE_KEY) === null) {
      localStorage.setItem(LANDING_ROOM_POSITION_STORAGE_KEY, JSON.stringify({ x: 0, y: 1 }));
    }
  } catch {
    // Storage unavailable (private mode): each pane falls back to its own
    // default placement.
  }
}

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
 const [presentation, dispatch] = useReducer(presentationReducer, initialPresentation);
 const stageRootRef = useRef<HTMLDivElement | null>(null);
 const stageVisualHeight = useStageVisualHeight(stageRootRef);
 // The landing stage's own root and visual height: the same arrangement
 // (ReadingStage + inset layer), mounted full-bleed on the signed-out page.
 const landingStageRootRef = useRef<HTMLDivElement | null>(null);
 const landingStageVisualHeight = useStageVisualHeight(landingStageRootRef);
 const [paused, setPaused] = useState(false);
 const [topUpOpen, setTopUpOpen] = useState(false);
 const [souvenirOpen, setSouvenirOpen] = useState(false);
 const [signingIn, setSigningIn] = useState(false);
 const [signInError, setSignInError] = useState<string | null>(null);
 // The landing (§12.1): its own presentation state drives the same stage
 // arrangement the signed-in page uses — ReadingStage's two panes plus the
 // clean-room inset — plus the #gid= handoff status, the renderer's chart
 // and the clean-room NatalChart that explains it.
 const [landingPresentation, dispatchLanding] = useReducer(
  presentationReducer,
  initialPresentation,
 );
 // The stage the landing shows: the chart focused (filling the stage, the
 // room floating) or the atelier, from the landing's presentation state.
 const landingChartFocused = landingPresentation.view === 'chart';
 const [gidHandoffSigningIn, setGidHandoffSigningIn] = useState(false);
 const [exampleChart, setExampleChart] = useState<NatalChartResult | null>(null);
 const [exampleNatal, setExampleNatal] = useState<NatalChart | null>(null);
 const [accountOpen, setAccountOpen] = useState(false);
 // Header credit balance (NAV-1): the same ledger the chat reads.
 const allowance = useAllowance();
 // The original renderer's view of the same sky: computed with its own
 // pipeline from the same birth data the clean-room chart persists.
 const [astrolabe, setAstrolabe] = useState<NatalChartResult | null>(null);
 const skyForChart = useRef<Promise<NatalChartResult> | null>(null);
 // Today's sky for the landing's click readings (§12.1 4b), kept apart from
 // the signed-in chart's sky.
 const landingSkyRef = useRef<Promise<NatalChartResult> | null>(null);
 // Narrow-screen layout (landing.css lays the stage out in flow as a top
 // band): drives the room pane's corner size so Natally stays readable when
 // the chart fills the stage (§12.1 4c).
 const [landingNarrow, setLandingNarrow] = useState(
  () => typeof window.matchMedia === 'function' && window.matchMedia(LANDING_NARROW_QUERY).matches,
 );
 useEffect(() => {
  if (typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia(LANDING_NARROW_QUERY);
  const onChange = () => setLandingNarrow(query.matches);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
 }, []);

 // Her voice, warmed by the onboarding's preload seam.
 const voiceRef = useRef<Voice | null>(null);
 if (voiceRef.current === null) voiceRef.current = getPreloadedVoice();
 const voice = voiceRef.current;

 // ---- Her living room on the landing (§12.1 5b) ----
 // Once voice is admitted she welcomes the visitor (once); after that,
 // each time the room falls quiet again for LANDING_STORY_IDLE_MS she
 // speaks one of her authored stories. Every word she says on the landing
 // is lipsynced by the atelier scene (the verbatim character follows the
 // voice engine's word events) and shown as her words by the karaoke
 // caption at the page's foot. A tap's passage stands the welcome down
 // for the race — see landingExplainTap.
 const landingWelcomeSpokenRef = useRef(false);
 const landingStoryTimerRef = useRef<number | undefined>(undefined);
 const clearLandingStoryTimer = () => {
  window.clearTimeout(landingStoryTimerRef.current);
  landingStoryTimerRef.current = undefined;
 };
 const speakLandingLine = (line: string) => {
  voice.speakStream(line, { flush: true });
 };
 const scheduleLandingStory = useCallback(() => {
  clearLandingStoryTimer();
  landingStoryTimerRef.current = window.setTimeout(() => {
   landingStoryTimerRef.current = undefined;
   // The next authored story the standing immersion rule allows (§12.1
   // 5c); if the whole round-robin turn is blocked, this quiet moment
   // passes in silence — never a word about the room's magic.
   for (let pick = 0; pick < LANDING_STORY_MAX_PICKS; pick += 1) {
    const story = nextSpontaneousStory();
    if (!LANDING_STORY_BLOCKLIST.test(story)) {
     speakLandingLine(story);
     return;
    }
   }
  }, LANDING_STORY_IDLE_MS);
 }, [voice]);
 useEffect(() => {
  if (auth.status !== 'signedOut') return;
  const unsubscribe = voice.onState(state => {
   if (!state.admitted) return;
   if (state.speaking) {
    clearLandingStoryTimer();
    return;
   }
   // Voice admitted and the room just went quiet: her welcome first
   // (once), then a story each further time the quiet settles.
   if (!landingWelcomeSpokenRef.current) {
    landingWelcomeSpokenRef.current = true;
    speakLandingLine(LANDING_WELCOME);
    return;
   }
   scheduleLandingStory();
  });
  return () => {
   unsubscribe();
   clearLandingStoryTimer();
  };
 }, [auth.status, voice, scheduleLandingStory]);

 // The landing's first gesture admits her voice — the same rule as the
 // signed-in opening — so her welcome can arrive (§12.1 5b); a first
 // gesture that is a chart tap explains instead (see landingExplainTap).
 useEffect(() => {
  if (auth.status !== 'signedOut' || voice.admitted) return;
  const admit = () => voice.admit();
  window.addEventListener('pointerdown', admit, { once: true });
  window.addEventListener('keydown', admit, { once: true });
  return () => {
   window.removeEventListener('pointerdown', admit);
   window.removeEventListener('keydown', admit);
  };
 }, [auth.status, voice]);

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

 // The landing's own driver (§12.1 4b, 4c): a tapped component's passage
 // rides the same cue→speech playback, but drives the landing's
 // presentation state — highlights, and the view swaps her passage asks
 // for as her voice reaches them. Her view cues are dispatched as manual
 // choices: the passage began with the visitor's tap, and while she
 // explains her words own the view — to the chart when she points at it,
 // back to her when she speaks to you — regardless of any earlier manual
 // choice (which would otherwise turn cue-following off for good).
 const landingDriverRef = useRef<PlaybackDriver | null>(null);
 if (landingDriverRef.current === null) {
  landingDriverRef.current = createPlayback((cue: Cue) => {
   if (cue.action.type === 'view') {
    dispatchLanding({ type: 'view', view: cue.action.view, manual: true });
   } else if (cue.action.type === 'focus') {
    dispatchLanding({ type: 'focus', targets: cue.action.targets });
   } else {
    dispatchLanding({ type: 'clear' });
   }
  });
 }
 const handleLandingReplyEvent = (event: ReplyEvent) => {
  const driver = landingDriverRef.current;
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
   if (detail === undefined) return;
   driverRef.current?.spoken({
    line: detail.line,
    wordIndex: detail.wordIndex,
    wordCount: detail.wordCount,
   });
   landingDriverRef.current?.spoken({
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
     landingDriverRef.current?.finish();
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

 // A tap on a chart component (INSET): her passage about it — authored
 // material + live placement, cues embedded — rides the same reply driver
 // as a chat reply, so the view swap, the highlights and her lipsynced
 // speech move together as her voice reaches each cue.
 // One pointer press on the inset layer is one sequence; a component tap
 // claims it, and an onSwap from the same press is ignored: the passage's
 // [[view:chart]] cue drives the view, where a manual swap would race it
 // and turn cue-following off.
 const pressSeqRef = useRef(0);
 const tapClaimedSeqRef = useRef(-1);
 const swapTimerRef = useRef<number | undefined>(undefined);

 // Compose and speak one tapped target's passage through the reply driver.
 // The sky is the exact array handed to explainTarget, so the cue
 // inventory (which needs it for now-line names) can never disagree with
 // the passage. A target with no verifiable passage throws inside
 // explainTarget: the failure is reported, never spoken around.
 const speakPassage = (target: string, liveChart: NatalChart, sky: SkyPlacement[] | null) => {
  let raw: string;
  try {
   raw = explainTarget(target, liveChart, sky);
  } catch (cause) {
   console.error('explainTarget: no passage for tapped target', target, cause);
   return;
  }
  const parsed = parseReply(raw, chartTargets(liveChart, sky));
  voice.stop();
  handleReplyEvent({ phase: 'begin' });
  voice.speakStream(parsed.text, { flush: true });
  handleReplyEvent({ phase: 'delta', text: parsed.text, cues: parsed.cues });
  handleReplyEvent({ phase: 'final' });
 };

 const explainTap = (target: string) => {
  tapClaimedSeqRef.current = pressSeqRef.current;
  if (chart === null) return;
  void skyToday(chart.input)
   .then(today => {
    // The sky argument is positional over the chart's bodies: entry i is
    // chart.bodies[i] placed now, matched by name across the pipelines.
    const placements: SkyPlacement[] = [];
    for (const body of chart.bodies) {
     const now = today.natalBodies.find(entry => entry.name === body.key);
     if (now === undefined) {
      // Today's sky is incomplete: degrade truthfully, sky: null.
      speakPassage(target, chart, null);
      return;
     }
     placements.push({ sign: now.signName, lon: now.lon });
    }
    speakPassage(target, chart, placements);
   })
   .catch(() => {
    // The sky of the moment never arrived: degrade truthfully, sky: null.
    speakPassage(target, chart, null);
   });
 };

 const swapInsetView = () => {
  // The chart's click lands after the pointerup that reports the tap, so
  // the swap waits one task for a component tap to claim the sequence —
  // whichever of the two arrives first.
  const press = pressSeqRef.current;
  window.clearTimeout(swapTimerRef.current);
  swapTimerRef.current = window.setTimeout(() => {
   if (pressSeqRef.current !== press || tapClaimedSeqRef.current === press) return;
   handleStageView(presentation.view === 'chart' ? 'atelier' : 'chart');
  }, 0);
 };

 // ---- The landing stage (§12.1) ----
 // The sky pipeline, the passage driver and the press-claiming rule the
 // signed-in stage uses, pointed at the landing's own presentation state
 // and the example chart: a tap on a wheel component (§12.1 4b) brings the
 // chart forward and she speaks her passage about it, every involved
 // element highlighting as her voice reaches it.

 // Today's sky at the example birth place, cast at most once per visit and
 // shared by every landing tap.
 const landingSkyToday = (): Promise<NatalChartResult> => {
  landingSkyRef.current ??= computeAstrolabeChart({
   ...EXAMPLE_BIRTH,
   dateIso: new Date().toISOString().slice(0, 10),
   timeIso: new Date().toTimeString().slice(0, 5),
  });
  return landingSkyRef.current;
 };

 const speakLandingPassage = (target: string, natal: NatalChart, sky: SkyPlacement[] | null) => {
  let raw: string;
  try {
   raw = explainTarget(target, natal, sky);
  } catch (cause) {
   console.error('explainTarget: no passage for tapped target', target, cause);
   return;
  }
  // §12.1 4c on the landing: the passage closes speaking to the visitor
  // (its last line is her question to them), so the stage returns to her
  // as those words end — a trailing view cue the driver applies when her
  // voice reaches it (or flushes when speech ends).
  raw = `${raw} [[view:atelier]]`;
  const parsed = parseReply(raw, chartTargets(natal, sky));
  voice.stop();
  handleLandingReplyEvent({ phase: 'begin' });
  voice.speakStream(parsed.text, { flush: true });
  handleLandingReplyEvent({ phase: 'delta', text: parsed.text, cues: parsed.cues });
  handleLandingReplyEvent({ phase: 'final' });
 };

 const landingExplainTap = (target: string) => {
  tapClaimedSeqRef.current = pressSeqRef.current;
  // The tap is itself the gesture that admits her voice, and it brings the
  // chart forward at once (§12.1 4b); the passage's cues then highlight
  // each involved element as she speaks. When this tap is the visit's
  // first gesture, her answer is her first words — the welcome would only
  // race and cut across it, so it stands down for this visit.
  landingWelcomeSpokenRef.current = true;
  voice.admit();
  dispatchLanding({ type: 'view', view: 'chart', manual: true });
  if (exampleNatal === null) return;
  void landingSkyToday()
   .then(today => {
    // The sky argument is positional over the chart's bodies, matched by
    // name across the pipelines — the same rule as the signed-in tap.
    const placements: SkyPlacement[] = [];
    for (const body of exampleNatal.bodies) {
     const now = today.natalBodies.find(entry => entry.name === body.key);
     if (now === undefined) {
      // Today's sky is incomplete: degrade truthfully, sky: null.
      speakLandingPassage(target, exampleNatal, null);
      return;
     }
     placements.push({ sign: now.signName, lon: now.lon });
    }
    speakLandingPassage(target, exampleNatal, placements);
   })
   .catch(() => {
    // The sky of the moment never arrived: degrade truthfully, sky: null.
    speakLandingPassage(target, exampleNatal, null);
   });
 };

 const landingSwapTimerRef = useRef<number | undefined>(undefined);
 const landingSwapInsetView = () => {
  // The same race rule as the signed-in stage: a component tap claims the
  // press, so the swap fires only when nothing else did.
  const press = pressSeqRef.current;
  window.clearTimeout(landingSwapTimerRef.current);
  landingSwapTimerRef.current = window.setTimeout(() => {
   if (pressSeqRef.current !== press || tapClaimedSeqRef.current === press) return;
   dispatchLanding({
    type: 'view',
    view: landingPresentation.view === 'chart' ? 'atelier' : 'chart',
    manual: true,
   });
  }, 0);
 };

 const handleLandingStageView = (next: StageView) => {
  if (next === 'chart' || next === 'atelier') {
   dispatchLanding({ type: 'view', view: next, manual: true });
  }
 };

 // First-load inversion (§4) only until a view has been chosen; the seeded
 // floating placement normally keeps both panes usable side by side.
 const handleLandingAutoInvert = (invert: boolean) => {
  if (!landingPresentation.follow) return;
  dispatchLanding({ type: 'view', view: invert ? 'chart' : 'atelier' });
 };
 useEffect(() => {
  if (authUnavailable) {
   seedLandingPanePlacements();
   setAuth({ status: 'signedOut', unavailable: true });
   return;
  }
  try {
   return onAuthChange((user: User | null) => {
    setSignInError(null);
    setSigningIn(false);
    setGidHandoffSigningIn(false);
    if (user === null) {
     // While the page is still on the splash: the landing's panes restore
     // their placement as they mount (§12.1 4c), so the seed is written
     // before the landing tree first renders.
     seedLandingPanePlacements();
    }
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
   if (PRODUCT_LANDING_HOSTS.includes(window.location.hostname)) {
    // On the landing domain the visit continues on the app domain, already
    // signed in (§12.1 items 6–7): the Google ID token travels in the URL
    // fragment — a fragment never reaches a server — and asknatally.online
    // consumes it the moment it loads (the #gid= effect below).
    const idToken = await googleSignInForIdToken();
    window.location.assign(`https://asknatally.online/#${GID_FRAGMENT}=${idToken}`);
    return;
   }
   await googleSignIn();
  } catch (error) {
   setSigningIn(false);
   // Specific, plain-language outcome (cancellation included) shown right
   // where the sign-in click happened.
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

 // The landing's natal chart (§12.1 item 1): cast once through the shared
 // renderer pipeline for the signed-out stage, and — through the same
 // clean-room pipeline a birth input runs (BirthForm → natalChart) — as the
 // NatalChart explainTarget speaks from (§12.1 4b), so a tap on a wheel
 // component has real passages and highlights. Until the wheel lands the
 // inset keeps its honest loading line.
 useEffect(() => {
  if (auth.status !== 'signedOut') return;
  let live = true;
  setExampleChart(null);
  setExampleNatal(null);
  landingSkyRef.current = null;
  computeAstrolabeChart(EXAMPLE_BIRTH)
   .then(result => {
    if (live) setExampleChart(result);
   })
   .catch(() => {
    // The ephemeris never loaded: the loading line stays, truthfully.
    if (live) setExampleChart(null);
   });
  natalChart(EXAMPLE_BIRTH)
   .then(chart => {
    if (live) setExampleNatal(chart);
   })
   .catch(() => {
    // No clean-room chart, no passages: taps still focus the chart.
    if (live) setExampleNatal(null);
   });
  return () => {
   live = false;
  };
 }, [auth.status]);

 // The #gid= sign-in handoff (§12.1 item 7): a signed-out load carrying a
 // Google ID token in the fragment strips it before anything else — the
 // token must not linger in the URL bar through a refresh or a share —
 // and signs in with it directly. No second sign-in click anywhere; only
 // a status line shows while it runs. Stripping first also makes this
 // effect idempotent, so a double invoke cannot sign in twice.
 useEffect(() => {
  if (auth.status !== 'signedOut') return;
  const hash = window.location.hash;
  if (!hash.startsWith(`#${GID_FRAGMENT}=`)) return;
  const handedOverToken = hash.slice(GID_FRAGMENT.length + 2);
  window.history.replaceState(
   null,
   '',
   window.location.pathname + window.location.search,
  );
  setGidHandoffSigningIn(true);
  void signInWithGoogleIdToken(handedOverToken).catch((error: unknown) => {
   setGidHandoffSigningIn(false);
   setSignInError(describeSignInFailure(error));
  });
 }, [auth.status]);

 // Entering the chart sections swaps the stage to the wheel; leaving them
 // swaps back to the atelier (§12.1 items 4–5) — by scrolling or a menu
 // jump, in either direction. Stable identity: LandingCards' section
 // tracking re-subscribes when this prop changes, and the shell re-renders
 // often (the credit ledger polls even signed out).
 const handleLandingSection = useCallback((_id: string, chart: boolean) => {
  dispatchLanding({ type: 'view', view: chart ? 'chart' : 'atelier', manual: true });
 }, []);

 if (auth.status === 'unknown') {
  return (
   <div className="app-splash" role="status">
    Opening the atelier…
    <VersionBadge />
   </div>
  );
 }

 if (auth.status === 'signedOut') {
  // The room pane's corner size follows the layout: the desktop formula
  // shrinks to an ~86 px sliver on a phone, so narrow screens keep her
  // whole and readable at a floored width instead (§12.1 4c).
  const roomPaneWidth = landingNarrow
   ? LANDING_ROOM_PANE_WIDTH_NARROW
   : LANDING_ROOM_PANE_WIDTH;
  if (gidHandoffSigningIn) {
   // The #gid= handoff is signing the visitor in (§12.1 item 7): only a
   // status line while it runs — no sign-in click is ever asked for again.
   return (
    <div className="app-splash" role="status">
     Signing you in…
     <VersionBadge />
    </div>
   );
  }
  return (
   <>
    {/* This file is the landing stage's only styling surface, so the two
            pane-swap rules live here with the markup they dress. The landing
            stage is a full-bleed backdrop, not a reading stage: there is no
            scene column to re-zoom beside a docked wheel, so a dock (which
            the inset chooses on any stage wide enough) would only stretch
            the card across the whole viewport behind its acrylic. The wheel
            instead stays a floating card in the bottom-left corner —
            opposite the right-docked copy cards and clear of Natally
            (§12.1 5a) — in the same corner the room pane takes when the
            chart fills the stage. Scoped to this stage; a drag still lifts
            the card out of the dock into a truly floating placement. */}
    <style>{`
     .scene-mount .stage-inset-layer[data-inset-dock='side'],
     .scene-mount .stage-inset-layer[data-inset-dock='stack'] {
      display: block;
     }
     .scene-mount[data-inset-dock='side'] .stage-inset-layer .chart-inset--docked,
     .scene-mount[data-inset-dock='stack'] .stage-inset-layer .chart-inset--docked {
      position: absolute;
      left: max(16px, 4vw);
      top: auto;
      bottom: max(16px, 4vh);
      width: min(32vw, 52vh);
      height: min(32vw, 52vh);
      margin: 0;
     }
    `}</style>
    {/* The landing's stage (§12.1 items 1, 4–5a): the atelier with the
            natal chart in the existing inset — the fixed mount is the inset
            layer's stage. Entering the chart sections (scroll, menu jump or
            a tap on the floating chart, item 4a) swaps the two panes: the
            chart fills the stage and the room becomes the floating pane,
            bottom-left and off the wheel's middle; leaving them swaps back.
            Both states are a re-layout of the same scene — never a remount —
            and the geometry stays on left/top/width/height in either state
            so the swap glides like the inset's own moves. */}
    <div
     className="scene-mount"
     ref={landingStageRootRef}
     onPointerDownCapture={() => {
      pressSeqRef.current += 1;
     }}
    >
     <div
      title={landingChartFocused ? 'Back to the atelier' : undefined}
      onClick={() => {
       // §12.1 4a, the way back: while the chart fills the stage, a tap on
       // Natally's corner card returns the atelier to the stage — the same
       // press-claimed swap a tap on the floating chart uses to focus it.
       if (landingChartFocused) landingSwapInsetView();
      }}
      style={{
       position: 'absolute',
       zIndex: 1,
       display: 'flex',
       alignItems: 'center',
       overflow: 'hidden',
       cursor: landingChartFocused ? 'pointer' : undefined,
       transition: `left ${LANDING_SWAP_MS}ms ${LANDING_SWAP_EASE}, top ${LANDING_SWAP_MS}ms ${LANDING_SWAP_EASE}, width ${LANDING_SWAP_MS}ms ${LANDING_SWAP_EASE}, height ${LANDING_SWAP_MS}ms ${LANDING_SWAP_EASE}, border-radius ${LANDING_SWAP_MS}ms ${LANDING_SWAP_EASE}, box-shadow ${LANDING_SWAP_MS}ms ${LANDING_SWAP_EASE}`,
       ...(landingChartFocused
        ? {
           left: 'max(16px, 4vw)',
           top: `calc(100% - max(16px, 4vh) - ${roomPaneWidth} / ${LANDING_ROOM_PANE_ASPECT})`,
           width: roomPaneWidth,
           height: `calc(${roomPaneWidth} / ${LANDING_ROOM_PANE_ASPECT})`,
           borderRadius: '12px',
           boxShadow:
            'inset 0 0 0 1px rgba(215, 182, 119, 0.28), 0 14px 38px rgba(3, 2, 8, 0.55)',
          }
        : {
           left: '0',
           top: '0',
           width: '100%',
           height: '100%',
           borderRadius: '0',
           boxShadow: 'none',
          })}}
     >
      <AtelierScene phase="idle" motionEnabled accountUid={null} />
     </div>
     {/* The chart's stage (§12.1 5a): the scene's area left of the card
             column — the Inset measures its stage from this element — so the
             cards never cover the focused wheel or the floating chart. */}
     <div className="landing-chart-stage">
     <div
      className="stage-inset-layer"
      data-mode={landingChartFocused ? 'fill' : 'float'}
     >
      <Inset
       storageKey="natally.inset.v1:landing:compact-v1"
       compact
       label="Natal chart"
       focused={landingChartFocused}
       fillHeight={landingStageVisualHeight}
       targets={landingPresentation.focusTargets}
       bodyCount={exampleChart?.natalBodies.length}
       onAutoInvert={handleLandingAutoInvert}
       onSwap={landingSwapInsetView}
       onComponentTap={landingExplainTap}
      >
       {exampleChart !== null ? (
        <Astrolabe3D
         chart={exampleChart}
         isSpinning
         resetTrigger={0}
         highlightedComponents={landingPresentation.focusTargets}
         onComponentTap={landingExplainTap}
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

    {/* NAV-1: one top bar — wordmark home at the left, the Menu and the
            sign-in action at the right. The menu items are the landing's
            sections (every item lands on a real section, rubric 3); each
            Sign In control is one click (§12.1 item 2). */}
    <header className="app-header app-header--front">
     <a className="app-brand" href="/">
      Natally <span className="app-brand-sub">· the atelier</span>
     </a>
     <div className="app-header-actions">
      {!auth.unavailable && (
       <button
        type="button"
        className="btn primary small app-header__signin"
        disabled={signingIn}
        onClick={() => void signIn()}
       >
        {signingIn ? 'Signing in…' : 'Sign in'}
       </button>
      )}
      <details className="app-burger">
       <summary aria-haspopup="menu" aria-label="Menu">☰</summary>
       <div className="app-burger__panel">
        {LANDING_SECTIONS.map(section => (
         <a
          key={section.id}
          className="app-menuitem"
          href={`#${section.id}`}
          onClick={closeMenuDetails}
         >
          {section.menuLabel}
         </a>
        ))}
        {!auth.unavailable && (
         <button
          type="button"
          className="btn primary"
          disabled={signingIn}
          onClick={() => void signIn()}
         >
          {signingIn ? 'Signing in…' : 'Sign in'}
         </button>
        )}
        {signInError && (
         <p className="app-burger__error" role="alert">{signInError}</p>
        )}
       </div>
      </details>
     </div>
    </header>

    {/* Deployment and sign-in truths, right where the click happened —
            normally nothing shows here (fail-visible, never silent). */}
    {auth.unavailable && (
     <p className="note warn">
      Sign-in isn’t available on this deployment — Firebase isn’t configured.
     </p>
    )}
    {signInError && (
     <p className="note error" role="alert">
      {signInError}
     </p>
    )}

    {/* The landing copy (§12.1 item 3): every piece of it paginated onto
            cards that scroll by over the atelier. */}
    <LandingCards
     onSection={handleLandingSection}
     onSignIn={() => void signIn()}
     signingIn={signingIn}
    />
    {/* Her words shown as she speaks them (§12.1 5b): welcome, a tapped
            passage, a quiet story — karaoke-paced, above the bottom bar. */}
    <div className="landing-caption">
     <KaraokeCaption />
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

 const lesson = getLesson('general');
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
         <p className="lesson-kicker">From Natally’s notebook</p>
         <h3>{lesson.title}</h3>
         <p className="lesson-body">{lesson.what}</p>
         <p className="lesson-question">{lesson.question}</p>
        </section>
       </>
      }
     />
     {/* The clean-room inset (ARCHITECTURE §Chart inset): the chart
              floats over the stage here, in place of the verbatim stage's
              own chart pane; when the chart is focused the wheel fills the
              visual area and Natally becomes the floating pane. A tap on a
              hovered chart component brings it forward and she explains it;
              a tap on empty inset chrome swaps the panes. */}
     <div
      className="stage-inset-layer"
      data-mode={view === 'chart' ? 'fill' : 'float'}
      onPointerDownCapture={() => {
       pressSeqRef.current += 1;
      }}
     >
      <Inset
       storageKey={`natally.inset.v1:${auth.uid}`}
       label="Your wheel"
       focused={view === 'chart'}
       fillHeight={stageVisualHeight}
       targets={presentation.focusTargets}
       bodyCount={chart.bodies.length}
       onAutoInvert={handleAutoInvert}
       onSwap={swapInsetView}
       onComponentTap={explainTap}
      >
       {astrolabe ? (
        <Astrolabe3D
         chart={astrolabe}
         isSpinning={false}
         resetTrigger={0}
         selectedPlanetName={focusBody}
         highlightedComponents={presentation.focusTargets}
         onComponentTap={explainTap}
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
