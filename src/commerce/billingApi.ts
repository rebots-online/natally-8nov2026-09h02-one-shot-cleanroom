// Typed HTTP client for the Netlify billing function
// (DOCS/ARCHITECTURE.md §Billing). Every call carries the customer's
// Firebase ID token as a bearer token. Unconfigured billing (HTTP 503) and
// unreachable billing surface as typed errors — never a dummy flow.

import { billingApiUrl } from '../platform/env';
import type { AllowanceEnvelope, GrantRecord, PurchaseKind } from '../shared/types';

/** The billing function returned 503: billing is not configured. */
export class BillingNotConfiguredError extends Error {
  /**
   * What the deployment is missing, when known: the server's
   * `billing_not_configured` detail (a server setting) or, when the gap is
   * client-side, the missing build-time setting itself.
   */
  readonly detail: string;

  constructor(detail = '') {
    super('billing not configured');
    this.name = 'BillingNotConfiguredError';
    this.detail = detail;
  }
}

/** The billing function could not be reached (offline, DNS, blocked). */
export class BillingNetworkError extends Error {
  constructor(cause: unknown) {
    super('billing unreachable', { cause });
    this.name = 'BillingNetworkError';
  }
}

/** The billing function answered with a failure or an unusable payload. */
export class BillingApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`billing request failed (${status})`);
    this.name = 'BillingApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Body of the checkout request. */
export interface CheckoutRequest {
  kind: PurchaseKind;
  /** Integer USD micros; Chargebee item prices must equal these cents. */
  amountUsdMicros: number;
  /** Client-generated idempotency key. */
  requestId: string;
}

/** A Chargebee hosted page ready for the drop-in lightbox. */
export interface CheckoutSession {
  url: string;
  id: string;
}

function endpoint(path: string): string {
  return `${billingApiUrl().replace(/\/+$/, '')}/billing/${path}`;
}

function bearer(idToken: string): Record<string, string> {
  return { Authorization: `Bearer ${idToken}`, Accept: 'application/json' };
}

async function request(
  path: string,
  init: RequestInit,
): Promise<{ status: number; payload: unknown }> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(endpoint(path), init);
    text = await response.text();
  } catch (cause) {
    throw new BillingNetworkError(cause);
  }
  if (response.status === 503) {
    // Body carries { error: 'billing_not_configured', detail: '<setting> is not set' };
    // surface the named setting so the failure is specific, never generic.
    let detail = '';
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === 'string' && parsed.detail !== '') detail = parsed.detail;
    } catch {
      // Non-JSON 503 (e.g. platform-level): stay generic but still truthful.
    }
    throw new BillingNotConfiguredError(detail);
  }
  if (!response.ok) {
    throw new BillingApiError(response.status, text.slice(0, 200));
  }
  try {
    return { status: response.status, payload: JSON.parse(text) as unknown };
  } catch {
    throw new BillingApiError(response.status, 'malformed JSON response');
  }
}

/** Fetch the customer's current allowance envelope. */
export async function getAccess(idToken: string): Promise<AllowanceEnvelope> {
  const { payload } = await request('access', { headers: bearer(idToken) });
  return payload as AllowanceEnvelope;
}

/** Ask the server for a Chargebee hosted page for a one-time charge. */
export async function createCheckout(
  idToken: string,
  input: CheckoutRequest,
): Promise<CheckoutSession> {
  const { status, payload } = await request('checkout', {
    method: 'POST',
    headers: { ...bearer(idToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const session = payload as { url?: unknown; id?: unknown } | null;
  if (
    session === null ||
    typeof session.url !== 'string' ||
    session.url === '' ||
    typeof session.id !== 'string' ||
    session.id === ''
  ) {
    throw new BillingApiError(status, 'checkout response missing url or id');
  }
  return { url: session.url, id: session.id };
}

/** Redeem an allowance code; resolves when the server accepts it. */
export async function redeem(
  idToken: string,
  code: string,
  requestId: string,
): Promise<void> {
  await request('redeem', {
    method: 'POST',
    headers: { ...bearer(idToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, requestId }),
  });
}

/** List the durable allowance grants for the customer. */
export async function getHistory(idToken: string): Promise<GrantRecord[]> {
  const { payload } = await request('history', { headers: bearer(idToken) });
  return payload as GrantRecord[];
}
