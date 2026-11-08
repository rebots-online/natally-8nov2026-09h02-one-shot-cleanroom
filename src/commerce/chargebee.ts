// Chargebee.js drop-in checkout (DOCS/ARCHITECTURE.md §Billing).
// The script loads lazily, once, only when a checkout actually opens. An
// empty Chargebee site means billing is unconfigured: `checkoutAvailable`
// is false and every open throws truthfully — never a dummy lightbox.

import { chargebeeSite } from '../platform/env';
import { BillingNotConfiguredError } from './billingApi';

/** True when a Chargebee site is configured for this build. */
export const checkoutAvailable = chargebeeSite() !== '';

/** The customer closed the lightbox before the payment succeeded. */
export class CheckoutClosedError extends Error {
  constructor() {
    super('checkout closed before payment');
    this.name = 'CheckoutClosedError';
  }
}

const CHARGEBEE_JS_SRC = 'https://js.chargebee.com/v2/chargebee.js';

/** Minimal hosted-page reference Chargebee.js opens in the lightbox. */
interface HostedPageRef {
  url: string;
}

/** Handlers of the Chargebee.js v2 drop-in checkout (public API). */
interface CheckoutHandlers {
  hostedPage: () => Promise<HostedPageRef>;
  success: (hostedPageId: string) => void;
  error: (error: unknown) => void;
  close: () => void;
}

interface ChargebeeInstance {
  openCheckout: (handlers: CheckoutHandlers) => void;
}

interface ChargebeeStatic {
  init: (options: { site: string }) => ChargebeeInstance;
}

declare global {
  interface Window {
    Chargebee?: ChargebeeStatic;
  }
}

let scriptPromise: Promise<ChargebeeStatic> | null = null;

function loadChargebeeScript(): Promise<ChargebeeStatic> {
  if (window.Chargebee) {
    return Promise.resolve(window.Chargebee);
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<ChargebeeStatic>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHARGEBEE_JS_SRC;
      script.async = true;
      script.onload = () => {
        if (window.Chargebee) {
          resolve(window.Chargebee);
        } else {
          reject(new Error('Chargebee script loaded without its global'));
        }
      };
      script.onerror = () => reject(new Error('Chargebee script failed to load'));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      // Do not cache failure: a retry may re-append the script.
      scriptPromise = null;
      throw error;
    });
  }
  return scriptPromise;
}

let instancePromise: Promise<ChargebeeInstance> | null = null;

/** Load the script and initialize Chargebee for the site exactly once. */
function chargebeeInstance(site: string): Promise<ChargebeeInstance> {
  instancePromise ??= loadChargebeeScript().then((chargebee) => chargebee.init({ site }));
  return instancePromise;
}

/**
 * Open a Chargebee hosted page in the drop-in lightbox. Resolves on the
 * Chargebee success callback; rejects if the customer closes early, if
 * Chargebee reports an error, or if billing is not configured.
 */
export async function openCheckout(hostedPageUrl: string): Promise<void> {
  if (!checkoutAvailable) {
    throw new BillingNotConfiguredError();
  }
  const instance = await chargebeeInstance(chargebeeSite());
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    instance.openCheckout({
      hostedPage: () => Promise.resolve({ url: hostedPageUrl }),
      success: () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      },
      error: (error) => {
        if (!settled) {
          settled = true;
          reject(
            error instanceof Error
              ? error
              : new Error('Chargebee checkout failed', { cause: error }),
          );
        }
      },
      close: () => {
        if (!settled) {
          settled = true;
          reject(new CheckoutClosedError());
        }
      },
    });
  });
}
