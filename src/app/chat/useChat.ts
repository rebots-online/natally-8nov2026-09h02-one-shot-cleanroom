// React state for a conversation with Natally (DOCS/ARCHITECTURE.md
// §Surfaces /app.html + §First reveal and speech-driven presentation).
// send() appends the user turn, streams the reply into the last message
// live, and converts typed inference failures into banner state. Every
// reply passes through the presentation-cue parser: what is shown and
// spoken is the cleaned text, and the cues travel to the stage through
// onReply so highlight and view track her voice. Persona questions get her
// authored backstory answer instead of a billed completion; quiet moments
// after a completed turn get, at most once between user turns, a
// spontaneous story from the backstage shelf. The stage can seed the
// conversation with her opening reading of the chart. useAllowance()
// keeps the ledger envelope fresh.

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextSpontaneousStory } from '../../content/backstory';
import { getAccess } from '../../commerce/billingApi';
import { creditDisplayPerUsd } from '../../platform/env';
import {
  AuthUnavailableError,
  idToken,
  NotSignedInError,
} from '../../platform/firebase';
import { formatCr } from '../../shared/credits';
import type { AllowanceEnvelope, ChatMessage, NatalChart } from '../../shared/types';
import type { Voice } from '../../voice';
import { parseReply, type Cue } from '../presentation/cues';
import { backstoryAnswerFor, chartTargets } from './context';
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

/** How quiet a completed turn must go before a spontaneous story. */
const SPONTANEOUS_IDLE_MS = 60_000;

export interface AllowanceView {
  envelope: AllowanceEnvelope | null;
  balanceCr: string;
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
  /** Presentation progress of every reply, for the stage to drive. */
  onReply: (event: ReplyEvent) => void;
}

export interface UseChat {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  streaming: boolean;
  error: ChatError | null;
  allowance: AllowanceView;
}

