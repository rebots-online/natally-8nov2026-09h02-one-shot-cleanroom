// Account-owned conversation and interruptible guided reading. The shell owns
// the welcome; this hook advances measured sections through the same voice and
// presentation rail, with access checked before each personal synthesis.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccess } from '../../commerce/billingApi';
import { creditDisplayPerUsd } from '../../platform/env';
import {
  AuthUnavailableError,
  idToken,
  NotSignedInError,
  onAuthChange,
} from '../../platform/firebase';
import { formatCr } from '../../shared/credits';
import type { AllowanceEnvelope, ChatMessage, NatalChart } from '../../shared/types';
import type { Voice } from '../../voice';
import { parseReply, type Cue } from '../presentation/cues';
import { chartTargets } from './context';
import { buildReadingSections, readingUpgrade } from './guidedReading';
import { extractLore, retrieveLore, saveLoreEntry } from './lore';
import {
  BillingNotConfiguredError,
  ChatNetworkError,
  NoAllowanceError,
  streamChat,
} from './inference';

/** Every failure useChat can surface to the UI, truthfully typed. */
export type ChatError =
  | NoAllowanceError
  | BillingNotConfiguredError
  | ChatNetworkError
  | NotSignedInError
  | AuthUnavailableError;

/** Cadence for re-reading the ledger between turns (posted usage lags). */
const ALLOWANCE_POLL_MS = 60_000;

