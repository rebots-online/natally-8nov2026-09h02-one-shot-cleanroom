// React state for a conversation with Natally (DOCS/ARCHITECTURE.md
// §Surfaces /app.html). send() appends the user turn, streams the reply
// into the last message live, and converts typed inference failures into
// banner state. Persona questions ("who are you…") get her authored
// backstory answer instead of a billed completion; quiet moments after a
// completed turn get, at most once between user turns, a spontaneous
// story from the backstage shelf. useAllowance() keeps the ledger
// envelope fresh: on mount, after every completed turn, and on a slow
// poll.

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
import { backstoryAnswerFor } from './context';
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
  /** Last known server-signed envelope; null when never fetched/signed out. */
  envelope: AllowanceEnvelope | null;
  /** formatCr() of the envelope's allowance, or '' while unknown. */
  balanceCr: string;
  /** True when auth said nobody is signed in (or auth is unavailable). */
  signedOut: boolean;
  /** Re-read the ledger now (used after each completed turn). */
  refresh: () => void;
}

/** Poll the billing ledger and expose the envelope plus its Cr balance. */
export function useAllowance(): AllowanceView {
  const [envelope, setEnvelope] = useState<AllowanceEnvelope | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fetched = await getAccess(await idToken());
        if (!cancelled) {
          setEnvelope(fetched);
          setSignedOut(false);
        }
      } catch (error) {
        if (cancelled) return;
        if (
          error instanceof NotSignedInError ||
          error instanceof AuthUnavailableError
        ) {
          setSignedOut(true);
          setEnvelope(null);
          return;
        }
        // Transport failure: keep the last known envelope; the poll retries.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), ALLOWANCE_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return {
    envelope,
    balanceCr: envelope === null ? '' : formatCr(envelope.allowanceUsdMicros, creditDisplayPerUsd()),
    signedOut,
    refresh,
  };
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `m${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UseChat {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  streaming: boolean;
  error: ChatError | null;
  allowance: AllowanceView;
}

/** One streaming conversation bound to a computed natal chart. */
export function useChat(chart: NatalChart): UseChat {
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
    updateMessages([
      ...messagesRef.current,
      { id: newId(), role: 'natally', text: nextSpontaneousStory(), at: Date.now() },
    ]);
  }, [updateMessages]);

  const armIdleStory = useCallback(() => {
    clearIdleStory();
    idleTimerRef.current = window.setTimeout(fireIdleStory, SPONTANEOUS_IDLE_MS);
  }, [clearIdleStory, fireIdleStory]);

  // A live user question always outranks a queued story; unmount kills it.
  useEffect(() => clearIdleStory, [clearIdleStory]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '' || streamingRef.current) return;

      clearIdleStory();
      storyAllowedRef.current = true;
      setError(null);

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

      let failed = false;
      try {
        let reply = '';
        for await (const delta of streamChat({ history, chart })) {
          reply += delta;
          updateMessages(
            messagesRef.current.map((message) =>
              message.id === replyId ? { ...message, text: reply } : message,
            ),
          );
        }
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
        // Keep the user's words; drop the reply only if nothing streamed.
        updateMessages(
          messagesRef.current.filter(
            (message) => message.id !== replyId || message.text !== '',
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
