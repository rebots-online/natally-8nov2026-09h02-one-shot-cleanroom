/** Selection only; prices, grants and checkout eligibility remain server-owned. */
export type PurchaseKind = 'reading' | 'conversation';
export type PurchaseIntent = {
  kind: PurchaseKind;
  sourceSection: string;
  offerId?: string;
};
export function purchaseIntent(kind: PurchaseKind, sourceSection: string, offerId?: string): PurchaseIntent {
  return offerId === undefined ? { kind, sourceSection } : { kind, sourceSection, offerId };
}
