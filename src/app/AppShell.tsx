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
 isNativeAuth,
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
import { AtelierAmbience } from '../atelier-original/components/atelier/AtelierAmbience';
import { unlockAtelierSound } from '../atelier-original/services/atelierSound';
import { ImmersiveLayout, AtelierRail } from './prototype/ImmersiveLayout';
import { VoiceDownloadStatus } from './VoiceDownloadStatus';
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
import { loadGazetteer } from '../services/gazetteer';
import {
 ONBOARDING_PROGRESS_PREFIX, createOnboardingProgress, loadFirebaseOnboardingProgress,
 saveFirebaseOnboardingProgress, saveOnboardingProgress,
 type OnboardingLoadResult, type OnboardingProgress,
} from '../services/onboardingProgress';
import KaraokeCaption from './karaokeCaption';
import { nextSpontaneousStory } from '../content/backstory';
import { LandingCards, LANDING_SECTIONS } from './landing/LandingCards';
import VersionBadge from './VersionBadge';
import TopUpSheet from './TopUpSheet';
import './app-shell.css';
import { SignInPanel } from './SignInPanel';

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

/** Exact frozen shared header: text identity, six destinations, bounded account. */
function StageHeader({ auth, balanceCr, balanceLoading, balanceError, onAccount,
 onTopUp, onMenu, onNavigate, onHome }: {
 auth: AuthState;
 balanceCr: string;
 balanceLoading: boolean;
 balanceError: string | null;
 onAccount: () => void;
 onTopUp: () => void;
 onMenu: () => void;
 onNavigate: (id: string, chart: boolean) => void;
 onHome: () => void;
}) {
 return (
  <header className="atelier-header" data-slot="header">
   <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <button type="button" className="atelier-brand-wordmark" aria-label="Natally home" onClick={onHome}>Natally</button>
    <nav className="atelier-header-nav" aria-label="Sections">
     {LANDING_SECTIONS.map(section => <button type="button" key={section.id} className="atelier-nav-link"
      onClick={() => onNavigate(section.id, section.chart)}>{section.menuLabel}</button>)}
    </nav>
   </div>
   <div className="atelier-header-actions">
    {auth.status === 'signedIn' && <button type="button" className="atelier-allowance-badge" onClick={onTopUp}
     aria-label={balanceError ? 'Balance unavailable. Open credits.' : `Conversation allowance ${balanceCr || 'checking'}. Open credits.`}
     title={balanceError ?? undefined}>{balanceError ? 'Balance unavailable' : balanceCr || (balanceLoading ? 'Checking…' : 'Balance unavailable')}</button>}
    <button type="button" className="atelier-account-btn" onClick={onAccount}
     aria-label={auth.status === 'signedIn' ? 'Account details' : 'Sign in'}>
     {auth.status === 'signedIn' && auth.photoUrl ? <img className="atelier-account-avatar" src={auth.photoUrl} alt="" referrerPolicy="no-referrer" /> :
      <span className="atelier-account-avatar"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
       <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg></span>}
    </button>
    <button type="button" className="atelier-menu-mobile-btn" aria-label="Open menu" onClick={onMenu}>
     <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" />
     </svg>
    </button>
   </div>
  </header>
 );
}

