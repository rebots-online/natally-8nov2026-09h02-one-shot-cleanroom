import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserSessionPersistence, getAuth, getRedirectResult, GoogleAuthProvider,
  setPersistence, signInWithRedirect, type Auth,
} from 'firebase/auth';
import { firebaseConfig } from './env';
import { createPhoneSignInSession, describeSignInFailure, type PhoneSignInSession } from './firebase';

async function bootstrapNativeAuth(): Promise<void> {
  type Flow = { port: number; state: string; provider: 'google' | 'phone'; startedAt: number; redirecting: boolean };
  const key = 'natally-native-auth-flow-v1';
  const status = document.getElementById('native-auth-status');
  const proceed = document.getElementById('native-auth-continue') as HTMLButtonElement | null;
  const cancel = document.getElementById('native-auth-cancel') as HTMLButtonElement | null;
  const description = document.getElementById('native-auth-description');
  const phoneForm = document.getElementById('native-auth-phone-form') as HTMLFormElement | null;
  const phoneInput = document.getElementById('native-auth-phone') as HTMLInputElement | null;
  const recaptcha = document.getElementById('native-auth-recaptcha');
  const codeForm = document.getElementById('native-auth-code-form') as HTMLFormElement | null;
  const codeInput = document.getElementById('native-auth-code') as HTMLInputElement | null;
  const resend = document.getElementById('native-auth-resend') as HTMLButtonElement | null;
  const title = document.getElementById('native-auth-title');
  const changeNumber = document.getElementById('native-auth-change-number');
  const back = title?.parentElement?.querySelector<HTMLButtonElement>('[data-native-back]');
  const errorInstruction = status?.parentElement?.querySelector<HTMLElement>('[data-native-error]');
  const returnInstruction = status?.parentElement?.querySelector<HTMLElement>('[data-native-return]');
  if (!status || !proceed || !cancel) return;
  const showView = (view: 'google' | 'phone' | 'code' | 'return' | 'error') => {
    if (title) title.textContent = view === 'phone' ? 'Sign in by SMS'
      : view === 'code' ? 'Enter your code'
        : view === 'return' ? 'Return to Natally'
          : view === 'error' ? 'Sign-in request expired' : 'Continue in your browser';
    if (back) back.hidden = view !== 'code';
    if (errorInstruction) errorInstruction.hidden = view !== 'error';
    if (returnInstruction) returnInstruction.hidden = view !== 'return';
    cancel.className = view === 'phone' || view === 'code' ? 'atelier-btn-text' : 'atelier-btn-secondary';
  };
  let challenge: PhoneSignInSession | null = null;
  let abort: AbortController | null = null;
  let phoneEpoch = 0;
  const clearPhone = () => {
    phoneEpoch += 1;
    abort?.abort();
    abort = null;
    challenge?.dispose();
    challenge = null;
    if (codeInput) codeInput.value = '';
  };
  const say = (message: string) => { status.textContent = message; };
  const unavailable = () => {
    showView('error');
    clearPhone();
    if (phoneForm) phoneForm.hidden = true;
    if (codeForm) codeForm.hidden = true;
    try { sessionStorage.removeItem(key); } catch { /* The flow is unusable without session storage. */ }
    proceed.disabled = cancel.disabled = true;
    say('Open Natally and choose Sign in again. This browser sign-in link is missing, invalid, or expired.');
  };
  const valid = (value: unknown): value is Flow => {
    if (typeof value !== 'object' || value === null || Object.keys(value).sort().join(',') !== 'port,provider,redirecting,startedAt,state') return false;
    const flow = value as Flow;
    return Number.isInteger(flow.port) && flow.port >= 30000 && flow.port <= 65535
      && typeof flow.state === 'string' && /^[a-f0-9]{64}$/.test(flow.state)
      && (flow.provider === 'google' || flow.provider === 'phone') && typeof flow.redirecting === 'boolean'
      && typeof flow.startedAt === 'number' && Number.isFinite(flow.startedAt)
      && flow.startedAt > 0 && Date.now() >= flow.startedAt && Date.now() - flow.startedAt < 300000;
  };
  if (window.location.origin !== 'https://asknatally.online') { unavailable(); return; }
  let flow: Flow;
  const fresh = window.location.hash.length > 1;
  try {
    if (fresh) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const entries = Array.from(params.entries());
      const port = params.get('port') || '';
      if (entries.length !== 3 || new Set(entries.map(([name]) => name)).size !== 3
        || !entries.every(([name]) => ['port', 'state', 'provider'].includes(name))
        || !/^\d{5}$/.test(port)) { unavailable(); return; }
      const candidate = { port: Number(port), state: params.get('state'), provider: params.get('provider'), startedAt: Date.now(), redirecting: false };
      if (!valid(candidate)) { unavailable(); return; }
      flow = candidate;
      sessionStorage.setItem(key, JSON.stringify(flow));
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      let candidate: unknown;
      try { candidate = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { unavailable(); return; }
      if (!valid(candidate)) { unavailable(); return; }
      flow = candidate;
    }
  } catch { unavailable(); return; }

  let submitted = false;
  const post = (credential: { state: string; provider: 'google' | 'phone'; cancelled?: true; idToken?: string; accessToken?: string; verificationId?: string; code?: string }) => {
    if (submitted) return;
    if (!valid(flow)) { unavailable(); return; }
    sessionStorage.removeItem(key);
    submitted = true;
    clearPhone();
    proceed.disabled = cancel.disabled = true;
    if (phoneForm) phoneForm.hidden = true;
    if (codeForm) codeForm.hidden = true;
    showView('return');
    say(credential.cancelled ? 'Cancelling sign-in in Natally…' : credential.provider === 'phone'
      ? 'Returning to Natally to verify your SMS code…' : 'Returning your Google sign-in to Natally…');
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `http://127.0.0.1:${flow.port}/natally-auth`;
    form.enctype = 'application/x-www-form-urlencoded';
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = 'credential';
    field.value = JSON.stringify(credential);
    form.append(field);
    document.body.append(form);
    form.submit();
  };
  cancel.disabled = false;
  cancel.addEventListener('click', () => {
    try { post({ state: flow.state, provider: flow.provider, cancelled: true }); }
    catch { say('The sign-in could not be cancelled here. Return to Natally and try again.'); }
  });
  let auth: Auth | null = null;
  const initialize = async (): Promise<Auth> => {
    let options: unknown;
    const label = flow.provider === 'phone' ? 'SMS' : 'Google';
    try { options = JSON.parse(firebaseConfig()); } catch { throw new Error(`${label} sign-in is not configured on this deployment.`); }
    if (typeof options !== 'object' || options === null || !('apiKey' in options)
      || typeof options.apiKey !== 'string' || !options.apiKey) throw new Error(`${label} sign-in is not configured on this deployment.`);
    const app = getApps().find(candidate => candidate.name === 'natally-native-auth')
      || initializeApp(options as FirebaseOptions, 'natally-native-auth');
    const current = getAuth(app);
    await setPersistence(current, browserSessionPersistence);
    auth = current;
    return current;
  };
  let busy = false;
  if (flow.provider === 'phone') {
    proceed.hidden = true;
    if (!description || !phoneForm || !phoneInput || !recaptcha || !codeForm || !codeInput || !resend) { unavailable(); return; }
    showView('phone');
    description.textContent = 'Request an SMS code here, then return to the Natally app to verify it and finish signing in.';
    const send = phoneForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const verify = codeForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const setBusy = (value: boolean) => {
      busy = value;
      phoneInput.disabled = codeInput.disabled = resend.disabled = value;
      if (send) send.disabled = value;
      if (verify) verify.disabled = value;
    };
    const requestCode = async () => {
      if (busy || submitted) return;
      if (!valid(flow)) { unavailable(); return; }
      clearPhone();
      const epoch = phoneEpoch;
      abort = new AbortController();
      const signal = abort.signal;
      phoneForm.hidden = false;
      codeForm.hidden = true;
      showView('phone');
      setBusy(true);
      say('Complete the reCAPTCHA check to request an SMS code.');
      try {
        const current = auth || await initialize();
        if (submitted || epoch !== phoneEpoch) return;
        const session = await createPhoneSignInSession(current, phoneInput.value, recaptcha, signal);
        if (submitted || epoch !== phoneEpoch) { session.dispose(); return; }
        abort = null;
        challenge = session;
        phoneForm.hidden = true;
        codeForm.hidden = false;
        showView('code');
        say('Your SMS code was sent. Enter its six digits to return to Natally for verification.');
        setBusy(false);
        codeInput.focus();
      } catch (error) {
        if (!submitted && epoch === phoneEpoch) say(describeSignInFailure(error, 'phone'));
      } finally {
        if (!submitted && epoch === phoneEpoch) setBusy(false);
      }
    };
    phoneForm.addEventListener('submit', event => { event.preventDefault(); void requestCode(); });
    resend.addEventListener('click', () => { void requestCode(); });
    const changeNumberView = () => {
      if (busy || submitted) return;
      clearPhone();
      phoneForm.hidden = false;
      codeForm.hidden = true;
      showView('phone');
      say('Enter your mobile phone number to request an SMS code.');
      phoneInput.focus();
    };
    changeNumber?.addEventListener('click', changeNumberView);
    back?.addEventListener('click', changeNumberView);
    codeForm.addEventListener('submit', event => {
      event.preventDefault();
      if (busy || submitted) return;
      if (!challenge) { say('Request a new SMS code before continuing.'); return; }
      if (!/^[0-9]{6}$/.test(codeInput.value)) { say('Enter the six digits from your SMS message.'); return; }
      try { post({ state: flow.state, provider: 'phone', verificationId: challenge.verificationId, code: codeInput.value }); }
      catch { say('Could not return your code to Natally. Open Natally and try signing in again.'); }
    });
    window.addEventListener('pagehide', clearPhone, { once: true });
    phoneForm.hidden = false;
    setBusy(false);
    say(fresh ? 'Enter your mobile phone number to request an SMS code.' : 'Request a new SMS code to continue. Codes from before this page reload are not retained.');
    phoneInput.focus();
    return;
  }
  showView('google');
  const retry = async () => {
    if (busy || submitted) return;
    if (!valid(flow)) { unavailable(); return; }
    busy = true;
    proceed.disabled = true;
    say('Opening Google in your browser…');
    try {
      const current = auth || await initialize();
      if (submitted) return;
      flow.redirecting = true;
      sessionStorage.setItem(key, JSON.stringify(flow));
      await signInWithRedirect(current, new GoogleAuthProvider());
    } catch (error) {
      flow.redirecting = false;
      try { sessionStorage.setItem(key, JSON.stringify(flow)); } catch { unavailable(); return; }
      busy = false;
      proceed.disabled = false;
      say(error instanceof Error ? `Google sign-in did not complete: ${error.message}` : 'Google sign-in did not complete. Continue with Google to try again.');
    }
  };
  proceed.addEventListener('click', () => { void retry(); });
  try {
    const current = await initialize();
    if (submitted) return;
    if (fresh) { await retry(); return; }
    const result = await getRedirectResult(current);
    if (submitted) return;
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential || credential.providerId !== 'google.com' || !credential.idToken || credential.idToken.length > 16384
        || (credential.accessToken != null && (!credential.accessToken || credential.accessToken.length > 16384))) {
        throw new Error('Google did not return a valid sign-in credential.');
      }
      post({ state: flow.state, provider: 'google', idToken: credential.idToken,
        ...(credential.accessToken ? { accessToken: credential.accessToken } : {}) });
      return;
    }
    flow.redirecting = false;
    sessionStorage.setItem(key, JSON.stringify(flow));
    proceed.disabled = false;
    say('Google did not return a sign-in result. Continue with Google to try again, or cancel sign-in.');
  } catch (error) {
    if (submitted) return;
    proceed.disabled = false;
    say(error instanceof Error ? error.message : 'Google sign-in did not complete. Try again or cancel sign-in.');
  }
}

void bootstrapNativeAuth();
