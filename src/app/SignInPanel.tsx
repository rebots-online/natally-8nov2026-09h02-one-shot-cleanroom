import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  cancelNativeSignIn, describeSignInFailure, emailSignIn, emailSignUp,
  isNativeAuth, nativePhoneSignIn, resetEmailPassword, startPhoneSignIn,
  type PhoneSignInSession,
} from '../platform/firebase';
import { AtelierRail } from './prototype/ImmersiveLayout';
import './sign-in.css';

type AuthView = 'choose' | 'email' | 'register' | 'reset' | 'phone' | 'code';

export interface SignInPanelProps {
  onClose(): void;
  onGoogle(): Promise<void>;
  initialMethod?: 'email' | 'phone';
  googleError?: string | null;
  continueOnApp?: boolean;
}

export function SignInPanel({ onClose, onGoogle, initialMethod, googleError, continueOnApp = false }: SignInPanelProps) {
  const [view, setView] = useState<AuthView>(initialMethod ?? 'choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const recaptchaRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PhoneSignInSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nativePendingRef = useRef(false);
  const pendingRef = useRef(false);
  const epochRef = useRef(0);
  const mountedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const id = useId();
  const native = isNativeAuth();
  const current = (epoch: number) => mountedRef.current && epoch === epochRef.current;
  const clearPhone = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current?.dispose();
    sessionRef.current = null;
    if (nativePendingRef.current) {
      nativePendingRef.current = false;
      void cancelNativeSignIn().catch(() => {});
    }
  };
  const abandon = () => {
    epochRef.current += 1;
    pendingRef.current = false;
    clearPhone();
  };
  const close = () => { abandon(); onCloseRef.current(); };
  const changeView = (next: AuthView) => {
    abandon();
    setPending(false);
    setPassword('');
    setConfirmation('');
    setCode('');
    setError(null);
    setStatus(null);
    setView(next);
  };
  const choose = (method: 'email' | 'phone') => {
    if (continueOnApp && !native) {
      window.location.assign(`https://asknatally.online/?auth=${method}`);
      return;
    }
    changeView(method);
    if (method === 'phone' && native) void requestCode();
  };
  const begin = (): number | null => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setStatus(null);
    epochRef.current += 1;
    return epochRef.current;
  };
  const finish = (epoch: number) => {
    if (!current(epoch)) return;
    pendingRef.current = false;
    setPending(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      mountedRef.current = false;
      abandon();
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-sign-in-focus]') ?? [])
      .find(element => element.getClientRects().length > 0)?.focus();
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [view]);

  const google = () => {
    const epoch = begin();
    if (epoch === null) return;
    // Preserve the browser gesture: call the shell before any await.
    try {
      void onGoogle().catch(cause => {
        if (current(epoch)) setError(describeSignInFailure(cause));
      }).finally(() => finish(epoch));
    } catch (cause) {
      if (current(epoch)) setError(describeSignInFailure(cause));
      finish(epoch);
    }
  };
  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (view === 'register' && password !== confirmation) {
      setError('The passwords do not match. Enter the same password in both fields.');
      return;
    }
    const epoch = begin();
    if (epoch === null) return;
    const action = view;
    try {
      if (action === 'reset') {
        await resetEmailPassword(email);
        if (current(epoch)) setStatus('If an account can receive a reset email at that address, a password reset link will arrive shortly. Check your inbox and spam folder.');
      } else if (action === 'register') await emailSignUp(email, password);
      else await emailSignIn(email, password);
    } catch (cause) {
      if (current(epoch)) {
        if (action === 'reset' && typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'auth/user-not-found') {
          setStatus('If an account can receive a reset email at that address, a password reset link will arrive shortly. Check your inbox and spam folder.');
        } else setError(describeSignInFailure(cause, 'email'));
      }
    } finally {
      if (current(epoch)) { setPassword(''); setConfirmation(''); }
      finish(epoch);
    }
  };
  const requestCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (pendingRef.current) return;
    clearPhone();
    const epoch = begin();
    if (epoch === null) return;
    setCode('');
    if (native) {
      nativePendingRef.current = true;
      setStatus('Complete SMS sign-in in your system browser. Keep Natally open.');
      try { await nativePhoneSignIn(); }
      catch (cause) { if (current(epoch)) setError(describeSignInFailure(cause, 'phone')); }
      finally {
        if (current(epoch)) { nativePendingRef.current = false; setStatus(null); }
        finish(epoch);
      }
      return;
    }
    const container = recaptchaRef.current;
    if (!container) { setError('The reCAPTCHA form is unavailable. Close sign-in and try again.'); finish(epoch); return; }
    // A resend reuses the mounted host; expose its phone form before Firebase renders verification.
    flushSync(() => setView('phone'));
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('Complete the reCAPTCHA check to request your SMS code.');
    try {
      const session = await startPhoneSignIn(phone, container, controller.signal);
      if (!current(epoch)) { session.dispose(); return; }
      sessionRef.current = session;
      abortRef.current = null;
      setView('code');
      setStatus(`A six-digit code was sent to ${phone}.`);
    } catch (cause) {
      if (current(epoch)) { setStatus(null); setError(describeSignInFailure(cause, 'phone')); }
    } finally { finish(epoch); }
  };
  const confirmCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = sessionRef.current;
    if (!session) { setError('This SMS session has expired. Request a new code.'); return; }
    const epoch = begin();
    if (epoch === null) return;
    try { await session.confirm(code); }
    catch (cause) { if (current(epoch)) setError(describeSignInFailure(cause, 'phone')); }
    finally { if (current(epoch)) setCode(''); finish(epoch); }
  };

  const title = view === 'choose' ? 'Save your chart' : view === 'register' ? 'Create account'
    : view === 'reset' ? 'Reset password' : view === 'email' ? 'Sign in'
      : view === 'code' ? 'Enter your code' : 'Sign in by SMS';
  const visibleError = error ?? (view === 'choose' ? googleError : null);
  const back = () => changeView(view === 'register' || view === 'reset' ? 'email' : view === 'code' ? 'phone' : 'choose');
  return (
    <section className="sign-in-panel" aria-labelledby={`${id}-title`} tabIndex={-1} ref={panelRef} aria-busy={pending}>
      <AtelierRail title={title} labelledBy={`${id}-title`} onClose={view === 'choose' ? close : undefined} onBack={view === 'choose' ? undefined : back}>
        {view === 'choose' && <>
          <button type="button" className="atelier-btn-primary" onClick={google} disabled={pending} data-sign-in-focus>Continue with Google</button>
          <button type="button" className="atelier-btn-secondary" onClick={() => choose('email')} disabled={pending}>Continue with email</button>
          <button type="button" className="atelier-btn-secondary" onClick={() => choose('phone')} disabled={pending}>Continue with SMS</button>
          <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden={!visibleError}>{visibleError}</div>
        </>}
        {(view === 'email' || view === 'register' || view === 'reset') && (
          <form onSubmit={submitEmail}>
            <div className="atelier-field-group">
              <label className="atelier-label" htmlFor={`${id}-email`}>Email</label>
              <input className="atelier-input" id={`${id}-email`} name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={pending} data-sign-in-focus />
              <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden={!visibleError}>{visibleError}</div>
            </div>
            {view !== 'reset' && <div className="atelier-field-group">
              <label className="atelier-label" htmlFor={`${id}-password`}>Password</label>
              <input className="atelier-input" id={`${id}-password`} name="password" type="password" autoComplete={view === 'register' ? 'new-password' : 'current-password'} required minLength={view === 'register' ? 6 : undefined} value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
              <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden />
            </div>}
            {view === 'register' && <div className="atelier-field-group">
              <label className="atelier-label" htmlFor={`${id}-confirm`}>Confirm password</label>
              <input className="atelier-input" id={`${id}-confirm`} name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending} />
              <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden />
            </div>}
            <button type="submit" className="atelier-btn-primary" disabled={pending}>{view === 'register' ? 'Create account' : view === 'reset' ? 'Send reset email' : 'Sign in'}</button>
            {view === 'email' && <>
              <button type="button" className="atelier-btn-secondary" onClick={() => changeView('register')}>Create account</button>
              <button type="button" className="atelier-btn-text" onClick={() => changeView('reset')}>Forgot password</button>
            </>}
            {view === 'reset' && <div data-bind="status" aria-live="polite">{status}</div>}
          </form>
        )}
        {(view === 'phone' || view === 'code') && (
          <>
            {native ? <>
              <p className="atelier-body-text">Complete SMS sign-in in your system browser.</p>
              <button type="button" className="atelier-btn-primary" onClick={() => void requestCode()} disabled={pending} data-sign-in-focus>Continue in your browser</button>
              <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden={!visibleError}>{visibleError}</div>
            </> : <>
              <form onSubmit={requestCode} hidden={view !== 'phone'}>
                <div className="atelier-field-group">
                  <label className="atelier-label" htmlFor={`${id}-phone`}>Phone number</label>
                  <input className="atelier-input" id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern="[+][1-9][0-9 .\(\)\-]{7,25}" title="Start with + and your country code, using 8–15 digits." value={phone} onChange={event => setPhone(event.target.value)} disabled={pending} data-sign-in-focus />
                  <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden={!visibleError}>{visibleError}</div>
                </div>
                <div className="atelier-recaptcha-region" data-bind="recaptcha" ref={recaptchaRef} aria-label="SMS reCAPTCHA verification" />
                <p className="atelier-body-text">By choosing Send code, you consent to receive an SMS for sign-in. Message and data rates may apply. Google uses phone numbers to help prevent spam and abuse.</p>
                <button type="submit" className="atelier-btn-primary" disabled={pending}>Send code</button>
              </form>
              <form onSubmit={confirmCode} hidden={view !== 'code'}>
                <div className="atelier-field-group">
                  <label className="atelier-label" htmlFor={`${id}-code`}>Code</label>
                  <input className="atelier-input" id={`${id}-code`} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value)} disabled={pending} data-sign-in-focus={view === 'code' ? true : undefined} />
                  <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden={!visibleError}>{visibleError}</div>
                </div>
                <button type="submit" className="atelier-btn-primary" disabled={pending}>Verify code</button>
                <button type="button" className="atelier-btn-secondary" disabled={pending} onClick={() => void requestCode()}>Resend code</button>
                <button type="button" className="atelier-btn-text" onClick={() => changeView('phone')}>Change number</button>
              </form>
            </>}
          </>
        )}
        {view !== 'reset' && <div data-bind="status" aria-live="polite">{status}</div>}
      </AtelierRail>
    </section>
  );
}
