import { restoreBillingPurchases } from '../services/billingAccess';
import { formatReadingAllowance } from '../services/billingApi';
import { CreditActions } from './CreditActions';
import { CustomerValueExplanation } from './CustomerValueExplanation';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getCheckoutCustomer, type CheckoutCustomer } from '../services/revenueCatCheckout';

export type AccountCreditsState =
  | { kind: 'idle' }
  | { kind: 'loading'; uid: string }
  | { kind: 'ready'; uid: string; balance: number }
  | { kind: 'error'; uid: string; message: string };

type PurchaseSummary =
  | { kind: 'loading'; restoring: boolean }
  | { kind: 'ready'; customer: CheckoutCustomer; restored: boolean }
  | { kind: 'error'; restoring: boolean };

type AccountBillingDialogProps = {
  user: User;
  credits: AccountCreditsState | null;
  onRefreshCredits: (uid: string) => Promise<void>;
  topUpHref: string;
  onClose: () => void;
};

function managementLink(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function AccountBillingDialog({ user, credits, onRefreshCredits, topUpHref, onClose }: AccountBillingDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = useRef(false);
  const requestGeneration = useRef(0);
  const actionInFlight = useRef(false);
  const [action, setAction] = useState<'load' | 'restore' | 'credits' | null>(null);
  const [summary, setSummary] = useState<PurchaseSummary>({ kind: 'loading', restoring: false });
  const titleId = useId();
  const creditsId = useId();
  const purchasesId = useId();
  const matchingCredits = credits && credits.kind !== 'idle' && credits.uid === user.uid ? credits : null;
  const controlsBusy = action !== null || matchingCredits?.kind === 'loading';

  const readCustomer = useCallback(async (restoring = false) => {
    if (!active.current || actionInFlight.current || auth.currentUser?.uid !== user.uid) return;
    const generation = ++requestGeneration.current;
    const current = () => active.current && requestGeneration.current === generation && auth.currentUser?.uid === user.uid;
    actionInFlight.current = true;
    setAction(restoring ? 'restore' : 'load');
    setSummary({ kind: 'loading', restoring });
    try {
      try {
        if(restoring) await restoreBillingPurchases(user.uid,current);
        const customer = await getCheckoutCustomer();
        if (!current()) return;
        if (customer.ownerUid !== user.uid) throw new Error('Purchase records did not match the current account.');
        setSummary({ kind: 'ready', customer, restored: restoring });
      } catch {
        if (current()) setSummary({ kind: 'error', restoring });
        return;
      }
      // The existing credit reader owns its independent loading/error/result state.
      if (restoring && current()) await onRefreshCredits(user.uid);
    } finally {
      if (current()) {
        actionInFlight.current = false;
        setAction(null);
      }
    }
  }, [user.uid, onRefreshCredits]);

  useEffect(() => {
    const element = dialog.current;
    if (!element || auth.currentUser?.uid !== user.uid) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    active.current = true;
    root.style.overflow = 'hidden';
    element.showModal();
    heading.current?.focus({ preventScroll: true });
    void readCustomer(true); // restore automatically on open; the button below is reassurance, not a requirement
    return () => {
      active.current = false;
      requestGeneration.current++;
      actionInFlight.current = false;
      element.close();
      if (root.style.overflow === 'hidden') root.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [user.uid, readCustomer]);

  const dismiss = () => {
    active.current = false;
    requestGeneration.current++;
    dialog.current?.close();
    onClose();
  };

  const refreshCredits = async () => {
    if (!active.current || actionInFlight.current || matchingCredits?.kind === 'loading' || auth.currentUser?.uid !== user.uid) return;
    const generation = ++requestGeneration.current;
    actionInFlight.current = true;
    setAction('credits');
    try {
      await onRefreshCredits(user.uid);
    } finally {
      if (active.current && requestGeneration.current === generation && auth.currentUser?.uid === user.uid) {
        actionInFlight.current = false;
        setAction(null);
      }
    }
  };

  const managementUrl = summary.kind === 'ready' && summary.customer.ownerUid === user.uid ? managementLink(summary.customer.managementUrl) : null;

  const containTabFocus = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') &&
        !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility === 'visible');
    event.preventDefault();
    if (controls.length === 0) {
      heading.current?.focus();
      return;
    }
    const currentIndex = controls.findIndex(element => element === document.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? controls.length - 1 : currentIndex - 1)
      : (currentIndex < 0 || currentIndex === controls.length - 1 ? 0 : currentIndex + 1);
    controls[nextIndex].focus();
  };

  return createPortal(<dialog ref={dialog} className="account-billing" aria-labelledby={titleId}
    onKeyDown={containTabFocus}
    onCancel={event => { event.preventDefault();dismiss(); }}>
    <div className="account-billing__header">
      <h2 id={titleId} ref={heading} tabIndex={-1}>Account &amp; billing</h2>
      <button type="button" onClick={dismiss} aria-label="Close account and billing">Close</button>
    </div>
    <CustomerValueExplanation />
    <section className="account-billing__section" aria-label="Your account">
      <h3>Your account</h3>
      <dl className="account-billing__identity">
        {user.displayName && <><dt>Name</dt><dd>{user.displayName}</dd></>}
        {user.email && <><dt>Email</dt><dd>{user.email}</dd></>}
        {user.phoneNumber && <><dt>Phone</dt><dd>{user.phoneNumber}</dd></>}
      </dl>
      {!user.displayName && !user.email && !user.phoneNumber && <p>You are signed in to your account.</p>}
    </section>
    <section className="account-billing__section" aria-labelledby={creditsId} aria-busy={matchingCredits?.kind === 'loading'}>
      <h3 id={creditsId}>Balance</h3>
      <div role="status">
        {matchingCredits?.kind === 'ready' ? <p className="account-billing__balance">{formatReadingAllowance(matchingCredits.balance)}</p>
          : matchingCredits?.kind === 'error' ? <p>Your balance could not be loaded. Please retry.</p>
          : <p>Checking your balance…</p>}
      </div>
      <div className="account-billing__actions">
        <button type="button" disabled={controlsBusy} onClick={() => void refreshCredits()}>{matchingCredits?.kind === 'error' ? 'Retry balance' : 'Refresh balance'}</button>
        <a className="account-billing__top-up" href={topUpHref} data-entry="top-up">Top Up</a>
      </div>
    </section>
    <section className="account-billing__section" aria-labelledby={purchasesId} aria-busy={summary.kind === 'loading'}>
      <h3 id={purchasesId}>Purchases</h3>
      {summary.kind === 'loading' && <p role="status">{summary.restoring ? 'Refreshing your purchase records…' : 'Checking your purchase history…'}</p>}
      {summary.kind === 'error' && <>
        <p role="alert">Your purchase records could not be {summary.restoring ? 'refreshed' : 'loaded'}. Please retry.</p>
        <button type="button" disabled={controlsBusy} onClick={() => void readCustomer(summary.restoring)}>Retry {summary.restoring ? 'restore' : 'purchase history'}</button>
      </>}
      {summary.kind === 'ready' && <>
        {summary.restored && <p role="status">Your purchases are up to date.</p>}
        {managementUrl && <a className="account-billing__manage" href={managementUrl} target="_blank" rel="noopener noreferrer">Manage subscriptions <span>Opens in a new tab</span></a>}
      </>}
      <div className="account-billing__actions">
        <button type="button" disabled={controlsBusy} onClick={() => void readCustomer(true)}>Restore purchases</button>
      </div>
    </section>
    <CreditActions uid={user.uid} onChanged={()=>void onRefreshCredits(user.uid)} />
  </dialog>, document.body);
}
