// Purchase flows tying the billing API to the Chargebee drop-in
// (DOCS/ARCHITECTURE.md §Billing). The price constants here are the single
// source of truth for every surface that displays or sells an offer.

import type { AllowanceEnvelope, PurchaseKind } from '../shared/types';
import { createCheckout, getAccess } from './billingApi';
import { openCheckout } from './chargebee';

/** Credit-pack prices in whole US dollars (BILLING_CREDIT_PACKS_USD). */
export const PACKS = [5, 10, 25] as const;

/** Souvenir report price in whole US dollars (BILLING_OFFER_PRICE_USD). */
export const SOUVENIR = 30;

/** Whole US dollars → integer USD micros (1,000,000 per dollar). */
function toUsdMicros(usd: number): number {
  const micros = Math.round(usd * 1_000_000);
  if (!Number.isSafeInteger(micros)) {
    throw new RangeError(`price not representable in integer USD micros: ${usd}`);
  }
  return micros;
}

/**
 * Create a checkout session, pay it in the drop-in lightbox, then re-fetch
 * the allowance on success only. Cancellation and failures propagate as
 * typed errors from ./billingApi and ./chargebee.
 */
async function purchase(
  idToken: string,
  kind: PurchaseKind,
  amountUsdMicros: number,
): Promise<AllowanceEnvelope> {
  const session = await createCheckout(idToken, {
    kind,
    amountUsdMicros,
    requestId: crypto.randomUUID(),
  });
  await openCheckout(session.url);
  return getAccess(idToken);
}

/** Buy a credit pack (one of PACKS); resolves with the fresh allowance. */
export async function buyCredits(idToken: string, usd: number): Promise<AllowanceEnvelope> {
  const packPrices: readonly number[] = PACKS;
  if (!packPrices.includes(usd)) {
    throw new RangeError(`credit pack price must be one of ${PACKS.join(', ')} USD`);
  }
  return purchase(idToken, 'credits', toUsdMicros(usd));
}

/** Buy the US$30 souvenir report; resolves with the fresh allowance. */
export async function buySouvenir(idToken: string): Promise<AllowanceEnvelope> {
  return purchase(idToken, 'souvenir', toUsdMicros(SOUVENIR));
}
