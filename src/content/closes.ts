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
    text: 'We have reached the edge of this session\u2019s credits, and I would hate to leave your chart half-explored — there is a whole sky still on the table. A small pack of credits keeps our conversation going from exactly where we left off, whenever you are ready.',
    cta: 'Keep the conversation going',
  },
  {
    kind: 'souvenir',
    text: 'If tonight\u2019s reading struck a chord, imagine having it bound — these words and your actual chart, frozen together as a keepsake you can return to for years. The souvenir report turns our conversation into something you can hold.',
    cta: 'Make it a keepsake',
  },
  {
    kind: 'none',
    text: 'And with that, the sky can rest for tonight — you brought good questions, and your chart clearly enjoys your company. Come back whenever you want to look deeper; I will keep the telescope warm. Warmly, Natally',
    cta: null,
  },
];

/** The authored close of a given kind. */
export function getClose(kind: CloseKind): NatallyClose {
  const close = CLOSES.find((c) => c.kind === kind);
  if (!close) throw new Error(`No close authored for kind: ${kind}`);
  return close;
}
