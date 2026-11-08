// Typed accessors over the public Vite env (DOCS/ARCHITECTURE.md §Env).
// Empty/absent values mean "not configured" and are returned as empty so
// callers surface truthful errors; only defaults frozen by the architecture
// are substituted.

const DEFAULT_BILLING_API_URL = 'https://natally-hosted-chat.netlify.app';
const DEFAULT_CREDIT_DISPLAY_PER_USD = 100;

function publicString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Base URL of the billing API (Netlify functions). Never empty. */
export function billingApiUrl(): string {
  return publicString(import.meta.env.VITE_BILLING_API_URL) ?? DEFAULT_BILLING_API_URL;
}

/**
 * Chargebee site name. Empty string means billing is not configured;
 * callers must surface a truthful error, never a dummy checkout.
 */
export function chargebeeSite(): string {
  return publicString(import.meta.env.VITE_CHARGEBEE_SITE) ?? '';
}

/**
 * Firebase web config as a JSON string (public). Empty string means auth
 * is unavailable; the app still renders, truthfully signed out.
 */
export function firebaseConfig(): string {
  return publicString(import.meta.env.VITE_FIREBASE_CONFIG) ?? '';
}

/** Credits displayed per US$1 (architecture default: 100). */
export function creditDisplayPerUsd(): number {
  const parsed = Number(publicString(import.meta.env.VITE_CREDIT_DISPLAY_PER_USD));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CREDIT_DISPLAY_PER_USD;
}
