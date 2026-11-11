import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserSessionPersistence, getAuth, getRedirectResult, GoogleAuthProvider,
  setPersistence, signInWithRedirect, type Auth,
} from 'firebase/auth';
import { firebaseConfig } from './env';

async function bootstrapNativeAuth(): Promise<void> {
  type Flow = { port: number; state: string; provider: 'google'; startedAt: number; redirecting: boolean };
  const key = 'natally-native-auth-flow-v1';
  const status = document.getElementById('native-auth-status');
  const proceed = document.getElementById('native-auth-continue') as HTMLButtonElement | null;
  const cancel = document.getElementById('native-auth-cancel') as HTMLButtonElement | null;
  if (!status || !proceed || !cancel) return;
  const say = (message: string) => { status.textContent = message; };
  const unavailable = () => {
    try { sessionStorage.removeItem(key); } catch { /* The flow is unusable without session storage. */ }
    proceed.disabled = cancel.disabled = true;
    say('Open Natally and choose Sign in again. This browser sign-in link is missing, invalid, or expired.');
  };
  const valid = (value: unknown): value is Flow => {
    if (typeof value !== 'object' || value === null || Object.keys(value).sort().join(',') !== 'port,provider,redirecting,startedAt,state') return false;
    const flow = value as Flow;
    return Number.isInteger(flow.port) && flow.port >= 30000 && flow.port <= 65535
      && typeof flow.state === 'string' && /^[a-f0-9]{64}$/.test(flow.state)
      && flow.provider === 'google' && typeof flow.redirecting === 'boolean'
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
  const post = (credential: { state: string; provider: 'google'; cancelled?: true; idToken?: string; accessToken?: string }) => {
    if (submitted) return;
    if (!valid(flow)) { unavailable(); return; }
    sessionStorage.removeItem(key);
    submitted = true;
    proceed.disabled = cancel.disabled = true;
    say(credential.cancelled ? 'Cancelling sign-in in Natally…' : 'Returning your Google sign-in to Natally…');
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
    try { post({ state: flow.state, provider: 'google', cancelled: true }); }
    catch { say('The sign-in could not be cancelled here. Return to Natally and try again.'); }
  });
  let auth: Auth | null = null;
  const initialize = async (): Promise<Auth> => {
    let options: unknown;
    try { options = JSON.parse(firebaseConfig()); } catch { throw new Error('Google sign-in is not configured on this deployment.'); }
    if (typeof options !== 'object' || options === null || !('apiKey' in options)
      || typeof options.apiKey !== 'string' || !options.apiKey) throw new Error('Google sign-in is not configured on this deployment.');
    const app = getApps().find(candidate => candidate.name === 'natally-native-auth')
      || initializeApp(options as FirebaseOptions, 'natally-native-auth');
    const current = getAuth(app);
    await setPersistence(current, browserSessionPersistence);
    auth = current;
    return current;
  };
  let busy = false;
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
