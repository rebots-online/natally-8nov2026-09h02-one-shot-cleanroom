// Firebase Auth access (DOCS/ARCHITECTURE.md §Identity): Google sign-in,
// UID = customer identity, Firebase ID token authenticates every billing
// call. Auth is initialized lazily; when VITE_FIREBASE_CONFIG is empty or
// invalid every function below throws AuthUnavailableError and
// authUnavailable is true so the app can render signed-out state truthfully.

import { FirebaseError, getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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

/** Google sign-in via popup, falling back to redirect when the popup is blocked. */
export async function googleSignIn(): Promise<void> {
  const a = requireAuth();
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(a, provider);
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/popup-blocked') {
      await signInWithRedirect(a, provider);
      return;
    }
    throw error;
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
