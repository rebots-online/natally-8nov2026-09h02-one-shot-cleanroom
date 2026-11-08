// Chargebee REST client (API v2) for one-time prepaid charges.
import crypto from 'node:crypto';
import { BillingConfigError } from './verify.mjs';

class ChargebeeError extends Error {
  constructor(message, status = 502, apiErrorCode) {
    super(message);
    this.name = 'ChargebeeError';
    this.status = status;
    this.apiErrorCode = apiErrorCode;
  }
}

function config(name) {
  const value = process.env[name];
  if (!value) throw new BillingConfigError(`${name} is not set`);
  return value;
}

function apiBase() {
  return `https://${config('CHARGEBEE_SITE')}.chargebee.com/api/v2`;
}

function authHeader() {
  // Chargebee HTTP Basic authentication: API key as username, empty password.
  return `Basic ${Buffer.from(`${config('CHARGEBEE_API_KEY')}:`).toString('base64')}`;
}

async function chargebeeFetch(path, { method = 'GET', params = {} } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const url = new URL(`${apiBase()}${path}`);
  const hasBody = method !== 'GET' && method !== 'DELETE';
  if (!hasBody) url.search = search.toString();
  const res = await fetch(url, {
    method,
    headers: {
      authorization: authHeader(),
      ...(hasBody ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: hasBody ? search.toString() : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null; // empty body
  }
  if (!res.ok) {
    const apiErrorCode = data && data.api_error_code;
    if (res.status === 404) {
      const err = new Error(`chargebee: not found (${path})`);
      err.status = 404;
      err.apiErrorCode = apiErrorCode;
      throw err;
    }
    throw new ChargebeeError(
      `chargebee: ${apiErrorCode || res.status}: ${(data && data.message) || res.statusText}`,
      502,
      apiErrorCode
    );
  }
  return data;
}

// Deterministic customer id per Firebase uid (owner checks on invoices use this).
export function customerIdFor(uid) {
  return `natally-${uid}`;
}

const customerCache = new Map(); // uid → customerId; ids are deterministic, cache saves a lookup

export async function ensureCustomer(uid) {
  const customerId = customerIdFor(uid);
  if (customerCache.has(uid)) return customerCache.get(uid);
  try {
    await chargebeeFetch(`/customers/${encodeURIComponent(customerId)}`);
  } catch (err) {
    if (err.status !== 404) {
      if (err.apiErrorCode === 'duplicate_entry') {
        customerCache.set(uid, customerId);
        return customerId;
      }
      throw err;
    }
    try {
      await chargebeeFetch('/customers', { method: 'POST', params: { id: customerId } });
    } catch (createErr) {
      // A concurrent request created it first — that customer is ours.
      if (createErr.apiErrorCode !== 'duplicate_entry') throw createErr;
    }
  }
  customerCache.set(uid, customerId);
  return customerId;
}

function itemPriceIdFor(kind, cents) {
  return `natally_${kind}_${cents}`;
}

function itemIdFor(kind) {
  return `natally_${kind}`;
}

async function listItemPrice(priceId) {
  const data = await chargebeeFetch('/item_prices', {
    params: { 'id[in]': JSON.stringify([priceId]), limit: 1 },
  });
  const entry = data.list && data.list[0];
  return entry ? entry.item_price : null;
}

// Ensure catalog item `natally_<kind>` (one-time "charge" item) and item price
// `natally_<kind>_<cents>` (USD, price = cents/100 dollars) exist, creating
// them idempotently when absent.
async function ensureItemPrice(kind, cents) {
  const priceId = itemPriceIdFor(kind, cents);
  const existing = await listItemPrice(priceId);
  if (existing) return existing;

  const itemId = itemIdFor(kind);
  try {
    await chargebeeFetch('/items', {
      method: 'POST',
      params: { id: itemId, name: `Natally ${kind}`, type: 'charge' },
    });
  } catch (err) {
    // Item already exists from another price point of the same kind.
    if (err.apiErrorCode !== 'duplicate_entry') throw err;
  }

  const usd = (cents / 100).toFixed(2);
  try {
    const created = await chargebeeFetch('/item_prices', {
      method: 'POST',
      params: {
        id: priceId,
        item_id: itemId,
        name: `Natally ${kind} $${usd}`,
        description: `Natally ${kind} (US$${usd}, one-time)`,
        external_name: `Natally ${kind} $${usd}`,
        pricing_model: 'per_unit',
        price: cents, // integer minor units of the site currency (USD cents)
        currency_code: 'USD',
      },
    });
    return created.item_price;
  } catch (err) {
    if (err.apiErrorCode === 'duplicate_entry') {
      const again = await listItemPrice(priceId);
      if (again) return again; // concurrent creation won the race
    }
    throw err;
  }
}

// createCheckout(uid, kind, amountUsdMicros, requestId) → { url, id }
// Documented one-time checkout ("Checkout charge-items and one-time charges"):
// POST /hosted_pages/checkout_one_time_for_items for an existing customer
// (cached by uid) charging an existing charge-item price.
export async function createCheckout(uid, kind, amountUsdMicros) {
  const cents = Math.round(Number(amountUsdMicros) / 10_000);
  if (!Number.isInteger(cents) || cents <= 0) {
    const err = new Error('invalid amountUsdMicros');
    err.status = 400;
    throw err;
  }
  const customerId = await ensureCustomer(uid);
  await ensureItemPrice(kind, cents);
  const page = await chargebeeFetch('/hosted_pages/checkout_one_time_for_items', {
    method: 'POST',
    params: {
      'customer[id]': customerId,
      'item_prices[item_price_id][0]': itemPriceIdFor(kind, cents),
      'item_prices[quantity][0]': 1,
    },
  });
  const hostedPage = page && page.hosted_page;
  if (!hostedPage || !hostedPage.url || !hostedPage.id) {
    throw new ChargebeeError('chargebee: hosted page response missing url/id', 502);
  }
  return { url: hostedPage.url, id: hostedPage.id };
}

export async function getInvoice(invoiceId) {
  const data = await chargebeeFetch(`/invoices/${encodeURIComponent(invoiceId)}`);
  return (data && data.invoice) || null;
}

function constantTimeEquals(a, b) {
  // Hash both sides to fixed length so timingSafeEqual never leaks length.
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

// verifyWebhook(rawBody, signatureHeader, authorizationHeader)
// Two verification paths, both against CHARGEBEE_WEBHOOK_SECRET, both in
// constant time:
//  1. HMAC-SHA256 signature over the raw body (hex, base64 or base64url
//     digest, including the `t=<ts>,v1=<digest>` signed-payload form) when a
//     signature header is present.
//  2. HTTP Basic authentication — Chargebee's documented webhook mechanism:
//     the webhook URL carries credentials and Chargebee sends them as
//     `Authorization: Basic base64(user:pass)`; the secret matches when it is
//     the whole `user:pass`, the user, or the password.
export function verifyWebhook(rawBody, signatureHeader, authorizationHeader = '') {
  const secret = config('CHARGEBEE_WEBHOOK_SECRET');
  const unauthorized = (message) => {
    const err = new Error(message);
    err.status = 401;
    throw err;
  };

  if (typeof signatureHeader === 'string' && signatureHeader.trim() !== '') {
    const provided = signatureHeader.trim();
    const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest();
    const hex = digest.toString('hex');
    const b64 = digest.toString('base64');
    const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const candidates = [provided];
    const v1 = provided.match(/(?:^|,)v1=([^,]+)$/);
    if (v1) candidates.push(v1[1].trim());
    const tsv = provided.match(/(?:^|,)t=[^,]+,(v1=[^,]+)$/);
    if (tsv) candidates.push(tsv[1].slice(3));

    const ok = candidates.some(
      (candidate) =>
        constantTimeEquals(candidate, hex) ||
        constantTimeEquals(candidate, b64) ||
        constantTimeEquals(candidate, b64url)
    );
    if (!ok) unauthorized('invalid webhook signature');
    return true;
  }

  const auth = typeof authorizationHeader === 'string' ? authorizationHeader.trim() : '';
  const basic = auth.match(/^Basic\s+(\S+)$/i);
  if (!basic) unauthorized('missing webhook credentials');
  let decoded = '';
  try {
    decoded = Buffer.from(basic[1], 'base64').toString('utf8');
  } catch {
    unauthorized('invalid webhook credentials');
  }
  const separator = decoded.indexOf(':');
  const user = separator >= 0 ? decoded.slice(0, separator) : decoded;
  const pass = separator >= 0 ? decoded.slice(separator + 1) : '';
  if (
    !constantTimeEquals(decoded, secret) &&
    !constantTimeEquals(user, secret) &&
    !constantTimeEquals(pass, secret)
  ) {
    unauthorized('invalid webhook credentials');
  }
  return true;
}
