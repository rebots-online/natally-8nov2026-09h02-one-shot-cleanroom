// Chat surface for /app.html (DOCS/ARCHITECTURE.md §Surfaces): parchment-
// on-plum conversation with Natally, Playfair header, live streaming caret,
// truthful error banner, top-up hand-off to the app shell. A no-allowance
// turn gets her in-world ask and opens the shell's top-up sheet at once;
// while audio has not been admitted, a truthful note says so.

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
import { useChat, type ChatError, type ChatStage } from './useChat';
import './chat.css';

export interface ChatPanelProps {
  /** Chart whose facts anchor the conversation. */
  chart: NatalChart;
  /** Opens the shell's top-up (credit packs) flow. */
  onTopUp: () => void;
  /** Voice + opening reading + presentation progress of replies. */
  stage: ChatStage;
}

/** Truthful, one-line banner copy per typed failure. */
function errorText(error: ChatError): string {
  if (error instanceof NoAllowanceError) {
    // Her in-world ask, not a system apology.
    return 'I’ve read all the pages your credits cover, love — bring me a top-up and I’ll keep going.';
  }
  if (error instanceof BillingNotConfiguredError) {
    return 'The atelier’s till isn’t configured on this deployment.';
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

export function ChatPanel({ chart, onTopUp, stage }: ChatPanelProps) {
  const { messages, send, streaming, error, allowance } = useChat(chart, stage);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);
  const [voiceAdmitted, setVoiceAdmitted] = useState(stage.voice.admitted);

  // Keep the newest streamed text in view.
  useEffect(() => {
    const log = logRef.current;
    if (log !== null) log.scrollTop = log.scrollHeight;
  }, [messages]);

  // A no-allowance turn opens the shell's top-up sheet at once.
  const askedRef = useRef<ChatError | null>(null);
  useEffect(() => {
    if (error instanceof NoAllowanceError && askedRef.current !== error) {
      askedRef.current = error;
      onTopUp();
    }
    if (error === null) askedRef.current = null;
  }, [error, onTopUp]);

  // Truthful audio state: the note stays until a gesture admits her.
  useEffect(() => stage.voice.onState(state => setVoiceAdmitted(state.admitted)), [stage.voice]);

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

      {!voiceAdmitted && (
        <p className="chat-voicenote" role="status">
          Tap anywhere and I’ll read this aloud — the browser keeps my voice
          silent until you do.
        </p>
      )}

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          className="chat-draft"
          type="text"
          value={draft}
          onChange={event => setDraft(event.target.value)}
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
