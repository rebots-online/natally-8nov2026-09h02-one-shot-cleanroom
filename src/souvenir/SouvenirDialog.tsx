// Frozen Stitch S09 offer/preparation/result/viewer rail. Real existing
// checkout, report generation, PDF and per-account retention remain unchanged.
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { authUnavailable, idToken, onAuthChange } from '../platform/firebase';
import { BillingApiError, BillingNetworkError, BillingNotConfiguredError } from '../commerce/billingApi';
import { CheckoutClosedError } from '../commerce/chargebee';
import { buySouvenir, SOUVENIR } from '../commerce/purchases';
import type { NatalChart } from '../shared/types';
import { AtelierRail } from '../app/prototype/ImmersiveLayout';
import { downloadPdf } from './pdf';
import { buildReport, type SouvenirReport } from './report';
import { loadSouvenir, saveSouvenir } from './retain';
import { SouvenirViewer } from './SouvenirViewer';

type Phase = 'offer' | 'checkout' | 'preparing' | 'done' | 'viewer';

export function SouvenirDialog({ chart, onClose }: { chart: NatalChart; onClose: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<Phase>('offer');
  const [stored, setStored] = useState<boolean | null>(null);
  const [report, setReport] = useState<SouvenirReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (authUnavailable) return;
    return onAuthChange(current => {
      setUser(current);
      const retained = current ? loadSouvenir(current.uid) : null;
      setReport(retained?.report ?? null);
      setStored(retained ? true : null);
      setPhase(retained ? 'viewer' : 'offer');
    });
  }, []);

  const busy = phase === 'checkout' || phase === 'preparing';
  useEffect(() => {
    document.getElementById('souvenir-dialog-title')?.focus();
  }, [phase]);
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function buy(): Promise<void> {
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!user) {
      setError('Sign in first — the keepsake belongs to your Natally account.');
      return;
    }
    setPhase('checkout');
    try {
      await buySouvenir(await idToken());
      setPhase('preparing');
      const generated = buildReport(chart);
      downloadPdf(generated);
      setReport(generated);
      setStored(saveSouvenir(user.uid, generated, chart));
      setPhase('done');
      window.dispatchEvent(new Event('natally-allowance-changed'));
    } catch (caught) {
      setPhase('offer');
      if (caught instanceof CheckoutClosedError) {
        setNotice('Checkout closed before payment.');
      } else if (caught instanceof BillingNotConfiguredError) {
        setError('Billing is not configured on this deployment, so the keepsake cannot be bought here.');
      } else if (caught instanceof BillingNetworkError) {
        setError('The billing service could not be reached — please try again.');
      } else if (caught instanceof BillingApiError) {
        setError('Billing refused the purchase: ' + caught.message);
      } else {
        setError(caught instanceof Error ? caught.message : 'The purchase did not complete.');
      }
    }
  }

  if (phase === 'viewer') return (
    <AtelierRail title="My keepsake" onClose={onClose} labelledBy="souvenir-dialog-title">
      <SouvenirViewer />
    </AtelierRail>
  );
  if (phase === 'checkout') return (
    <AtelierRail title="Opening checkout…" labelledBy="souvenir-dialog-title">
      <div data-bind="checkout-status" role="status" />
    </AtelierRail>
  );
  if (phase === 'preparing') return (
    <AtelierRail title="Preparing your keepsake…" labelledBy="souvenir-dialog-title">
      <div data-bind="preparation-status" role="status" />
    </AtelierRail>
  );
  if (phase === 'done') return (
    <AtelierRail title="Keepsake ready" onClose={onClose} labelledBy="souvenir-dialog-title">
      <button type="button" className="atelier-btn-primary" disabled={!stored} onClick={() => setPhase('viewer')}>Open keepsake</button>
      <button type="button" className="atelier-btn-secondary" disabled={!report} onClick={() => { if (report) downloadPdf(report); }}>Download PDF</button>
      <div data-bind="retention-status" role="status">
        {stored === false ? 'This browser could not store the keepsake. The PDF has downloaded, but the interactive keepsake cannot be reopened here.' : null}
      </div>
    </AtelierRail>
  );
  return (
    <AtelierRail title="Keep your sky" onClose={onClose} labelledBy="souvenir-dialog-title">
      <p className="atelier-body-text">Your natal report, as a PDF and an interactive keepsake.</p>
      <p className="atelier-keepsake-price">US{'$'}{SOUVENIR}</p>
      <button type="button" className="atelier-btn-primary" disabled={authUnavailable || user === null} onClick={() => void buy()}>Get my keepsake</button>
      {authUnavailable ? (
        <div className="atelier-status-banner error" data-bind="error" role="alert">Sign-in is unavailable on this deployment, so the keepsake cannot be bought here.</div>
      ) : user === null ? (
        <div className="atelier-status-banner" role="status">Sign in to buy your keepsake.</div>
      ) : null}
      {notice && <div className="atelier-status-banner" data-bind="checkout-status" role="status">{notice}</div>}
      {error && <div className="atelier-status-banner error" data-bind="error" role="alert">{error}</div>}
    </AtelierRail>
  );
}
