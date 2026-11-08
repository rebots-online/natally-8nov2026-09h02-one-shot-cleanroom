// Top-up sheet: server-signed balance via getAccess(), formatted with
// formatCr at the deployment's credit display rate. A zero balance is never
// shown as a number — the sheet simply reads "Top up". Credit packs and the
// souvenir are wired to the real purchase calls (Chargebee checkout runs
// inside them). The offers always render; when configuration is missing the
// sheet fails visibly and specifically instead — naming the missing setting,
// whether client-side (VITE_CHARGEBEE_SITE) or from the server's
// billing_not_configured detail — and never charges anything. A completed
// purchase refreshes the access envelope.

import { useCallback, useEffect, useState } from 'react';
import { BillingNotConfiguredError, getAccess } from '../commerce/billingApi';
import { CheckoutClosedError } from '../commerce/chargebee';
import { PACKS, SOUVENIR, buyCredits, buySouvenir } from '../commerce/purchases';
import { chargebeeSite, creditDisplayPerUsd } from '../platform/env';
import { idToken } from '../platform/firebase';
import { formatCr } from '../shared/credits';
import type { AllowanceEnvelope } from '../shared/types';

interface TopUpSheetProps {
  onClose: () => void;
}

/** Human sentence for a failed access load, naming what is missing. */
function describeLoadError(error: unknown): string {
  if (error instanceof BillingNotConfiguredError) {
    return error.detail
      ? `The billing service is not configured — ${error.detail}. Balance and purchases are unavailable.`
      : 'The billing service is not configured. Balance and purchases are unavailable.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Your balance could not be reached right now.';
}

export default function TopUpSheet({ onClose }: TopUpSheetProps) {
  const [access, setAccess] = useState<AllowanceEnvelope | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const billingConfigured = chargebeeSite() !== '';

  const refreshAccess = useCallback(async () => {
    setAccess(null);
    setLoadError(null);
    try {
      setAccess(await getAccess(await idToken()));
    } catch (error) {
      setLoadError(describeLoadError(error));
    }
  }, []);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function purchase(kind: 'credits' | 'souvenir', usd: number) {
    if (busy !== null) return;
    setNotice(null);
    setBusy(`${kind}:${usd}`);
    try {
      const token = await idToken();
      // Both calls resolve with the fresh, server-signed envelope.
      const envelope =
        kind === 'credits' ? await buyCredits(token, usd) : await buySouvenir(token);
      setAccess(envelope);
      setNotice(
        kind === 'credits'
          ? 'Purchase complete — balance refreshed above.'
          : 'Souvenir purchase complete — thank you.',
      );
      await refreshAccess();
    } catch (error) {
      if (error instanceof CheckoutClosedError) {
        setNotice('Checkout closed before payment — nothing was charged.');
      } else if (error instanceof BillingNotConfiguredError) {
        setNotice(
          error.detail
            ? `Checkout is not configured — ${error.detail}. Nothing was charged.`
            : 'Checkout is not configured on this deployment — nothing was charged.',
        );
      } else {
        setNotice(
          error instanceof Error
            ? error.message
            : 'The purchase could not be completed. Please try again.',
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const displayPerUsd = creditDisplayPerUsd();
  const balanceUsdMicros = access?.allowanceUsdMicros ?? 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Top up"
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>Top up</h2>
          <button type="button" className="btn ghost small" onClick={onClose} autoFocus>
            Close
          </button>
        </div>

        {balanceUsdMicros > 0 && (
          <p className="balance">
            Balance <strong>{formatCr(balanceUsdMicros, displayPerUsd)}</strong>
          </p>
        )}

        {!billingConfigured && (
          <p className="note warn">
            Checkout is not configured on this build — VITE_CHARGEBEE_SITE is not set,
            so the Chargebee payment window cannot open. Nothing will be charged.
          </p>
        )}

        {loadError ? (
          <p className="note error" role="alert">
            {loadError}
          </p>
        ) : !access ? (
          <p className="note status" role="status">
            Checking your balance…
          </p>
        ) : null}

        <div className="packs">
          {PACKS.map(usd => (
            <button
              key={usd}
              type="button"
              className="pack"
              disabled={!billingConfigured || busy !== null}
              onClick={() => void purchase('credits', usd)}
            >
              <span className="usd">US${usd}</span>
              <span className="what">{formatCr(Math.round(usd * 1_000_000), displayPerUsd)}</span>
              {busy === `credits:${usd}` ? '…' : ''}
            </button>
          ))}
          <button
            type="button"
            className="pack wide"
            disabled={!billingConfigured || busy !== null}
            onClick={() => void purchase('souvenir', SOUVENIR)}
          >
            <span className="usd">US${SOUVENIR}</span>
            <span className="what">Natal report keepsake</span>
            {busy === `souvenir:${SOUVENIR}` ? '…' : ''}
          </button>
        </div>

        {notice && (
          <p className="note status" role="status">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
