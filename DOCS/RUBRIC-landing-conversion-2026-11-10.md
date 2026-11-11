> **Superseded 2026-11-11** by `DOCS/RUBRIC-landing-atelier-2026-11-11.md` (ARCHITECTURE §12.1: the landing is the app's signed-out page). Kept as history.

# Rubric — landing conversion build-out (astronatally.com) — 2026-11-10

Preauthored **before** design or code (AGENTS.md rule 10). Observation target:
`landing.html` marketing sections + cross-domain CTA seam + dual-domain deploy.
Acceptance is a recorded screencast/checklist observation against every
checkpoint below on the deployed build (DOCS/DEMONSTRATIONS/); static
inspection and lint never substitute.

## Checkpoints (observe on the deployed astronatally.com build)

1. **First screen** — the interactive atelier + example wheel still owns the
   first viewport (no banner above it); the header is unchanged (brand, Menu,
   account/sign-in). No new chrome above the fold.
2. **Hero copy present** — beneath the stage, a `#meet-natally` section with
   one H1 stating the offer plainly (an astrologer who reads your natal chart
   aloud and shows every part of it) and a primary CTA **Create your natal
   chart — it's free**.
3. **Every menu item lands on a real section** — Menu → Your chart /
   Your chart, explained aloud / Personal readings / Prices / Learn astrology
   each scrolls to a section with that content (`#your-chart`,
   `#reading-aloud`, `#talk-with-natally`, `#prices`, `#education`). No dead
   anchors anywhere on the page.
4. **Prices are on the page** — `#prices` shows the real offer with exact
   amounts: chart creation free; conversation credit packs US$5 / US$10 /
   US$25; keepsake natal report US$30 (PDF + retained interactive viewer).
   No invented testimonials, countdowns, or scarcity; no meta copy beyond the
   existing footer notice.
5. **CTAs cross domains correctly** — every CTA on astronatally.com
   (hero, sections, header Sign In / Top Up / example-caption link) opens
   `https://asknatally.online/app.html?app=1` (or the offer variant), not a
   same-origin `/app.html`. On the dated hosts the same CTAs also point at
   asknatally.online.
6. **asknatally.online serves the app at root** — `https://asknatally.online/`
   mounts the app shell directly (not the landing); `/app.html` also works;
   `?app=1` mount-redirect on the landing still lands on the app domain.
7. **Her voice, no disclaimers** — all new copy reads as the sincere-astrologer
   register (warm, plain, no miracles, no "just symbolic" hedging); the only
   entertainment-purpose notice remains the single footer line.
8. **Reduced motion / no-JS truth** — with JS disabled the sections and CTAs
   still read and navigate (static anchors); noscript line still present.
9. **Purchased domains retain their roles** — astronatally.com serves the
   landing and asknatally.online the app; canonical publication targets both
   purchased domains (rule 11).
10. **Version badge** — every surface (both new domains + dated hosts) shows
    the same new version stamp bottom-right after the deploy.

## Out of scope (record, do not build)

- Testimonials/social proof (none exist; never invented).
- The inset behaviours (INSET dispatch, separate issue per ledger).
- DNS / Netlify CORS — runbook steps (DOCS/DOMAINS/), not landing code.
  (Firebase authorized domains are IN scope — login cannot work without them;
  added 2026-11-11, snapshot in DOCS/DOMAINS/.)