export interface AllowanceView {
  envelope: AllowanceEnvelope | null;
  balanceCr: string;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** One streamed reply's presentation progress, cue by cue. */
export type ReplyEvent =
  | { phase: 'begin' }
  | { phase: 'delta'; text: string; cues: Cue[] }
  | { phase: 'final' }
  | { phase: 'failed' };

export interface ChatStage {
  /** Her voice; streamed and authored replies are spoken through it. */
  voice: Voice;
  /** Authored first message: her opening reading of the chart (with cues). */
  opening: string | null;
  /**
   * While she speaks the opening reading: the prefix of it her voice has
   * reached, word by word; null when the whole reading is shown — before
   * she starts speaking, and once it is flushed.
   */
  revealedOpening?: string | null;
  /** Presentation progress of every reply, for the stage to drive. */
  onReply: (event: ReplyEvent) => void;
  /** Capture this reply's successful speech cleanup before another interaction. */
  captureSpeechCompletion?: () => (() => void);
  subscribeReadingInterruption?: (listener: () => void) => () => void;
  claimReading?: () => void;
  openingSettled?: boolean;
}

export interface UseChat {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  streaming: boolean;
  /** True while her opening reading is appearing word by word. */
  openingLive: boolean;
  error: ChatError | null;
  allowance: AllowanceView;
  guidanceState: 'waiting' | 'running' | 'paused' | 'complete';
  pauseReading: () => void;
  resumeReading: () => void;
  memoryNotice: string | null;
}

function newId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** One streaming conversation bound to a computed natal chart. */
export function useChat(chart: NatalChart, stage?: ChatStage): UseChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const [guidanceState, setGuidanceState] = useState<UseChat['guidanceState']>('waiting');
  const [owner, setOwner] = useState<string | null>(null);
  const allowance = useAllowance();
  const messagesRef = useRef<ChatMessage[]>([]);
  const stageRef = useRef<ChatStage | undefined>(stage);
  stageRef.current = stage;
  const operation = useRef({ owner: null as string | null, epoch: 0, session: 0, abort: null as AbortController | null,
    cursor: 0, educationDone: false, educationId: '', replyId: '', running: false,
    completedFree: false, openingId: '', openingText: '', chart });
  const openingLive = stage?.revealedOpening != null;
  const updateMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);
  const pauseReading = useCallback(() => {
    operation.current.epoch++;
    operation.current.abort?.abort();
    operation.current.abort = null;
    operation.current.running = false;
    stageRef.current?.voice.stop();
    stageRef.current?.onReply({ phase: 'failed' });
    setStreaming(false);
    setGuidanceState('paused');
  }, []);
  useEffect(() => {
    let live = true;
    const clear = () => {
      operation.current.epoch++;
      operation.current.abort?.abort();
      operation.current.running = false;
      stageRef.current?.voice.stop();
    };
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthChange(user => {
        if (!live) return;
        const nextOwner = user?.uid ?? null;
        if (operation.current.owner === nextOwner) return;
        if (operation.current.owner !== null) clear();
        operation.current.owner = nextOwner;
        setOwner(nextOwner);
      });
    } catch (cause) {
      setError(cause instanceof AuthUnavailableError ? cause : new AuthUnavailableError());
    }
    return () => { live = false; unsubscribe(); clear(); operation.current.owner = null; };
  }, []);
  useEffect(() => {
    operation.current.epoch++;
    operation.current.session++;
    operation.current.abort?.abort();
    Object.assign(operation.current, { chart, cursor: 0, educationDone: false, educationId: '', replyId: '', running: false, completedFree: false, openingId: '', openingText: '' });
    setStreaming(false); setError(null); setMemoryNotice(null); setGuidanceState('waiting');
    const opening = stageRef.current?.opening;
    if (opening) {
      const parsed = parseReply(opening, chartTargets(chart));
      const id = newId();
      operation.current.openingId = id;
      operation.current.openingText = parsed.text;
      updateMessages([{ id, role: 'natally', text: stageRef.current?.revealedOpening ?? parsed.text, at: Date.now() }]);
    } else updateMessages([]);
  }, [owner, chart, updateMessages]);
  useEffect(() => stageRef.current?.subscribeReadingInterruption?.(pauseReading), [stage?.subscribeReadingInterruption, pauseReading]);
  useEffect(() => {
    const id = operation.current.openingId;
    if (!id) return;
    const text = stage?.revealedOpening ?? operation.current.openingText;
    updateMessages(messagesRef.current.map(message => message.id === id ? { ...message, text } : message));
  }, [stage?.revealedOpening, updateMessages]);

  // A speech wait is abortable. Successful completion wins over the final
  // speaking:false event; cancellation never advances the reading cursor.
  const canSpeak = () => {
    const voice = stageRef.current?.voice;
    if (!voice?.admitted) return false;
    let available = true;
    const unsubscribe = voice.onState(state => { if (state.error) available = false; });
    unsubscribe();
    return available;
  };
  const finishSpeech = async (signal: AbortSignal, current: () => boolean) => {
    const active = stageRef.current;
    const complete = active?.captureSpeechCompletion?.();
    if (!active || !canSpeak()) { complete?.(); return; }
    await new Promise<void>((resolve, reject) => {
      let finished = false, heard = false;
      let unsubscribe = () => {};
      const settle = (success: boolean) => {
        if (finished) return;
        finished = true; unsubscribe(); signal.removeEventListener('abort', abort);
        if (success && current()) { complete?.(); resolve(); }
        else reject(new DOMException('The reading was interrupted.', 'AbortError'));
      };
      const abort = () => settle(false);
      signal.addEventListener('abort', abort, { once: true });
      unsubscribe = active.voice.onState(state => {
        if (state.speaking) heard = true;
        if (state.error) { settle(true); active.voice.stop(); }
        else if (heard && !state.speaking) queueMicrotask(() => settle(false));
      });
      if (finished) { unsubscribe(); return; }
      if (signal.aborted || !current()) { settle(false); return; }
      active.voice.speakStream('', { flush: true, onComplete: () => settle(true) });
    });
  };
  const deliver = async (raw: string, id: string, signal: AbortSignal, current: () => boolean) => {
    if (!current()) throw new DOMException('Interrupted', 'AbortError');
    stageRef.current?.claimReading?.();
    const parsed = parseReply(raw, chartTargets(chart));
    const existing = messagesRef.current.some(message => message.id === id);
    updateMessages(existing ? messagesRef.current.map(message => message.id === id ? { ...message, text: parsed.text } : message)
      : [...messagesRef.current, { id, role: 'natally', text: parsed.text, at: Date.now() }]);
    stageRef.current?.onReply({ phase: 'begin' });
    if (canSpeak()) stageRef.current!.voice.speakStream(parsed.text);
    stageRef.current?.onReply({ phase: 'delta', text: parsed.text, cues: parsed.cues });
    stageRef.current?.onReply({ phase: 'final' });
    await finishSpeech(signal, current);
  };
  const reply = async (uid: string, query: string, directive: string, personal: boolean, id: string,
    signal: AbortSignal, current: () => boolean) => {
    const lore = await retrieveLore(uid, query, current);
    if (!current()) throw new DOMException('Interrupted', 'AbortError');
    setMemoryNotice(previous => lore.notice ?? previous);
    const history = messagesRef.current.filter(message => message.id !== id);
    updateMessages([...history, { id, role: 'natally', text: '', at: Date.now() }]);
    stageRef.current?.claimReading?.();
    stageRef.current?.onReply({ phase: 'begin' });
    let raw = '', spoken = 0;
    for await (const delta of streamChat({ history, chart, signal, context: { lore: lore.prompt, directive, personal } })) {
      if (!current()) throw new DOMException('Interrupted', 'AbortError');
      raw += delta;
      const parsed = parseReply(extractLore(raw).text, chartTargets(chart));
      if (canSpeak() && parsed.text.length >= spoken) stageRef.current!.voice.speakStream(parsed.text.slice(spoken));
      spoken = parsed.text.length;
      updateMessages(messagesRef.current.map(message => message.id === id ? { ...message, text: parsed.text } : message));
      stageRef.current?.onReply({ phase: 'delta', text: parsed.text, cues: parsed.cues });
    }
    stageRef.current?.onReply({ phase: 'final' });
    if (spoken > 0) await finishSpeech(signal, current);
    else throw new ChatNetworkError('The reading returned no visible text. Please retry this section.');
    if (!current()) throw new DOMException('Interrupted', 'AbortError');
    const developments = extractLore(raw).developments;
    const session = operation.current.session;
    const memoryCurrent = () => operation.current.owner === uid && operation.current.chart === chart && operation.current.session === session;
    for (let index = 0; index < developments.length; index++) {
      if (!current()) throw new DOMException('Interrupted', 'AbortError');
      try { await saveLoreEntry(uid, { id: `${id}-lore-${index}`, kind: 'character', text: developments[index]! }, memoryCurrent); }
      catch (cause) { if (memoryCurrent()) setMemoryNotice(`This character detail could not be saved: ${cause instanceof Error ? cause.message : 'Please try again.'}`); }
      if (!current()) throw new DOMException('Interrupted', 'AbortError');
    }
  };
  const resumeReading = useCallback(() => {
    pauseReading();
    if (guidanceState === 'complete') {
      Object.assign(operation.current, { cursor: 0, educationDone: false, educationId: '', replyId: '', completedFree: false });
    }
    setError(null); setGuidanceState('waiting');
  }, [pauseReading, guidanceState]);
  useEffect(() => {
    if (!owner || guidanceState !== 'waiting' || stageRef.current?.openingSettled === false || openingLive) return;
    const uid = owner, epoch = ++operation.current.epoch;
    const controller = new AbortController();
    operation.current.abort = controller; operation.current.running = true;
    const current = () => operation.current.epoch === epoch && operation.current.owner === uid && operation.current.chart === chart && !controller.signal.aborted;
    setGuidanceState('running'); setStreaming(true);
    void (async () => {
      // Child passive effects can run before the shell resets its opening
      // refs. Yield one microtask, then claim speech only after that reset.
      await Promise.resolve();
      if (!current()) return;
      if (stageRef.current?.openingSettled === false || stageRef.current?.revealedOpening != null) {
        setGuidanceState('waiting');
        return;
      }
      stageRef.current?.claimReading?.();
      const sections = buildReadingSections(chart);
      let free = false;
      for (; operation.current.cursor < sections.length && current();) {
        const section = sections[operation.current.cursor]!;
        const progress = operation.current;
        if (!progress.educationId) progress.educationId = newId();
        if (!progress.educationDone) {
          const cues = section.targets.length ? `[[view:chart]][[chart:${section.targets.join(';')}]]` : '[[chart:clear]][[view:atelier]]';
          await deliver(cues + section.education + ' [[chart:clear]][[view:atelier]]', progress.educationId, controller.signal, current);
          if (!current()) return;
          progress.educationDone = true;
        }
        let access: AllowanceEnvelope | null = null;
        try { access = await getAccess(await idToken()); }
        catch (cause) { if (current()) setError(new ChatNetworkError(`Reading access could not be checked. ${cause instanceof Error ? cause.message : ''}`)); }
        if (!current()) return;
        if (!progress.replyId) progress.replyId = newId();
        if (access?.state === 'ready' && access.allowanceUsdMicros > 0) {
          await reply(uid, section.title, section.directive, true, progress.replyId, controller.signal, current);
        } else {
          free = true;
          progress.completedFree = true;
          if (access !== null) await deliver(readingUpgrade(section, progress.cursor), progress.replyId, controller.signal, current);
        }
        if (!current()) return;
        progress.cursor++; progress.educationDone = false; progress.educationId = ''; progress.replyId = '';
      }
      if (!current()) return;
      await deliver("[[chart:clear]][[view:atelier]]That's the complete tour of the chart we have. What would you like to explore in your own words?", newId(), controller.signal, current);
      if (current()) { operation.current.completedFree = free; setGuidanceState('complete'); }
    })().catch(cause => {
      if (!current()) return;
      setError(cause instanceof NoAllowanceError || cause instanceof BillingNotConfiguredError || cause instanceof ChatNetworkError || cause instanceof NotSignedInError || cause instanceof AuthUnavailableError
        ? cause : new ChatNetworkError(cause instanceof Error ? cause.message : 'The reading was interrupted.'));
      stageRef.current?.voice.stop(); stageRef.current?.onReply({ phase: 'failed' }); setGuidanceState('paused');
    }).finally(() => {
      if (current()) { operation.current.running = false; setStreaming(false); allowance.refresh(); }
    });
  }, [owner, chart, guidanceState, stage?.openingSettled, openingLive]);
  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pauseReading();
    const uid = operation.current.owner;
    if (!uid) { setError(new NotSignedInError()); return; }
    const epoch = operation.current.epoch;
    const controller = new AbortController(); operation.current.abort = controller;
    const current = () => operation.current.epoch === epoch && operation.current.owner === uid && operation.current.chart === chart && !controller.signal.aborted;
    const user = { id: newId(), role: 'user' as const, text: trimmed, at: Date.now() };
    const session = operation.current.session;
    const memoryCurrent = () => operation.current.owner === uid && operation.current.chart === chart && operation.current.session === session;
    updateMessages([...messagesRef.current, user]); setError(null); setStreaming(true);
    void saveLoreEntry(uid, { id: user.id, kind: 'user', text: trimmed }, memoryCurrent).catch(cause => {
      if (memoryCurrent()) setMemoryNotice(`Your words could not be saved: ${cause instanceof Error ? cause.message : 'Please try again.'}`);
    });
    try {
      const access = await getAccess(await idToken());
      if (!current()) return;
      await reply(uid, trimmed, 'Answer this actual user question. Explain each component generally first; provide personal synthesis only with the supplied verified access. Missing current sky or second-chart data must be requested, not invented.',
        access.state === 'ready' && access.allowanceUsdMicros > 0, newId(), controller.signal, current);
    } catch (cause) {
      if (current()) { setError(cause instanceof NoAllowanceError || cause instanceof BillingNotConfiguredError || cause instanceof ChatNetworkError || cause instanceof NotSignedInError || cause instanceof AuthUnavailableError
        ? cause : new ChatNetworkError(cause instanceof Error ? cause.message : 'The reply could not continue.')); stageRef.current?.voice.stop(); stageRef.current?.onReply({ phase: 'failed' }); }
    } finally { if (current()) { setStreaming(false); allowance.refresh(); } }
  };
  return { messages, send, streaming, openingLive, error, allowance, guidanceState, pauseReading, resumeReading, memoryNotice };
}

