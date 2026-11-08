// Chat surface for /app.html (DOCS/ARCHITECTURE.md §Surfaces): parchment-
// on-plum conversation with Natally, Playfair header, live streaming caret,
// truthful error banner, top-up hand-off to the app shell.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AuthUnavailableError,
  NotSignedInError,
} from '../../platform/firebase';
import type { NatalChart } from '../../shared/types';
import {
  BillingNotConfiguredError,
  ChatNetworkError,
  NoAllowanceError,
} from './inference';
import { useChat, type ChatError } from './useChat';
import './chat.css';

export interface ChatPanelProps {
  /** Chart whose facts anchor the conversation. */
  chart: NatalChart;
  /** Opens the shell's top-up (credit packs) flow. */
  onTopUp: () => void;
}

/** Truthful, one-line banner copy per typed failure. */
function errorText(error: ChatError): string {
  if (error instanceof NoAllowanceError) {
    return 'No allowance — top up to continue.';
  }
  if (error instanceof BillingNotConfiguredError) {
    return 'Billing not configured.';
  }
  if (error instanceof NotSignedInError) {
    return 'Sign in to talk with Natally.';
  }
  if (error instanceof AuthUnavailableError) {
    return 'Sign-in is unavailable right now.';
  }
  if (error instanceof ChatNetworkError) {
    return `Connection problem — try again. ${error.message}`;
  }
  return 'Something went wrong — try again.';
}

export function ChatPanel({ chart, onTopUp }: ChatPanelProps) {
  const { messages, send, streaming, error, allowance } = useChat(chart);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);

  // Keep the newest streamed text in view.
  useEffect(() => {
    const log = logRef.current;
    if (log !== null) log.scrollTop = log.scrollHeight;
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (streaming || draft.trim() === '') return;
    const text = draft;
    setDraft('');
    void send(text);
  }

  return (
    <section className="chat-panel" aria-label="Conversation with Natally">
      <header className="chat-head">
        <h2 className="chat-title">Natally</h2>
        {allowance.balanceCr !== '' && (
          <span className="chat-balance" data-state={allowance.envelope?.state}>
            {allowance.balanceCr}
          </span>
        )}
      </header>

      <div className="chat-log" role="log" aria-live="polite" ref={logRef}>
        {messages.length === 0 && (
          <p className="chat-empty">
            Your chart is on the table — ask Natally anything about it.
          </p>
        )}
        {messages.map((message, index) => {
          const isStreamingReply =
            streaming && index === messages.length - 1 && message.role === 'natally';
          return (
            <div
              key={message.id}
              className={
                message.role === 'user'
                  ? 'chat-msg chat-msg-user'
                  : 'chat-msg chat-msg-natally'
              }
            >
              {message.text}
              {isStreamingReply && <span className="chat-caret" aria-hidden="true" />}
            </div>
          );
        })}
      </div>

      {error !== null && (
        <div className="chat-error" role="alert">
          <span className="chat-error-text">{errorText(error)}</span>
          {error instanceof NoAllowanceError && (
            <button type="button" className="chat-topup" onClick={onTopUp}>
              Top up
            </button>
          )}
        </div>
      )}

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          className="chat-draft"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={streaming ? 'Natally is writing…' : 'Ask about your chart…'}
          disabled={streaming}
          aria-label="Message for Natally"
          autoComplete="off"
        />
        <button
          className="chat-send"
          type="submit"
          disabled={streaming || draft.trim() === ''}
        >
          Send
        </button>
      </form>
    </section>
  );
}
