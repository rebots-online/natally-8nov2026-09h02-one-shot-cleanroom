# Architecture — 2026-11-08 (clean-room one-shot)

## Product

Natally: astrologer companion. Landing (marketing) · App (atelier, natal
chart, conversation with Natally) · Souvenir (US$30 natal report keepsake).
Conversation runs on credit packs (US$5/10/25). No placeholders, no dummy
payments.

## Stack

Vite + React 19 + TypeScript strict · three.js chart · Firebase (existing
project, public web config) · Chargebee prepaid rail · OpenRouter inference on
a per-customer managed key.

## Identity

Firebase Auth, Google sign-in. Firebase ID token authenticates every billing
call. UID = customer identity. Firestore with ported-shape rules.

## Billing — Chargebee (replaces RevenueCat on the client rail)

- Client: Chargebee.js drop-in checkout for one-time charges. Prices from
  `.env` (`BILLING_OFFER_PRICE_USD=30.00`, `BILLING_CREDIT_PACKS_USD=5,10,25`);
  Chargebee item prices must equal those exact cents.
- Server: Netlify function `chargebee.mjs` on the `natally-hosted-chat` site,
  routes `/billing/{access,checkout,redeem,webhook,history,invoices/:id}`.
  Verified Chargebee webhook payments idempotently grant integer USD-micros
  allowances in the runtime Firestore ledger and raise the managed OpenRouter
  key's USD spend limit by the verified amount. Allowance = grants − posted
  usage. The existing RevenueCat-wired function stays untouched.
