// Netlify function: billing rail router.
// Routes (site path or /.netlify/functions/chargebee/billing/...):
//   GET  /billing/access         Bearer Firebase ID token → allowance + key state
//   POST /billing/checkout       {kind, amountUsdMicros, requestId} → hosted page {url,id}
//   POST /billing/redeem         {code, requestId} → grant redemption allowance
//   POST /billing/webhook        Chargebee webhook (HMAC-verified raw body)
//   GET  /billing/history        grants + posted usage for the caller
//   GET  /billing/invoices/:id   owner-checked Chargebee invoice
//   POST /billing/chat           SSE passthrough on the uid's managed OpenRouter key
import crypto from 'node:crypto';
import { BillingConfigError, verifyIdToken } from '../../billing/verify.mjs';
import * as chargebee from '../../billing/chargebee.mjs';
import * as ledger from '../../billing/ledger.mjs';
import * as openrouter from '../../billing/openrouter.mjs';

// Free-tier inference chain (OpenRouter canonical ids):
// deepseek-chat-v3-0324:free → llama-3.3-70b:free → gemma-3-27b:free
const FREE_MODEL_CHAIN = [
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
];

function corsHeaders(req) {
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
  const allowed = process.env.BILLING_ALLOWED_ORIGIN;
  if (allowed === '*') {
    headers['access-control-allow-origin'] = '*';
  } else if (allowed) {
    const origin = req.headers.get('origin') || '';
    if (allowed.split(',').map((entry) => entry.trim()).includes(origin)) {
      headers['access-control-allow-origin'] = origin;
    }
  }
  return headers;
}

function json(req, data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(req), ...extra },
  });
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function errorResponse(err, req) {
  const status =
    err instanceof BillingConfigError || err.code === 'billing_not_configured'
      ? 503
      : [400, 401, 402, 403, 404].includes(err.status)
        ? err.status
        : err.status
          ? 502
          : 500;
  if (status >= 500) console.error('[billing]', err);
  // 503 bodies name what is missing (BillingConfigError messages carry the
  // env var name) so the client sheet can tell the customer truthfully.
  const body =
    status === 503
      ? { error: 'billing_not_configured', detail: err.message || 'billing not configured' }
      : { error: status === 500 ? 'internal error' : err.message || 'error' };
  return json(req, body, status);
}

async function readJson(req) {
  const text = await req.text();
  if (!text) throw badRequest('JSON body required');
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('invalid JSON body');
  }
}

function routeOf(pathname) {
  const match = pathname.match(/(?:^|\/)billing\/(.*)$/);
  return match ? match[1].replace(/\/+$/, '') : null;
}

// ── GET /billing/access ─────────────────────────────────────────────────────

function maskKey(key) {
  return key.length > 16 ? `${key.slice(0, 10)}…${key.slice(-4)}` : '•••';
}

async function accessRoute(req) {
  const { uid } = await verifyIdToken(req);
  const { allowanceUsdMicros, postedUsageUsdMicros } = await ledger.allowance(uid);
  const managed = await ledger.getManagedKey(uid);
  const body = {
    state: managed ? 'ready' : 'none',
    allowanceUsdMicros,
    postedUsageUsdMicros,
  };
  if (managed) {
    body.key = { maskedKey: maskKey(managed.key), limitUsdMicros: managed.limitUsdMicros };
  }
  return json(req, body);
}

// ── POST /billing/checkout ──────────────────────────────────────────────────

async function checkoutRoute(req) {
  const { uid } = await verifyIdToken(req);
  const body = await readJson(req);
  const kind = String(body.kind || '');
  if (!/^[a-z0-9_-]{1,32}$/.test(kind)) throw badRequest('invalid kind');
  const amountUsdMicros = Number(body.amountUsdMicros);
  if (!Number.isInteger(amountUsdMicros) || amountUsdMicros <= 0) {
    throw badRequest('invalid amountUsdMicros');
  }
  const requestId = String(body.requestId || '');
  if (requestId.length === 0 || requestId.length > 128) {
    throw badRequest('invalid requestId');
  }
  const checkout = await chargebee.createCheckout(uid, kind, amountUsdMicros);
  return json(req, checkout);
}

// ── POST /billing/redeem ────────────────────────────────────────────────────

