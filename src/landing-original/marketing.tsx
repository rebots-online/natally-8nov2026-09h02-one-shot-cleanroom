import { signOutBilling } from './services/billingApi';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { FirebaseError } from 'firebase/app';
import { GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { AtelierScene } from './components/atelier/AtelierScene';
import { AtelierAmbience } from './components/atelier/AtelierAmbience';
import { Inset } from '../app/stage/Inset';
import { describeSignInFailure } from '../platform/firebase';
import { auth } from './services/firebase';
import { initializeInteractionAnalytics, updateInteractionContext, trackInteraction, beginInteractionEpisode, chartAnalyticsTarget, type InteractionInputMethod } from './services/interactionAnalytics';
import { readCreditBalance, formatReadingAllowance } from './services/billingApi';
import { fetchUserIntake, loadNatalIntake } from './services/onboarding';
import { requiresFreshOnboarding } from './services/natallyHistory';
import { calculateNatalChart, type NatalChartInput, type NatalChartResult } from './services/ephemeris';
import { chartTargetLabel, chartTargets } from './services/chartTargets';
import { getAuthoredChartExplanation, getAuthoredUpsellClose, type AuthoredExplanation } from './services/authoredChartExplanations';
import { createAuthoredEducationSession, readEducationInviteSettings, type AuthoredEducationSession } from './services/authoredEducationSession';
import { nextAuthoredNudge, readNudgeSettings, type NudgeSession } from './services/authoredNudges';
import { HISTORY_ERASURE_EVENT, isNatallyHistoryErasing, type HistoryErasureNotice } from './services/historyLifecycle';
import { loadVoiceSettings, speakNatallyText, isSpeechBusy, SPEECH_ACTIVITY_EVENT } from './services/voiceService';
import './marketing.css';

type Phase =
  | { kind: 'resolving' }
  | { kind: 'signed-out' }
  | { kind: 'no-intake' }
  | { kind: 'loading'; uid: string; intake: NatalChartInput }
  | { kind: 'ready'; uid: string; intake: NatalChartInput; chart: NatalChartResult }
  | { kind: 'error'; message: string };
type View = 'atelier' | 'chart';
type SpeechState = 'idle' | 'preparing' | 'speaking' | 'error';
type ChartNarration = { ownerUid: string; generation: number; controller: AbortController; targets: readonly string[] };
const rootLanding = window.location.pathname === '/' || window.location.pathname === '/index.html';
const appEntry = (offer?: 'conversation') => {
  const destination = new URL(window.location.href);
  destination.pathname = '/app.html';
  destination.searchParams.set('app', '1');
  destination.searchParams.delete('offer'); destination.searchParams.delete('offers'); destination.searchParams.delete('restore');
  if (offer) destination.searchParams.set('offer', offer);
  return destination.href;
};
type InsetPosition = { x: number; y: number };
const boundedInset = (position: InsetPosition): InsetPosition => ({ x: Math.max(0, Math.min(1, position.x)), y: Math.max(0, Math.min(1, position.y)) });
const GUEST_ROOM = '__marketing_guest__';
const envString = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' && value ? value : fallback;
};
const APP_PATH = envString('VITE_APP_PATH', '/app.html');
const APP_NAMESPACE = envString('VITE_APP_NAMESPACE', 'natally');
const EXAMPLE_CHART_INPUT: NatalChartInput = {
  name: 'Aurelia', birthDate: '1988-08-31', birthTime: '14:30',
  placeName: 'Toronto, ON, Canada', latitude: 43.6532, longitude: -79.3832,
  timezoneOffset: -4, houseSystem: 'W',
};
const STORY_SECTIONS = ['meet-natally', 'your-chart', 'reading-aloud', 'talk-with-natally'];
const nudgeSettings = readNudgeSettings(import.meta.env);
const educationInviteSettings = readEducationInviteSettings(import.meta.env);
const WELCOME = 'Come in. You can explore my room, move the little things on my shelves, and see what catches your eye. With your own chart here, choose a planet, sign, house or relationship and I will explain it.';

