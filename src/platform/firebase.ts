// Firebase Auth access (DOCS/ARCHITECTURE.md §Identity): Google sign-in,
// UID = customer identity, Firebase ID token authenticates every billing
// call. Auth is initialized lazily; when VITE_FIREBASE_CONFIG is empty or
// invalid every function below throws AuthUnavailableError and
// authUnavailable is true so the app can render signed-out state truthfully.

import { FirebaseError, getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './env';

export type AuthMethod = 'google' | 'email' | 'phone';

export function isNativeAuth(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Thrown by every function in this module when auth is unavailable. */
export class AuthUnavailableError extends Error {
  constructor() {
    super('Firebase auth is unavailable: VITE_FIREBASE_CONFIG is empty or invalid.');
    this.name = 'AuthUnavailableError';
  }
}

/** Thrown by idToken() when nobody is signed in. */
export class NotSignedInError extends Error {
  constructor() {
    super('No signed-in user; sign in with Google first.');
    this.name = 'NotSignedInError';
  }
}

/** Thrown by googleSignIn() when the person closed the popup themselves. */
export class SignInCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'SignInCancelledError';
  }
}

function parseFirebaseOptions(raw: string): FirebaseOptions | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (
      !('apiKey' in parsed) ||
      typeof parsed.apiKey !== 'string' ||
      parsed.apiKey.length === 0
    ) {
      return null;
    }
    // Whole-object boundary cast: apiKey is validated above; remaining
    // FirebaseOptions fields are optional pass-throughs for initializeApp.
    return parsed as FirebaseOptions;
  } catch {
    return null;
  }
}

const options: FirebaseOptions | null = parseFirebaseOptions(firebaseConfig());

/** True when the Firebase config is empty or invalid: auth cannot run. */
export const authUnavailable: boolean = options === null;

let auth: Auth | null = null;

function requireAuth(): Auth {
  if (auth) return auth;
  if (!options) throw new AuthUnavailableError();
  const app = getApps().length > 0 ? getApp() : initializeApp(options);
  auth = getAuth(app);
  return auth;
}

export function accountFirestore(accountUid: string): Firestore {
  const owner = requireAuth();
  if (!accountUid || owner.currentUser?.uid !== accountUid) {
    throw new NotSignedInError();
  }
  const database = (options as (FirebaseOptions & { firestoreDatabaseId?: unknown }) | null)?.firestoreDatabaseId;
  return typeof database === 'string' && database.length > 0
    ? getFirestore(owner.app, database)
    : getFirestore(owner.app);
}

export async function emailSignIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
}

export async function emailSignUp(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
}

export async function resetEmailPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email.trim());
}

export interface PhoneSignInSession {
  verificationId: string;
  confirm(code: string): Promise<void>;
  dispose(): void;
}

/** A challenge owns its verifier until sending settles, and its confirmation
 *  until the caller disposes it. An abandoned challenge can never be reused. */
export async function createPhoneSignInSession(
  owner: Auth, phoneNumber: string, container: HTMLElement, signal?: AbortSignal,
): Promise<PhoneSignInSession> {
  const normalized = phoneNumber.replace(/[\s().-]/g, '');
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
    throw new FirebaseError('auth/invalid-phone-number', 'Use an international phone number.');
  }
  if (signal?.aborted) throw new SignInCancelledError();
  return new Promise<PhoneSignInSession>((resolve, reject) => {
    let verifier: RecaptchaVerifier | null = null;
    let abandoned = false;
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      const current = verifier;
      verifier = null;
      current?.clear();
    };
    const abort = () => {
      abandoned = true;
      cleanup();
      reject(new SignInCancelledError());
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      verifier = new RecaptchaVerifier(owner, container, { size: 'compact' });
      if (signal?.aborted) { abort(); return; }
      void signInWithPhoneNumber(owner, normalized, verifier).then(result => {
        cleanup();
        if (abandoned) return;
        settled = true;
        let disposed = false;
        resolve({
          verificationId: result.verificationId,
          async confirm(code: string): Promise<void> {
            if (disposed) throw new FirebaseError('auth/code-expired', 'Request a new SMS code.');
            if (!/^[0-9]{6}$/.test(code)) {
              throw new FirebaseError('auth/invalid-verification-code', 'Enter the six-digit SMS code.');
            }
            await result.confirm(code);
            if (disposed) throw new SignInCancelledError();
            disposed = true;
          },
          dispose() { disposed = true; },
        });
      }, error => {
        cleanup();
        if (!abandoned) reject(error);
      });
    } catch (error) {
      cleanup();
      if (!settled && !abandoned) reject(error);
    }
  });
}