function constantTimeEquals(a, b) {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function redeemRoute(req) {
  const { uid } = await verifyIdToken(req);
  const body = await readJson(req);
  const code = typeof body.code === 'string' ? body.code : '';
  const requestId = String(body.requestId || '');
  if (requestId.length === 0 || requestId.length > 128) throw badRequest('invalid requestId');
  const expected = process.env.BILLING_REDEMPTION_CODE;
  const allowanceUsd = process.env.BILLING_REDEMPTION_ALLOWANCE_USD;
  if (!expected || !allowanceUsd) throw new BillingConfigError('redemption is not configured');
  if (!code || !constantTimeEquals(code, expected)) {
    throw Object.assign(new Error('invalid redemption code'), { status: 403 });
  }
  const usdMicros = Math.round(Number(allowanceUsd) * 1_000_000);
  if (!Number.isFinite(usdMicros) || usdMicros <= 0) {
    throw new BillingConfigError('BILLING_REDEMPTION_ALLOWANCE_USD is invalid');
  }
  // Idempotent per uid+requestId: the grant id derives from both.
  const { created } = await ledger.recordGrant({
    uid,
    source: 'redeem',
    eventId: requestId,
    usdMicros,
    meta: { requestId },
  });
  const { allowanceUsdMicros } = await ledger.allowance(uid);
  return json(req, { granted: created, allowanceUsdMicros });
}

// ── POST /billing/webhook ───────────────────────────────────────────────────

// Raise (or first create) the uid's managed key limit by a grant amount.
async function raiseKeyLimit(uid, addUsdMicros) {
  const managed = await ledger.getManagedKey(uid);
  const newLimitUsdMicros = (managed ? managed.limitUsdMicros : 0) + addUsdMicros;
  if (!managed) {
    const created = await openrouter.createManagedKey({
      name: `natally-${uid}`,
      limitUsd: newLimitUsdMicros / 1_000_000,
    });
    await ledger.saveManagedKey(uid, {
      openrouterKey: created.secret,
      openrouterKeyId: created.id,
      limitUsdMicros: newLimitUsdMicros,
    });
  } else {
    await openrouter.patchKeyLimit(managed.openrouterKeyId, newLimitUsdMicros / 1_000_000);
    await ledger.setManagedKeyLimit(uid, newLimitUsdMicros);
  }
  return newLimitUsdMicros;
}

async function webhookRoute(req) {
  const raw = await req.text();
  const signature =
    req.headers.get('chargebee-event-signature') ??
    req.headers.get('x-chargebee-event-signature') ??
    req.headers.get('chargebee-signature') ??
    req.headers.get('x-chargebee-signature') ??
    '';
  chargebee.verifyWebhook(raw, signature, req.headers.get('authorization') || '');

  const event = JSON.parse(raw);
  const type = event.event_type || event.type || '';
  if (type !== 'payment_success') return json(req, { received: true, ignored: type });

  const content = event.content || {};
  const invoice = content.invoice || {};
  const transaction = content.transaction || {};
  const customerId =
    invoice.customer_id || transaction.customer_id || (content.customer && content.customer.id) || '';
  if (!customerId.startsWith('natally-')) {
    return json(req, { received: true, ignored: 'foreign customer' });
  }
  const uid = customerId.slice('natally-'.length);
  const cents = Number.isFinite(Number(invoice.total))
    ? Number(invoice.total)
    : Number.isFinite(Number(transaction.amount))
      ? Number(transaction.amount)
      : 0;
  const usdMicros = Math.round(cents) * 10_000;
  if (usdMicros <= 0) return json(req, { received: true, ignored: 'zero amount' });

  const { created } = await ledger.recordGrant({
    uid,
    source: 'chargebee',
    eventId: event.id,
    usdMicros,
    meta: { invoiceId: invoice.id || '', invoiceStatus: invoice.status || '' },
  });
  if (created) await raiseKeyLimit(uid, usdMicros);
  return json(req, { received: true, granted: created });
}

// ── GET /billing/history ────────────────────────────────────────────────────

async function historyRoute(req) {
  const { uid } = await verifyIdToken(req);
  const { grants, usage } = await ledger.history(uid);
  return json(req, { grants, usage });
}

// ── GET /billing/invoices/:id ───────────────────────────────────────────────

async function invoiceRoute(req, invoiceId) {
  const { uid } = await verifyIdToken(req);
  const invoice = await chargebee.getInvoice(invoiceId); // 404 → mapped by errorResponse
  if (!invoice || invoice.customer_id !== chargebee.customerIdFor(uid)) {
    throw Object.assign(new Error('not found'), { status: 404 });
  }
  return json(req, { invoice });
}

// ── POST /billing/chat ──────────────────────────────────────────────────────

function validateChat(body) {
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0 || messages.length > 200) {
    throw badRequest('messages required (1–200 items)');
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object') throw badRequest('invalid message');
    if (!['system', 'user', 'assistant', 'developer'].includes(message.role)) {
      throw badRequest('invalid message role');
    }
    if (typeof message.content !== 'string' || message.content.length > 100_000) {
      throw badRequest('invalid message content');
    }
  }
  let maxTokens;
  if (body.maxTokens !== undefined && body.maxTokens !== null) {
    maxTokens = Number(body.maxTokens);
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 32_000) {
      throw badRequest('invalid maxTokens');
    }
  }
  return { messages, maxTokens };
}

