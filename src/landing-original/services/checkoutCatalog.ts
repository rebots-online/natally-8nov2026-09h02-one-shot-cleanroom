// UX-PLAY-1 pack selection: explicit env catalog parsing and selection only.
// No price, ROCHE amount or grant is interpreted here; slots are selector keys.
import type { PurchaseKind } from './purchaseIntent';

export type CheckoutPlatform = 'web' | 'android';
export type CheckoutCadence = 'monthly' | 'one_time';
export type CheckoutTier = '5' | '10' | '25';
export type CheckoutPackBinding = {
  cadence: CheckoutCadence;
  tier: CheckoutTier;
  packageIdentifier: string;
  webProductIdentifier?: string;
  androidProductIdentifier?: string;
};
export type CheckoutCatalogEntry = {
  offerId: string;
  kind: PurchaseKind;
  cadence: CheckoutCadence | null;
  tier: CheckoutTier | null;
  packageIdentifier: string;
  productIdentifier: string;
};
type CatalogError = Error & { name: 'CheckoutCatalogError' };
function catalogError(message: string): CatalogError {
  const error: CatalogError = new Error(message) as CatalogError;
  error.name = 'CheckoutCatalogError';
  return error;
}
export function billingEnv(name: string): string | null {
  const raw = (import.meta.env as unknown as Record<string, string | undefined>)[name];
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}
export function requireBillingEnv(name: string): string {
  const value = billingEnv(name);
  if (value === null) throw new Error(`Required billing binding ${name} is not configured; refusing to continue.`);
  return value;
}
const TIER_ORDER: Record<CheckoutTier, number> = { '5': 1, '10': 2, '25': 3 };
function isCheckoutTier(value: unknown): value is CheckoutTier {
  return value === '5' || value === '10' || value === '25';
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function optionalPlatformId(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw catalogError(`The conversation pack catalog has an invalid ${label}; platform product IDs must be nonblank strings.`);
  }
  return value.trim();
}
// UX-PLAY-1: the pack catalog is an explicit JSON array; invalid shapes reject
// the whole catalog instead of falling back to the retired single conversation
// product. Price/ROCHE/count fields, if present, are ignored, never interpreted.
function conversationPackBindings(): CheckoutPackBinding[] {
  const raw = billingEnv('VITE_REVENUECAT_CONVERSATION_PACKS_JSON');
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw catalogError(`VITE_REVENUECAT_CONVERSATION_PACKS_JSON is not valid JSON; refusing to guess the conversation packs.${error instanceof Error ? ` (${error.message})` : ''}`);
  }
  if (!Array.isArray(parsed)) {
    throw catalogError('VITE_REVENUECAT_CONVERSATION_PACKS_JSON must be a JSON array of pack bindings.');
  }
  const seenSlots = new Set<string>();
  const webProducts = new Set<string>();
  const androidProducts = new Set<string>();
  const bindings: CheckoutPackBinding[] = [];
  for (const item of parsed) {
    if (!isRecord(item)) throw catalogError('Every conversation pack binding must be a JSON object.');
    const { cadence, tier, packageIdentifier, webProductIdentifier, androidProductIdentifier } = item;
    if (cadence !== 'monthly' && cadence !== 'one_time') {
      throw catalogError('Every conversation pack binding needs cadence "monthly" or "one_time".');
    }
    if (!isCheckoutTier(tier)) {
      throw catalogError('Every conversation pack binding needs tier "5", "10" or "25".');
    }
    if (typeof packageIdentifier !== 'string' || packageIdentifier.trim().length === 0) {
      throw catalogError('Every conversation pack binding needs a nonblank packageIdentifier.');
    }
    const web = optionalPlatformId(webProductIdentifier, 'webProductIdentifier');
    const android = optionalPlatformId(androidProductIdentifier, 'androidProductIdentifier');
    const slot = `${cadence}-${tier}`;
    if (seenSlots.has(slot)) throw catalogError(`The conversation pack catalog has a duplicate ${slot} slot; each cadence/tier may appear once.`);
    seenSlots.add(slot);
    if (web !== undefined) {
      if (webProducts.has(web)) throw catalogError(`The conversation pack catalog reuses web product "${web}" across slots.`);
      webProducts.add(web);
    }
    if (android !== undefined) {
      if (androidProducts.has(android)) throw catalogError(`The conversation pack catalog reuses Android product "${android}" across slots.`);
      androidProducts.add(android);
    }
    bindings.push({
      cadence, tier,
      packageIdentifier: packageIdentifier.trim(),
      webProductIdentifier: web,
      androidProductIdentifier: android,
    });
  }
  return bindings;
}
// Monthly-5/10/25 then one_time-5/10/25; ordering is display order,
// never a currency amount or a grant size.
function compareConversationEntries(a: CheckoutCatalogEntry, b: CheckoutCatalogEntry): number {
  const cadenceOrder = (value: CheckoutCadence): number => (value === 'monthly' ? 0 : 1);
  if (a.cadence !== b.cadence) return cadenceOrder(a.cadence as CheckoutCadence) - cadenceOrder(b.cadence as CheckoutCadence);
  return TIER_ORDER[a.tier as CheckoutTier] - TIER_ORDER[b.tier as CheckoutTier];
}
// Selection is separate from display order; a lower tier is never an implicit
// substitute for the configured default. Explicit offer choices bypass this.
export function defaultCreditOfferId(offers: readonly { offerId: string }[]): string | null {
  const tier = billingEnv('VITE_REVENUECAT_DEFAULT_CREDIT_TIER');
  if (!isCheckoutTier(tier)) {
    throw catalogError('VITE_REVENUECAT_DEFAULT_CREDIT_TIER must be configured as "5", "10" or "25".');
  }
  for (const cadence of ['monthly', 'one_time'] as const) {
    const offerId = `${cadence}-${tier}`;
    if (offers.some(offer => offer.offerId === offerId)) return offerId;
  }
  return null;
}
function readingEntry(platform: CheckoutPlatform): CheckoutCatalogEntry | null {
  const packageIdentifier = billingEnv('VITE_REVENUECAT_READING_PACKAGE_ID');
  const productIdentifier = billingEnv(platform === 'web'
    ? 'VITE_REVENUECAT_READING_PRODUCT_ID'
    : 'VITE_REVENUECAT_ANDROID_READING_PRODUCT_ID');
  if (packageIdentifier === null || productIdentifier === null) return null;
  return { offerId: 'reading', kind: 'reading', cadence: null, tier: null, packageIdentifier, productIdentifier };
}
export function checkoutEntries(platform: CheckoutPlatform, kind?: PurchaseKind): CheckoutCatalogEntry[] {
  const entries: CheckoutCatalogEntry[] = [];
  if (kind === undefined || kind === 'reading') {
    const reading = readingEntry(platform);
    if (reading) entries.push(reading);
  }
  if (kind === undefined || kind === 'conversation') {
    for (const binding of conversationPackBindings()) {
      const productIdentifier = platform === 'web' ? binding.webProductIdentifier : binding.androidProductIdentifier;
      if (productIdentifier === undefined) continue;
      entries.push({
        offerId: `${binding.cadence}-${binding.tier}`,
        kind: 'conversation',
        cadence: binding.cadence,
        tier: binding.tier,
        packageIdentifier: binding.packageIdentifier,
        productIdentifier,
      });
    }
    entries.sort(compareConversationEntries);
  }
  return entries;
}
export function checkoutEntry(platform: CheckoutPlatform, kind: PurchaseKind, offerId?: string): CheckoutCatalogEntry {
  const entries = checkoutEntries(platform, kind);
  if (kind === 'reading') {
    if (offerId === undefined || offerId === 'reading') {
      if (entries.length === 0) throw catalogError(`The ${platform} reading product bindings are not configured; refusing to guess them.`);
      return entries[0];
    }
  }
  if (offerId !== undefined) {
    const exact = entries.find(entry => entry.offerId === offerId);
    if (!exact) throw catalogError(`The selected "${offerId}" pack is not configured for ${platform}; refusing a substitute.`);
    return exact;
  }
  const defaultOfferId = defaultCreditOfferId(entries);
  const defaultEntry = entries.find(entry => entry.offerId === defaultOfferId);
  if (defaultEntry) return defaultEntry;
  throw catalogError(`VITE_REVENUECAT_DEFAULT_CREDIT_TIER has no configured pack for ${platform}; select an available pack explicitly.`);
}
// UX-PLAY-1: passive purchase-history suppression keeps matching the previous
// single-product identifiers without demanding pack bindings or provider calls.
export function configuredCheckoutProductIds(): string[] {
  const names = ['VITE_REVENUECAT_READING_PRODUCT_ID', 'VITE_REVENUECAT_CONVERSATION_PRODUCT_ID',
    'VITE_REVENUECAT_ANDROID_READING_PRODUCT_ID', 'VITE_REVENUECAT_ANDROID_CONVERSATION_PRODUCT_ID'];
  const ids = names
    .map(name => billingEnv(name))
    .filter((value): value is string => value !== null);
  try {
    for (const binding of conversationPackBindings()) {
      if (binding.webProductIdentifier !== undefined) ids.push(binding.webProductIdentifier);
      if (binding.androidProductIdentifier !== undefined) ids.push(binding.androidProductIdentifier);
    }
  } catch {
    // An invalid pack catalog still suppresses the historical single products.
  }
  return [...new Set(ids)];
}