/** Poll the billing ledger and expose the envelope plus its Cr balance. */
export function useAllowance(): AllowanceView {
  const [envelope, setEnvelope] = useState<AllowanceEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const ownerGeneration = generation.current, serial = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next = await getAccess(await idToken());
      if (generation.current === ownerGeneration && request.current === serial) setEnvelope(next);
    } catch (cause) {
      if (generation.current === ownerGeneration && request.current === serial) {
        setEnvelope(null);
        setError(cause instanceof Error ? cause.message : 'Your balance could not be reached.');
      }
    } finally {
      if (generation.current === ownerGeneration && request.current === serial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    try { unsubscribe = onAuthChange(() => { generation.current++; setEnvelope(null); void refresh(); }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Reading access is unavailable.'); setLoading(false); }
    const timer = window.setInterval(() => void refresh(), ALLOWANCE_POLL_MS);
    const onAllowanceChanged = () => void refresh();
    window.addEventListener('natally-allowance-changed', onAllowanceChanged);
    return () => {
      generation.current++; unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener('natally-allowance-changed', onAllowanceChanged);
    };
  }, [refresh]);

  return {
    envelope,
    balanceCr: envelope === null
      ? ''
      : formatCr(envelope.allowanceUsdMicros, creditDisplayPerUsd()),
    loading,
    error,
    refresh: () => void refresh(),
  };
}
