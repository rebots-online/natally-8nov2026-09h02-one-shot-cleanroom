// Three warm, authored closes for natural end-points of a conversation with
// Natally. The credits close keeps a session going, the souvenir close offers
// the keepsake report, and the soft none simply says goodbye. Prices are never
// baked in here — the surface renders them from configuration.

/** Which offer a close accompanies. */
export type CloseKind = 'credits' | 'souvenir' | 'none';

/** One authored close: Natally's words plus the offer's button label. */
export interface NatallyClose {
  kind: CloseKind;
  /** Natally's closing words. */
  text: string;
  /** Label for the offer button, or null when there is no offer. */
  cta: string | null;
}

/** All closes, in offer order: credits, souvenir, soft none. */
export const CLOSES: readonly NatallyClose[] = [
  {
    kind: 'credits',
    text: 'okay so we just bumped into the edge of this session\u2019s credits — low-key tragic, because your chart was getting SO good. a little pack keeps our conversation going from this exact sentence, whenever you want: no rush, no dramatic fog effects, your chart and your pace.',
    cta: 'Keep the conversation going',
  },
  {
    kind: 'souvenir',
    text: 'if tonight\u2019s reading is living rent-free in your head — valid, it happens — imagine it bound: these words plus your actual chart, frozen together as a keepsake you can reread for years. the souvenir report is basically our conversation wearing its fancy coat.',
    cta: 'Make it a keepsake',
  },
  {
    kind: 'none',
    text: 'and with that, the sky can rest — you brought the good questions and the whole wheel noticed. come back whenever you want to go deeper; the candles and I keep the atelier warm. be gentle with yourself out there, bestie. — natally',
    cta: null,
  },
];

/** The authored close of a given kind. */
export function getClose(kind: CloseKind): NatallyClose {
  const close = CLOSES.find((c) => c.kind === kind);
  if (!close) throw new Error(`No close authored for kind: ${kind}`);
  return close;
}
