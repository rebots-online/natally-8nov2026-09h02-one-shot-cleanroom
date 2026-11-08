// W12 SOUVENIR — the purchase flow dialog (DOCS/ARCHITECTURE.md §Surfaces,
// Souvenir). Shows the configured price, buys through the commerce client
// (Chargebee drop-in), then on verified success typesets the keepsake,
// downloads the PDF and retains it for the account. Billing failures are
// reported truthfully; a closed checkout charges nothing.

import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { authUnavailable, idToken, onAuthChange } from '../platform/firebase';
import { BillingApiError, BillingNetworkError, BillingNotConfiguredError } from '../commerce/billingApi';
import { CheckoutClosedError } from '../commerce/chargebee';
import { buySouvenir, SOUVENIR } from '../commerce/purchases';
import type { NatalChart } from '../shared/types';
import { downloadPdf } from './pdf';
import { buildReport } from './report';
import { saveSouvenir } from './retain';

type Phase = 'offer' | 'checkout' | 'preparing' | 'done';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'rgba(28, 17, 34, 0.72)',
} as const;

const cardStyle = {
  position: 'relative',
  width: 'min(440px, 100%)',
  padding: '30px 30px 26px',
  background: 'var(--plum-raised)',
  border: '1px solid var(--plum-line)',
  borderRadius: 14,
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
} as const;

const closeStyle = {
  position: 'absolute',
  top: 10,
  right: 12,
  padding: '4px 10px',
  background: 'none',
  border: 'none',
  borderRadius: 6,
  color: 'var(--parchment-muted)',
  fontFamily: 'inherit',
  fontSize: 20,
  lineHeight: 1,
} as const;

const titleStyle = {
  margin: '0 0 4px',
  fontFamily: 'var(--font-display)',
  fontSize: 24,
  fontWeight: 400,
  color: 'var(--parchment)',
} as const;

const priceStyle = {
  margin: '0 0 14px',
  color: 'var(--brass-bright)',
  fontSize: 15,
} as const;

const listStyle = {
  margin: '0 0 18px',
  padding: '0 0 0 20px',
  color: 'var(--parchment-muted)',
  fontSize: 14,
  lineHeight: 1.7,
} as const;

const primaryButtonStyle = {
  padding: '12px 22px',
  background: 'var(--brass)',
  color: 'var(--plum-deep)',
  border: 'none',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: 16,
} as const;

const noteStyle = {
  margin: '12px 0 0',
  fontSize: 13,
  lineHeight: 1.6,
} as const;

export function SouvenirDialog({ chart, onClose }: { chart: NatalChart; onClose: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<Phase>('offer');
  const [stored, setStored] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (authUnavailable) return;
    return onAuthChange(setUser);
  }, []);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  const busy = phase === 'checkout' || phase === 'preparing';

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function buy(): Promise<void> {
    setError(null);
    setNotice(null);
    if (!user) {
      setError('Sign in with Google first — the keepsake belongs to your Natally account.');
      return;
    }
    setPhase('checkout');
    try {
      await buySouvenir(await idToken());
      setPhase('preparing');
      const report = buildReport(chart);
      downloadPdf(report);
      setStored(saveSouvenir(user.uid, report, chart));
      setPhase('done');
    } catch (caught) {
      setPhase('offer');
      if (caught instanceof CheckoutClosedError) {
        setNotice('Checkout closed before payment — nothing was charged.');
      } else if (caught instanceof BillingNotConfiguredError) {
        setError('Billing is not configured on this deployment, so the keepsake cannot be bought here.');
      } else if (caught instanceof BillingNetworkError) {
        setError('The billing service could not be reached — please try again.');
      } else if (caught instanceof BillingApiError) {
        setError(`Billing refused the purchase: ${caught.message}`);
      } else {
        setError(caught instanceof Error ? caught.message : 'The purchase did not complete.');
      }
    }
  }

  return (
    <div style={overlayStyle} onClick={busy ? undefined : onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="souvenir-dialog-title"
        style={cardStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButton}
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={busy}
          style={{ ...closeStyle, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}
        >
          ×
        </button>

        <h2 id="souvenir-dialog-title" style={titleStyle}>
          A Keepsake of Your Sky
        </h2>

        {phase === 'done' ? (
          <>
            <p style={priceStyle}>Payment received — thank you.</p>
            <ul style={listStyle}>
              <li>Your typeset PDF has downloaded.</li>
              <li>
                {stored
                  ? 'The keepsake is retained in your account — the viewer keeps it beside your chart, and the PDF can be downloaded again any time.'
                  : 'This browser refused to store the keepsake (private mode or full storage), so it cannot be re-opened here — but the PDF is yours.'}
              </li>
            </ul>
            <button type="button" style={{ ...primaryButtonStyle, cursor: 'pointer' }} onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <p style={priceStyle}>US${SOUVENIR}, one payment.</p>
            <ul style={listStyle}>
              <li>Every placement in your chart, read by Natally</li>
              <li>The aspects between them, set out plainly</li>
              <li>A typeset PDF to keep, ready the moment you pay</li>
              <li>The report kept in your account, chart beside the text</li>
            </ul>
            {authUnavailable ? (
              <p style={{ ...noteStyle, color: 'var(--parchment-muted)' }}>
                Google sign-in is unavailable on this deployment, so the keepsake cannot be bought here.
              </p>
            ) : user === null ? (
              <p style={{ ...noteStyle, color: 'var(--parchment-muted)' }}>
                Sign in with Google to buy the keepsake.
              </p>
            ) : null}
            <button
              type="button"
              style={{
                ...primaryButtonStyle,
                background: busy ? 'var(--brass-dim)' : 'var(--brass)',
                cursor: busy ? 'default' : 'pointer',
              }}
              disabled={busy || authUnavailable || user === null}
              onClick={() => void buy()}
            >
              {phase === 'checkout'
                ? 'Opening checkout…'
                : phase === 'preparing'
                  ? 'Binding your keepsake…'
                  : `Buy the keepsake · US$${SOUVENIR}`}
            </button>
          </>
        )}

        {notice && (
          <p role="status" style={{ ...noteStyle, color: 'var(--parchment-muted)' }}>
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" style={{ ...noteStyle, color: 'var(--brass-bright)' }}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
