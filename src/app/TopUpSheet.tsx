// Frozen Stitch S08 rail. Existing billing functions supply every result.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BillingNotConfiguredError, getAccess, redeem } from '../commerce/billingApi';
import { CheckoutClosedError } from '../commerce/chargebee';
import { PACKS, buyCredits } from '../commerce/purchases';
import { chargebeeSite, creditDisplayPerUsd } from '../platform/env';
import { idToken } from '../platform/firebase';
import { formatCr } from '../shared/credits';
import type { AllowanceEnvelope } from '../shared/types';
import { AtelierRail } from './prototype/ImmersiveLayout';

interface TopUpSheetProps { onClose: () => void; }

function describeLoadError(error: unknown): string {
  if (error instanceof BillingNotConfiguredError) {
    return error.detail
      ? 'The billing service is not configured — ' + error.detail + '. Balance and purchases are unavailable.'
      : 'The billing service is not configured. Balance and purchases are unavailable.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Your balance could not be reached right now.';
}

export default function TopUpSheet({ onClose }: TopUpSheetProps) {
  const [access, setAccess] = useState<AllowanceEnvelope | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'checkout' | 'redeem' | null>(null);
  const [view, setView] = useState<'topup' | 'checkout' | 'cancelled' | 'error' | 'result'>('topup');
  const [selectedPack, setSelectedPack] = useState<number>(PACKS[0]);
  const [notice, setNotice] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const redemption = useRef<{ code: string; requestId: string } | null>(null);
  const billingConfigured = chargebeeSite() !== '';

  const refreshAccess = useCallback(async () => {
    setAccess(null);
    setLoadError(null);
    try {
      const envelope = await getAccess(await idToken());
      setAccess(envelope);
      return envelope;
    } catch (error) {
      setLoadError(describeLoadError(error));
      return null;
    }
  }, []);

  useEffect(() => { void refreshAccess(); }, [refreshAccess]);
  useEffect(() => { document.getElementById('conversation-credits-title')?.focus(); }, [view]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && busy === null) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function purchase() {
    if (busy !== null) return;
    setNotice(null);
    setPurchaseError(null);
    setBusy('checkout');
    setView('checkout');
    try {
      setAccess(await buyCredits(await idToken(), selectedPack));
      const refreshed = await refreshAccess();
      setNotice(refreshed ? 'Purchase complete — balance refreshed.' : 'Purchase complete. Your balance could not be refreshed.');
      window.dispatchEvent(new Event('natally-allowance-changed'));
      setView('result');
    } catch (error) {
      if (error instanceof CheckoutClosedError) setView('cancelled');
      else {
        setPurchaseError(error instanceof BillingNotConfiguredError
          ? error.detail
            ? 'Checkout is not configured — ' + error.detail + '. Nothing was charged.'
            : 'Checkout is not configured on this deployment — nothing was charged.'
          : error instanceof Error ? error.message : 'The purchase could not be completed. Please try again.');
        setView('error');
      }
    } finally { setBusy(null); }
  }

  async function redeemCode() {
    if (busy !== null) return;
    setCodeError(null);
    if (!code.trim()) { setCodeError('Enter your code.'); return; }
    if (!redemption.current || redemption.current.code !== code) {
      redemption.current = { code, requestId: crypto.randomUUID() };
    }
    setBusy('redeem');
    try {
      await redeem(await idToken(), code, redemption.current.requestId);
      const refreshed = await refreshAccess();
      setCode('');
      redemption.current = null;
      setNotice(refreshed ? 'Code redeemed. Balance refreshed.' : 'Code redeemed. Your balance could not be refreshed.');
      window.dispatchEvent(new Event('natally-allowance-changed'));
      setView('result');
    } catch (error) { setCodeError(describeLoadError(error)); }
    finally { setBusy(null); }
  }

  if (view === 'checkout') return (
    <AtelierRail title="Opening checkout…" labelledBy="conversation-credits-title">
      <div data-bind="checkout-status" role="status" />
    </AtelierRail>
  );
  if (view === 'cancelled') return (
    <AtelierRail title="Checkout closed" onClose={() => setView('topup')} labelledBy="conversation-credits-title">
      <p className="atelier-body-text">Checkout closed before payment.</p>
      <button type="button" className="atelier-btn-primary" onClick={() => setView('topup')}>Back to credits</button>
    </AtelierRail>
  );
  if (view === 'error') return (
    <AtelierRail title="Checkout unavailable" onClose={() => setView('topup')} labelledBy="conversation-credits-title">
      <div className="atelier-status-banner error" data-bind="error" role="alert">{purchaseError}</div>
      <button type="button" className="atelier-btn-primary" onClick={() => void purchase()}>Try again</button>
    </AtelierRail>
  );
  if (view === 'result') return (
    <AtelierRail title="Conversation credits" onBack={() => setView('topup')} labelledBy="conversation-credits-title">
      <div className="atelier-status-banner" data-bind="redemption-result" role="status">{notice}</div>
      <button type="button" className="atelier-btn-primary" onClick={() => setView('topup')}>Back to credits</button>
    </AtelierRail>
  );
  return (
    <AtelierRail title="Conversation credits" onBack={onClose} labelledBy="conversation-credits-title">
      <p className="atelier-secondary-text" data-bind="allowance" role="status">
        {loadError ?? (access ? 'Balance ' + formatCr(access.allowanceUsdMicros, creditDisplayPerUsd()) : 'Checking your balance…')}
        {!billingConfigured && ' Checkout is not configured — VITE_CHARGEBEE_SITE is not set.'}
      </p>
      <fieldset className="atelier-choice-group" disabled={busy !== null}>
        <legend className="atelier-sr-only">Choose a credit pack</legend>
        {PACKS.map(usd => (
          <label className="atelier-choice-label" key={usd}>
            <input type="radio" name="credit_pack" value={usd} checked={selectedPack === usd} onChange={() => setSelectedPack(usd)} />
            <span className="atelier-choice-price">US{'$'}{usd}</span>
          </label>
        ))}
      </fieldset>
      <button type="button" className="atelier-btn-primary" disabled={!billingConfigured || busy !== null} onClick={() => void purchase()}>Continue</button>
      <details className="atelier-redeem">
        <summary>Redeem admin code</summary>
        <form onSubmit={event => { event.preventDefault(); void redeemCode(); }}>
          <div className="atelier-field-group">
            <label className="atelier-label" htmlFor="redeem-code">Code</label>
            <input className="atelier-input" id="redeem-code" type="text" autoComplete="off" value={code} disabled={busy !== null} onChange={event => setCode(event.target.value)} aria-describedby={codeError ? 'redeem-code-error' : undefined} />
            <div className="atelier-inline-error" id="redeem-code-error" data-bind="field-error" role="alert" hidden={!codeError}>{codeError}</div>
          </div>
          <button type="submit" className="atelier-btn-secondary" disabled={busy !== null}>{busy === 'redeem' ? 'Redeeming…' : 'Redeem'}</button>
          <div data-bind="redemption-result" aria-live="polite" />
        </form>
      </details>
    </AtelierRail>
  );
}
