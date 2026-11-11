You are the coder for task LANDING-B in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §12.1 and §16 (entity registry) for names, DOCS/RUBRIC-landing-conversion-2026-11-10.md, and the files you own plus the files you must call into (read-only). Never read git history, dist/, other repositories, or any file you do not own except read-only callees.

HARD RULES
- Edit only your owned files: src/landing-original/marketing.tsx, src/landing-original/marketing.css. Any other change is rejected.
- New module-scope names must already appear in DOCS/ARCHITECTURE.md §16 (pending LANDING rows). Do not invent other names.
- No placeholders, no TODOs, no mock data, no fake success paths. Anything unconfigured fails visibly.
- `npx tsc --noEmit` must be clean for the whole tree when you finish (do not edit other files to make it so; report a conflict instead).
- Do not commit or push. Report paths changed, a unified diff summary, the checks you actually ran with their exit status, and any decision you could not make (escalate instead of guessing).

FIXED INTERFACES (binding on every task; implement your side exactly)
## LANDING — derived 1:1 from DOCS/ARCHITECTURE.md §12.1 (frozen 2026-11-11) + DOCS/RUBRIC-landing-conversion-2026-11-10.md; §16 pending LANDING rows.

Fixed interfaces (every task implements its side exactly; nobody edits another task's files):
- Markup contract (landing.html ↔ marketing.tsx/css): inside `<main id="top">`, after `#marketing-experience-root`, one `<div class="landing-cards">` holding, in order, `<section class="landing-section" id="meet-natally|your-chart|reading-aloud|talk-with-natally|prices|education" data-chart="false|true">`; each section holds one or more `<article class="landing-card">` (one page of copy each). `data-chart="true"` on `your-chart` and `reading-aloud` only. Menu anchors (`#your-chart`, `#reading-aloud`, `#talk-with-natally`, `#prices`, `#education`) target these ids.
- App entries: `https://asknatally.online/` (app at `/`); the Sign In entry is `https://asknatally.online/?signin=google`; offers keep `?offer=…`. On hosts other than astronatally.com / www.astronatally.com the landing keeps same-origin `/app.html` (dev).
- Arrival with `signin=google` (asknatally.online): the parameter is removed from the address bar and `googleSignIn()` starts at once (popup; its existing redirect fallback when blocked); while it runs no sign-in button or card asks for another click.



YOUR TASK (from CHECKLIST.md)
| LANDING-B | Landing behaviour and look per §12.1 items 1, 3–6: the stage is the atelier exactly as the app's signed-out page shows it (full stage, `AtelierScene`), the example wheel in the inset; the `.landing-cards` scroll by over/beside it, each `.landing-card` drawn with the app's dark-purple `.card` surface (`src/app/app-shell.css` `.card` tokens copied into `marketing.css`); the active section (scroll position or menu item) drives the view: `data-chart="true"` → chart view, otherwise atelier, both directions; `STORY_SECTIONS`/section tracking read the contract ids. `appEntry`/`APP_ORIGIN` per the interfaces for Sign In, Create-your-chart, Top Up, Open my atelier, example-caption link and the `?app=1`/offer self-redirect. Verify in the dev server: scroll and menu both swap and swap back; every CTA's href. | `src/landing-original/marketing.tsx`, `src/landing-original/marketing.css` | ⬜ |

ARCHITECTURE CONTEXT (target state; behaviour authority)
### 12.1 Landing target state (operator 2026-11-11 — FROZEN on Robin's order "assign to coders from checklist")

1. **The landing is the atelier.** Visitors land on the page that comes up
   today when you click Sign In: the big Natally in her atelier. That page
   replaces the current marketing layout as the landing.
2. **One click, one sign-in (hard rule).** Sign In launches Google's account
   chooser on that same click. No screen, card or button ever asks someone to
   click to sign in after they already clicked Sign In — offering sign-in and
   then presenting another "click here to sign in" taunts them. A blocked
   popup falls back to Google's redirect from that same click, never to a
   second prompt.
3. **All scrolling text is paginated onto cards.** Every piece of landing copy
   is divided into pages, each page its own small card with the dark purple
   background of the card that today carries the second "click here to sign
   in" (that card's look is kept; its second-click role is removed per item
   2). The cards scroll by; no landing copy remains as plain scrolling text.
4. **Entering the natal-chart content swaps to the chart** — by scrolling into
   it or by choosing its menu item.
5. **Leaving the natal-chart content swaps back to the atelier** — by
   scrolling out of it or by choosing a menu item outside it.
6. **Roles by domain.** astronatally.com is the landing; the webapp lands on
   asknatally.online. Every way into the app from the landing — Sign In,
   create-your-chart, Top Up, open-my-atelier, the `?app=1` entry — routes to
   asknatally.online, and asknatally.online serves the app at `/`.
7. **Sign-in works on both domains.** Firebase authorized domains include
   astronatally.com, asknatally.online and their `www` hosts (added
   2026-11-11; snapshot in `DOCS/DOMAINS/`). Item 2 holds across the domain
   change: the landing's Sign In arrives at asknatally.online already
   starting Google sign-in — the visitor never meets a second sign-in click.



RUBRIC (acceptance checkpoints)
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
9. **Both dated hosts unchanged in role** — natally-8nov2026.robin.mba and
   .surge.sh still deploy the same build first (rule 11), with landing CTAs
   pointing to asknatally.online.
10. **Version badge** — every surface (both new domains + dated hosts) shows
    the same new version stamp bottom-right after the deploy.

## Out of scope (record, do not build)

- Testimonials/social proof (none exist; never invented).
- The inset behaviours (INSET dispatch, separate issue per ledger).
- DNS / Netlify CORS — runbook steps (DOCS/DOMAINS/), not landing code.
  (Firebase authorized domains are IN scope — login cannot work without them;
  added 2026-11-11, snapshot in DOCS/DOMAINS/.)


VERIFY: run the dev server (`npm run dev`, port shown in output) and exercise the contract in a browser or by targeted reasoning over the actual code path; state exactly what you observed. Acceptance is by observed behaviour, not by code presence.