- Env (kstore pointers, resolved at runtime only): `CHARGEBEE_SITE`,
  `CHARGEBEE_API_KEY`, `CHARGEBEE_WEBHOOK_SECRET`, `VITE_CHARGEBEE_SITE`,
  plus `OPENROUTER_ADMIN_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `BILLING_KEY_ENCRYPTION_KEY`, `BILLING_ALLOWED_ORIGIN`.

- Purchase prompting: when a chat turn has no allowance, the conversation
  shows Natally's in-world ask and the top-up sheet opens with the three
  credit packs and the US$30 souvenir; choosing one opens the Chargebee
  checkout; on success the allowance refreshes and the same turn can be
  resent. Every step that needs configuration fails visibly and truthfully
  when it is absent (missing `VITE_CHARGEBEE_SITE` → the sheet says checkout
  is not configured and names it; server 503 `billing_not_configured` → the
  same, with the missing server setting) — never a silent no-op, never a
  fake success.
## Inference

`completeHosted`: streaming completions on the customer's managed OpenRouter
key (free-tier chain); context = natal chart facts + conversation. Without
allowance: authored content only.

## Astrology

Swiss Ephemeris WASM (`public/vendor/swisseph/*`) computed locally; gazetteer
for birth place → coordinates/timezone. Frozen chart types in
`src/shared/types.ts`.

## Surfaces

- `/` landing: actual atelier art + mascot hero, example chart, value copy,
  offers at configured prices.
- `/app.html`: atelier scene (actual art), natal chart, chat with Natally
  (persona: warm astrologer, streaming, optional voice), account + top-up.
- Souvenir: US$30 purchase → authored + chart-facts report → PDF + retained
  interactive viewer.

## Env (public)

`VITE_BILLING_API_URL=https://natally-hosted-chat.netlify.app`,
`VITE_CHARGEBEE_SITE`, `VITE_FIREBASE_CONFIG` (public JSON),
`VITE_CREDIT_DISPLAY_PER_USD=100`.

## Release

Canonical `build_all.sh` only. Every run stamps a new version
(`version.json`/`version.txt`, shown bottom-right on every surface), deploys
the web build first to both production hosts — natally-8nov2026.robin.mba and
natally-8nov2026.surge.sh — then builds the native matrix (Linux, Windows via
cross-compilation, Android). natally.robin.mba is cut over only by the
operator.

## Native packaging

The canonical build is deploy-first and full-matrix: stamp once; compile web;
publish to natally-8nov2026.robin.mba and natally-8nov2026.surge.sh; then run
Linux AppImage/deb/rpm, Windows x64 executable/NSIS and Android arm64 APK/AAB/
native-symbol packaging. Native output lives in dist/natally-v<version>/.
The original Tauri Rust host, capabilities, mascot icons and generated
Android source project supply packaging identity mba.robin.natally; the
current rewrite's dist-web/app.html is the bundled native entry.

| Entity | Location | Contract |
| --- | --- | --- |
| Canonical coordinator | `build_all.sh` | One stamp and dual web publish before native compilation; web/deploy failure aborts the run |
| Build credential resolver | `scripts/build-environment.mjs` | Signing defaults declared in .env.example, actual pointers resolved through installed KStore client into child-process environment only |
| Native packaging coordinator | `scripts/build-native.mjs` | Sync native metadata to stamped version; run all supported native targets; stage artifacts and SHA-256 inventory; nonzero exit for any missing/failed requested target |
| Native host | `src-tauri/**` | Preserved original identity and native bridges; app.html bundle; Android full debug symbols and production keystore signing |

## First reveal and speech-driven presentation

| Entity | Location | Contract |
| --- | --- | --- |
| Reveal handoff | `src/app/onboarding/FirstLight.tsx` | Casting completes → hand the chart to the stage at once. No separate wheel is ever drawn over Natally; the only chart on screen is the stage's. |
| Opening reading | `src/app/AppShell.tsx` | The stage opens with Natally reading the chart aloud immediately (gesture-gated audio; truthful note when not admitted). The reading is her first chat message; chat is live beneath it. |
| Presentation cues | `src/app/presentation/cues.ts` | Her replies carry hidden cues `[[view:chart]]`, `[[view:atelier]]`, `[[chart:TARGET;…]]`, `[[chart:clear]]` at the passage they govern. Parsed out of display and speech with exact text offsets; unknown targets are dropped. |
| Presentation state | `src/app/presentation/state.ts` | Reducer over `PresentationState`: focus/clear set the highlighted targets; view swaps chart⇄inset (chart focused → Natally becomes the inset). A manual view choice turns `follow` off, and automatic view cues then stop. |
| Playback drive | `src/app/presentation/playback.ts` | The voice engine's word boundary offsets advance through the cues; each crossed cue is applied, so highlight → scroll → focus → un-highlight track what she is saying. Without audio, cues apply at text-stream offsets. |
| Cue prompting | `src/app/chat/context.ts` | System prompt instructs her to emit those cues as she narrates: chart view for geometry, atelier view for reflection, clear between emphases; includes this chart's exact target inventory. |

## Chart inset (primary USP)

| Entity | Location | Contract |
| --- | --- | --- |
| Inset (app) | `src/app/stage/Inset.tsx` + `inset.css` | Whichever pane is not in focus (chart, or Natally when the chart is focused) floats as an inset over the stage, visible from first load. Drag anywhere across the full stage; released near an edge or corner it docks there. A corner grip resizes it from 20% to 60% of the stage width, keeping its aspect; arrow keys with Alt resize. Position and size persist per account. First-load placement (no saved position) is computed on the actual screen: measure Natally's rendered face rectangle in the stage (scene coordinates 780–1270 × 380–760 of 2048 × 1280, mapped through the scene's rendered scale and crop) and choose the dock corner whose inset rectangle, at the largest size in 20–60% that fits, does not intersect that face rectangle; if none fits at 20%, the inset docks below the stage area. Recomputed on resize until the customer moves it. |
| Inset (landing) | `src/landing-original/marketing.tsx` + `marketing.css` | Same behaviour for the landing's example chart inset: draggable, dockable, resizable 20–60%, persisted for the guest. |

## Landing demo chart (unpaid example)

| Entity | Location | Contract |
| --- | --- | --- |
| Demo birth data | landing example chart | 31 August 1988, 14:30, Toronto (43.6532 N, 79.3832 W, America/Toronto). Chosen by measurement for a clearly visible theme: Sun–Moon–Neptune grand trine (1.0° orb), one bright triangle across the wheel, planets across 9 signs. Her demo narration opens on that triangle. |
| Casual discovery | landing inset wheel | Bodies, signs, houses and aspect lines are spread so an idle mouse-over anywhere on the wheel lands on something; each hit shows its tooltip/highlight. |
| No disclaimers | everything she says or the page shows | No disclaimer, hedge or meta framing anywhere — not in page copy, captions, lessons, spoken narration or chat replies ("example", "not your chart", "not proven predictions", "symbolic language, not…", "sign in to explore your own…"). She speaks with conviction in-world; the persona prompt forbids self-discounting. |
