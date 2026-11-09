// Firebase Auth access (DOCS/ARCHITECTURE.md §Identity): Google sign-in,
// UID = customer identity, Firebase ID token authenticates every billing
// call. Auth is initialized lazily; when VITE_FIREBASE_CONFIG is empty or
// invalid every function below throws AuthUnavailableError and
// authUnavailable is true so the app can render signed-out state truthfully.

import { FirebaseError, getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { firebaseConfig } from './env';

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

/** Google sign-in via popup, falling back to redirect when the popup is
 *  blocked. Cancellation (the person closed the popup) throws
 *  SignInCancelledError; every other failure rethrows for
 *  describeSignInFailure() to name. */
export async function googleSignIn(): Promise<void> {
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

/** Specific, plain-language text for any sign-in outcome short of success —
 *  callers show it exactly where the sign-in click happened. Never silent. */
export function describeSignInFailure(error: unknown): string {
  if (error instanceof SignInCancelledError) {
    return 'Sign-in was cancelled — tap again whenever you’re ready.';
  }
  if (error instanceof AuthUnavailableError) {
    return 'Sign-in isn’t configured on this deployment — VITE_FIREBASE_CONFIG is empty or invalid.';
  }
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/popup-blocked':
        return 'The sign-in window was blocked — allow popups for this site and tap again.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled — tap again whenever you’re ready.';
      case 'auth/unauthorized-domain':
        return 'This domain isn’t authorized for Google sign-in yet — it must be added in the Firebase console (Authentication → Settings → Authorized domains).';
      case 'auth/operation-not-allowed':
        return 'Google sign-in is disabled for this Firebase project — enable it in the console (Authentication → Sign-in method).';
      case 'auth/configuration-not-found':
        return 'Google sign-in isn’t configured for this project — add the Google provider in the Firebase console.';
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
