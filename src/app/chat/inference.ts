// Streaming inference on the customer's managed OpenRouter key behind
// POST {billingApiUrl()}/billing/chat (DOCS/ARCHITECTURE.md §Inference).
// Failures are typed and truthful: 402 = no allowance, 503 = billing not
// configured, anything transport-level = network error. Never a dummy or
// client-side-authored completion.
//
// Wire contract (frozen with W5): body {messages, maxTokens?} where
// messages is one optional leading {role:'system'} plus user|assistant
// turns; the response is an SSE stream of OpenRouter-style chunks.

import { billingApiUrl } from '../../platform/env';
import { idToken } from '../../platform/firebase';
import type { ChatMessage, NatalChart } from '../../shared/types';
import { buildMessages, type ContextMessage } from './context';

/** 402 from the ledger: no allowance remaining. */
export class NoAllowanceError extends Error {
  constructor(detail = '') {
    super(detail ? `No allowance remaining. ${detail}` : 'No allowance remaining.');
    this.name = 'NoAllowanceError';
  }
}

/** 503: the server's billing rail is not configured. */
export class BillingNotConfiguredError extends Error {
  constructor() {
    super('Billing is not configured.');
    this.name = 'BillingNotConfiguredError';
  }
}

/** Fetch failure or unexpected HTTP/SSE failure. */
export class ChatNetworkError extends Error {
  readonly status?: number;
  constructor(detail: string, status?: number) {
    super(detail);
    this.name = 'ChatNetworkError';
    this.status = status;
  }
}

export interface StreamChatInput {
  history: ChatMessage[];
  chart: NatalChart;
  maxTokens?: number;
}

type Frame =
  | { kind: 'delta'; text: string }
  | { kind: 'done' }
  | { kind: 'ignore' };

function chatUrl(): string {
  return `${billingApiUrl()}/billing/chat`;
}

async function post(body: string, token: string): Promise<Response> {
  try {
    return await fetch(chatUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body,
    });
  } catch (cause) {
    throw new ChatNetworkError(
      cause instanceof Error ? cause.message : 'request failed',
    );
  }
}

/** POST the conversation; re-fetch the ID token and retry once on 401. */
async function postConversation(
  messages: ContextMessage[],
  maxTokens: number | undefined,
): Promise<Response> {
  const body = JSON.stringify(
    maxTokens === undefined ? { messages } : { messages, maxTokens },
  );
  let response = await post(body, await idToken());
  if (response.status === 401) {
    response = await post(body, await idToken());
  }
  return response;
}

/** Best-effort human-readable detail from an error response body. */
async function errorDetail(response: Response): Promise<string> {
  const raw = (await response.text().catch(() => '')).trim();
  if (!raw) return '';

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
  }
  if (parsed === null || typeof parsed !== 'object') {
    return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
  }

  if ('error' in parsed) {
    const { error } = parsed;
    if (typeof error === 'string') return error;
    if (error !== null && typeof error === 'object' && 'message' in error) {
      const { message } = error;
      if (typeof message === 'string') return message;
    }
  }
  if ('message' in parsed) {
    const { message } = parsed;
    if (typeof message === 'string') return message;
  }
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

/** Parse one SSE frame (already terminator-stripped). */
function parseFrame(frame: string): Frame {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');

  if (data === '') return { kind: 'ignore' };
  if (data === '[DONE]') return { kind: 'done' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { kind: 'ignore' };
  }
  if (parsed === null || typeof parsed !== 'object') return { kind: 'ignore' };

  if ('error' in parsed) {
    const { error } = parsed;
    if (typeof error === 'string') throw new ChatNetworkError(error);
    if (error !== null && typeof error === 'object' && 'message' in error) {
      const { message } = error;
      if (typeof message === 'string') throw new ChatNetworkError(message);
    }
    throw new ChatNetworkError('upstream error');
  }

  if (!('choices' in parsed)) return { kind: 'ignore' };
  const { choices } = parsed;
  if (!Array.isArray(choices) || choices.length === 0) return { kind: 'ignore' };

  const first = choices[0];
  if (first === null || typeof first !== 'object' || !('delta' in first)) {
    return { kind: 'ignore' };
  }
  const { delta } = first;
  if (delta === null || typeof delta !== 'object' || !('content' in delta)) {
    return { kind: 'ignore' };
  }
  const { content } = delta;
  if (typeof content === 'string' && content.length > 0) {
    return { kind: 'delta', text: content };
  }
  return { kind: 'ignore' };
}

/**
 * Stream Natally's reply as text deltas. Throws NotSignedInError /
 * AuthUnavailableError from the platform, NoAllowanceError (402),
 * BillingNotConfiguredError (503), or ChatNetworkError.
 */
export async function* streamChat(
  input: StreamChatInput,
): AsyncGenerator<string, void, unknown> {
  const messages = buildMessages(input.history, input.chart);
  const response = await postConversation(messages, input.maxTokens);

  if (!response.ok) {
    const detail = await errorDetail(response);
    if (response.status === 402) throw new NoAllowanceError(detail);
    if (response.status === 503) throw new BillingNotConfiguredError();
    throw new ChatNetworkError(
      detail ? `HTTP ${response.status}. ${detail}` : `HTTP ${response.status}.`,
      response.status,
    );
  }

  if (!response.body) {
    throw new ChatNetworkError('Response carried no stream body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder
        .decode(value, { stream: true })
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');

        const parsed = parseFrame(frame);
        if (parsed.kind === 'done') return;
        if (parsed.kind === 'delta') yield parsed.text;
      }
    }

    // Flush a final frame that lacked its terminator.
    buffer += decoder.decode();
    if (buffer.trim() !== '') {
      const parsed = parseFrame(buffer);
      if (parsed.kind === 'done') return;
      if (parsed.kind === 'delta') yield parsed.text;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