function newId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** One streaming conversation bound to a computed natal chart. */
export function useChat(chart: NatalChart, stage?: ChatStage): UseChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const allowance = useAllowance();

  // Mirror of `messages` so streaming updates never read stale state.
  const messagesRef = useRef<ChatMessage[]>([]);
  const streamingRef = useRef(false);
  const idleTimerRef = useRef<number | undefined>(undefined);
  // Never two stories without a user turn between them.
  const storyAllowedRef = useRef(true);
  // Latest stage bundle (voice, opening, onReply) without rebinding send.
  const stageRef = useRef<ChatStage | undefined>(stage);
  stageRef.current = stage;

  const updateMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const clearIdleStory = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = undefined;
  }, []);

  /** Drop the next spontaneous story into a still room, if allowed. */
  const fireIdleStory = useCallback(() => {
    if (streamingRef.current || !storyAllowedRef.current) return;
    storyAllowedRef.current = false;
    const story = nextSpontaneousStory();
    stageRef.current?.voice.speakStream(story, { flush: true });
    updateMessages([
      ...messagesRef.current,
      { id: newId(), role: 'natally', text: story, at: Date.now() },
    ]);
  }, [updateMessages]);

  const armIdleStory = useCallback(() => {
    clearIdleStory();
    idleTimerRef.current = window.setTimeout(fireIdleStory, SPONTANEOUS_IDLE_MS);
  }, [clearIdleStory, fireIdleStory]);

  // A live user question always outranks a queued story; unmount kills it.
  useEffect(() => clearIdleStory, [clearIdleStory]);

  // The stage opens with her reading the chart aloud as her first chat
  // message (unless a conversation is already running). The shell owns the
  // speech (gesture-gated); here the message lands and its cues reach the
  // stage through onReply.
  useEffect(() => {
    const opening = stageRef.current?.opening;
    if (opening === null || opening === undefined) return;
    if (messagesRef.current.length > 0) return;
    const parsed = parseReply(opening, chartTargets(chart));
    updateMessages([
      { id: newId(), role: 'natally', text: parsed.text, at: Date.now() },
    ]);
    stageRef.current?.onReply({ phase: 'begin' });
    stageRef.current?.onReply({ phase: 'delta', text: parsed.text, cues: parsed.cues });
    stageRef.current?.onReply({ phase: 'final' });
  }, [chart, updateMessages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '' || streamingRef.current) return;

      clearIdleStory();
      storyAllowedRef.current = true;
      setError(null);
      // A new turn supersedes whatever she was saying.
      stageRef.current?.voice.stop();

      const userMessage: ChatMessage = {
        id: newId(),
        role: 'user',
        text: trimmed,
        at: Date.now(),
      };

      // The wire history is the transcript so far plus this user turn —
      // authored or streamed replies never reach the model mid-flight.
      const history = [...messagesRef.current, userMessage];

      // The telescope turned on her: answer from the authored backstory,
      // in her voice, without spending allowance.
      const authored = backstoryAnswerFor(trimmed);
      if (authored !== null) {
        updateMessages([
          ...history,
          { id: newId(), role: 'natally', text: authored.answer, at: Date.now() },
        ]);
        stageRef.current?.voice.speakStream(authored.answer, { flush: true });
        armIdleStory();
        return;
      }

      streamingRef.current = true;
      setStreaming(true);

      const replyId = newId();
      updateMessages([
        ...history,
        { id: replyId, role: 'natally', text: '', at: Date.now() },
      ]);
      stageRef.current?.onReply({ phase: 'begin' });

      let failed = false;
      try {
        const inventory = chartTargets(chart);
        let raw = '';
        let spoken = 0;
        for await (const delta of streamChat({ history, chart })) {
          raw += delta;
          const parsed = parseReply(raw, inventory);
          // Feed the voice the cleaned delta; held-back cue fragments make
          // the cleaned text pause, never shrink below what was spoken.
          if (parsed.text.length >= spoken) {
            stageRef.current?.voice.speakStream(parsed.text.slice(spoken));
            spoken = parsed.text.length;
          } else {
            spoken = parsed.text.length;
          }
          stageRef.current?.onReply({ phase: 'delta', text: parsed.text, cues: parsed.cues });
          updateMessages(
            messagesRef.current.map(message =>
              message.id === replyId ? { ...message, text: parsed.text } : message,
            ),
          );
        }
        stageRef.current?.voice.speakStream('', { flush: true });
        stageRef.current?.onReply({ phase: 'final' });
      } catch (cause) {
        failed = true;
        const typed: ChatError =
          cause instanceof NoAllowanceError ||
          cause instanceof BillingNotConfiguredError ||
          cause instanceof ChatNetworkError ||
          cause instanceof NotSignedInError ||
          cause instanceof AuthUnavailableError
            ? cause
            : new ChatNetworkError(
                cause instanceof Error ? cause.message : 'stream failed',
              );
        setError(typed);
        // Speak what honestly arrived, and let the stage settle the cues.
        stageRef.current?.voice.speakStream('', { flush: true });
        stageRef.current?.onReply({ phase: 'failed' });
        // Keep the user's words; drop the reply only if nothing streamed.
        updateMessages(
          messagesRef.current.filter(
            message => message.id !== replyId || message.text !== '',
          ),
        );
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        allowance.refresh();
        if (!failed) armIdleStory();
      }
    },
    [allowance, armIdleStory, chart, clearIdleStory, updateMessages],
  );

  return { messages, send, streaming, error, allowance };
}

/** Poll the billing ledger and expose the envelope plus its Cr balance. */
export function useAllowance(): AllowanceView {
  const [envelope, setEnvelope] = useState<AllowanceEnvelope | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEnvelope(await getAccess(await idToken()));
    } catch {
      // Banner state is owned by the failing turn, not the poll.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), ALLOWANCE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return {
    envelope,
    balanceCr: envelope === null || envelope.state === 'none'
      ? ''
      : formatCr(envelope.allowanceUsdMicros * creditDisplayPerUsd() * 1e-6),
    refresh: () => void refresh(),
  };
}