function parseUsageLine(line) {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' && parsed.usage ? parsed.usage : null;
  } catch {
    return null;
  }
}

// Forward the upstream SSE bytes verbatim; harvest the usage chunk OpenRouter
// appends (usage.include) and post the actual spend to the ledger.
function streamSse(req, upstream, { uid, model }) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            const lineUsage = parseUsageLine(line);
            if (lineUsage) usage = lineUsage;
          }
        }
        for (const line of `${buffer}${decoder.decode()}`.split('\n')) {
          const lineUsage = parseUsageLine(line);
          if (lineUsage) usage = lineUsage;
        }
      } catch (err) {
        console.error('[billing chat stream]', err);
      } finally {
        try {
          controller.close();
        } catch {
          /* client already gone */
        }
        if (usage && typeof usage.cost === 'number' && Number.isFinite(usage.cost)) {
          try {
            await ledger.recordUsage({
              uid,
              usdMicros: Math.round(usage.cost * 1_000_000),
              model,
              requestId: 'chat',
            });
          } catch (err) {
            console.error('[billing usage post]', err);
          }
        }
      }
    },
    cancel() {
      try {
        reader.cancel();
      } catch {
        /* upstream already closed */
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-model': model,
      ...corsHeaders(req),
    },
  });
}

async function chatRoute(req) {
  const { uid } = await verifyIdToken(req);
  const { messages, maxTokens } = validateChat(await readJson(req));

  const { allowanceUsdMicros } = await ledger.allowance(uid);
  if (allowanceUsdMicros <= 0) {
    throw Object.assign(new Error('allowance exhausted'), { status: 402 });
  }

  // Managed key: provision lazily at the current allowance, keep its upstream
  // spend limit at least at the allowance.
  let managed = await ledger.getManagedKey(uid);
  if (!managed) {
    const created = await openrouter.createManagedKey({
      name: `natally-${uid}`,
      limitUsd: allowanceUsdMicros / 1_000_000,
    });
    const { generation } = await ledger.saveManagedKey(uid, {
      openrouterKey: created.secret,
      openrouterKeyId: created.id,
      limitUsdMicros: allowanceUsdMicros,
    });
    managed = {
      key: created.secret,
      generation,
      limitUsdMicros: allowanceUsdMicros,
      openrouterKeyId: created.id,
    };
  } else if (managed.limitUsdMicros < allowanceUsdMicros) {
    await openrouter.patchKeyLimit(managed.openrouterKeyId, allowanceUsdMicros / 1_000_000);
    await ledger.setManagedKeyLimit(uid, allowanceUsdMicros);
    managed = { ...managed, limitUsdMicros: allowanceUsdMicros };
  }

  let upstream = null;
  let usedModel = null;
  for (const model of FREE_MODEL_CHAIN) {
    const attempt = await openrouter.streamChat({
      apiKey: managed.key,
      model,
      messages,
      maxTokens,
    });
    if (attempt.status === 404 || attempt.status === 429) {
      try {
        await attempt.body?.cancel();
      } catch {
        /* body already consumed */
      }
      continue; // fall through the chain
    }
    upstream = attempt;
    usedModel = model;
    break;
  }
  if (!upstream) throw Object.assign(new Error('inference unavailable'), { status: 502 });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    throw Object.assign(
      new Error(
        `inference unavailable (${upstream.status}${detail ? `: ${detail.slice(0, 200)}` : ''})`
      ),
      { status: 502 }
    );
  }
  return streamSse(req, upstream, { uid, model: usedModel });
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    const path = routeOf(new URL(req.url).pathname);
    if (path === null) throw Object.assign(new Error('not found'), { status: 404 });
    if (path === 'access' && req.method === 'GET') return await accessRoute(req);
    if (path === 'checkout' && req.method === 'POST') return await checkoutRoute(req);
    if (path === 'redeem' && req.method === 'POST') return await redeemRoute(req);
    if (path === 'webhook' && req.method === 'POST') return await webhookRoute(req);
    if (path === 'history' && req.method === 'GET') return await historyRoute(req);
    if (path === 'chat' && req.method === 'POST') return await chatRoute(req);
    const invoiceMatch = path.match(/^invoices\/([^/]+)$/);
    if (invoiceMatch && req.method === 'GET') {
      return await invoiceRoute(req, decodeURIComponent(invoiceMatch[1]));
    }
    throw Object.assign(new Error('not found'), { status: 404 });
  } catch (err) {
    return errorResponse(err, req);
  }
}

export default handler;