const MarketingExperience: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ kind: 'resolving' });
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountDialogUid, setAccountDialogUid] = useState<string | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);
  const [credits, setCredits] = useState<CreditsState>({ kind: 'idle' });
  const [inset, setInset] = useState<InsetPosition>({ x: 0, y: 1 });
  const [dragging, setDragging] = useState(false);
  const [activeSection, setActiveSection] = useState(STORY_SECTIONS[0]);
  const [manualView, setManualView] = useState<View | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [lesson, setLesson] = useState<AuthoredExplanation | null>(null);
  const [lessonChartActive, setLessonChartActive] = useState(false);
  const [aside, setAside] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(nudgeSettings.notice);
  const [voiceSettings, setVoiceSettings] = useState(loadVoiceSettings);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [chartNarration, setChartNarration] = useState<ChartNarration | null>(null);
  const [exampleChart, setExampleChart] = useState<NatalChartResult | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState === 'visible');
  const [inView, setInView] = useState(false);
  const frameRef = useRef<HTMLElement | null>(null);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const insetRef = useRef(inset);
  const dragRef = useRef<{ pointer: number; clientX: number; clientY: number; x: number; y: number; rangeX: number; rangeY: number } | null>(null);
  const creditGeneration = useRef(0);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const ownerRef = useRef<string | null>(null);
  const voiceRef = useRef<AbortController | null>(null);
  const voiceAllowedRef = useRef(false);
  const nudgeSessionRef = useRef<NudgeSession>({ candidates: new Map(), presented: new Set(), recent: [] });
  const nudgeControl = useRef<{ refresh: () => void } | null>(null);
  const lastSpoken = useRef(WELCOME);
  const speechBusyRef = useRef(false);
  const lessonSpeechRef = useRef(0);
  const educationSession = useRef<AuthoredEducationSession | null>(null);
  const exampleChartPromiseRef = useRef<Promise<NatalChartResult> | null>(null);
  const selectorInput = useRef<InteractionInputMethod>('unknown');
  const analyticsPrevious = useRef<{ owner: string | null; section: string; manual: View | null; speech: SpeechState; account: string | null; narrating: boolean } | null>(null);

  const roomUid = ownerUid || GUEST_ROOM;
  const ownedChart = phase.kind === 'ready' && phase.uid === ownerUid && auth.currentUser?.uid === ownerUid ? phase.chart : null;
  const displayedChart = ownedChart ?? exampleChart;
  const automaticView: View = activeSection === 'your-chart' || activeSection === 'reading-aloud' ? 'chart' : 'atelier';
  const narratingChart = chartNarration && chartNarration.targets.length > 0 && chartNarration.ownerUid === ownerUid &&
    chartNarration.generation === generationRef.current && voiceRef.current === chartNarration.controller &&
    !chartNarration.controller.signal.aborted && inView && documentVisible && !document.hidden &&
    (speechState === 'preparing' || speechState === 'speaking');
  const view: View = displayedChart ? manualView || (lessonChartActive ? 'chart' : lesson ? 'atelier' : automaticView) : 'atelier';
  const analyticsAccess = credits.kind === 'ready' && credits.uid === ownerUid && auth.currentUser?.uid === ownerUid && credits.balance > 0 ? 'available' : 'unknown';
  useEffect(() => {
    if (!authResolved || (rootLanding && auth.currentUser)) return;
    try { initializeInteractionAnalytics('marketing'); }
    catch { console.error('Interaction analytics initialization failed (VITE_GA_MEASUREMENT_ID).'); }
  }, [authResolved]);
  useEffect(() => {
    const previous = analyticsPrevious.current;
    let source: 'user_action' | 'automatic_scroll_swap' | 'narration' | 'lifecycle' = 'lifecycle';
    if (previous && previous.owner === ownerUid) {
      if (previous.account !== accountDialogUid || (manualView !== null && previous.manual !== manualView)) source = 'user_action';
      else if (previous.section !== activeSection || (previous.manual !== null && manualView === null)) source = 'automatic_scroll_swap';
      else if (previous.speech !== speechState || previous.narrating || narratingChart) source = 'narration';
    }
    updateInteractionContext({
      scene: authResolved ? view : 'none', panel: accountDialogUid ? 'account' : 'world',
      visible: authResolved && inView && documentVisible, listening: speechState === 'speaking', source, paid_access_state: analyticsAccess
    });
    analyticsPrevious.current = { owner: ownerUid, section: activeSection, manual: manualView, speech: speechState, account: accountDialogUid, narrating: !!narratingChart };
  }, [authResolved, view, ownerUid, activeSection, manualView, speechState, accountDialogUid, inView, documentVisible, narratingChart, analyticsAccess]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Tab') selectorInput.current = 'keyboard'; };
    const pointer = (event: PointerEvent) => { selectorInput.current = event.pointerType === 'touch' ? 'touch' : 'pointer'; };
    document.addEventListener('keydown', keyboard, true); document.addEventListener('pointerdown', pointer, true);
    return () => {
      document.removeEventListener('keydown', keyboard, true); document.removeEventListener('pointerdown', pointer, true);
      updateInteractionContext({ scene: 'none', visible: false, listening: false, paid_access_state: 'unknown', source: 'lifecycle' });
    };
  }, []);
  const insetKey = `${APP_NAMESPACE}.marketing.inset-position.${roomUid}`;
  const placeInset = (position: InsetPosition, save = true) => {
    const next = boundedInset(position); insetRef.current = next; setInset(next);
    if (save) try { localStorage.setItem(insetKey, JSON.stringify(next)); } catch { /* Movement remains available for this visit. */ }
  };
  useEffect(() => {
    dragRef.current = null; setDragging(false);
    try {
      const saved = JSON.parse(localStorage.getItem(insetKey) || 'null');
      placeInset(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : { x: 0, y: 1 }, false);
    } catch { placeInset({ x: 0, y: 1 }, false); }
  }, [insetKey]);
  const endInsetDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointer !== event.pointerId) return;
    dragRef.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    placeInset(insetRef.current);
  };
  const insetStyle = { '--marketing-inset-left': `calc(${inset.x * 68}% + ${10 - inset.x * 20}px)`, '--marketing-inset-top': `calc(${inset.y * 68}% + ${10 - inset.y * 20}px - var(--marketing-inset-handle-height) * ${inset.y})` } as React.CSSProperties;
  const loadCredits = useCallback(async (uid: string) => {
    const generation = ++creditGeneration.current;
    if (auth.currentUser?.uid !== uid) return;
    setCredits({ kind: 'loading', uid });
    try {
      const balance = await readCreditBalance();
      if (!mountedRef.current || creditGeneration.current !== generation || auth.currentUser?.uid !== uid || ownerRef.current !== uid) return;
      if (balance.ownerUid !== uid) throw new Error('Credits did not match your account.');
      setCredits({ kind: 'ready', uid, balance: balance.balance });
    } catch {
      if (mountedRef.current && creditGeneration.current === generation && auth.currentUser?.uid === uid && ownerRef.current === uid) setCredits({ kind: 'error', uid, message: 'Hmm, I couldn\'t reach your credits just now — try again?' });
    }
  }, []);
  useEffect(() => {
    creditGeneration.current++; setCredits({ kind: 'idle' });
    if (!user || !authResolved) return;
    const refresh = () => { if (!document.hidden && auth.currentUser?.uid === user.uid) void loadCredits(user.uid); };
    refresh(); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh); window.addEventListener('natally:purchase-access-changed', refresh);
    return () => { creditGeneration.current++; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('natally:purchase-access-changed', refresh); };
  }, [user?.uid, authResolved, loadCredits]);
  const isCurrentOwner = () => mountedRef.current && (auth.currentUser?.uid || null) === ownerRef.current &&
    !isNatallyHistoryErasing(ownerRef.current);
  const abortOwnedVoice = () => {
    const current = voiceRef.current;
    voiceRef.current = null;
    current?.abort();
    speechBusyRef.current = false;
    setSpeechState('idle'); setChartNarration(null);
  };
  const stopVoice = () => {
    voiceAllowedRef.current = false; setVoiceEnabled(false);
    lessonSpeechRef.current++; setLessonChartActive(false);
    abortOwnedVoice(); nudgeControl.current?.refresh();
  };

  const speak = async (text: string, explicit = false, narrationTargets: readonly string[] = [], entryPoint: 'voice' | 'replay' | 'chart_object' | 'placement_select' = 'voice', idle = false, onAdmitted?: () => void): Promise<boolean> => {
    if (!isCurrentOwner() || document.hidden || !inView) return false;
    if (idle && isSpeechBusy()) return false;
    if (explicit) {
      voiceAllowedRef.current = true; setVoiceEnabled(true);
    }
    if (!voiceAllowedRef.current || (!voiceSettings.readingAloud && !explicit)) return false;
    abortOwnedVoice();
    const controller = new AbortController();
    const owner = ownerRef.current, generation = generationRef.current;
    voiceRef.current = controller; speechBusyRef.current = true;
    setChartNarration(owner && ownedChart && narrationTargets.length > 0 ? { ownerUid: owner, generation, controller, targets: [...narrationTargets] } : null);
    lastSpoken.current = text; setSpeechState('preparing');
    nudgeControl.current?.refresh();
    const current = () => mountedRef.current && !controller.signal.aborted && voiceRef.current === controller &&
      ownerRef.current === owner && generationRef.current === generation && isCurrentOwner() && !document.hidden;
    let finishPlayback: ReturnType<typeof beginInteractionEpisode> | null = null;
    const endPlayback = (outcome: 'completed' | 'cancelled') => { finishPlayback?.(outcome); finishPlayback = null; };
    controller.signal.addEventListener('abort', () => endPlayback('cancelled'), { once: true });
    const settings = { ...voiceSettings, readingAloud: true };
    if (explicit && !voiceSettings.readingAloud) setVoiceSettings(settings);
    try {
      const complete = await speakNatallyText(text, settings,
        () => { if (current()) { if (!finishPlayback) finishPlayback = beginInteractionEpisode('voice_playback', { entry_point: entryPoint, response_mode: 'no_response' }); setSpeechState('speaking'); } },
        () => { if (current()) { speechBusyRef.current = false; setSpeechState('idle'); setChartNarration(null); } },
        undefined,
        { idle, onAdmitted, signal: controller.signal, onPreparing: preparing => { if (current()) setSpeechState(preparing ? 'preparing' : 'speaking'); } });
      if (!current()) return false;
      voiceRef.current = null; speechBusyRef.current = false;
      endPlayback(complete ? 'completed' : 'cancelled');
      setSpeechState(complete ? 'idle' : 'error'); setChartNarration(null);
      return complete;
    } catch {
      endPlayback('cancelled');
      if (current()) { trackInteraction('voice_playback', { status: 'failed', entry_point: entryPoint, response_mode: 'no_response' }); speechBusyRef.current = false; setSpeechState('error'); setChartNarration(null); }
      return false;
    } finally {
      endPlayback('cancelled');
      if (voiceRef.current === controller) { voiceRef.current = null; speechBusyRef.current = false; }
      nudgeControl.current?.refresh();
    }
  };

  // A1: the landing example chart is pure local ephemeris computation — one
  // calculation per visitor session, cached in a ref; never network/auth/inference.
  const loadExampleChart = useCallback(async (): Promise<NatalChartResult> => {
    let computation = exampleChartPromiseRef.current;
    if (!computation) {
      computation = calculateNatalChart(EXAMPLE_CHART_INPUT);
      exampleChartPromiseRef.current = computation;
    }
    return computation;
  }, []);

  const load = useCallback((uid: string | null) => {
    const generation = ++generationRef.current;
    const room = uid || GUEST_ROOM;
    if (educationSession.current?.ownerUid !== room) educationSession.current = createAuthoredEducationSession(room, educationInviteSettings);
    voiceAllowedRef.current = false; setVoiceEnabled(false);
    const currentVoice = voiceRef.current; voiceRef.current = null; currentVoice?.abort();
    speechBusyRef.current = false; setSpeechState('idle'); setChartNarration(null);
    setLesson(null); setAside(null); setSelectedComponents([]); setManualView(null);
    lessonSpeechRef.current++; setLessonChartActive(false);
    lastSpoken.current = WELCOME;
    setNotice(nudgeSettings.notice);
    setPhase(uid ? { kind: 'resolving' } : { kind: 'signed-out' });
    nudgeSessionRef.current = { candidates: new Map(), presented: new Set(), recent: [] };
    const isCurrent = () => mountedRef.current && generationRef.current === generation &&
      auth.currentUser?.uid === uid && !isNatallyHistoryErasing(uid);
    if (!uid) return;
    if (isNatallyHistoryErasing(uid)) { setPhase({ kind: 'no-intake' }); return; }
    try { if (requiresFreshOnboarding(uid)) { setPhase({ kind: 'no-intake' }); return; } }
    catch { setPhase({ kind: 'error', message: 'I couldn\'t quite read my shelf of charts — try again?' }); return; }
    void (async () => {
      try {
        const local = loadNatalIntake(uid);
        let localReady = false;
        if (local) {
          setPhase({ kind: 'loading', uid, intake: local });
          try {
            const chart = await calculateNatalChart(local);
            if (!isCurrent()) return;
            setPhase({ kind: 'ready', uid, intake: local, chart }); localReady = true;
          } catch { if (!isCurrent()) return; }
        }
        try {
          const remote = await fetchUserIntake(uid);
          if (!isCurrent()) return;
          if (!remote) {
            if (!localReady) setPhase(local ? { kind: 'error', message: 'Your saved intake is invalid.' } : { kind: 'no-intake' });
            return;
          }
          if (localReady && JSON.stringify(remote) === JSON.stringify(local)) return;
          if (!localReady) setPhase({ kind: 'loading', uid, intake: remote });
          const chart = await calculateNatalChart(remote);
          if (isCurrent()) {
            const currentVoice = voiceRef.current; voiceRef.current = null; currentVoice?.abort();
            speechBusyRef.current = false; setSpeechState('idle'); setChartNarration(null); setLesson(null); setSelectedComponents([]);
            lessonSpeechRef.current++; setLessonChartActive(false);
            setPhase({ kind: 'ready', uid, intake: remote, chart });
          }
        } catch { if (isCurrent() && !localReady) setPhase({ kind: 'error', message: 'Your chart slipped off the shelf — let\'s try again.' }); }
      } catch { if (isCurrent()) setPhase({ kind: 'error', message: 'I couldn\'t read your birth details just now.' }); }
    })();
  }, []);

  // One-click sign-in (ARCHITECTURE §Header, menu and sign-in): the Sign In
  // control starts Google sign-in directly — popup, redirect when blocked —
  // and every outcome but success is named right where they tapped.
  const startSignIn = async () => {
    if (signInBusy) return;
    setAccountError(null);
    setSignInBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        if (error instanceof FirebaseError && error.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw error;
      }
      // Success: the auth observer carries the visitor into the app.
    } catch (error) {
      setSignInBusy(false);
      setAccountError(describeSignInFailure(error));
    }
  };

  // A redirect sign-in that came back failed shows its specific message here.
  useEffect(() => {
    getRedirectResult(auth).catch(error => setAccountError(describeSignInFailure(error)));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setAccountDialogUid(null);
      if (user && rootLanding) { window.location.replace(appEntry()); return; }
      setUser(user); setAuthResolved(true); setAccountError(null);
      creditGeneration.current++; setCredits({ kind: 'idle' });
      ownerRef.current = user?.uid || null; setOwnerUid(ownerRef.current); load(ownerRef.current);
    }, error => {
      setAccountDialogUid(null);
      setUser(null); setAuthResolved(false); setAccountError(error.message || 'I couldn\'t tell who\'s at my door just now.');
      creditGeneration.current++; setCredits({ kind: 'idle' });
      ownerRef.current = null; setOwnerUid(null); load(null);
      setPhase({ kind: 'error', message: error.message || 'I couldn\'t tell who\'s at my door just now. Try again in a moment.' });
    });
    const erasure = (event: Event) => {
      const detail = (event as CustomEvent<HistoryErasureNotice>).detail;
      if (detail.accountUid !== ownerRef.current) return;
      load(ownerRef.current);
      if (detail.phase === 'erasing') setPhase({ kind: 'no-intake' });
    };
    window.addEventListener(HISTORY_ERASURE_EVENT, erasure);
    return () => {
      mountedRef.current = false; generationRef.current++;
      educationSession.current = null;
      const current = voiceRef.current; voiceRef.current = null; current?.abort();
      unsubscribe(); window.removeEventListener(HISTORY_ERASURE_EVENT, erasure);
    };
  }, [load]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setReducedMotion(media.matches);
    const visibility = () => {
      setDocumentVisible(!document.hidden);
      if (document.hidden) stopVoice();
    };
    media.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => { setManualView(null); }, [activeSection]);
  useEffect(() => {
    if (phase.kind !== 'signed-out' && phase.kind !== 'no-intake') return;
    let cancelled = false;
    void loadExampleChart().then(chart => {
      if (!cancelled && mountedRef.current) setExampleChart(chart);
    }, () => { /* The example stays absent; the intake guidance already tells the truth. */ });
    return () => { cancelled = true; };
  }, [phase.kind, loadExampleChart]);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-head');
    if (!header) return;
    const measure = () => document.documentElement.style.setProperty('--marketing-header-height', header.getBoundingClientRect().height + 'px');
    const observer = new ResizeObserver(measure); observer.observe(header); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    roomRef.current?.toggleAttribute('inert', view !== 'atelier');
    chartRef.current?.removeAttribute('inert');
  }, [view, ownedChart]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: .08 });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!inView) stopVoice(); }, [inView]);

  useEffect(() => {
    const frame = frameRef.current;
    const story = frame?.closest<HTMLElement>('.marketing-story');
    if (!frame || !story) return;
    let raf = 0, position = 0, velocity = 0, target = 0, previousY = window.scrollY, previousAt = performance.now();
    const updateSection = () => {
      const narrow = window.matchMedia('(max-width: 820px)').matches;
      const bottom = narrow ? frame.getBoundingClientRect().bottom : 0;
      const line = narrow ? Math.min(window.innerHeight - 32, bottom + Math.max(24, (window.innerHeight - bottom) * .3)) : window.innerHeight * .42;
      const sections = STORY_SECTIONS.map(id => ({ id, rect: document.getElementById(id)?.getBoundingClientRect() })).filter(entry => entry.rect);
      const crossing = sections.find(entry => entry.rect!.top <= line && entry.rect!.bottom > line);
      const nearest = crossing || sections.reduce((best, entry) => Math.abs(entry.rect!.top - line) < Math.abs(best.rect!.top - line) ? entry : best, sections[0]);
      if (nearest) setActiveSection(nearest.id);
      story.style.setProperty('--marketing-frame-height', frame.offsetHeight + 'px');
    };
    const settle = () => {
      raf = 0; updateSection();
      if (reducedMotion || document.hidden) { position = velocity = target = 0; }
      else {
        target *= .78;
        velocity = (velocity + (target - position) * .14) * .72;
        position = Math.max(-9, Math.min(9, position + velocity));
      }
      frame.style.setProperty('--marketing-spring-y', position.toFixed(3) + 'px');
      frame.style.setProperty('--marketing-spring-angle', (position * .07).toFixed(3) + 'deg');
      if (Math.abs(position) + Math.abs(velocity) + Math.abs(target) > .025) raf = requestAnimationFrame(settle);
      else { frame.style.setProperty('--marketing-spring-y', '0px'); frame.style.setProperty('--marketing-spring-angle', '0deg'); }
    };
    const scroll = () => {
      const now = performance.now(), delta = window.scrollY - previousY;
      target = reducedMotion ? 0 : Math.max(-7, Math.min(7, delta / Math.max(16, now - previousAt) * 2));
      previousY = window.scrollY; previousAt = now;
      if (!raf) raf = requestAnimationFrame(settle);
    };
    const observer = new IntersectionObserver(updateSection, { threshold: [0, .15, .4, .7, 1] });
    STORY_SECTIONS.forEach(id => { const section = document.getElementById(id); if (section) observer.observe(section); });
    window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', scroll);
    document.addEventListener('visibilitychange', scroll);
    updateSection();
    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll);
      document.removeEventListener('visibilitychange', scroll);
      frame.style.setProperty('--marketing-spring-y', '0px'); frame.style.setProperty('--marketing-spring-angle', '0deg');
    };
  }, [reducedMotion]);

  const runtime = useRef<{ eligible: () => boolean; speak: typeof speak }>({ eligible: () => false, speak });
  runtime.current = {
    eligible: () => isCurrentOwner() && voiceAllowedRef.current && voiceSettings.readingAloud &&
      inView && documentVisible && view === 'atelier' && !isSpeechBusy() && !speechBusyRef.current && speechState === 'idle', speak
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null, epoch = 0, resolving = false, disposed = false;
    const clear = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
    const refresh = () => {
      if (disposed || !runtime.current.eligible()) { epoch++; resolving = false; clear(); return; }
      if (!nudgeSettings.enabled || timer !== null || resolving) return;
      timer = setTimeout(() => {
        timer = null; if (!runtime.current.eligible()) { refresh(); return; }
        resolving = true; const attempt = ++epoch, generation = generationRef.current, session = nudgeSessionRef.current;
        const current = () => !disposed && attempt === epoch && generation === generationRef.current && runtime.current.eligible();
        void nextAuthoredNudge(roomUid, session, current, (nudge, rememberAdmission) => {
          if (!current()) return Promise.resolve(false);
          setNotice(nudge.notice);
          if (!nudge.soul.character) return Promise.resolve(false);
          return runtime.current.speak(nudge.text, false, [], 'voice', true, () => {
            rememberAdmission(isCurrentOwner); setNotice(nudge.notice);
            session.presented.add(nudge.id); session.recent = [...session.recent, nudge.id].slice(-2);
            setAside(nudge.text);
          });
        }).catch(error => { if (current()) setNotice(error instanceof Error ? error.message : 'That memory went fuzzy on me.'); })
          .finally(() => { if (attempt === epoch) { resolving = false; refresh(); } });
      }, (nudgeSettings.minSeconds + Math.random() * (nudgeSettings.maxSeconds - nudgeSettings.minSeconds)) * 1000);
    };
    const control = { refresh }; nudgeControl.current = control;
    window.addEventListener(SPEECH_ACTIVITY_EVENT, refresh); refresh();
    return () => { disposed = true; epoch++; clear(); window.removeEventListener(SPEECH_ACTIVITY_EVENT, refresh); if (nudgeControl.current === control) nudgeControl.current = null; };
  }, [roomUid]);
  useEffect(() => { nudgeControl.current?.refresh(); }, [view, voiceEnabled, voiceSettings.readingAloud, inView, documentVisible, speechState, phase]);

  const explain = (target: string, isMulti = false, entryPoint: 'chart_object' | 'placement_select' = 'chart_object') => {
    const chart = displayedChart;
    if (!chart || !isCurrentOwner()) return;
    const session = educationSession.current, owner = ownerRef.current, generation = generationRef.current;
    if (!session || session.ownerUid !== roomUid) return;
    const close = getAuthoredUpsellClose(chart, 'default');
    const prepared = session.prepare(crypto.randomUUID(), framing => getAuthoredChartExplanation(chart, target, framing));
    if (!prepared) return;
    const committed = session.commit(prepared, () => educationSession.current === session && generationRef.current === generation &&
      ownerRef.current === owner && isCurrentOwner() && !document.hidden, nextLesson => {
        const finishAnswer = beginInteractionEpisode('education_answer', { activity_kind: 'education', response_mode: 'authored_free', entry_point: entryPoint, ...chartAnalyticsTarget(target) });
        // A placement starts an automatic explanation, not a persistent view pin.
        // A deliberate view choice made afterwards still takes precedence.
        setManualView(null);
        setLesson({ ...nextLesson, text: nextLesson.text + '\n\n' + close }); setLessonChartActive(true); setAside(null);
        setSelectedComponents(previous => isMulti ? Array.from(new Set([...previous, ...nextLesson.targets])) : nextLesson.targets);
        finishAnswer();
      });
    if (!committed) return;
    const nextLesson = prepared.answer, speech = ++lessonSpeechRef.current;
    if (voiceSettings.readingAloud) void (async () => {
      try { await speak(nextLesson.text + '\n\n' + close, true, nextLesson.targets, entryPoint); }
      finally { if (lessonSpeechRef.current === speech) setLessonChartActive(false); }
    })();
    else { abortOwnedVoice(); setLessonChartActive(false); }
  };
  const targets = useMemo(() => displayedChart ? chartTargets(displayedChart) : [], [displayedChart]);
  const caption = ownedChart ? ownedChart.input.name + ' · born ' + ownedChart.input.birthDate + ', ' +
    (ownedChart.input.birthTimeUnknown ? 'birth time not stated · Whole Sign' : ownedChart.input.birthTime + ' · ' + (ownedChart.input.houseSystem === 'P' ? 'Placidus' : 'Whole Sign')) +
    ' · ' + ownedChart.input.placeName : null;
  const exampleCaptionShown = !ownedChart && !!exampleChart && (phase.kind === 'signed-out' || phase.kind === 'no-intake');
  const onVoice = () => {
    trackInteraction('interface_action', { entry_point: 'voice_control', action: voiceEnabled ? 'stop' : 'start', activity_kind: 'navigation', response_mode: 'no_response', input_method: 'unknown' });
    if (voiceEnabled) {
      stopVoice(); setVoiceSettings(previous => ({ ...previous, readingAloud: false }));
    } else {
      const text = aside || lesson?.text || WELCOME;
      if (!aside && !lesson) setAside(text);
      void speak(text, true, !aside && lesson ? lesson.targets : []);
    }
  };

  const accountMount = document.getElementById('marketing-account-root');
  const matchingCredits = credits.kind !== 'idle' && credits.uid === user?.uid && auth.currentUser?.uid === user?.uid ? credits : null;
  const signOutAccount = async () => {
    setAccountError(null);
    try { await signOutBilling(); }
    catch (error) { setAccountError(error instanceof Error ? error.message : 'The door stuck on the way out — try once more?'); }
  };
  return <>
    {accountMount && createPortal(<div className="marketing-account">
      {!authResolved ? <span role="status">{accountError || 'Seeing who\'s at my door…'}{accountError && <button type="button" onClick={() => window.location.reload()}>Retry</button>}</span> : user ? <>
        <details className="marketing-account__profile"><summary>Profile</summary><div className="marketing-account__menu">
          <span>{user.displayName || user.email || 'Your account'}</span>
          <button type="button" onClick={event => { trackInteraction('interface_action', { entry_point: 'account', action: 'open', activity_kind: 'navigation', response_mode: 'no_response', input_method: 'unknown' }); event.currentTarget.focus(); setAccountDialogUid(user.uid); }}>Account &amp; billing</button>
          <a href={appEntry()}>Open my atelier</a><button type="button" onClick={() => void signOutAccount()}>Sign out</button>
        </div></details>
        <button type="button" className="marketing-account__credits" aria-haspopup="dialog" aria-expanded={accountDialogUid === user.uid}
          aria-label={matchingCredits?.kind === 'ready' ? `${formatReadingAllowance(matchingCredits.balance)} remaining. Open Account and billing.` : 'Open Account and billing'}
          title={matchingCredits?.kind === 'error' ? matchingCredits.message : undefined}
          onClick={event => { event.currentTarget.focus(); setAccountDialogUid(user.uid); }}>
          <span aria-live="polite">{matchingCredits?.kind === 'ready' ? formatReadingAllowance(matchingCredits.balance) : matchingCredits?.kind === 'error' ? 'hmm…' : 'counting…'}</span>
        </button>
        {matchingCredits?.kind === 'error' && <button type="button" aria-label="Retry balance" onClick={() => void loadCredits(user.uid)}>Retry</button>}
        <a className="signin" href={appEntry('conversation')} data-entry="top-up">Top Up</a>
        {accountError && <span role="alert">{accountError}</span>}
      </> : <a className="signin" href={appEntry()} data-entry="sign-in" data-od-id="nav-sign-in">Sign In</a>}
    </div>, accountMount)}
    {user && accountDialogUid === user.uid && auth.currentUser?.uid === user.uid && <AccountBillingDialog key={user.uid} user={user}
      credits={matchingCredits} onRefreshCredits={loadCredits} topUpHref={appEntry('conversation')} onClose={() => { trackInteraction('interface_action', { entry_point: 'account', action: 'close', activity_kind: 'navigation', response_mode: 'no_response', input_method: 'unknown' }); setAccountDialogUid(null); }} />}
    <section ref={frameRef} className="marketing-frame" aria-label="Explore Natally's room and your chart">
      <div className="marketing-frame__spring">
        <div ref={stageRef} className="marketing-frame__stage" style={insetStyle} data-view={view} data-dragging={dragging} data-reduced-motion={reducedMotion}>
          <div className="marketing-frame__pane marketing-frame__room" data-active={view === 'atelier'}>
            <div ref={roomRef} className="marketing-frame__content" aria-hidden={view !== 'atelier'}>
              <AtelierScene key={roomUid} accountUid={roomUid} phase={speechState === 'speaking' ? 'speaking' : speechState === 'preparing' ? 'thinking' : 'idle'}
                motionEnabled={!reducedMotion && documentVisible && inView} sceneVisible={inView && documentVisible} />
            </div>
            {view !== 'atelier' && <button type="button" className="marketing-frame__foreground" aria-label="Bring Natally's room into focus" onClick={() => setManualView('atelier')} />}
          </div>
          {/* Clean-room inset (ARCHITECTURE §Chart inset, 'Inset (landing)'):
              the example/owned chart floats in the same dockable, resizable
              pane the app uses — drag across the stage, dock to the nearest
              edge or corner, corner grip 20–60% keeping aspect, arrow keys
              move, Alt+arrows resize, persisted per guest. Focused (chart
              view) it fills the stage; the room pane floats instead. */}
          {displayedChart && <div className="stage-inset-layer" data-mode={view === 'chart' ? 'fill' : 'float'}>
            <Inset storageKey={`${APP_NAMESPACE}.marketing.inset.v1.${roomUid}`} label={ownedChart ? 'Your wheel' : 'Aurelia\u2019s wheel'}
              focused={view === 'chart'} bodyCount={displayedChart.natalBodies.length}>
              <div ref={chartRef} className="marketing-frame__content" data-chart-callout-boundary data-chart-inset={view !== 'chart'}>
                <Astrolabe3D chart={displayedChart} isSpinning={!reducedMotion && documentVisible && inView} resetTrigger={0}
                  selectedComponents={selectedComponents} highlightedComponents={lesson?.targets || []} onToggleComponent={explain}
                  reducedMotion={reducedMotion} motionPaused={reducedMotion || !documentVisible || !inView} visible={inView && documentVisible}
                  showAnnotations={view === 'chart'} layoutKey={view} onActivate={view === 'atelier' ? () => setManualView('chart') : undefined} />
              </div>
            </Inset>
          </div>}
          {displayedChart && view === 'chart' && <button type="button" className="marketing-frame__inset-handle" aria-label="Move Natally's inset" title="Drag to move Natally. Arrow keys move; Home docks top left; End docks bottom right."
            onPointerDown={event => {
              if (event.button !== 0 || !stageRef.current) return;
              const rect = stageRef.current.getBoundingClientRect(), handleHeight = event.currentTarget.getBoundingClientRect().height; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...insetRef.current, rangeX: Math.max(1, rect.width * .68 - 20), rangeY: Math.max(1, rect.height * .68 - handleHeight - 20) }; setDragging(true);
            }}
            onPointerMove={event => { const start = dragRef.current; if (!start || start.pointer !== event.pointerId) return; placeInset({ x: start.x + (event.clientX - start.clientX) / start.rangeX, y: start.y + (event.clientY - start.clientY) / start.rangeY }, false); }}
            onPointerUp={endInsetDrag} onPointerCancel={endInsetDrag} onLostPointerCapture={event => { if (dragRef.current?.pointer === event.pointerId) endInsetDrag(event); }}
            onKeyDown={event => {
              const step = event.shiftKey ? .1 : .025, directions: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
              if (directions[event.key]) { event.preventDefault(); const [x, y] = directions[event.key]; placeInset({ x: insetRef.current.x + x, y: insetRef.current.y + y }); }
              else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); placeInset(event.key === 'Home' ? { x: 0, y: 0 } : { x: 1, y: 1 }); }
            }}>⠿ <span>Move Natally</span></button>}
        </div>
        <div className="marketing-frame__controls">
          <button type="button" aria-label={voiceEnabled ? 'Sound Off — turn off Natally’s voice' : 'Sound On — turn on Natally’s voice'} aria-pressed={voiceEnabled} onClick={onVoice}>{voiceEnabled ? 'Sound Off 🔇' : 'Sound On 🔊'}</button>
          {displayedChart && <label className="marketing-frame__target"><span className="marketing-frame__target-label">Explore a placement</span>
            <select value={lesson?.targets[0] || ''}
              onKeyDown={() => { selectorInput.current = 'keyboard'; }}
              onFocus={event => { const target = chartAnalyticsTarget(event.currentTarget.value); if (target && selectorInput.current === 'keyboard') trackInteraction('chart_item_focus', { ...target, entry_point: 'placement_select', input_method: 'keyboard', activity_kind: 'education', response_mode: 'no_response' }); }}
              onChange={event => { if (event.target.value) { const target = chartAnalyticsTarget(event.target.value); if (target) trackInteraction('chart_item_select', { ...target, entry_point: 'placement_select', input_method: selectorInput.current, activity_kind: 'education', response_mode: 'no_response' }); explain(event.target.value, false, 'placement_select'); } selectorInput.current = 'unknown'; }}>
              <option value="">Choose a planet, sign, house or aspect</option>
              {targets.map(target => <option key={target} value={target}>{chartTargetLabel(target)}</option>)}
            </select>
          </label>}
        </div>
        {inView && documentVisible && <AtelierAmbience view={view} phase={speechState === 'speaking' ? 'speaking' : 'idle'} />}
        <div className="marketing-frame__text">
          {view === 'chart' && <p className="marketing-frame__instruction">Click on a planet, house, sign, or aspect to hear its interpretation in astrology.</p>}
          {caption && <p className="marketing-frame__caption">{caption}</p>}
          {/* Operator directive 2026-11-08: no meta copy anywhere — the example chart is scene dressing on her wall, labelled like any chart in her room; the original's "It is not your chart." disclaimer is retired. */}
          {exampleCaptionShown && <p className="marketing-frame__caption marketing-frame__caption--example">Aurelia · born 31 Aug 1988, 2:30 PM · Whole Sign · Toronto <a href={`${APP_PATH}?app=1`}>Create your natal chart ↗</a></p>}
          {!ownedChart && <div className="marketing-frame__intake" role="status">
            {/* Operator directive 2026-11-08 immersion sweep: every page-spoken
              state line stays in her voice — no system disclaimers anywhere;
              the signed-out state lets the centred call-to-action speak. */}
            <p>{phase.kind === 'no-intake' ? 'Your chart isn\'t on my wall yet — create it, and I\'ll read it to you.'
              : phase.kind === 'error' ? phase.message
                : phase.kind === 'loading' ? 'Working out your chart, degree by degree…' : phase.kind === 'signed-out' ? '' : 'Looking for your chart on my wall…'}</p>
            {phase.kind === 'error' && <button type="button" onClick={() => { const uid = auth.currentUser?.uid || null; ownerRef.current = uid; setOwnerUid(uid); load(uid); }}>Retry chart</button>}
          </div>}
          {(lesson || aside) && <div className="marketing-frame__lesson" tabIndex={0} aria-label="Natally's complete explanation">
            {lesson && <><h3>{lesson.title}</h3><p>{lesson.text}</p></>}
            {aside && <p>{aside}</p>}
          </div>}
          {(lesson || aside) && <button type="button" className="marketing-frame__replay" onClick={() => void speak(aside || lesson?.text || lastSpoken.current, true, !aside && lesson ? lesson.targets : [], 'replay')}>{speechState === 'error' ? 'Retry voice' : 'Replay'}</button>}
          <p className="marketing-frame__status" role="status">{speechState === 'preparing' ? 'Clearing my throat…' : speechState === 'speaking' ? 'Natally is speaking' : speechState === 'error' ? (voiceEnabled ? 'My voice went quiet on me — the words are still here below. Tap Retry voice, or flip Sound Off and On again.' : 'My voice went quiet on me — the words are still here below. Tap Retry voice, or turn Sound On.') : ''}</p>
          {notice && <p className="marketing-frame__notice" role="status">{notice}</p>}
        </div>
      </div>
    </section></>;
};

// Rubric 6: the landing document ships its version badge hidden; populate it
// from the build's natally-version meta so every entry path shows the build.
{
  let badge = document.querySelector<HTMLElement>('[data-natally-version-badge]');
  const version = document.querySelector<HTMLMetaElement>('meta[name="natally-version"]')?.content;
  if (!badge && version) {
    badge = document.createElement('div');
    badge.className = 'version-badge';
    badge.setAttribute('data-natally-version-badge', '');
    badge.setAttribute('aria-label', 'Build version');
    document.body.appendChild(badge);
  }
  if (badge && version) { badge.textContent = version; badge.hidden = false; }
}
const mount = document.getElementById('marketing-experience-root');
const entryParams = new URLSearchParams(window.location.search);
const entryOffer = entryParams.get('offer');
if ('__TAURI_INTERNALS__' in window || entryParams.get('app') === '1' || entryOffer === 'reading' || entryOffer === 'conversation') {
  const destination = new URL(window.location.href); destination.pathname = '/app.html'; window.location.replace(destination.href);
} else if (mount) createRoot(mount).render(<MarketingExperience />);

