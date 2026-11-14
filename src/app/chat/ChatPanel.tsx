// Existing conversation hooks bound to frozen S06 and S11 rail structures.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthUnavailableError, NotSignedInError } from '../../platform/firebase';
import type { NatalChart } from '../../shared/types';
import { getLesson } from '../../content/lessons';
import { BillingNotConfiguredError, ChatNetworkError, NoAllowanceError } from './inference';
import { useChat, type ChatError, type ChatStage } from './useChat';
import './chat.css';

export interface ChatPanelProps {
  chart: NatalChart;
  onTopUp: () => void;
  stage: ChatStage;
  onMenu?: () => void;
}

function errorText(error: ChatError): string {
  if (error instanceof NoAllowanceError) return 'Top up to keep talking.';
  if (error instanceof BillingNotConfiguredError) return error.message;
  if (error instanceof NotSignedInError) return 'Sign in to talk with Natally.';
  if (error instanceof AuthUnavailableError) return 'Sign-in is unavailable right now.';
  if (error instanceof ChatNetworkError) return `The connection was interrupted. ${error.message}`;
  return 'The conversation could not continue. Try again.';
}

export function ChatPanel({ chart, onTopUp, stage, onMenu }: ChatPanelProps) {
  const { messages, send, streaming, openingLive, error } = useChat(chart, stage);
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const askedRef = useRef<ChatError | null>(null);
  const lesson = getLesson('general');

  useEffect(() => {
    const log = logRef.current;
    if (log !== null) log.scrollTop = log.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (error instanceof NoAllowanceError && askedRef.current !== error) {
      askedRef.current = error;
      onTopUp();
    }
    if (error === null) askedRef.current = null;
  }, [error, onTopUp]);

  // The existing send hook owns the result. Keep an unanswered question in
  // the composer on failure instead of clearing the only retryable copy.
  useEffect(() => {
    if (submitted === null || streaming) return;
    if (error === null) setDraft(current => current === submitted ? '' : current);
    setSubmitted(null);
  }, [submitted, streaming, error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (streaming || draft.trim() === '') return;
    setSubmitted(draft);
    void send(draft);
  }

  return (
    <section aria-label="Conversation with Natally">
      <div className="atelier-rail-header">
        <h1 className="atelier-rail-title" tabIndex={-1}>Your reading</h1>
        {onMenu && <button type="button" className="atelier-rail-btn-icon" aria-label="Menu" onClick={onMenu}>←</button>}
      </div>
      <div className="atelier-transcript-scroll" data-bind="transcript" role="log" aria-live="polite" ref={logRef}>
        {messages.map((message, index) => {
          const live = (streaming || openingLive) && index === messages.length - 1 && message.role === 'natally';
          return (
            <div key={message.id} className={message.role === 'user' ? 'atelier-msg-bubble-user' : 'atelier-msg-bubble-natally'}>
              {message.text}
              {live && <span className="chat-caret" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="atelier-field-group">
          <label className="atelier-label" htmlFor="ask-natally">Ask Natally</label>
          <input
            className="atelier-input" id="ask-natally" type="text" autoComplete="off"
            placeholder="Ask about your chart…" value={draft}
            onChange={event => setDraft(event.target.value)} disabled={streaming}
          />
          {error !== null && <div className="atelier-inline-error" data-bind="field-error" role="alert">{errorText(error)}</div>}
        </div>
        <button className="atelier-btn-primary" type="submit" disabled={streaming || draft.trim() === ''}>Send</button>
      </form>
      <details className="atelier-chart-notes">
        <summary>Chart notes</summary>
        <div data-bind="chart-notes">
          <h2>{lesson.title}</h2>
          <p>{lesson.what}</p>
          <p>{lesson.question}</p>
        </div>
      </details>
    </section>
  );
}
