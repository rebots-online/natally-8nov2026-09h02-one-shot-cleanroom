// App shell for /app.html (DOCS/ARCHITECTURE.md §Surfaces). State machine:
//   signed-out (onAuthChange)  → Google sign-in card over the atelier scene
//   signed-in without a chart  → FirstLight: the staged first-light welcome
//                                (src/app/onboarding) around the original
//                                onboarding intake, ending in the reveal and
//                                a single button into the conversation
//   signed-in with a chart     → atelier layout: AtelierBackdrop behind a
//                                collapsible AstroChart panel, ChatPanel
//                                (its onTopUp opens the TopUpSheet), a
//                                lesson card for the hovered body (getLesson,
//                                falling back to the general lesson), and the
//                                keepsake offer, code-split behind a dynamic
//                                import. The computed chart is kept
//                                per-customer in localStorage so a reload
//                                doesn't demand re-entering birth data.

import { Suspense, lazy, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AstroChart } from '../chart/AstroChart';
import { getLesson } from '../content/lessons';
import { authUnavailable, googleSignIn, onAuthChange } from '../platform/firebase';
import type { ChartBodyKey, NatalChart } from '../shared/types';
import AtelierBackdrop from './AtelierBackdrop';
import { ChatPanel } from './chat/ChatPanel';
import FirstLight from './onboarding/FirstLight';
import TopUpSheet from './TopUpSheet';
import './app-shell.css';

// The keepsake tree (report authoring + PDF export) is heavy; the dynamic
// import keeps it out of the app entry chunk and is the seam shared with the
// souvenir task.
const SouvenirDialog = lazy(() =>
  import('../souvenir/SouvenirDialog').then(mod => ({ default: mod.SouvenirDialog })),
);

type AuthState =
  | { status: 'unknown' }
  | { status: 'signedOut'; unavailable: boolean }
  | { status: 'signedIn'; uid: string; name: string };

const CHART_STORE_PREFIX = 'natally.chart.v1:';

function isNatalChart(value: unknown): value is NatalChart {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const input = candidate.input;
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as Record<string, unknown>).dateIso === 'string' &&
    Array.isArray(candidate.bodies)
  );
}

function loadStoredChart(uid: string): NatalChart | null {
  try {
    const raw = localStorage.getItem(CHART_STORE_PREFIX + uid);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isNatalChart(parsed) ? parsed : null;
  } catch {
    // Unreadable or corrupt storage: fall back to the birth form.
    return null;
  }
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'unknown' });
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [chartOpen, setChartOpen] = useState(true);
  const [hoveredKey, setHoveredKey] = useState<ChartBodyKey | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [souvenirOpen, setSouvenirOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (authUnavailable) {
      setAuth({ status: 'signedOut', unavailable: true });
      return;
    }
    try {
      return onAuthChange((user: User | null) => {
        setSignInError(null);
        setSigningIn(false);
        setAuth(
          user
            ? {
                status: 'signedIn',
                uid: user.uid,
                name: user.displayName ?? user.email ?? 'stargazer',
              }
            : { status: 'signedOut', unavailable: false },
        );
      });
    } catch {
      setAuth({ status: 'signedOut', unavailable: true });
    }
  }, []);

  // Load the stored chart on sign-in; drop it from memory on sign-out.
  useEffect(() => {
    if (auth.status !== 'signedIn') {
      setChart(null);
      return;
    }
    setChart(loadStoredChart(auth.uid));
  }, [auth]);

  // Persist the chart for the signed-in customer.
  useEffect(() => {
    if (auth.status !== 'signedIn' || chart === null) return;
    try {
      localStorage.setItem(CHART_STORE_PREFIX + auth.uid, JSON.stringify(chart));
    } catch {
      // Storage unavailable (private mode/quota): the chart lives in memory.
    }
  }, [auth, chart]);

  async function signIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      await googleSignIn();
    } catch (error) {
      setSigningIn(false);
      setSignInError(
        error instanceof Error ? error.message : 'Sign-in failed. Please try again.',
      );
    }
  }

  if (auth.status === 'unknown') {
    return (
      <div className="app-splash" role="status">
        Opening the atelier…
      </div>
    );
  }

  if (auth.status === 'signedOut') {
    return (
      <>
        <AtelierBackdrop />
        <div className="app-intake">
          <div className="card">
            <img
              className="sign-in-portrait"
              src="/natally-mascot.webp"
              alt="Natally, the atelier astrologer"
            />
            <h1>Natally</h1>
            <p className="card-intro">
              An astrologer who keeps an atelier for your chart. Sign in and she’ll cast it
              with you, then talk it over — planets, houses, and all.
            </p>
            {auth.unavailable ? (
              <p className="note warn">
                Sign-in isn’t available on this deployment — Firebase isn’t configured.
              </p>
            ) : (
              <button
                type="button"
                className="btn primary wide"
                disabled={signingIn}
                onClick={() => void signIn()}
              >
                {signingIn ? 'Signing in…' : 'Sign in with Google'}
              </button>
            )}
            {signInError && (
              <p className="note error" role="alert">
                {signInError}
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  if (chart === null) {
    return <FirstLight onSitDown={setChart} />;
  }

  const lesson = getLesson(hoveredKey ?? 'general');

  return (
    <div className="app-main">
      <AtelierBackdrop />
      <div className="app-frame">
        <header className="app-header">
          <h1 className="app-brand">
            Natally <span className="app-brand-sub">· the atelier</span>
          </h1>
          <div className="app-header-actions">
            <span className="app-greeting">{auth.name}</span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setSouvenirOpen(true)}
            >
              Keepsake…
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setTopUpOpen(true)}
            >
              Top up
            </button>
          </div>
        </header>

        <div className="app-columns">
          <div className="app-side">
            <section className="panel" aria-label="Your natal chart">
              <header className="panel-head">
                <h2>Your natal chart</h2>
                <button
                  type="button"
                  className="btn ghost small"
                  aria-expanded={chartOpen}
                  onClick={() => setChartOpen(open => !open)}
                >
                  {chartOpen ? 'Hide' : 'Show'}
                </button>
              </header>
              {chartOpen && (
                <div className="chart-body">
                  <AstroChart chart={chart} onHoverBody={key => setHoveredKey(key ?? null)} />
                </div>
              )}
            </section>

            <section className="panel lesson-card" aria-live="polite">
              <p className="lesson-kicker">
                {hoveredKey !== null ? `You’re hovering · ${hoveredKey}` : 'From Natally’s notebook'}
              </p>
              <h3>{lesson.title}</h3>
              <p className="lesson-body">{lesson.what}</p>
              <p className="lesson-question">{lesson.question}</p>
            </section>
          </div>

          <section className="app-chat" aria-label="Conversation with Natally">
            <ChatPanel chart={chart} onTopUp={() => setTopUpOpen(true)} />
          </section>
        </div>
      </div>

      {topUpOpen && <TopUpSheet onClose={() => setTopUpOpen(false)} />}

      {souvenirOpen && (
        <Suspense fallback={null}>
          <SouvenirDialog chart={chart} onClose={() => setSouvenirOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