export async function startPhoneSignIn(
  phoneNumber: string, container: HTMLElement, signal?: AbortSignal,
): Promise<PhoneSignInSession> {
  return createPhoneSignInSession(requireAuth(), phoneNumber, container, signal);
}

export async function nativePhoneSignIn(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const value = await invoke<unknown>('native_sign_in', { provider: 'phone' });
    if (typeof value !== 'object' || value === null || !('provider' in value)
      || value.provider !== 'phone' || !('verificationId' in value)
      || typeof value.verificationId !== 'string' || value.verificationId.length < 1
      || value.verificationId.length > 8191 || !('code' in value)
      || typeof value.code !== 'string' || !/^[0-9]{6}$/.test(value.code)
      || ('idToken' in value && value.idToken != null)
      || ('accessToken' in value && value.accessToken != null)) {
      throw new Error('The native browser returned an invalid SMS credential.');
    }
    await signInWithCredential(requireAuth(), PhoneAuthProvider.credential(value.verificationId, value.code));
  } catch (error) {
    if (error === 'Sign-in cancelled' || (error instanceof Error && error.message === 'Sign-in cancelled')) {
      throw new SignInCancelledError();
    }
    throw error;
  }
}

export async function cancelNativeSignIn(): Promise<void> {
  if (!isNativeAuth()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('cancel_native_sign_in');
}

async function nativeGoogleIdToken(): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const value = await invoke<unknown>('native_sign_in', { provider: 'google' });
    if (typeof value !== 'object' || value === null || !('provider' in value)
      || value.provider !== 'google' || !('idToken' in value)
      || typeof value.idToken !== 'string' || !value.idToken || value.idToken.length > 16384) {
      throw new Error('The native browser returned an invalid Google credential.');
    }
    const accessToken = 'accessToken' in value ? value.accessToken : undefined;
    if (accessToken != null && (typeof accessToken !== 'string' || !accessToken || accessToken.length > 16384)) {
      throw new Error('The native browser returned an invalid Google access token.');
    }
    await signInWithCredential(requireAuth(), GoogleAuthProvider.credential(value.idToken, typeof accessToken === 'string' ? accessToken : undefined));
    return value.idToken;
  } catch (error) {
    if (error === 'Sign-in cancelled' || (error instanceof Error && error.message === 'Sign-in cancelled')) {
      throw new SignInCancelledError();
    }
    throw error;
  }
}

/** Google sign-in via popup, falling back to redirect when the popup is
 *  blocked. Cancellation (the person closed the popup) throws
 *  SignInCancelledError; every other failure rethrows for
 *  describeSignInFailure() to name. */
export async function googleSignIn(): Promise<void> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    await nativeGoogleIdToken();
    return;
  }
  const a = requireAuth();
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(a, provider);
  } catch (error) {
    if (error instanceof FirebaseError) {
      if (error.code === 'auth/popup-blocked') {
        await signInWithRedirect(a, provider);
        return;
      }
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        throw new SignInCancelledError();
      }
    }
    throw error;
  }
}

/** Google sign-in via popup that additionally returns the Google ID token
 *  (LANDING-C, §12.1 item 7): the landing hands that token to
 *  asknatally.online in the URL fragment so no second sign-in click is
 *  needed. Popup-blocked falls back to Google's redirect on the same click;
 *  the sign-in then completes through the existing redirect path
 *  (redirectSignInFailure + onAuthChange), never through this promise, so
 *  the promise stays pending while the browser navigates away. Cancellation
 *  (the person closed the popup) throws SignInCancelledError; every other
 *  failure rethrows for describeSignInFailure() to name. */
export async function googleSignInForIdToken(): Promise<string> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return nativeGoogleIdToken();
  const a = requireAuth();
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(a, provider);
    const oauthCredential = GoogleAuthProvider.credentialFromResult(result);
    const googleIdToken = oauthCredential?.idToken;
    if (!googleIdToken) {
      // A successful popup sign-in must carry the Google ID token; an absent
      // one is a real failure, never a silent success.
      throw new Error('Google sign-in succeeded but returned no ID token.');
    }
    return googleIdToken;
  } catch (error) {
    if (error instanceof FirebaseError) {
      if (error.code === 'auth/popup-blocked') {
        await signInWithRedirect(a, provider);
        // The page is navigating to Google; the redirect result is consumed
        // by the existing redirect path after the browser returns. This
        // promise intentionally never settles.
        return new Promise<string>(() => {});
      }
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        throw new SignInCancelledError();
      }
    }
    throw error;
  }
}

