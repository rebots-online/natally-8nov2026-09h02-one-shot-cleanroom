// OpenRouter provisioning API: per-customer managed keys.
// Documented shapes: POST /api/v1/keys { name, limit } → { key, data: { hash, ... } };
// PATCH /api/v1/keys/{hash} { limit } → { data: { ... } }.
import { BillingConfigError } from './verify.mjs';

const BASE = 'https://openrouter.ai/api/v1';

function adminKey() {
  const key = process.env.OPENROUTER_ADMIN_KEY;
  if (!key) throw new BillingConfigError('OPENROUTER_ADMIN_KEY is not set');
  return key;
}

async function orFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${adminKey()}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

function upstreamError(action, { status, data }) {
  const message = (data && data.error && data.error.message) || '';
  return Object.assign(
    new Error(`openrouter ${action} failed (${status}${message ? `: ${message}` : ''})`),
    { status: 502 }
  );
}

// createManagedKey({ name, limitUsd }) → { id, secret, limitUsd }
// The plaintext key is returned by OpenRouter only in this response.
export async function createManagedKey({ name, limitUsd }) {
  const { ok, status, data } = await orFetch('/keys', {
    method: 'POST',
    body: { name, limit: limitUsd },
  });
  if (!ok) throw upstreamError('key creation', { status, data });
  const record = (data && data.data) || {};
  const secret = (data && typeof data.key === 'string' && data.key) || record.secret;
  const id = record.hash || (data && data.id) || '';
  if (typeof secret !== 'string' || secret.length === 0) {
    throw upstreamError('key creation (no key secret returned)', { status: 200, data });
  }
  return { id, secret, limitUsd };
}

// PATCH the USD spend limit of an existing key (identified by its hash).
export async function patchKeyLimit(keyId, limitUsd) {
  if (!keyId) throw Object.assign(new Error('openrouter key id missing'), { status: 500 });
  const { ok, status, data } = await orFetch(`/keys/${encodeURIComponent(keyId)}`, {
    method: 'PATCH',
    body: { limit: limitUsd },
  });
  if (!ok) throw upstreamError('key limit update', { status, data });
  return true;
}

// Streaming chat completions on a managed key. `usage: { include: true }`
// makes OpenRouter append a final SSE chunk carrying the actual spend.
export async function streamChat({ apiKey, model, messages, maxTokens }) {
  const body = {
    model,
    messages,
    stream: true,
    usage: { include: true },
  };
  if (Number.isFinite(maxTokens)) body.max_tokens = maxTokens;
  return fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