/** Actual identity and allowance in the frozen S07 task rail. */
function AccountPanel({
 auth, balanceCr, balanceError, onClose, onTopUp, onKeepsake, onSignOut,
 onRedoOnboarding, onResumeOnboarding, canRedoOnboarding, redoBusy, redoError,
}: {
 auth: Extract<AuthState, { status: 'signedIn' }>;
 balanceCr: string;
 balanceError: string | null;
 onClose: () => void;
 onTopUp: () => void;
 onKeepsake: () => void;
 onSignOut: () => void;
 onRedoOnboarding: () => void;
 onResumeOnboarding?: () => void;
 canRedoOnboarding: boolean;
 redoBusy: boolean;
 redoError: string | null;
}) {
 const [confirming, setConfirming] = useState(false);
 return <AtelierRail title="Account" onClose={redoBusy ? undefined : onClose} labelledBy="atelier-account-title">
  <div className="atelier-account-identity" data-bind="identity">{auth.name}{auth.email && auth.email !== auth.name ? <div>{auth.email}</div> : null}</div>
  <div className="atelier-account-allowance"><span>Conversation allowance</span><div data-bind="allowance">
   {balanceError ? <span role="alert">{balanceError}</span> : balanceCr || 'Checking your balance…'}
  </div></div>
  <button type="button" className="atelier-btn-primary" disabled={redoBusy} onClick={onTopUp}>Top up</button>
  <button type="button" className="atelier-btn-secondary" disabled={redoBusy} onClick={onKeepsake}>My keepsake</button>
  {onResumeOnboarding && <button type="button" className="atelier-btn-secondary" disabled={redoBusy} onClick={onResumeOnboarding}>Resume onboarding</button>}
  {canRedoOnboarding && !confirming && <button type="button" className="atelier-btn-secondary" onClick={() => setConfirming(true)}>Redo onboarding</button>}
  {confirming && <div>
   <p className="atelier-body-text">Start onboarding again? Your existing chart stays available until the replacement is saved.</p>
   <button type="button" className="atelier-btn-primary" disabled={redoBusy} onClick={onRedoOnboarding}>{redoBusy ? 'Saving…' : 'Start again'}</button>
   <button type="button" className="atelier-btn-secondary" disabled={redoBusy} onClick={() => setConfirming(false)}>Cancel</button>
  </div>}
  {redoError && <p className="atelier-status-banner error" role="alert">{redoError}</p>}
  <button type="button" className="atelier-btn-text" disabled={redoBusy} onClick={onSignOut}>Sign out</button>
 </AtelierRail>;
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
const LANDING_NARROW_QUERY = '(max-width: 768px)';
const PRODUCT_LANDING_HOSTS: readonly string[] = ['astronatally.com', 'www.astronatally.com'];
const GID_FRAGMENT = 'gid';
const AUTH_METHOD_QUERY = 'auth';
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
 const record = (candidate: unknown): candidate is Record<string, unknown> => typeof candidate === 'object' && candidate !== null;
 const finite = (candidate: unknown): candidate is number => typeof candidate === 'number' && Number.isFinite(candidate);
 const point = (candidate: unknown) => record(candidate) && finite(candidate.longitude) && candidate.longitude >= 0 && candidate.longitude <= 360 &&
  (candidate.latitude === undefined || finite(candidate.latitude)) && (candidate.speed === undefined || finite(candidate.speed));
 if (!record(value) || !record(value.input)) return false;
 const input = value.input;
 if (typeof input.dateIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso)) return false;
 const date = new Date(input.dateIso + 'T00:00:00Z');
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.dateIso ||
  (input.name !== undefined && typeof input.name !== 'string') ||
  !(input.timeIso === null || typeof input.timeIso === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeIso)) || !record(input.place)) return false;
 const place = input.place;
 if (typeof place.label !== 'string' || !place.label.trim() || !finite(place.latitude) || Math.abs(place.latitude) > 90 ||
  !finite(place.longitude) || Math.abs(place.longitude) > 180 || typeof place.timezoneIana !== 'string' || !place.timezoneIana) return false;
 try { new Intl.DateTimeFormat('en', { timeZone: place.timezoneIana }); } catch { return false; }
 const keys = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'TrueNode', 'Ascendant', 'Midheaven'];
 const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
 return Array.isArray(value.bodies) && value.bodies.length > 0 && value.bodies.every(body => record(body) &&
  keys.includes(String(body.key)) && signs.includes(String(body.sign)) && point(body.position) &&
  Number.isInteger(body.house) && Number(body.house) >= 1 && Number(body.house) <= 12) &&
  Array.isArray(value.houses) && value.houses.length === 12 && value.houses.every((cusp, index) => record(cusp) && cusp.house === index + 1 && point(cusp.position)) &&
  point(value.ascendant) && point(value.midheaven) && Array.isArray(value.aspects) && value.aspects.every(aspect => record(aspect) &&
   keys.includes(String(aspect.a)) && keys.includes(String(aspect.b)) &&
   ['conjunction', 'opposition', 'square', 'trine', 'sextile'].includes(String(aspect.kind)) && finite(aspect.orb));
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
 const [chartSession, setChartSession] = useState<{ uid: string | null; chart: NatalChart | null }>({ uid: null, chart: null });
 const chartSessionRef = useRef(chartSession);
 const activeUid = useRef<string | null>(null);
 const chart = auth.status === 'signedIn' && chartSession.uid === auth.uid ? chartSession.chart : null;
 const [onboardingLoad, setOnboardingLoad] = useState<OnboardingLoadResult>({ progress: null, error: null });
 const latestDraft = useRef<{ uid: string | null; progress: OnboardingProgress | null }>({ uid: null, progress: null });
 const [onboardingReady, setOnboardingReady] = useState<string | null>(null);
 const [restorationError, setRestorationError] = useState<string | null>(null);
 const restorationGeneration = useRef(0);
 const [redoRequested, setRedoRequested] = useState(false);
 const redoActive = useRef(false);
 const intakeActive = useRef(false);
 const [onboardingEntry, setOnboardingEntry] = useState(0);
 const entryGeneration = useRef(0);
 const [chartSaveError, setChartSaveError] = useState<string | null>(null);
 const [redoBusy, setRedoBusy] = useState(false);
 const [redoError, setRedoError] = useState<string | null>(null);
 const redoPending = useRef(false);
 const redoGeneration = useRef(0);
 const [presentation, dispatch] = useReducer(presentationReducer, initialPresentation);
 const interactionEpochRef = useRef(0);
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
 const [initialAuthMethod, setInitialAuthMethod] = useState<'email' | 'phone' | undefined>(() => {
  const method = new URLSearchParams(window.location.search).get(AUTH_METHOD_QUERY);
  return method === 'email' || method === 'phone' ? method : undefined;
 });
 const [signInOpen, setSignInOpen] = useState(() => initialAuthMethod !== undefined);
 useEffect(() => {
  if (!initialAuthMethod) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(AUTH_METHOD_QUERY);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
 }, [initialAuthMethod]);
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
 const [menuOpen, setMenuOpen] = useState(false);
 const [infoSection, setInfoSection] = useState<string | null>(null);
 const railHistoryRef = useRef<('account' | 'topup' | 'souvenir' | 'signin' | 'menu')[]>([]);
 const railOpenerRef = useRef<HTMLElement | null>(null);
 const keepsakeIntentRef = useRef(false);
 const [interactionMuted, setInteractionMuted] = useState(() => {
  try { return localStorage.getItem('natally.atelier.sound-muted') === 'true'; } catch { return false; }
 });
 const [soundError, setSoundError] = useState<string | null>(null);

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
   interactionEpochRef.current += 1;
   // A new utterance supersedes the opening: her words are all visible.
   endOpeningReveal();
   driver.begin(voice.admitted);
  } else if (event.phase === 'delta') driver.update(event.text, event.cues);
  else if (event.phase === 'final') driver.end();
  else driver.finish();
 };

 const captureSpeechCompletion = () => {
  const epoch = interactionEpochRef.current;
  return () => {
   if (epoch !== interactionEpochRef.current) return;
   driverRef.current?.finish();
   dispatch({ type: 'clear' });
  };
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
  if (event.phase === 'begin') {
   interactionEpochRef.current += 1;
   driver.begin(voice.admitted);
  }
  else if (event.phase === 'delta') driver.update(event.text, event.cues);
  else if (event.phase === 'final') driver.end();
  else driver.finish();
 };

 const captureLandingSpeechCompletion = () => {
  const epoch = interactionEpochRef.current;
  return () => {
   if (epoch !== interactionEpochRef.current) return;
   landingDriverRef.current?.finish();
   dispatchLanding({ type: 'clear' });
  };
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
   voice.speakStream(openingClean, { flush: true, onComplete: captureSpeechCompletion() });
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
   voice.speakStream(openingClean, { flush: true, onComplete: captureSpeechCompletion() });
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
   captureSpeechCompletion,
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
  const speechComplete = captureSpeechCompletion();
  voice.speakStream(parsed.text, { flush: true, onComplete: speechComplete });
  handleReplyEvent({ phase: 'delta', text: parsed.text, cues: parsed.cues });
  handleReplyEvent({ phase: 'final' });
 };

 const explainTap = (target: string) => {
  tapClaimedSeqRef.current = pressSeqRef.current;
  voice.stop();
  const epoch = ++interactionEpochRef.current;
  if (chart === null) return;
  void skyToday(chart.input)
   .then(today => {
    if (epoch !== interactionEpochRef.current) return;
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
    if (epoch !== interactionEpochRef.current) return;
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
  const speechComplete = captureLandingSpeechCompletion();
  voice.speakStream(parsed.text, { flush: true, onComplete: speechComplete });
  handleLandingReplyEvent({ phase: 'delta', text: parsed.text, cues: parsed.cues });
  handleLandingReplyEvent({ phase: 'final' });
 };

 const landingExplainTap = (target: string) => {
  tapClaimedSeqRef.current = pressSeqRef.current;
  voice.stop();
  const epoch = ++interactionEpochRef.current;
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
    if (epoch !== interactionEpochRef.current) return;
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
    if (epoch !== interactionEpochRef.current) return;
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
 const restoreOnboarding = async (uid: string) => {
  const generation = ++restorationGeneration.current;
  setOnboardingReady(null);
  setRestorationError(null);
  try {
   const loaded = await loadFirebaseOnboardingProgress(uid, loadGazetteer());
   if (activeUid.current !== uid || generation !== restorationGeneration.current) return;
   latestDraft.current = { uid, progress: loaded.progress };
   setOnboardingLoad(loaded);
   setOnboardingReady(uid);
  } catch (failure) {
   if (activeUid.current !== uid || generation !== restorationGeneration.current) return;
   setRestorationError(failure instanceof Error ? failure.message : 'Your saved birth details could not be restored.');
  }
 };

 useEffect(() => {
  if (authUnavailable) {
   seedLandingPanePlacements();
   setAuth({ status: 'signedOut', unavailable: true });
   return;
  }
  try {
   const unsubscribe = onAuthChange((user: User | null) => {
    setSignInError(null);
    setSigningIn(false);
    setGidHandoffSigningIn(false);
    if (user) { setSignInOpen(false); railHistoryRef.current = []; }
    else seedLandingPanePlacements();
    const uid = user?.uid ?? null;
    if (uid !== activeUid.current) {
     activeUid.current = uid;
     restorationGeneration.current += 1;
     redoGeneration.current += 1;
     redoPending.current = false;
     redoActive.current = false;
     setRedoRequested(false);
     setRedoBusy(false);
     setRedoError(null);
     setChartSaveError(null);
     setRestorationError(null);
     setOnboardingReady(null);
     setAccountOpen(false);
     setTopUpOpen(false);
     setSouvenirOpen(false);
     entryGeneration.current += 1;
     setOnboardingEntry(entryGeneration.current);
     const restored = uid ? loadStoredChart(uid) : null;
     chartSessionRef.current = { uid, chart: restored };
     setChartSession(chartSessionRef.current);
     intakeActive.current = uid !== null && restored === null;
     latestDraft.current = { uid, progress: null };
     setOnboardingLoad({ progress: null, error: null });
     if (uid) void restoreOnboarding(uid);
    }
    setAuth(user ? {
     status: 'signedIn', uid: user.uid,
     name: user.displayName ?? user.email ?? user.phoneNumber ?? 'stargazer',
     email: user.email ?? null, photoUrl: user.photoURL ?? null,
    } : { status: 'signedOut', unavailable: false });
   });
   return () => {
    activeUid.current = null;
    restorationGeneration.current += 1;
    redoGeneration.current += 1;
    entryGeneration.current += 1;
    unsubscribe();
   };
  } catch {
   setAuth({ status: 'signedOut', unavailable: true });
  }
 }, []);

 useEffect(() => {
  if (auth.status !== 'signedIn') return;
  const uid = auth.uid;
  const reconcile = () => {
   if (activeUid.current !== uid || redoActive.current || intakeActive.current || redoPending.current) return;
   const restored = loadStoredChart(uid);
   if (!restored) return;
   chartSessionRef.current = { uid, chart: restored };
   setChartSession(chartSessionRef.current);
  };
  const onStorage = (event: StorageEvent) => {
   if (event.key === CHART_STORE_PREFIX + uid || event.key === ONBOARDING_PROGRESS_PREFIX + encodeURIComponent(uid)) reconcile();
  };
  window.addEventListener('pageshow', reconcile);
  window.addEventListener('popstate', reconcile);
  window.addEventListener('storage', onStorage);
  return () => {
   window.removeEventListener('pageshow', reconcile);
   window.removeEventListener('popstate', reconcile);
   window.removeEventListener('storage', onStorage);
  };
 }, [auth.status, auth.status === 'signedIn' ? auth.uid : null]);

 const commitChart = (computed: NatalChart): boolean => {
  if (auth.status !== 'signedIn' || activeUid.current !== auth.uid || !isNatalChart(computed)) return false;
  let saved = false;
  try {
   localStorage.setItem(CHART_STORE_PREFIX + auth.uid, JSON.stringify(computed));
   saved = true;
   setChartSaveError(null);
  } catch {
   setChartSaveError('Your chart is available on this page, but its browser copy could not be saved. Your accepted birth details remain in your account.');
  }
  if (!saved && redoActive.current) return false;
  chartSessionRef.current = { uid: auth.uid, chart: computed };
  setChartSession(chartSessionRef.current);
  redoActive.current = false;
  intakeActive.current = false;
  setRedoRequested(false);
  return saved;
 };

 const beginRedo = async () => {
  if (auth.status !== 'signedIn' || activeUid.current !== auth.uid || chart === null ||
      onboardingReady !== auth.uid || redoPending.current) return;
  const uid = auth.uid;
  const generation = ++redoGeneration.current;
  const progress = createOnboardingProgress(uid, 'redo');
  redoPending.current = true;
  setRedoBusy(true);
  setRedoError(null);
  try {
   await saveFirebaseOnboardingProgress(progress);
   if (activeUid.current !== uid || generation !== redoGeneration.current) return;
   const warning = saveOnboardingProgress(progress);
   latestDraft.current = { uid, progress };
   setOnboardingLoad({ progress, error: warning });
   entryGeneration.current += 1;
   setOnboardingEntry(entryGeneration.current);
   redoActive.current = true;
   intakeActive.current = true;
   setRedoRequested(true);
   setAccountOpen(false);
   railHistoryRef.current = [];
  } catch (failure) {
   if (activeUid.current === uid && generation === redoGeneration.current) {
    setRedoError(failure instanceof Error ? failure.message : 'Your onboarding could not be restarted. Your existing chart has been kept.');
   }
  } finally {
   if (activeUid.current === uid && generation === redoGeneration.current) {
    redoPending.current = false;
    setRedoBusy(false);
   }
  }
 };

 const resumeRedo = () => {
  if (auth.status !== 'signedIn' || activeUid.current !== auth.uid || chart === null ||
      redoPending.current || latestDraft.current.uid !== auth.uid) return;
  const progress = latestDraft.current.progress;
  if (progress?.mode !== 'redo' || progress.status === 'complete') return;
  setOnboardingLoad({ progress, error: onboardingLoad.error });
  entryGeneration.current += 1;
  setOnboardingEntry(entryGeneration.current);
  redoActive.current = true;
  intakeActive.current = true;
  setRedoRequested(true);
  setAccountOpen(false);
  railHistoryRef.current = [];
 };

 const returnToChart = () => {
  if (redoPending.current) return;
  entryGeneration.current += 1;
  setOnboardingEntry(entryGeneration.current);
  redoActive.current = false;
  intakeActive.current = false;
  setRedoRequested(false);
 };

 const openAccount = () => openRail(auth.status === 'signedIn' ? 'account' : 'signin');
 const hasRedoDraft = chart !== null && onboardingLoad.progress?.mode === 'redo' && onboardingLoad.progress.status !== 'complete';

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
  setAccountOpen(false); setTopUpOpen(false); setSouvenirOpen(false); setMenuOpen(false);
  railHistoryRef.current = []; keepsakeIntentRef.current = false;
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
 }, []);

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


 const currentTask = signInOpen ? 'signin' : accountOpen ? 'account' : topUpOpen ? 'topup' : souvenirOpen ? 'souvenir' : menuOpen ? 'menu' : null;
 const applyTask = (next: 'account' | 'topup' | 'souvenir' | 'signin' | 'menu' | null) => {
  setSignInOpen(next === 'signin'); setAccountOpen(next === 'account'); setTopUpOpen(next === 'topup');
  setSouvenirOpen(next === 'souvenir'); setMenuOpen(next === 'menu');
 };
 const openRail = (next: 'account' | 'topup' | 'souvenir' | 'signin' | 'menu') => {
  if (currentTask === next) return;
  if (!currentTask) railOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  else railHistoryRef.current.push(currentTask);
  applyTask(next);
 };
 const closeRail = () => {
  if (redoPending.current) return;
  const previous = railHistoryRef.current.pop() ?? null;
  applyTask(previous);
  if (previous === null) window.requestAnimationFrame(() => railOpenerRef.current?.focus());
 };
 const showSection = (id: string, chartView: boolean) => {
  voice.stop();
  railHistoryRef.current = []; applyTask(null); setInfoSection(id);
  dispatchLanding({ type: 'view', view: chartView ? 'chart' : 'atelier', manual: true });
 };
 const closeInformation = () => {
  setInfoSection(null);
  dispatchLanding({ type: 'view', view: 'atelier', manual: true });
 };
 const requestKeepsake = () => {
  if (auth.status !== 'signedIn') { openRail('signin'); return; }
  if (chart === null) {
   keepsakeIntentRef.current = true; railHistoryRef.current = []; applyTask(null); setInfoSection(null);
   return;
  }
  openRail('souvenir');
 };
 const toggleInteractionSounds = () => {
  try {
   const muted = !interactionMuted;
   localStorage.setItem('natally.atelier.sound-muted', String(muted));
   setInteractionMuted(muted); setSoundError(null);
   if (!muted) unlockAtelierSound();
  } catch { setSoundError('Interaction sounds could not be changed in this browser.'); }
 };
 useEffect(() => {
  if (auth.status === 'signedIn') allowance.refresh();
 }, [auth.status, auth.status === 'signedIn' ? auth.uid : '']);
 useEffect(() => {
  const visibleTask = currentTask ?? infoSection;
  if (!visibleTask) return;
  const heading = Array.from(document.querySelectorAll<HTMLElement>('#atelier-rail-mount .atelier-rail-title'))
   .find(element => element.getClientRects().length > 0);
  heading?.focus();
 }, [currentTask, infoSection]);
 useEffect(() => {
  if (!(menuOpen || accountOpen || (infoSection && !signInOpen && !topUpOpen && !souvenirOpen))) return;
  const onKey = (event: KeyboardEvent) => {
   if (event.key !== 'Escape' || event.defaultPrevented) return;
   event.preventDefault();
   if (currentTask) closeRail(); else closeInformation();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
 }, [menuOpen, accountOpen, infoSection, signInOpen, topUpOpen, souvenirOpen]);

 const personalStage = auth.status === 'signedIn' && chart !== null && infoSection === null;
 const activePresentation = personalStage ? presentation : landingPresentation;
 const chartFocused = activePresentation.view === 'chart';
 const activeChart = personalStage ? astrolabe : exampleChart;
 const activeTargets = activePresentation.focusTargets;
 const foregroundBody = personalStage ? chart.bodies.find(body => activeTargets.includes(body.key))?.key ?? null : null;
 const returnToRoom = () => {
  if (personalStage) { handleStageView('atelier'); return; }
  if (infoSection === 'your-chart' || infoSection === 'reading-aloud') setInfoSection(null);
  handleLandingStageView('atelier');
 };
 const toggleView = () => {
  if (chartFocused) returnToRoom();
  else if (personalStage) handleStageView('chart');
  else handleLandingStageView('chart');
 };
 // The frozen demonstration template follows the existing view state,
 // without a second effect or a competing automatic view dispatch.
 const visibleInformation = !personalStage && chartFocused && infoSection !== 'your-chart' && infoSection !== 'reading-aloud'
  ? 'your-chart' : infoSection;
 const baseHidden = currentTask !== null || visibleInformation !== null;

 return (
  <ImmersiveLayout
   header={<StageHeader auth={auth} balanceCr={allowance.balanceCr} balanceLoading={allowance.loading} balanceError={allowance.error}
    onAccount={openAccount}
    onTopUp={() => openRail('topup')} onMenu={() => openRail('menu')} onNavigate={showSection}
    onHome={() => { railHistoryRef.current = []; applyTask(null); closeInformation(); }} />}
   stage={
    <div className="atelier-room-container stage-inset-root" ref={stageRootRef} data-chart-focused={chartFocused}
     onPointerDownCapture={() => { pressSeqRef.current += 1; }}>
     <div className="atelier-stage-controls">
      <button type="button" className="atelier-stage-ctrl-btn" aria-label={`${interactionMuted ? 'Unmute' : 'Mute'} interaction sounds`}
       title="Interaction sounds" aria-pressed={!interactionMuted} onClick={toggleInteractionSounds}>
       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5m5 3a6 6 0 0 1 0 8" /></svg>
      </button>
      <button type="button" className="atelier-stage-ctrl-btn" aria-label={paused ? 'Resume motion' : 'Pause motion'}
       title={paused ? 'Resume motion' : 'Pause motion'} aria-pressed={paused} onClick={() => setPaused(current => !current)}>
       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d={paused ? 'M7 4v16l13-8z' : 'M6 4h4v16H6zm8 0h4v16h-4z'} /></svg>
      </button>
      <button type="button" className="atelier-stage-ctrl-btn" onClick={toggleView}>{chartFocused ? 'Reading room' : personalStage ? 'Your chart' : 'Chart'}</button>
     </div>
     <div className={chartFocused ? 'atelier-live-room atelier-natally-inset-dock' : 'atelier-live-room'}
      role={chartFocused ? 'button' : undefined} tabIndex={chartFocused ? 0 : undefined}
      aria-label={chartFocused ? 'Bring Natally into focus' : undefined}
      onClick={chartFocused ? returnToRoom : undefined}
      onKeyDown={chartFocused ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); returnToRoom(); } } : undefined}>
      <div className="atelier-live-room-content" inert={chartFocused}><AtelierScene phase="idle" motionEnabled={!paused} accountUid={auth.status === 'signedIn' ? auth.uid : null} /></div>
     </div>
     {personalStage && <AtelierAmbience view={activePresentation.view} phase="idle" />}
     <div className="stage-inset-layer" data-mode={chartFocused ? 'fill' : 'float'}>
      <Inset key={auth.status === 'signedIn' ? auth.uid : 'landing'}
       storageKey={auth.status === 'signedIn' ? `natally.inset.v1:${auth.uid}` : 'natally.inset.v1:landing:compact-v1'}
       label={personalStage ? 'Your chart' : 'Demonstration chart'} compact focused={chartFocused}
       targets={activeTargets} bodyCount={activeChart?.natalBodies.length}
       onAutoInvert={personalStage ? handleAutoInvert : handleLandingAutoInvert}
       onSwap={personalStage ? swapInsetView : landingSwapInsetView}
       onComponentTap={personalStage ? explainTap : landingExplainTap}>
       {activeChart ? <Astrolabe3D chart={activeChart} isSpinning={!personalStage} resetTrigger={0}
        selectedPlanetName={foregroundBody} highlightedComponents={activeTargets} focusSequence={activePresentation.sequence}
        onComponentTap={personalStage ? explainTap : landingExplainTap} /> : <div className="chart-loading" role="status">Casting the wheel…</div>}
      </Inset>
     </div>
    </div>
   }
   caption={<KaraokeCaption />}
   status={<>{chartSaveError && <div className="atelier-status-banner error" role="alert">{chartSaveError}</div>}
    {chart !== null && restorationError && <div className="atelier-status-banner error" role="alert">{restorationError}
     {auth.status === 'signedIn' && <button type="button" className="atelier-btn-text" onClick={() => void restoreOnboarding(auth.uid)}>Try again</button>}</div>}
    {soundError && <div className="atelier-status-banner error" role="alert">{soundError}</div>}<VoiceDownloadStatus /></>}
   rail={
    <>
     <div hidden={baseHidden} className="atelier-base-task">
      {auth.status === 'unknown' || gidHandoffSigningIn ? <AtelierRail title="Signing you in…"><div role="status" /></AtelierRail>
       : auth.status === 'signedOut' ? <LandingCards onSection={showSection} onSignIn={() => openRail('signin')} signingIn={signingIn} />
       : chart === null && onboardingReady !== auth.uid ? <AtelierRail title="Restoring your birth details…">
        {restorationError ? <><div className="atelier-status-banner error" role="alert">{restorationError}</div>
         <button type="button" className="atelier-btn-primary" onClick={() => void restoreOnboarding(auth.uid)}>Try again</button></>
         : <p className="atelier-secondary-text" role="status">Reading your saved answers…</p>}
       </AtelierRail>
       : chart === null || redoRequested ? <FirstLight
        key={auth.uid + ':' + onboardingEntry} accountUid={auth.uid}
        initialProgress={onboardingLoad.progress} storageError={onboardingLoad.error}
        onProgress={progress => {
         if (activeUid.current !== auth.uid || entryGeneration.current !== onboardingEntry || progress.accountUid !== auth.uid) return;
         latestDraft.current = { uid: auth.uid, progress };
         setOnboardingLoad(previous => ({ ...previous, progress }));
        }}
        onStorageError={message => {
         if (activeUid.current === auth.uid && entryGeneration.current === onboardingEntry) setChartSaveError(message);
        }}
        onCancel={chart !== null ? returnToChart : undefined}
        onSitDown={computed => {
         if (activeUid.current !== auth.uid || entryGeneration.current !== onboardingEntry) return false;
         const saved = commitChart(computed);
         if (saved && keepsakeIntentRef.current) { keepsakeIntentRef.current = false; openRail('souvenir'); }
         return saved;
        }} />
       : <ChatPanel chart={chart} stage={chatStage} onTopUp={() => openRail('topup')} onMenu={() => openRail('menu')} />}
     </div>
     {visibleInformation !== null && currentTask === null && <LandingCards sectionId={visibleInformation} onSection={showSection} onClose={closeInformation}
      onSignIn={() => openRail('signin')} signingIn={signingIn} />}
     {menuOpen && <AtelierRail title="Menu" onClose={closeRail}>
      {LANDING_SECTIONS.map(section => <button type="button" className="atelier-btn-secondary" key={section.id}
       onClick={() => showSection(section.id, section.chart)}>{section.menuLabel}</button>)}
      <button type="button" className="atelier-btn-secondary" onClick={() => openRail(auth.status === 'signedIn' ? 'account' : 'signin')}>{auth.status === 'signedIn' ? 'Account' : 'Sign in'}</button>
     </AtelierRail>}
     {signInOpen && <SignInPanel onClose={() => { closeRail(); setInitialAuthMethod(undefined); }} onGoogle={signIn}
      initialMethod={initialAuthMethod} googleError={signInError}
      continueOnApp={PRODUCT_LANDING_HOSTS.includes(window.location.hostname) && !isNativeAuth()} />}
     {auth.status === 'signedIn' && accountOpen && <AccountPanel auth={auth} balanceCr={allowance.balanceCr} balanceError={allowance.error}
      onClose={closeRail} onTopUp={() => openRail('topup')} onKeepsake={requestKeepsake} onSignOut={() => void handleSignOut()}
      onRedoOnboarding={() => void beginRedo()} onResumeOnboarding={hasRedoDraft ? resumeRedo : undefined}
      canRedoOnboarding={chart !== null && onboardingReady === auth.uid} redoBusy={redoBusy} redoError={redoError} />}
     {auth.status === 'signedIn' && topUpOpen && <TopUpSheet onClose={closeRail} />}
     {auth.status === 'signedIn' && chart !== null && souvenirOpen && <Suspense fallback={null}>
      <SouvenirDialog chart={chart} onClose={closeRail} />
     </Suspense>}
    </>
   }
  />
 );
}