/** Sign in from a Google ID token handed over from the landing domain
 *  (LANDING-C, §12.1 item 7): rebuilds the Google credential from the token
 *  and signs in with it. Failures rethrow for describeSignInFailure(). */
export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  const a = requireAuth();
  await signInWithCredential(a, GoogleAuthProvider.credential(idToken));
}

/** Specific, plain-language text for any sign-in outcome short of success —
 *  callers show it exactly where the sign-in click happened. Never silent. */
export function describeSignInFailure(error: unknown, method: AuthMethod = 'google'): string {
  const label = method === 'email' ? 'Email/password' : method === 'phone' ? 'SMS' : 'Google';
  if (error instanceof SignInCancelledError) {
    return 'Sign-in was cancelled — tap again whenever you’re ready.';
  }
  if (error instanceof AuthUnavailableError) {
    return `${label} sign-in isn’t configured on this deployment — VITE_FIREBASE_CONFIG is empty or invalid.`;
  }
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/popup-blocked':
        return 'The sign-in window was blocked — allow popups for this site and tap again.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled — tap again whenever you’re ready.';
      case 'auth/unauthorized-domain':
        return `This domain isn’t authorized for ${label} sign-in yet — it must be added in the Firebase console (Authentication → Settings → Authorized domains).`;
      case 'auth/operation-not-allowed':
      case 'auth/admin-restricted-operation':
        return `${label} sign-in is disabled for this Firebase project — enable it in the console (Authentication → Sign-in method).`;
      case 'auth/configuration-not-found':
        return `${label} sign-in isn’t configured for this project — configure its provider in the Firebase console.`;
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'The email or password was not accepted. Check both and try again.';
      case 'auth/email-already-in-use':
        return 'That email already has an account. Sign in or reset your password.';
      case 'auth/weak-password':
      case 'auth/password-does-not-meet-requirements':
        return 'Choose a stronger password with at least six characters and any requirements set by this service.';
      case 'auth/user-disabled':
        return 'This account is disabled. Contact support before trying again.';
      case 'auth/invalid-phone-number':
      case 'auth/missing-phone-number':
        return 'Enter your phone number with + and its country code, followed by 8–15 digits.';
      case 'auth/invalid-verification-code':
      case 'auth/missing-verification-code':
        return 'That SMS code was not accepted. Enter the six digits from the message and try again.';
      case 'auth/code-expired':
      case 'auth/session-expired':
      case 'auth/invalid-verification-id':
        return 'This SMS session has expired. Request a new code.';
      case 'auth/captcha-check-failed':
      case 'auth/invalid-app-credential':
      case 'auth/missing-app-credential':
      case 'auth/recaptcha-not-enabled':
      case 'auth/missing-recaptcha-token':
      case 'auth/invalid-recaptcha-token':
        return 'The reCAPTCHA check did not complete. Request a new code and complete the check again.';
      case 'auth/quota-exceeded':
        return 'The SMS sending quota has been reached. Please try again later.';
      case 'auth/network-request-failed':
        return 'A network problem stopped sign-in — check the connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts just now — wait a moment and try again.';
      default:
        return `Sign-in failed (${error.code}). Please try again.`;
    }
  }
  if (error instanceof Error && error.message) {
    return `Sign-in failed — ${error.message}`;
  }
  return 'Sign-in failed. Please try again.';
}

/** After a redirect sign-in returns: its specific failure message, or null
 *  when no redirect failed (or auth isn't configured — that is reported
 *  separately by authUnavailable). */
export async function redirectSignInFailure(): Promise<string | null> {
  try {
    await getRedirectResult(requireAuth());
    return null;
  } catch (error) {
    if (error instanceof AuthUnavailableError) return null;
    return describeSignInFailure(error);
  }
}

/** Subscribe to sign-in state; returns an unsubscribe function. */
export function onAuthChange(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(requireAuth(), listener);
}

/** Current user's Firebase ID token; throws NotSignedInError when signed out. */
export async function idToken(): Promise<string> {
  const user = requireAuth().currentUser;
  if (!user) throw new NotSignedInError();
  return user.getIdToken();
}

/** Sign the current customer out (NAV-1: the account menu's Sign out). */
export async function signOutNow(): Promise<void> {
  await signOut(requireAuth());
}
