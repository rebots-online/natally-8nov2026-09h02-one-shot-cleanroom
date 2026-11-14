# Checklist — 2026-11-08 (clean-room one-shot)

1:1 translation of DOCS/ARCHITECTURE.md. One coder per task, disjoint files,
frozen contracts. ⬜ · 🔧 · ✅ · 🛑. Acceptance: section complete, `tsc
--noEmit` clean, owned files only, no placeholders, commit+push.

## Current operator frontier — 2026-11-11

Current explicit corrections supersede the historical recipes below. Netlify
repair/deployment recipes are cancelled. The requested checkpoint is working
login + actual paid/admin-redemption allowance + direct per-user OpenRouter
inference with exact model openrouter/free and provider cap0, then the sole
build_all.sh publishes both purchased domains and builds the native matrix.
Chargebee connection follows that artifact checkpoint; it is not its gate.
Operator's latest instruction is to publish the current checkpoint now under
PUBLISH-CURRENT. Earlier issuer discovery is not a gate for that publication;
remaining direct-key/reading gaps must be reported honestly.

| Task | Current state | Actual source / proof |
| --- | --- | --- |
| Namespace | [X] written; actual production APK identity/signature observed | 80e2d7f/c68e9a8; all native version projections agree; SDK reports mba.robin.astronatally, version1.31.768; configured production signer comparison passed; proof7490239 |
| Purchased HTTPS publication | Observed live on both purchased hosts | CLI pin2fca7ee; canonical v1.31.768 published with HTTPS forced; actual root badges, normal TLS and all root/app/auth routes observed; proof0dc2681 |
| Compact layout / exact 3D chart / acrylic status | [X] written, recorded visual observations; phone overlap open | source 3d73829/b6b1b88/4401e7d/29cc530; proof in landing-polish-2026-11-11 plus deployed v1.31.768 captures; root reviewed desktop/390px; phone inset still overlaps Natally's upper-left face |
| Neutral reset / sentence speech mapping | [X] written; 11 actual-source tests and tsc passed | source4e19107, proof8073639; actual completion/interruption observed; pronunciation audition remains unverified without audio |
| Native browser sign-in bridge | [X] written; source tests and all native compilation passed | source8ba564a, protocol proof2c2e138, full packaging proof7490239; actual Google/system-browser return and native runtime remain unverified |
| Personal product host references | [X] tracked migration written | 3be3421; exact originals retained in Admin-Manual operational backup; runtime request observation follows new deployment |
| Cancelled Netlify patches | [X] isolated and restored to published source | exact patch/test backup + SHA readback in Admin-Manual/.staging/natally-cancelled-netlify-checkpoint-2026-11-11 |
| Direct-key issuance / reading | Pending replacement issuer/client wiring and actual readable reply | Current active inference.ts still posts to old /billing/chat; no replacement issuer endpoint recovered from available KStore/config/Cloud Run/Hostinger access. This is not a gate for the operator's current publication order; no further issuer/account lookup is implied. Never put management key/admin code in client. |
| Full checkpoint build and deployment | Observed canonical exit0; complete packaging inventory | v1.31.768 stampd7a6073; both sites live; Linux3, Windows3, Android APK/AAB/symbols;9 artifacts, all4 target states packaged; exact metadata gate printed BUILD-MATRIX-PACKAGED 1.31.768; proof7490239. Real login/reading rubric acceptance remains open. |
| Native artifact transport | Exact inventory/log/evidence pushed; large binary bytes local | dist/natally-v1.31.768/ retains all produced bytes; no artifact LFS filter/URL configured. Preserve the operator's no-Forgejo-contact restriction; no oversized raw Git blobs, GitHub LFS or remote changes. |
| Windows signing | Packaging succeeded; installer signing skipped | Actual windows.log reports unsigned cross-platform installer; no signing, installation or Windows runtime acceptance is claimed. |
| Literal wildcard DNS | Pending exact two-record correction | Apex/www already geo.surge.world with valid HTTPS. Connected Namecheap tool has no zone read/write, Composio found no DNS interface, and actual browser access failed No browser is available. No zone mutation or full-zone backup was possible. |
| Required semantic review | Pending; latest returned ERROR is provider_read_timeout | Canonical KStore review is not PASS. Current exact review request is retained in the Admin-Manual operational outbox; no alternate authority or verdict override. |
| Chargebee checkout activation | Explicitly after checkpoint | No dummy flow, purchase or automatic allowance |

## Original 2026-11-08 task history — superseded where the frontier differs

| ID | Task | Owned files (exclusive) | Depends | Status |
| --- | --- | --- | --- | --- |
| W0 | SHELL | package.json, tsconfig.json, vite.config.ts, landing.html, app.html, .env.example, version.json, build_all.sh, .gitignore, netlify.toml | — | ✅ 982edfb/75b8807/53b0694 |
| W1 | SHARED | src/shared/** | W0 | ✅ aac9f27 |
| W2 | PLATFORM | src/platform/** (env/firebase/eventBus; version/pwa by W13) | W0 | ✅ d16359d |
| W3 | ASTRO | src/astro/** | W1 | ✅ a58e0ba |
| W4 | CHART | src/chart/** | W1, W3 | ✅ e6b91dd |
| W5 | BILLING-SERVER | netlify/functions/**, billing/** | W2 | ✅ c0b0b58 |
| W6 | COMMERCE-CLIENT | src/commerce/** | W2 (runtime W5) | ✅ 0e0f980 |
| W7 | VOICE | src/voice/** | W1 | ✅ 9573b46 |
| W8 | CHAT | src/app/chat/** | W2, W6 | ✅ da51fc9 |
| W9 | CONTENT | src/content/** | W1 | ✅ 19478c8 |
| W10 | APP-SHELL | src/app/** except chat/** | W2–W6, W9 | ✅ 1468c64 |
| W11 | LANDING | src/landing/** | W3, W4, W9 | ✅ eafe3b4 |
| W12 | SOUVENIR | src/souvenir/** | W4, W6, W8 | ✅ a29a3c8 |
| W13 | ENTRY-RELEASE | src/main.tsx, src/platform/{pwa,version}.ts | all | ✅ 434bc76 |
| W14 | JOURNEY-PROOF | DOCS/DEMONSTRATIONS/** | all | 🛑 operator: needs Chargebee/Firebase/OpenRouter credentials resolved (KStore pointers), the function deployed to Netlify, and real purchases recorded |

Integration: repo-wide `tsc --noEmit` clean; `bash build_all.sh` green
(dist-web/, 534 ms). Every task's commit pushed to origin
(~/github/natally-cleanroom-origin.git).

## Active repair swarm — rubric-bound, not yet accepted

| Task | Exclusive ownership | Required outcomes | State |
| --- | --- | --- | --- |
| AUDIO | `src/voice/**` and the two copied voiceService adapters named in ARCHITECTURE | R1: one speech owner, supersession without cancelling same-turn chunks, no stale mouth/karaoke events | In progress |
| PRESENTATION | Copied landing controller/CSS/renderer/content and landing document chrome named in ARCHITECTURE | R2: return to Natally between explanations; R3: wheel structure visible; R4: aspect hover/click; R5: compact readable header; R6: immersion-breaking lines absent | In progress |
| INTEGRATION | Parent-owned commits, canonical build invocation, dual staging publication and recording | R7: meaningful atomic commits and confirmed pushes; same version on both dated hosts; one continuous rubric recording | Pending both slices |

The historical green markers above are implementation records, not proof
that the current product passes this rubric. Acceptance remains pending
the continuous recording; no operator audition or test suite is a substitute.

## Native build request — active

| Task | Scope | Observable outcome |
| --- | --- | --- |
| NATIVE-BOOTSTRAP | Native host, generated Android sources, original icons, CLI dependency and build-only credential pointers | Current rewrite has reproducible Tauri packaging with original identity/signing; no dependency on the old checkout |
| NATIVE-COORDINATOR | `build_all.sh`, `scripts/build-environment.mjs`, `scripts/build-native.mjs` | One version; web dual-publish first and fail-fast; full Linux/Windows/Android matrix follows |
| NATIVE-ARTIFACTS | `dist/natally-v<version>/**` | Linux AppImage/deb/rpm, Windows executable/NSIS, Android signed APK/AAB/symbol ZIP; exact produced/missing status and SHA-256 inventory |
| NATIVE-ANDROID-1 | ARCHITECTURE.md §Native packaging: the Android target collects exactly the APK and AAB produced by THIS invocation (current stamped version), never leftovers from earlier versions; v1.24.765 failed with "Android release APK/AAB were not uniquely produced". Signed APK + AAB + native-symbol ZIP staged with SHA-256 in dist/natally-v<version>/. | `scripts/build-native.mjs` | not started |
| NATIVE-MSI-1 | ARCHITECTURE.md §Native packaging 'Windows MSI (Store)': package the cross-compiled Windows executable into an MSI on Linux with `wixl` (install msitools if absent): per-machine install, product name Natally, existing upgrade code from tauri.conf.json, version MAJOR.MINOR.BUILD.0 from the stamp, Start-menu shortcut, mascot icon; staged as natally-v<version>-windows-x64.msi with SHA-256; replaces the "windows-store not-built" entry. | `scripts/build-native.mjs`, `src-tauri/msi/**` | not started |

Landed (committed + pushed): NATIVE-ANDROID-1 2772764 (Android packaged in v1.26.765) · NATIVE-MSI-1 fc4da1d, a34ab8f (proof MSI from the v1.26.765 exe: Natally 1.26.765.0, per-machine, existing upgrade code). The Status column above predates these commits.

## INSET — dockable, resizable chart inset (ARCHITECTURE.md §Chart inset)

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| INSET-1 | Clean-room inset component per ARCHITECTURE.md §Chart inset 'Inset (app)': intent — Natally and her chart both usable, neither defeating the other. Unfocused pane floats over the stage from first load; drag, dock on release, corner-grip resize 20–60% keeping aspect, Alt+arrows resize, arrows move, persisted per account. First-load placement by range against the on-screen box of her rendered head: roomy → largest corner/size leaving her face clear with the chart legible; tight → least overlap with chart legible; too small → invert (chart focused, Natally the inset). Re-evaluated on resize until the customer moves it; the customer's choice wins. | `src/app/stage/Inset.tsx`, `src/app/stage/inset.css`, the inset wiring in `src/app/AppShell.tsx` | committed 8ca33a1; first-load placement amendment open |
| INSET-2 | Same owner as INSET-1 (one construct, one agent). ARCHITECTURE.md §First reveal and speech-driven presentation: casting hands the chart straight to the stage; she reads the chart aloud at once as her first chat message; her hidden cues drive highlight → focus → un-highlight and the chart⇄inset swap as her voice reaches them; a manual view choice stops automatic view cues. | `src/app/presentation/**`, `src/app/chat/**`, `src/app/stage/**`, `src/app/AppShell.tsx`, `src/app/onboarding/FirstLight.tsx` | not started |
| INSET-3 | Same owner. ARCHITECTURE.md §Chart inset row 'Inset (landing)' and §Landing demo chart: the landing example chart uses 31 August 1988 14:30 Toronto (Sun–Moon–Neptune grand trine; her demo narration opens on that triangle); the landing inset uses the same clean-room inset component (drag, dock, resize 20–60%, persisted for the guest); an idle mouse-over anywhere on the wheel lands on a highlightable target; 'She stays herself': one consistent sincere voice answering from inside the tradition for everyone, including people genuinely seeking answers — never inflating into miracles, never deflating with "get real"; one "for entertainment and edutainment purposes" notice in the terms and site footer only, never in her voice; cross-cultural history welcome; no opinion-spending either way — judged by what each line does for the person in context, not phrase-matching. Covers page copy, captions, lessons, spoken narration and the chat persona prompt. | `src/landing/**`, `src/landing-original/marketing.tsx`, `src/landing-original/marketing.css`, `src/content/**`, `landing.html`, `index.html`, `public/terms.html` | not started |

Landed (committed + pushed): INSET-1 8ca33a1, c6de0d5, 173a54d · INSET-2 f93bb49 · INSET-3 5d574a3 · INSET-4 60d861e, 0586465 · INSET-5 1a3c636, 719be9f, ce09a75, fee4bb4. Deployed in v1.24.765. The Status column above predates these commits.

| INSET-4 | Same owner. ARCHITECTURE.md §Chart inset (re-architected): size floor = smallest size at which every individual house number and planet symbol can be told apart and read, every body a ~44 CSS px target; prefers larger up to 60%; resizable floor→60% (grip, Alt+arrows). Moves like a card: grab anywhere and drag; tap/click without movement still selects. Layout by range: large enough → chart docks beside the scene (side by side or stacked) and the scene re-zooms into the remaining space so nothing is obscured, dragging it back over the scene undocks it; roomy → floating card largest face-clear above floor; tight → least overlap at largest size achieving it; too small → invert. Docked/floating state, position and size persist per account. Applies to app and landing insets. | `src/app/stage/**`, `src/app/AppShell.tsx`, `src/app/app-shell.css`, `src/landing-original/marketing.tsx`, `src/landing-original/marketing.css` | not started |
| INSET-5 | Same owner. ARCHITECTURE.md §Composition and presence: (a) landing balance — caption + "Create your natal chart" as one centred group beneath the controls, button the clear primary action sized to the controls' rhythm; (b) first paint — atelier poster on screen immediately, no blank page while scripts load; (c) chat present as she speaks — the chat box is on screen from her first spoken word (first reading included), her words appear in it as she says them, input ready; (d) space — one compact header line (wordmark, sign-in, menu for overflow), stage fills viewport height with no dead space below, footer notice below the fold; (e) remove the remaining "Sign in to explore your own calculated chart." line under 'She stays herself'. Landing and app. | `src/app/**` (except `src/app/TopUpSheet.tsx`), `src/landing/**`, `src/landing-original/marketing.tsx`, `src/landing-original/marketing.css`, `landing.html`, `index.html`, `app.html` | not started |

Acceptance: observed in the dev browser at 344, 500 and 1440 px — visible on load, dragged to each side, docked, resized to both limits, reload keeps position and size. One commit + push per change; deploy via build_all.sh; bottom-right version confirms the deploy.

## BILL — purchase flow (ARCHITECTURE.md §Billing — Chargebee, Purchase prompting)

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| BILL-1 | Full Chargebee purchase flow per §Billing: no-allowance turn → Natally's in-world ask + top-up sheet opens (3 packs + US$30 souvenir) → Chargebee checkout → allowance refresh → resend. Missing client or server configuration fails visibly, naming the missing setting; never silent, never fake success. Exposes the top-up sheet and purchase API only; INSET owns ChatPanel/AppShell wiring (it opens the sheet on a no-allowance error). | `src/commerce/**`, `src/app/TopUpSheet.tsx`, `netlify/functions/chargebee.mjs`, `billing/**` | not started |

## NAV — header, menu and one-click sign-in (ARCHITECTURE.md §Header, menu and sign-in)

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| NAV-1 | Single stage owner. Standard header placement (one top bar: wordmark left, items inline on wide screens, account action top right, standard menu button top right on narrow screens; nothing stacked below or centred in rows). Every menu item does exactly what its label says (real section scroll/open); items with no real destination removed. "Sign in" starts Google sign-in directly (popup, redirect fallback) and lands in the app at chart or first light — no intermediate page or second button; success, cancellation and every failure (popup blocked, unauthorised domain, network, missing configuration) shown visibly and specifically where they clicked. Landing and app. | `src/app/**` (except `src/app/TopUpSheet.tsx`), `src/landing/**`, `src/landing-original/marketing.tsx`, `src/landing-original/marketing.css`, `src/platform/firebase.ts`, `landing.html`, `index.html`, `app.html` | not started |

## INSET — derived 1:1 from DOCS/ARCHITECTURE.md §4 inset card, §5 state/explain, §6 context target, §7 Astrolabe3D target, §16 pending INSET rows (commit c50a55c). Supersedes STAGE-6 (2) and (3); STAGE-6 (1) orientation panel stays separate.

Fixed interfaces (every task implements its side exactly; nobody edits another task's files):
- Target names: bodies `Sun`…; signs `Aries`…; houses `House 1`…`House 12`; aspect lines `aspectTargetName(a, kind, b, now)` → natal `"Sun trine Moon"`, now↔natal `"now Mars square Venus"` (kind lower-case; no now↔now lines exist by design).
- `InsetProps.onSwap?: () => void` (tap on the inset with no component hit) · `InsetProps.onComponentTap?: (target: string) => void` (forwarded to the chart's `onComponentTap`).
- `Astrolabe3DProps.onComponentTap?: (target: string) => void` fires on a click/tap over a hovered component (not drag) with the target name above; `highlightedComponents: string[]` accepts those same names.
- `explainTarget(target: string, chart: NatalChart, sky: SkyPlacement[] | null): string` returns her passage as reply text with embedded cues (`[[view:chart]]`, `[[chart:A;B]]`, `[[chart:clear]]`) so it flows through `parseReply` and the existing playback driver unchanged; `involvedElements(target, chart): string[]`; `ExplainSource = 'tap' | 'cue'`.
- `userData.wheelStructure = true` on house spokes, house numbers, sign ring/ticks, degree marks; the focus-dim traverse never dims objects carrying it.

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| INSET-A | Inset card per §4: drag arms anywhere past `DRAG_THRESHOLD_PX`, docked card lifts on drag; release within `DOCK_REACH` docks (right→side, bottom→stack, else corner snap) and the stage re-zooms (`data-inset-dock`/`--inset-dock-size`); all four corners carry working resize grips clamped to [floor, cap]; Alt+arrow retained; size floor = max(fingertip rim, `GLYPH_MIN_PX` legibility of every house number and planet symbol); touch: tap on component = hover+click, tap on empty = `onSwap`, press-hold (`LONG_PRESS_MS`) then move = drag; `.chart-inset` acrylic: `backdrop-filter: blur` + plum tint darkening what lies behind, wheel/numbers/symbols fully legible, same material docked and focused. Add `onSwap`/`onComponentTap` props and forward the latter to the child chart. Verify every contract by actually exercising it in the dev server, not by code presence. | `src/app/stage/Inset.tsx`, `src/app/stage/inset.css` | ⬜ |
| INSET-B | `src/app/presentation/explain.ts` (new): `ExplainSource`, `aspectTargetName`, `involvedElements`, `explainTarget` per the interfaces; passage composed from `content/lessons` + `chart/liveReading` placement statement (authored; no inference; no placeholders) with cues for every involved element, moving element by element, `[[chart:clear]]` at the end. `src/app/chat/context.ts`: `chartTargets` enumerates aspect lines via `aspectTargetName` (natal and now↔natal); `presentationBlock` tells her to bring the chart forward, highlight involved elements, clear between emphases. Register nothing beyond §16 rows. | `src/app/presentation/explain.ts`, `src/app/chat/context.ts` | ⬜ |
| INSET-C | `Astrolabe3D` (deliberate local additions to the frozen port, §16.12): mark house spokes, house numbers, sign ring/ticks, degree marks `userData.wheelStructure` and exempt them in the focus-dim traverse so only bodies, glyphs and aspect lines de-emphasise; add `onComponentTap` fired from the existing click/tap path on a hovered component (never on drag), reporting target names per the interfaces (aspect lines included); make `highlightedComponents` accept those names (map internally where ids differ). Keep raycast selectability and callouts of aspect lines. | `src/atelier-original/components/Astrolabe3D.tsx` | ⬜ |
| INSET-D | `AppShell.tsx` wiring: pass `highlightedComponents={presentation.focusTargets}`; `onComponentTap(target)` → `explainTarget(target, chart, skyToday)` fed to the same reply driver as a chat reply (view→chart, highlights, speech with lipsync) and ignore an `onSwap` arriving from the same pointer sequence; `onSwap` → `{type:'view', view: other, manual:true}`. No change to what she says beyond calling `explainTarget`. | `src/app/AppShell.tsx` | ⬜ |

Acceptance for all: `tsc --noEmit` clean; owned files only; no placeholders; each contract demonstrated in the running dev server and reported; commit by the orchestrator after holistic semantic review.

## LANDING — derived 1:1 from DOCS/ARCHITECTURE.md §12.1 (frozen 2026-11-11, item 1 corrected: the landing is AppShell's signed-out page) + DOCS/RUBRIC-landing-conversion-2026-11-10.md; §16 pending LANDING rows. (First dispatch targeted landing.html/marketing — wrong page; stopped and rolled back.)

Fixed interfaces (every task implements its side exactly; nobody edits another task's files):
- `LandingCards(props: LandingCardsProps)`; `LandingCardsProps = { onSection: (id: string, chart: boolean) => void; onSignIn: () => void; signingIn: boolean }`. `LANDING_SECTIONS: readonly { id: 'meet-natally'|'your-chart'|'reading-aloud'|'talk-with-natally'|'prices'|'education'; menuLabel: string; chart: boolean; cards: readonly { heading?: string; body: string }[] }[]` — `chart: true` only for `your-chart` and `reading-aloud`. Each section renders as `<section id={id}>` of `.landing-card` pages; `onSection` fires as a section becomes the one in view (scroll or anchor jump), both directions. The `meet-natally` first card carries the one Sign In call-to-action (`onSignIn`).
- `googleSignInForIdToken(): Promise<string>` — popup (redirect fallback when blocked, which resolves through the existing redirect path), returns the Google ID token (`GoogleAuthProvider.credentialFromResult`); cancellation throws `SignInCancelledError`. `signInWithGoogleIdToken(idToken: string): Promise<void>` — `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`.
- Handoff: on astronatally.com / www.astronatally.com (`PRODUCT_LANDING_HOSTS`) a successful sign-in navigates to `https://asknatally.online/#gid=<idToken>`; on any host, a signed-out load with `#gid=` strips the fragment (`history.replaceState`) before anything else and calls `signInWithGoogleIdToken`. On other hosts (dev) sign-in stays in place as today.

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| LANDING-A | `src/app/landing/LandingCards.tsx` + `src/app/landing/landing.css` (new): `LANDING_SECTIONS` authored per rubric 2–4 and 7 — `meet-natally` (one H1 stating the offer plainly: an astrologer who reads your natal chart aloud and shows every part of it; the Sign In call-to-action), `your-chart`, `reading-aloud`, `talk-with-natally`, `prices` (exact: chart creation free; conversation credit packs US$5 / US$10 / US$25; keepsake natal report US$30 — PDF + retained interactive viewer), `education`; every section paginated into short cards; her sincere-astrologer register; no testimonials, countdowns, scarcity or disclaimers. Cards use the app's dark-purple `.card` surface (`src/app/app-shell.css` tokens) and scroll by over the atelier; section tracking per the interface. | `src/app/landing/LandingCards.tsx`, `src/app/landing/landing.css` | ⬜ |
| LANDING-B | `AppShell.tsx` signed-out branch becomes the landing per §12.1 items 1–7: keep `AtelierScene` and the header; replace the single intro card with `<LandingCards>`; header menu items link to the section ids; the landing's chart (`EXAMPLE_BIRTH` via `computeAstrolabeChart`; no person's name and no "example"/"Aurelia" text anywhere on screen — operator 2026-11-11) sits in the existing `Inset` and `onSection(…, chart)` swaps the stage to the chart for chart sections and back to the atelier otherwise (both directions; menu jumps included); every Sign In control is one click (`googleSignInForIdToken` on `PRODUCT_LANDING_HOSTS` then the `#gid=` handoff, the existing `signIn()` elsewhere); a signed-out load with `#gid=` runs the handoff per the interface and shows only a status line while it signs in; errors via `describeSignInFailure`. No change to the signed-in app. | `src/app/AppShell.tsx` | ⬜ |
| LANDING-C | `src/platform/firebase.ts`: add `googleSignInForIdToken` and `signInWithGoogleIdToken` per the interfaces, sharing the existing `requireAuth`, error classes and redirect handling; no change to existing exports' behaviour. | `src/platform/firebase.ts` | ⬜ |

Acceptance for all: `tsc --noEmit` clean; owned files only; no placeholders; each contract demonstrated in the running dev server and reported; checked against every rubric checkpoint; commit by the orchestrator after holistic semantic review.

## VOICE — derived 1:1 from DOCS/ARCHITECTURE.md §8.1 (frozen 2026-11-11).

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| VOICE-A | Port the original `VoiceDownloadStatus`/`VoiceProgress` (LIBS/reference/VoiceDownloadStatus.natally-ai-studio.tsx) to `src/app/VoiceDownloadStatus.tsx` against `src/atelier-original/services/supertonicTts.ts` (`subscribeVoiceStatus`, `VoiceStatus`), styled with plain CSS in the app's palette (no Tailwind), adding the percentage beside `x / y MB`; mount it once in `src/main.tsx` so every page shows it; in `src/main.tsx` also start the idle-scheduled preload (`scheduleSupertonicPreload` from `src/atelier-original/services/supertonicTts.ts`) on every page load. | `src/app/VoiceDownloadStatus.tsx`, `src/main.tsx` | ⬜ |
| CHART-LEGIBLE | `Astrolabe3D` (deliberate local addition, §16.12): every symbol legible at every size per §12.1 4c — planet and sign glyph sprites ≥ 14 CSS px on screen, house numbers and degree labels ≥ 11 px, scaled from the renderer's pixel size so a small floating inset never shrinks them into illegibility; contrast kept; no overlap pile-ups made worse; callouts never cover the hovered component — placed clear of it with a visible gap on the side with room, inside the inset. | `src/atelier-original/components/Astrolabe3D.tsx` | ⬜ |
| VOICE-B | `src/voice/index.ts`: §8.1 items 2–4 on the speaking side — a `speakStream` issued while the model still loads waits and then speaks (never silently dropped); chunks are synthesised ahead (next chunk in the worker while the current plays) so playback is gapless; keep karaoke/mouth events and gesture-gating; verify WebGPU→WASM calibration in `src/atelier-original/services/supertonic.worker.ts` is intact (read-only unless broken — report). | `src/voice/index.ts` | ⬜ |

Acceptance: `tsc --noEmit` clean; owned files only; no placeholders; observed in the dev server (bar with % visible during load on the landing; clicking a planet before the model is ready speaks once ready; long passage plays without gaps).

## AUDIT-1 — every defect the orchestrator observed at 1440×900, 1280×720 and 390×844 (2026-11-11), derived from ARCHITECTURE §12.1 4b–5d, §8.1. One round, three coders, disjoint files.

Observed defects (screens in /tmp/claude-1000/review/A-*.png): zodiac-ring signs are pale glyphs on pale baubles — illegible; planet glyphs and degree text too small and soft; the gold sign ticks are cylinders that cross the ring and stick out on both sides ("gold bars floating"); callouts sit on top of what they describe; selecting an aspect does not highlight it; on the phone the atelier floats mid-screen with an empty band above, the floating chart is missing at first load, and in chart view the cards cover the wheel; at 1280×720 the voice bar covers the bottom of the floating chart; scene meta labels ("Here with you", "An imagined sky"), the dev "Rehearse breakage" control and the "Tap a cookie · take a bite" instruction point at the room's magic; the treat is cookies out of season; the swap snaps instead of gliding; she never switches the view with her words; she has no welcome or stories on the landing.

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| AUDIT-CHART | `Astrolabe3D` (deliberate local additions): sign baubles a saturated fill with a dark, outlined glyph (legible at every size); all glyph/label textures drawn at 256 px × devicePixelRatio and sprites held to a minimum on-screen size (glyph ≥ 14 CSS px, degree/house text ≥ 11 px) from the renderer's pixel size, never darker or blurrier; sign-boundary ticks become short lines confined to the ring's width (no cylinders crossing it); house cusp separators run between the rings, attached; callouts placed clear of the hovered element with a visible gap on the side with room; selecting an aspect line highlights it and its two bodies; the Earth label crisp. | `src/atelier-original/components/Astrolabe3D.tsx` | ⬜ |
| AUDIT-LANDING | `AppShell.tsx` landing branch + `src/app/landing/landing.css`: phone layout — the atelier fills the top of the viewport (no empty band), the floating chart visible at first load, and in chart view the cards never cover the wheel (cards below/after the stage on narrow screens); insets stay clear of the bottom voice bar; the swap animates both panes together over ~450 ms (chart grows from its card, room shrinks into its corner, and back); while she explains, the view follows her passage's cues (chart when she points, back to her when she speaks to you); her welcome (no shelf/breakage reference) once voice is admitted and her authored stories when the room is quiet (`content/backstory` `nextSpontaneousStory`), spoken with lipsync and shown as her words. | `src/app/AppShell.tsx`, `src/app/landing/landing.css` | ⬜ |
| AUDIT-ROOM | Immersion (§12.1 5c/5d): remove the scene caption/status labels (`PHASE_LABELS` figcaption, "An imagined sky"), the "Rehearse breakage" control (dev included) and the "Tap a cookie · take a bite" instruction; the treat is macarons outside Halloween/Christmas (sign, item name, bite) and cookies only in season; remove shelf/grab/breakage references from `FirstLight` greeting and from anything she says (`content/backstory.ts`, `app/chat/context.ts`). Mechanics stay. | `src/atelier-original/components/atelier/AtelierScene.tsx`, `src/atelier-original/components/atelier/AtelierTrinkets.tsx`, `src/atelier-original/components/atelier/AtelierSeason.tsx`, `src/app/onboarding/FirstLight.tsx`, `src/content/backstory.ts`, `src/app/chat/context.ts` | ⬜ |

Acceptance: tsc clean; owned files only; orchestrator re-runs the same three-size audit and judges every listed defect gone before commit.

## STAGE-6 — swap, focus, inset surface, non-blocking orientation (ARCHITECTURE.md §Chart inset rows added 2026-11-09)

| ID | Task | Owned files (exclusive) | Status |
| --- | --- | --- | --- |
| STAGE-6 | Single stage owner. (1) "Talk with Natally" card and all orientation/instructions move to a side panel beside the stage: never over Natally, never modal, no dismissal required to continue. (2) Click/tap anywhere on the inset without dragging swaps it with the main view (drag moves, never swaps); Natally brings the chart into focus whenever she discusses a component during readings or explanations, highlights that component and de-emphasises other bodies and lines — never the wheel structure (house divisions, house numbers, sign ring, degree marks stay full presence); clears between emphases; every natal↔natal, now↔natal, now↔now line is mouse-over/tap selectable and explained. (3) Docking by dragging near edges/corners works; all four corners resize by dragging within floor–60%; inset is translucent dark-purple acrylic with the background behind it darkened and slightly blurred, fully legible. Also finish or revert the incomplete NAV-1 landing checkpoint ebf1ed9 so the tree typechecks. | `src/app/**` (except `src/app/TopUpSheet.tsx`), `src/landing/**`, `src/landing-original/marketing.tsx`, `src/landing-original/marketing.css`, `src/platform/firebase.ts`, `landing.html`, `index.html`, `app.html` | not started |

## LANDING-POLISH — operator correction 2026-11-11, before publishing

Frozen authority: ARCHITECTURE §12.1 4d/5e/5f and §Domains; observation
rubric: DOCS/RUBRIC-landing-atelier-2026-11-11.md checkpoints 8–14. This
supersedes conflicting earlier minimum-size instructions and “never smaller”
wording for the landing's compact inset. No fresh design interpretation is
needed. Keep the current atelier design and copy. Status: 🟡 active; all
acceptance observations remain pending until recorded.

### POLISH-LAYOUT — [X] source/proof recorded — compact sizing, calmer cards, visible karaoke

Ownership: `src/app/stage/Inset.tsx`, `src/app/stage/inset.css`,
`src/app/AppShell.tsx` (landing branch/wiring only),
`src/app/landing/LandingCards.tsx`, `src/app/landing/landing.css`,
`src/app/app-shell.css` (karaoke selector rules only; append if absent),
`src/app/karaokeCaption.tsx` (rolling two-line caption window).
The renderer is another coder's file: do not edit it. No new module-scope
entities except those named below.

Do:
- Add `InsetProps.compact?: boolean`, default false; private constants
  `COMPACT_INSET_MIN_PX = 96`, `COMPACT_INSET_DEFAULT_PX = 400`. When compact,
  preferred first-load width is 400 CSS px on wide screens or 180 px through
  760 px, floor 96, bounded by the actual stage. Pass `compact={true}` and a
  `:compact-v1` storage-key suffix from the landing's chart `Inset` only.
  Consistently use the compact floor in `clampGeometry`, drag/grips, Alt+arrow,
  restore, resize and automatic placement. Initial compact placement floats at
  the preferred size at the TOP LEFT, with the existing margin and below
  the header; do not auto-enlarge/dock/invert
  using the body-count/glyph floor. Operator screenshot 2026-11-11 04-02-51.png
  is the good geometry reference (~400 px top-left at 1440 px viewport);
  do not override the customer's saved manual size/position. Persist manual geometry; after the customer
  moves/resizes, it wins. Other callers keep existing defaults and behaviour.
- Keep the focused chart fitting the stage with about 8% breathing margin;
  the renderer coder owns camera framing. Keep phone's sticky stage and cards
  below it, wide card column beside the stage, and all panes inside the visible
  stage/above the voice bar. Preserve pane swap and speech cue behaviour.
- In existing `.landing-cards`/section rules set minimum page/section gaps
  48/96 CSS px desktop, 32/64 phones, plus a visible gutter from the stage.
  Keep one native vertical document scroll; no nested scroller. In
  `LandingCards`, render `.landing-scroll-cue` with the current scroll direction:
  start “Scroll down ↓”; middle “↑ Previous” and “Next ↓”; end “↑ Back up”.
  Buttons target real adjacent section ids in `LANDING_SECTIONS`; keep the
  existing `onSection` contract, native touch/wheel/key scrolling, header
  anchors and stage swaps. Use local component state/handlers, accessible
  names/focus, no new exported API. No dead next control at the end.
- Keep `inset.css`'s black-sky stars and fine constellation lines subdued
  behind the wheel: visible at ordinary brightness without bright foreground
  zigzags. Tone down the over-bright first pass. Retain reduced-motion stillness.
- For `.karaoke-caption .is-glowing` on both landing and app use `#fff36b`,
  weight 700, sharp dark edge/shadow and layered yellow halo; active-word
  contrast at least 7:1 against the caption surface. Keep surrounding words
  readable and real speech timing unchanged; no new animation or layout jump.
  Reconcile the landing's override so it cannot restore dim brass.
- In existing `KaraokeCaption`, measure the available caption width/font and
  paginate its words into windows of at most two actual lines; on resize
  remeasure. Display the window containing the original `wordIndex` and use
  original indices for the active highlight. No clipping-only solution, wall
  of text or caption scrollbar. Use component-local helpers/state only.

Verify/Accept: `npx tsc --noEmit` exits 0. Read back each edited region. Do not
mark visual acceptance from typecheck. Commit each coherent completed change
with explicit paths and push immediately to GitHub origin/master; preserve
others' changes. No `build_all.sh` yet while chart/layout defects remain.

Operator verification protocol (coder executes and records, not a checklist
gate): use the existing dev server or `npx vite --host 127.0.0.1 --port 5194
--strictPort`; demonstrate rubric 8, 11, 12, 13 at 1440×900, 1280×720 and
390×844. Resize a corner to 96 px, reload, focus/back; scroll/keyboard/menu
through first/middle/last cards and back. Record real speech karaoke (a
synthetic caption event alone is not proof). Save continuous screencast and
representative screenshots under `DOCS/DEMONSTRATIONS/landing-polish-2026-11-11/`
with truthful observations/timecodes. You may use Playwright in your own
isolated browser context; coordinate shared MCP browser access. Do not sweep
runtime/cache/log files into source commits. Report any observed gap explicitly.

### POLISH-CHART — [X] source/proof recorded — sharp renderer and exact gold spokes

Exclusive ownership: `src/atelier-original/components/Astrolabe3D.tsx`.
Read-only: `src/app/stage/Inset.tsx` and `src/app/AppShell.tsx` for the owned
renderer contract. Use existing `Astrolabe3D` and `Astrolabe3DProps`; preserve
public props and handlers. Internal effect-local helpers may be adjusted;
new module-scope entities require an architecture row first.

Do:
- Draw into a backing canvas matched to the actual displayed CSS box times
  devicePixelRatio; remeasure/redraw on container resize, compact/focused swap
  and transition settlement. Do not stretch a stale small bitmap, cap label
  texture resolution below its displayed footprint, or use a halo that blurs
  glyph/degree/Earth edges. Keep solid contrasting letter edges.
- Frame the entire focused wheel with about 8% surrounding margin. At compact
  widths below 160 px use a clean interactive thumbnail, deferring detailed
  annotations to focus/selection. Below 240 px show distinct interactive
  glyphs; defer crowded
  degree annotations to hover/selection or focus rather than forcing the card
  larger. Full details remain accessible through existing callouts/speech.
  At the 400 px reference size the sign/body/house badges and degree labels
  must not pile up: distinct lanes, restrained glyph/badge sizes, suppress
  secondary annotations where they collide and reveal on hover/selection.
  No darker chart, no new obsolete arc.
- Zodiac badge fill/glyph contrast is at least 4.5:1, never pale-on-pale.
  Preserve/restore smooth thick UFO/doughnut geometry, perspective tilt and
  a shaded rounded rim with moving sun/specular glint, not a flat disc.
  Existing scene-effect-local generated environment/reflection resources
  must be disposed at cleanup; no new module API. Keep text materials crisp.
  Sign ticks follow the torus cross-section height, not a flat slab at its
  crown: y=sqrt(max(0,tubeRadius^2-(r-trackRadius)^2))+tiny offset.
  Match the existing longitude mapping; inspect top/back alignment explicitly.
- Replace remaining gold sign-boundary cylinder bars with short precise radial
  strokes flush with the actual ring band's inner/outer edges at the exact
  computed boundary angles. House cusp spokes meet their actual inner/outer
  rings at exact cusp angles. No projecting ends, detached bars, duplicate
  arcs, z-fighting or floating gap. Preserve the selectable bodies/aspects and
  related highlights; keep structure visible during highlight dimming.
- Preserve callouts clear of their target and pane-swap/touch behaviour.

Verify/Accept: `npx tsc --noEmit` exits 0; read back edited regions. Commit only
the owned renderer, meaningful message, push immediately to origin/master.
No production build/publish. Concurrent layout work is authoritative for its
files and new `compact` prop; do not revert it.

Operator verification protocol: use the shared dev server on 5194 when ready,
or separate Vite port 5195; inspect floating/minimum/focused/back at all three
rubric sizes and DPR 1/2, rotate and resize the wheel, select a body/aspect and
observe label clarity/spoke joins. Record checkpoints 9/10 in
`DOCS/DEMONSTRATIONS/landing-polish-2026-11-11/`; coordinate browser access with
POLISH-LAYOUT and report actual observations, not static-code confidence.

### POLISH-CHART-3D — [X] source/proof recorded — operator's sculpted-marker correction

Exclusive owner: `src/atelier-original/components/Astrolabe3D.tsx`. Same
renderer/props as POLISH-CHART; no new module API. Keep checkpoint 109e40e's
exact surface-following ticks, ring joins, full-DPR rendering and PMREM sun
reflection. Replace its provisional flat painted circle/sticker treatment
with the existing sculpted 3D beads/medallions, dark jewel surfaces and smaller
transparent glyph-only labels (at least 4.5:1 glyph/surface contrast). Keep the
smooth rounded rim and perspective. Group neighbouring body longitudes within
12 degrees into up to four height lanes separated by about 0.12 world units;
retain every body's exact longitude, use fine leaders to its actual ecliptic
anchor and keep picks at the displayed marker. Decluttering suppresses only
secondary text, NEVER a body (including Neptune). At 400 px the result has
clear space between bodies/glyphs, not enlarged overlapping badges.

When `focusSequence` changes and external highlighted/selected/selectedPlanet
are all empty, clear the renderer's existing `localAspectFocus` latch too;
this is the neutral-reset signal the next shell task will send. Glyphs and
structure retain contrast during narration/hover; no pale-on-pale or excessive
alpha dimming. Typecheck `npx tsc --noEmit` exit0; commit+push owned file. Record
rubric9/10/21 at floating/focused400px, all three viewport sizes and DPR1/2,
including close-body selection then neutral reset. Do not claim style accepted
until observed. No build/publish yet.

### POLISH-OVERLAY — [X] source/proof recorded — speech status superimposes

Own `src/app/VoiceDownloadStatus.tsx`, `src/app/AppShell.tsx` landing voice-bar
measurement/reservation only, `src/app/landing/landing.css` voice-bar offset
rules only. Read POLISH-LAYOUT's current code before edits; coordinate the
same owner for both tasks. §12.1 5g: make `.nv-bar` a small fixed acrylic
surface (max-width min(360px,100vw - 24px), ~70% plum tint, blur, subtle border),
preserving truthful MB/percentage, prepare/synthesis status and retry. Show
quiet synthesis status in production. Do not move the stage/inset or scrollY:
remove measurement-driven stage bottom/height reservations and corresponding
`--landing-voice-bar-h` layout offsets. Keep interactive status controls usable
and never cover the chart's grips/caption/card controls. No new module symbols.
Typecheck exit0, commit+push. Record rubric20 through real synthesis start/end,
compare observed stage/inset rectangles and scrollY, and inspect all3sizes.

POLISH-LAYOUT phone completion addendum: `--landing-stage-height` is authorized
in `landing.css` as the single shared private height formula for the sticky
scene, card anchor/cue and caption. In focused narrow mode reserve top room
band below the header, chart middle band (>=160px when available) and caption
foot; increase stage height within visible viewport only as needed. Keep
whole Natally, readable chart and two-line current-sentence caption clear of
one another. Preserve the customer's manual geometry. Same type/proof gates.

### DOMAIN-RETIREMENT — [X] tracked reference migration written; runtime proof follows deployment

Retire the old personal-domain URLs throughout first-party tracked repository
text/configuration and scripts, including historical prose. Runtime landing
entries use astronatally.com/www.astronatally.com and app entries use
asknatally.online; historical prose uses `retired-product-host` rather than
rewriting history. Use `mba.robin.astronatally` package identity under the NAMESPACE amendment. No product
deployment may target an unrelated personal-domain host. The exact migration
and release assignment follows the landing correction review; no placeholder
backend destination or unapproved backup-domain role may be invented.

## PREBILLING CHECKPOINT — SUPERSEDED Netlify task recipes

**CANCELLED before deployment by the operator's direct-key correction.**
CHECKPOINT-SERVER and CHECKPOINT-CLIENT below are preserved historical recipes,
not current assignments. Workers stopped with unpublished patches; preserve
those patches before integrating any replacement work. Do not deploy Netlify.
Current frontier is NAMESPACE plus direct user-key issuance/inference recovery,
then the already-requested full canonical build and purchased-domain deploy.


Frozen §9.1; rubric22–25. Order: working Google login + real admin redemption
+ managed key + readable/spoken `openrouter/free` response → one all-platform
`build_all.sh` checkpoint → Chargebee connection later. No automatic allowance.

### CHECKPOINT-SERVER

Own `netlify/functions/chargebee.mjs`, `billing/openrouter.mjs`,
`billing/checkpoint-server.test.mjs` (Node built-in tests), existing
backend deployment configuration/credentials through the private Netlify API.
Read-only `billing/ledger.mjs`, `billing/verify.mjs`, `netlify.toml`,
`scripts/build-environment.mjs`, `.env.example`. Never print secrets. Root/other
coders own client/layout/renderer. Preserve concurrent work.

Do:
1. Set existing `FREE_MODEL_CHAIN` exactly to `['openrouter/free']`; retire the
   three absent models. `createManagedKey` and `patchKeyLimit` send limit0,
   retain actual0 in saved managed-key metadata. Keep the allowance check
   before key creation: only payment/admin-code grant, never zero-cost access
   inferred from the model or key cap. `redeemRoute`, constant-time secret
   compare, configured grant amount and idempotent grant identity remain real.
2. Add exported `OpenRouterRateLimitError(retryAfterSeconds)` with numeric field
   bounded1–86400/default30. On actual upstream429 parse Retry-After seconds or
   HTTP date. Route returns HTTP429, JSON `error:'rate_limited'` and
   `retryAfterSeconds`, Retry-After header, exposed through CORS. Do not relabel
   allowance402 as rate limit or post spend for failed completion. Keep actual
   text/usage truthful if failure occurs mid-stream; no paid fallback.
3. Snapshot existing private Netlify env under
   `/home/robin/Admin-Manual/CREDENTIALS/Natally/` with a dated semantic name,
   then update only BILLING_ALLOWED_ORIGIN to include purchased apex/www
   HTTPS origins and localhost/127.0.0.1 ports5180/5192/5194/5195, retaining
   native Tauri origins and retiring old personal product origins. Site is
   natally-hosted-chat, id f48513f6-0319-4672-8959-4d3f4c7fd1b5. Use existing
   legitimate private CLI OAuth/API; app connector currently requires reauth.
   Existing OPENROUTER_ADMIN_KEY is valid; Firebase service account/encryption
   key and BILLING_REDEMPTION_CODE/ALLOWANCE_USD are already present. Do not
   connect/repair Chargebee API credentials in this checkpoint.
4. Publish the existing Netlify API functions with supported
   `netlify deploy --no-build --prod --functions netlify/functions --dir
   /home/robin/Admin-Manual/.staging/natally-hosted-chat-precheckpoint-static-2026-11-11/`.
   Before that command, read the actual currently published deploy ID/manifest,
   download its immutable static bytes to that exact known directory and verify
   manifest hashes. Pass the correct existing site ID/auth through the existing
   private CLI context. Retain old/new deploy IDs, manifest and static hashes
   as rollback evidence. No new Vite/native build and no invented function-only
   CLI. Preserve the other existing API function(s). Commit+push each coherent source
   change immediately. No product `build_all.sh` until client proof is ready.

Verify/Accept: `node --test billing/checkpoint-server.test.mjs` exits0; isolated
fetch stubs verify real gate ordering, model exactness, key cap0, idempotent redemption
handling and 429 propagation; syntax checks on ownedmjs exit0. No production
fake accounts/grants/customers. Operator protocol: normal validated CORS for all
origins; actual operator sign-in→actual code→actual grant/key→complete readable
free response, record scrubbed evidence. Provider diagnostic already proved
zero cap200/cost0; it alone does not pass the full journey.

### CHECKPOINT-CLIENT

Own `src/app/TopUpSheet.tsx`, `src/app/chat/{useChat.ts,ChatPanel.tsx,inference.ts}`,
`src/app/AppShell.tsx` account/status+speech-completion wiring only,
`src/voice/index.ts`, and
`src/atelier-original/services/voiceService.ts::prepareSpeechWithOffsets`
(speech-normalization region only). Read-only
`src/commerce/billingApi.ts`, `src/shared/credits.ts`, `src/platform/firebase.ts`,
`src/app/presentation/{state.ts,playback.ts,cues.ts}`. Coordinate AppShell with
POLISH-OVERLAY before edits; preserve its completed changes and preexisting
narrow-stage tracker. No Chargebee connection; no new module symbols except
registered `RateLimitedError` and registered fields.

Do:
0. Operationally checkpoint the preexisting 53-line AppShell narrow-screen
   section tracker separately after reading its exact diff against the existing
   phone card/stage requirements. Preserve all other work. The operator asked
   to commit/push the previous agent's pending work; do not bury this hunk in
   a new feature commit or leave it to be swept into a version stamp.
1. Add an inline accessible “Redeem admin code” form inside existing TopUpSheet,
   enabled even when Chargebee site is absent. Submit using the existing
   `redeem(await idToken(), enteredCode, requestId)`; keep requestId stable for
   same-attempt retry and new for a newcode/attempt. Never embed the secret or
   assume success. Show actual error/result; clear code on success; dispatch
   `natally-allowance-changed`. Listen in useAllowance to refresh immediately.
2. Correct balance to `formatCr(envelope.allowanceUsdMicros, creditDisplayPerUsd())`
   regardless of key state none. Valid zero displays0Cr; loading/fetcherror
   stay distinct via `AllowanceView.loading:boolean` and `error:string|null`.
   Render those truthful states in existing header/account display. Real grant
   should be visible before first chat provisions the managed key.
3. Add `RateLimitedError(retryAfterSeconds,message?)` in inference.ts; preserve
   actual429/retry timing, including streaming error metadata. In useChat keep
   the unanswered user question, display/speak one authored line:
   “I need a brief pause before I can answer that. We can keep looking at your
   chart in the meantime.” Use the existing shared voice; no invented answer.
   ChatPanel exposes a retry action disabled until Retry-After expires, default
   30s; no automatic tight loop, no grant bypass, no paid model selection.
4. Extend `SpeakOptions.onComplete?:()=>void` and the existing controller's
   utterance epoch. Callback fires once after a flushed utterance completely
   plays successfully; stop/supersession/error discards it. Shell explanation
   completion clears old highlighted/selected/selectedPlanet targets and
   increments focusSequence, guarded against clearing a newer interaction.
   Renderer task already clears localAspectFocus on that empty reset signal.
   Keep speech-paced cues and manual view preference; don't switch views just
   to reset the wheel. Apply reset in signed-out and signed-in explanation paths.
5. Normalize whole-word atelier in speech input to “ah-tell-yay” in the existing
   offset-preserving text-preparation seam. Visible/caption text stays atelier;
   mapped word offsets remain correct. Do not change spoken rate or lip timing.

Verify/Accept: `npx tsc --noEmit` exits0; meaningful voice-completion cancellation
and word-offset checks if a new seam is needed. Commit+push per coherent slice.
Operator protocol: actual redeemed balance, actual model response, actual speech
and neutral reset, actual pronunciation and correct two-line karaoke. All3sizes;
normal Google browser, no bypass of Google's automation check. Save proof under
DOCS/DEMONSTRATIONS/landing-polish-2026-11-11/. Never mark a synthetic auth event
as Google sign-in proof or a rate-limit canned line as a real model response.

### CHECKPOINT-RELEASE — pending journey proof

After server/client and current chart/layout fixes are complete, retire all
first-party tracked text references to old personal-domain product hosts using
the DOMAIN-RETIREMENT contract. Then use ONLY `build_all.sh`, automatic version,
dual purchased web publish first, all native targets. Preserve and stage every
actual output in dist/natally-v<version>/ with hashes; commit+push stamp/artifacts
and exact missing/failed inventory. No manual version, no temporary-domain
publish, no Chargebee connection before this provisional artifact set. Root
will provide an exact bounded release assignment after the journey is observed.

Queued after this checkpoint: narrated shorter cards (rubric15), adaptive
half-speed presence and optional pointer/sensor seed (16–17), continuing varied
story lore (18), proportional FREE FRESH MACARONS/brief musical marquee (19).
These are requested and pending, not implemented by this checklist paragraph.

## NAMESPACE — [X] source and targeted gates complete (operator 2026-11-11)

Authority: ARCHITECTURE.md §17; rubric26. Exclusive ownership:
`src-tauri/tauri.conf.json`, `scripts/build-native.mjs`,
`src-tauri/gen/android/app/build.gradle.kts`, old/new MainActivity.kt and
NatallyBillingPlugin.kt under `src-tauri/gen/android/app/src/main/java/mba/robin/`.
Read-only `src-tauri/src/native_billing.rs`, AndroidManifest.xml and build_all.sh.
You are not alone in this checkout. Preserve other agents' unpublished patches
and do not revert or stage them. Git commits are serialized by root.

Do: Set the canonical Tauri identifier, Gradle namespace and applicationId to
`mba.robin.astronatally`. In existing build-native `prepare`, assign this exact
value to existing `config.identifier` so canonical builds retain the selected
identity. Move the two tracked Kotlin sources from natally/ to astronatally/,
changing only their package declaration. Preserve activity/plugin behavior,
signing, versions, product name and MSI upgradeCode. The Rust bridge already
registers with app.config().identifier; do not add another literal. Do not edit
native caches or old artifacts. No manual version stamp and no separate build.

Verify/Accept: Node syntax check on scripts/build-native.mjs exits0; Node reads
Tauri JSON and asserts identifier; a targeted literal assertion of the owned
Gradle/Kotlin sources observes the exact new package and no old package in
those active files. Read back the full edited regions. Commit/push the identity
change immediately using explicit paths; report SHA and actual remote equality.
Native compile/package and actual APK identity observation belong to the full
`build_all.sh` run after the direct-key frontier is ready, not a separate build.

## RELEASE-HTTPS — [X] purchased-domain publication option

Authority §17, existing rubric14. Own only the two Surge invocation lines in
`build_all.sh`. Add `--force https` to each existing purchased-domain publish,
retaining exact domains, automatic stamp and web-before-native sequencing.
Verify `bash -n build_all.sh` exits0 and read back both command lines. Commit
and push separately after the namespace commit, with explicit path only.
Do not invoke the full build until root releases it after direct-key recovery.

## ISOLATE-SUPERSEDED — [X] operational source recovery complete

Own only billing/openrouter.mjs, netlify/functions/chargebee.mjs,
billing/checkpoint-server.test.mjs, src/app/AppShell.tsx,
src/app/TopUpSheet.tsx, src/app/chat/useChat.ts. These are the exact unpublished
CHECKPOINT-SERVER and CHECKPOINT-CLIENT slices reported by their owners.
You are not alone; restore nothing else and preserve all other work.

Do: Before mutation, inspect each exact diff and confirm it is the reported
cancelled slice. Save a binary-capable git diff of the five tracked files,
HEAD SHA, SHA-256 source hashes, and full bytes of the new untracked test in
/home/robin/Admin-Manual/.staging/natally-cancelled-netlify-checkpoint-2026-11-11/.
Verify backup bytes/hashes before restoring these five tracked files to their
published HEAD content. Recheck source hashes before each restore to avoid
clobbering a concurrent writer. Preserve the new test at the named backup path
and remove only its just-created original after verified byte match. Restore
recipe is git apply of the saved patch and copying back that test. No checkout
of other paths, external service actions, product build, source commit or sweep.
Report exact backup/restore observations to root, then release ownership.

## VOICE-COMPLETE — [X] source and visual reset proof complete; auditory pronunciation pending

Authority §18 and rubric21/24. Own src/voice/index.ts,
src/voice/index.test.mjs, src/atelier-original/services/voiceService.ts
(prepareSpeechWithOffsets only), src/app/AppShell.tsx (completion wiring only),
src/app/chat/useChat.ts (ChatStage and successful final voice flush only), and
src/app/presentation/state.ts (clear action only). Read-only
src/app/presentation/playback.ts and the existing renderer reset prop contract.
You are not alone: preserve current layout/geometry/overlay work and do not
restore cancelled billing source or touch billing/model/provisioning code.

Do: Extend SpeakOptions with optional onComplete?:()=>void and ChatStage with
optional captureSpeechCompletion?:()=>()=>void. Call the latter factory once
immediately after onReply(begin), retain its returned callback for that reply,
and pass that exact callback to the successful final voice flush. The shell
factory captures the current component-local interaction epoch and returns a
callback that checks the captured epoch, finishes driver and dispatches clear.
Increment the interaction epoch at each new reading/selection, stopping old
voice before any async sky lookup. Existing speakNatallyText returns boolean;
use it rather than guessing
from onState. Callback belongs to the current epoch, fires once only after the
whole flushed queue succeeds, and is discarded on stop/supersession/false/error.
Do not treat a temporary empty queue during an unfinished stream as completion.
Pass success completion through streamed replies, opening reading and both
signed-in/landing chart explanation paths. Finish that path's playback driver,
then dispatch clear; keep the current view/follow preference. New user targets
stop old speech before async sky work begins; component-local interaction
epochs prevent an old completion from clearing newer focus. Reducer clear empties
both selectedTargets and focusTargets and always increments sequence, triggering
renderer localAspectFocus cleanup even if outer focus is already empty.

Normalize whole-word atelier (case-insensitive) to ah-tell-yay in the existing
atelier prepareSpeechWithOffsets character-map pipeline. Preserve exact display
text and monotonic offsets, using the same proportional source-character map
as the existing angular expansion. Do not edit the unused duplicate landing
port. Preserve speech rate, lipsync, prefetch and the measured two-line caption.

Use Node built-in tests in the named new test file to execute actual modules
(strip TypeScript in memory with installed Node24 node:module
stripTypeScriptTypes and controlled VM imports; execute the actual controller
module and exact named pronunciation source region, not a copied algorithm). Test last queued chunk/flush exactly-once success, not-yet-flushed
stream gaps, unadmitted speech, false result/error, stop/supersession, and
pronunciation offsets including atelier beside degrees and unchanged display.
No product fixture account, network mock journey, new dependency or temp file.
Verify/Accept: node --experimental-vm-modules --test src/voice/index.test.mjs
and npx tsc --noEmit exit0. Read back edits; commit+push each coherent slice with
explicit paths after requesting root's Git window.
Operator protocol: record real speech to successful neutral chart, interruption
by a different target (old completion cannot clear it), focused/floating reset
and actual atelier speech with original-word karaoke. Save under existing
DOCS/DEMONSTRATIONS/landing-polish-2026-11-11/. Synthetic unit completion alone
is not the real speech observation. No full build or deploy until root releases.

## NATIVE-AUTH — [X] source and transport protocol complete; native/Google journey pending

Authority §19 / rubric27. Own src/platform/firebase.ts, new
src/platform/nativeAuthPage.ts, new src/platform/nativeAuth.test.mjs,
auth/native.html, vite.config.ts, src-tauri/src/native_auth.rs,
src-tauri/src/lib.rs, src-tauri/Cargo.toml and Cargo.lock. You are not alone;
no AppShell/voice/chart/billing/provisioning edits and no source reuse from
other repositories. CodeGraph first, named parser-gap reads are authorized.
No browser/network security workaround, credentials/config changes or manual
version. Normal Web Google login behaviour must stay unchanged.

Do:
1. Add private async nativeGoogleIdToken():Promise<string> in firebase.ts.
   For native (__TAURI_INTERNALS__ in window) only, dynamically import existing
   @tauri-apps/api/core invoke; invoke native_sign_in with provider google,
   validate returned google provider and nonempty idToken <=16384 chars, then
   signInWithCredential(requireAuth(),GoogleAuthProvider.credential(idToken,
   optional accessToken)); return token. Map actual Sign-in cancelled rejection
   to existing SignInCancelledError, surface other errors truthfully. Both
   existing googleSignIn and googleSignInForIdToken branch to it for native.
   Browser paths perform no new await before their current gesture popup.
2. Make existing native_auth module/commands available on desktop and Android.
   Use injected AppHandle with official tauri-plugin-opener::OpenerExt::open_url
   in existing flow instead of desktop open::that. Register opener plugin in
   run alongside current native billing plugin, one combined command handler.
   Keep existing random state, loopback listener, fixed purchased origin,
   deadline, peer/host/header/body limits and token validation. Extend existing
   Credentials with optional cancelled:bool. Only correct state/provider and
   absent token/phone fields authorize cancellation. End that waiting request
   with Sign-in cancelled, show truthful browser cancellation; invalid input
   must not terminate a real waiting login. Preserve existing Rust tests and
   add cancellation-specific cases inside that existing tests module.
3. Cargo: add tauri-plugin-opener="2", move getrandom="0.3" and url="2" to
   shared dependencies, remove now-unused open="5"; rust-version1.90. Resolve
   Cargo.lock with cargo generate-lockfile only, not a separate product build.
4. Add auth/native.html and Vite nativeAuth input. Accessible Natally plum/gold
   serif utility with status/Continue with Google/Cancel sign-in controls,
   no account-service call or analytics. Load new nativeAuthPage.ts. Private
   bootstrapNativeAuth() owns all local helpers. Only purchased HTTPS origin,
   exactly one decimal port30000–65535, one 64lowercasehex state and google
   provider are accepted. Store only {port,state,provider,startedAt,redirecting}
   in sessionStorage key natally-native-auth-flow-v1; expiry300s. Never store,
   log or URL-encode tokens. Remove initial fragment after retaining flow.
   Separate named Firebase app natally-native-auth uses the existing public
   firebaseConfig and browserSessionPersistence; real Google redirect starts
   automatically only once for a fresh valid launch. On return consume real
   getRedirectResult and Google credential. Submit a normal form POST only to
   the validated loopback URL /natally-auth, one credential field containing
   {state,provider:'google',idToken,accessToken?}; no fetch workaround. Cancel
   posts {state,provider:'google',cancelled:true} with no token fields. Clear
   session flow before submission. Returned-null credentials show real retry
   rather than redirect loops. Missing/invalid/expired flow says Open Natally
   and choose Sign in again. Valid flow keeps real retry/cancel on errors.
   Referrer meta policy origin (not no-referrer or strict-origin variants),
   no-store metadata; no invented sign-in success. Keep native response's
   existing no-referrer policy and exact Rust Origin validation. Observe an
   actual browser-generated loopback cancellation POST carrying
   Origin:https://asknatally.online (isolated transport protocol only, no
   synthetic Google/native-login claim).
5. Registered Node test executes actual TypeScript modules in memory via
   installed Node stripTypeScriptTypes/controlled imports. Cover native wrapper
   invoking real command name/provider and Firebase credential installation;
   browser branch preserving popup behaviour; malformed/duplicate/state/port/
   origin/expired flow rejected; valid actual-shaped credential creates only
   the exact loopback form and clears flow; cancelled form has no token; null
   redirect cannot loop. Fixture credentials are isolated tests, never actual
   user-login acceptance or production writes.

Verify/Accept: node --experimental-vm-modules --test
src/platform/nativeAuth.test.mjs and npx tsc --noEmit exit0; cargo metadata
--manifest-path src-tauri/Cargo.toml --locked --no-deps returns correct package
and dependency graph. Read back all edits. No standalone Vite/native build;
actual Rust compile is in canonical build_all.sh. Commit+push coherent source
with explicit paths after requesting Git window; no version change.
Operator protocol: actual callback utility at desktop/390px and invalid-flow
message, then normal system-browser Google/native return after web deployment;
record separately from synthetic module/Rust tests. Do not label the Google
journey verified until performed. No full build/deploy until root releases.

## BUILD-SUCCESS-MINOR — additional success increment, operator 2026-11-12

Status: [X] implementation f1b1dab; ✅ delegated behavioral verification
2026-11-12T20:01:59Z; real build and observation protocol reported separately.
`bash -n build_all.sh` exited0. Actual-tail isolated fixture: success exited0,
MINOR31→32, BUILD769 from UTC epoch-day%10000, builtAt null, extra JSON field
preserved, JSON/text agreed, and real Git commit matched the local bare remote.
Native-failure fixture exited37 without writes or an extra commit. Prefix before
the final native call was byte-identical to f1b1dab parent. Full evidence:
DOCS/DEMONSTRATIONS/build-all-success-version-2026-11-12/shell-regression.json. Contract: ARCHITECTURE §22, frozen
e95ee3a; prior rubric afff5ff; Admin-Manual CC2 v1.1 published55d6662 and stored
exactly in KStore revision1, UUID01a1d157-313d-8001-bde1-f8fbf6fd9d88.

Ownership: executable edits ONLY `build_all.sh`; this task's status/evidence in
CHECKLIST.md and DOCS/DEMONSTRATIONS/build-all-success-version-2026-11-12/;
real pipeline log `build/build-all-success-version-2026-11-12.log`; existing
automatic canonical projection files are owned only when the script generates
them. You are not alone in the codebase: preserve all unrelated changes and
untracked evidence. Do not read other source, modify helpers, consolidate other
increments, manually choose a version, or fix unrelated defects.

Do: Read `build_all.sh` (CodeGraph already tried twice and did not cover shell).
Keep every line before its final native invocation unchanged. Change the final
`exec node scripts/build-native.mjs` to `node scripts/build-native.mjs`. Append
an inline `node -e` using the existing shell quoting idiom and exact entities:
`fs=require('fs')`; `v` parsed from version.json with JSON/read errors caught
and rethrown; `completedVersion=v.version`; `[maj,min]` from its slots, validate
integer maj>=1,min>=0; `build=Math.floor(Date.now()/86400000)%10000`;
`v.version=[maj,min+1,build].join('.')`; `v.builtAt=null`. Preserve other JSON
fields, write formatted version.json with newline and version.txt with newline.
Print `Built version: v` plus completedVersion and `Next source version: v`
plus v.version as separate lines. Then `git add version.json version.txt`,
`git commit -qm "Advance MINOR after successful canonical build"`, and
`git push origin HEAD`, with no `|| true`. No call to native prepare at the end;
artifact/projection files retain their built stamp until the next existing
automatic pre-build stamp. `set -e` ensures the added tail never runs on failure.

Re-read the edited region. Before coding, provide the required brief Insight
explaining why final exec must return and why built/source versions differ;
after coding, explain the extra increment preserves existing counters.

Verify (coder runs; root does not): `bash -n build_all.sh`. In an isolated
fixture under build/ (never /tmp), execute the ACTUAL final native call and
added tail extracted from build_all.sh, under `set -euo pipefail`. Simulate
only the native child return (0 or nonzero); execute the real inline Node and
real git commit/push against a local fixture bare remote. Success must add
exactly1 MINOR, compute current epoch-day%10000, write agreeing JSON/text with
builtAt null, preserve extra JSON fields, and push the commit. Failure must
preserve input files and return the child's nonzero status without the extra
commit. Confirm the preexisting prefix is byte-identical to parent source.
Accept: repeatable syntax/fixture assertions pass with these results and only
build_all.sh contains executable edits. Record observed commands/results here.

Publication: commit/push this one executable change immediately before the real
build, with explicit owned paths. Parent grants this Git window; no other writer
will commit concurrently. Verify pushed reachability. Mark implementation and
verification truthfully in a separate immediately-pushed evidence commit.

Operator observation protocol (not an Accept clause): after the above, execute
ONLY `./build_all.sh` on the current host (already verified asrock), tee exact
output to the named build log using pipefail. The current explicit instruction
authorizes the build despite prior unrelated UI holds. Send root the actual
`stamp:` value as soon as observed. Preserve running/failed/completed state;
record a terminal screencast under the evidence directory where supported.
Observe the deployed badge via browser after publication, recording it without
claiming layout repairs. On full success observe the extra source stamp and
its commit/push. Never run an inner build directly, alter helper numbering, or
claim a running build is complete. Report actual failures without expanding
scope. Root owns the timestamped DOCS change-table report and KStore review.

## PUBLISH-CURRENT — execute now, operator 2026-11-11

Authority: latest explicit deploy instruction and ARCHITECTURE §20. The
operator asks full build/deployment now and README with only ./build_all.sh
as its build command. README now records existing Surge deployment account
robinsai.world@gmail.com (Free), actual owner of both purchased domains.
Own execution/artifact inventory under build/, dist-web/, dist/natally-v<version>/;
canonical automatic version projection files; correction of literal build
failures within existing build_all.sh, scripts/build-{environment,native}.mjs,
src-tauri/Cargo.toml/Cargo.lock/tauri.conf.json and the NATIVE-AUTH source paths
only when needed to satisfy their already-frozen interfaces. No new behavior,
Netlify deploy, Firebase/customer/grant writes or Chargebee connection. You are
not alone: preserve the three existing dirty VOICE dispatch logs and other
untracked records; stage only owned source/version/artifacts.

Do: Read the named canonical entry and README. Confirm the already-observed
Surge context account/owned destinations; execute ./build_all.sh now. Do not
invoke inner web/native build commands or manually set a version. The script
stamps/commits/pushes automatically, publishes astronatally.com and
asknatally.online first, and only then runs the whole native matrix. Preserve
actual console output and every produced target in the canonical versioned
inventory. If a command fails, report exact stage/error promptly, correct a
literal implementation/configuration failure only within the already frozen
contracts/owned paths, commit+push it immediately, then retry only by running
./build_all.sh (a new automatic stamp). A missing new design decision returns
to root; it is not permission to improvise. Do not clean historical artifacts.

Verify/Accept: committed automatic version files agree; versioned inventory
lists all produced artifacts with actual SHA256 and exact target status; the
configured identity remains mba.robin.astronatally. After successful publication,
observe normal TLS and the new actual version badge on both purchased sites,
root/app/auth utility route responses and real browser layout at desktop/phone.
Read the produced APK application ID with available SDK tooling and compare to
mba.robin.astronatally; verify signer through the existing builder. These
operator observations are recorded separately from the source/type gates.
Never claim Google/native sign-in, direct-key provisioning or model reading
verified merely because the page/build is delivered. Record any functional gap.
Commit+push each coherent source fix and available artifact checkpoint with
explicit paths. Use Git window from root around these commits; the canonical
stamp is explicitly authorized to commit/push its own exact projection files.
Report URLs, final source/stamp, complete/partial platform matrix, inventory and
actual output paths. No repeat deployment permission is needed.

Observed execution: canonical v1.31.768 exited0 after the scoped Android
source-root correction c68e9a8. Stamp/source d7a6073, web proof0dc2681 and
final packaging/SDK proof7490239 are pushed. The committed versioned inventory
has complete:true,9 artifacts and all4 target states packaged. Both apexes
show the actual version badge over validated HTTPS; root/app/native-auth
routes returned200. Root reviewed deployed desktop and phone captures; the
phone inset overlap remains open. Native bytes are preserved locally; their
inventory/log/evidence are pushed. Windows installer signing and actual
Google/native-return/direct-key reading acceptance remain unverified or open
as specified above; this record does not promote them to a passed rubric.

## DNS-WILDCARDS — exact operator-requested Surge target

External operational ownership only: literal host * CNAME in astronatally.com
and asknatally.online. Existing authoritative evidence shows their apex/www
already geo.surge.world, but their literal * still uses a retired personal host.
Using the connected Namecheap service, first save exact complete record sets
and metadata under /home/robin/Admin-Manual/.staging/natally-dns-wildcards-2026-11-11/.
Change only each existing * CNAME target to geo.surge.world, preserving every
other record/TTL/setting. Prefer a record-specific API; if replacement of a
whole set is required, include the complete original set plus only that target
change. Read back through API and both authoritative NS. No registrar/account/
plan/mail changes, no root/apex/www edits, no unrelated-domain publication.
If connector approval or access fails, report its actual reason and leave the
working apex build/deployment proceeding. No source or Git ownership.

## ANDROID-SOURCE-ROOTS — literal namespace build correction, 2026-11-11

Authority: ARCHITECTURE §21 (frozen) and existing observation rubric26 in
DOCS/RUBRIC-landing-atelier-2026-11-11.md. Canonical v1.30.768 failed Android
Kotlin compilation because an obsolete generated package remained under the
broad main Java source directory; web/Linux/Windows completed. Preserve that
partial attempt, its logs and every existing generated file.

Ownership: src-tauri/gen/android/app/build.gradle.kts only for this source
correction; afterward resume the existing PUBLISH-CURRENT execution/artifact
ownership. You are not alone in this checkout: never revert or stage others'
edits, including the three dirty VOICE result logs. Root holds Git until this
recipe is pushed, then explicitly grants your next Git window.

Do: Inside the existing android block, immediately after namespace, configure
android.sourceSets.getByName("main").java by calling
sourceSets.getByName("main").java.setSrcDirs(listOf("src/main/java/mba/robin/astronatally")).
Expand the existing final kotlin { jvmToolchain(21) } block to retain
jvmToolchain(21) and configure kotlin.sourceSets.getByName("main").kotlin by
calling sourceSets.getByName("main").kotlin.setSrcDirs(listOf("src/main/java/mba/robin/astronatally")).
Both calls replace the broad main roots; do not append srcDir, rely solely on
java.exclude for Kotlin, edit obsolete Logger.kt, delete generated sources or
change any other build behavior. Keep resources/manifests/test roots, signing,
dependencies, namespace/applicationId and the version recipe as they are.
Re-read the edited region, commit/push this scoped correction immediately,
then run only ./build_all.sh. No inner build command or manual version stamp.
The canonical entry assigns the next version and republishes both purchased
websites before rebuilding the complete Linux/Windows/Android matrix. Apply
the existing PUBLISH-CURRENT literal-failure/escalation and evidence contract.

Verify/Accept (idempotent committed end-state gate, run after the canonical
attempt): the following reads the current versioned inventory and returns
BUILD-MATRIX-PACKAGED only if every canonical target packaged successfully;
otherwise keep this build checkpoint incomplete and report the exact failure.

```sh
node --input-type=module -e 'import {readFileSync} from "node:fs"; const read=p=>{try{return JSON.parse(readFileSync(p,"utf8"));}catch(e){throw new Error("Invalid committed build metadata: "+p,{cause:e});}};const v=read("version.json").version;const i=read("dist/natally-v"+v+"/inventory.json");if(i.version!==v||i.complete!==true||!["linux","windows","windows-msi","android"].every(t=>i.targets?.[t]?.state==="packaged")||i.artifacts.length<8||!i.artifacts.every(a=>a.bytes>0&&/^[a-f0-9]{64}$/.test(a.sha256)))throw new Error("Current canonical matrix remains incomplete");console.log("BUILD-MATRIX-PACKAGED "+v);'
```

Operator verification protocol: preserve the actual canonical console/target
logs; inspect the produced APK package ID with the available Android SDK and
verify its production signer with the existing builder (no credentials in
evidence). Observe live TLS/version and desktop/phone layout after publication.
Record those observations separately from the idempotent metadata gate and
from actual Google-login/read acceptance. No account, credit, Firebase,
Netlify, Chargebee, registrar or signing-identity writes. Windows packaging
does not imply signing: preserve the observed unsigned-installer limitation.
Keep large native bytes in the versioned root dist, with exact inventory/logs
committed/pushed; no raw oversized Git blobs, GitHub LFS, Forgejo contact or
remote reconfiguration while the operator's restriction remains active.

Observed execution: c68e9a8 implemented both exact setters, preserving the
obsolete generated files. The only retry was ./build_all.sh, which assigned
v1.31.768 and completed all platforms. The idempotent gate printed
BUILD-MATRIX-PACKAGED 1.31.768 (exit0). SDK badging observed application ID
mba.robin.astronatally, versionName1.31.768; apksigner exited0 with one valid
v2 signer matching the configured production certificate. Exact observations
are committed at7490239 under dist/natally-v1.31.768/verification/.


## ONBOARDING-RESUME — explicit flags, current operator contract 2026-11-12

- [X] **ONBOARDING-RESUME** — implement only the five-flag mechanism below.
  **Authority:** Robin explicitly prohibits all tests, including the earlier
  Node suite and browser recordings. Do not write/run tests, browser automation,
  compiler verification or other verification commands. Earlier pass counts are
  withdrawn as acceptance. Existing generated artifacts stay outside this PR.
  **Worktree:** `/home/robin/github/natally-onboarding-resume`.
  **Branch:** `codex/onboarding-resume`.
  **Owned source files:** `src/services/onboardingProgress.ts`,
  `src/app/onboarding/FirstLight.tsx`,
  `src/onboarding-original/FirstLight.tsx`, `src/app/AppShell.tsx`.
  **Other permitted edits:** this task's implementation marker and concise
  source-reference handback. No test files or browser artifacts.
  **Read-only supporting inputs:** existing imports and public types in
  `src/shared/types.ts`; no unrelated source surveys.
  **Do:** realize exactly the frozen §23 contract copied below. Five explicit
  persisted booleans, each set on accepting its step; one check before the
  questionnaire mount, initial question and every next question. All true means
  no questionnaire, even with draft status. Preserve existing chart and
  profile-only intentional redo. Do not introduce other mechanisms.
  **Verify/Accept:** direct semantic source inspection. Trace each flag's
  initialization, true assignment, persistence, restoration and pre-question
  read. Enumerate all assignments that can enable redo. Show the all-true
  branch bypassing questionnaire mount and only-false steps being selected.
  No test command, screenshot, recording or pass count is acceptable evidence.
  **Handback:** reread edited regions, report exact file:line anchors and any
  uncertainty. Parent integrates/commits/pushes. Do not race Git mutations.
  You are not alone in this checkout; preserve others' edits. No deployment,
  version increment or packaging invocation.

### Exact frozen contract (1:1 copy of ARCHITECTURE.md §23)


Authority: Robin's current explicit request. Work is isolated in
`codex/onboarding-resume`, worktree `/home/robin/github/natally-onboarding-resume`,
based on published `a47c807`. Deliver a PR to `master`; this request does not
authorize a deployment, version increment, or canonical packaging invocation.
The earlier test/recording rubric is withdrawn from the PR on Robin's explicit
order. No tests are to be written or run. This section
supersedes §4's onboarding recovery description and permits only the named
hydration/navigation changes to the otherwise preserved questionnaire in §13.
Every other architecture section remains in force. This amendment is frozen for
the exact behavior requested; the following checklist is its 1:1 translation.

### Required behavior and decisions

1. A valid `natally.chart.v1:<uid>` chart is completion evidence, including
   charts created before incremental progress existed. Resolve the current UID's
   chart before mounting FirstLight: no welcome/questionnaire flash on auth
   restoration. A chart always wins over stale initial-onboarding progress.
   Reload, `pageshow`, browser Back/Forward, and a changed auth object for the
   same UID never create a redo request. Reconcile external chart changes on
   `storage` and page restoration without overwriting an active local edit.
2. Persist every edit and each accepted section synchronously to the current
   account's localStorage record. Save the draft before changing questions or
   starting an asynchronous calculation. A fresh tab of the same origin resumes
   the saved answers. A changed field invalidates only that section's accepted
   completion when its value is no longer valid; keep all other valid answers
   and completion flags. Back is review, not reset. Forward navigation selects
   the first genuinely uncompleted/invalid section in the explicit question
   order. Never require already accepted valid sections again during normal
   recovery. Partly typed answers survive even before Next is selected.
3. Unknown birth time and explicitly skipped current location are affirmative
   answers. A null/empty optional value alone is not evidence that the question
   was answered. Preserve selected gazetteer identity/label, location consent,
   device location and skip choice. A malformed section invalidates only that
   section; a malformed entire record yields an honest recovery warning and
   fresh intake without erasing its stored bytes. Validate UID, version, types,
   real date, time and gazetteer membership before accepting restored data.
4. Submitted answers remain durable through calculation failures, navigation,
   reload and retry. Resume a fully submitted intake by computing the chart from
   those exact validated answers, without replaying the questionnaire. Persist
   the resulting chart synchronously to the same UID before marking progress
   complete. Retain the complete answer snapshot; a complete snapshot with a
   missing/unreadable chart can reconstruct it without re-asking questions.
   Storage failure is visible: in-memory use continues, but the UI never claims
   durability that failed. If saving the complete answer snapshot fails after
   the chart handoff, FirstLight forwards that exact error through
   `OnboardingProps.onStorageError`; App retains the warning on the reading
   stage, guarded by the originating UID. Preserve the submitted recovery snapshot on chart
   write failure. Do not read or attribute the old unowned session key
   `natally.firstlight.draft.v1` to an arbitrary signed-in account; leave it
   untouched. This patch does not introduce cloud sync or cross-origin storage.
5. Only Account's `Redo onboarding` action and a second explicit `Start again`
   confirmation create a fresh redo draft. The confirmation explains that the
   existing chart stays available until the replacement succeeds. `Cancel`
   dismisses the confirmation without mutation. Confirmed redo starts from the
   name question; it has its own saved draft with `mode: 'redo'`. The previous
   chart is retained in memory and storage throughout. FirstLight offers
   `Return to my chart`, cancelling any pending handoff and returning to that
   chart while retaining the redo draft. On reload, the saved chart wins;
   Account offers `Resume onboarding` for a saved unfinished redo, which
   explicitly re-enters that draft. Resuming does not reset its answers.
   No route, key press, mount effect, missing optional answer, or history event
   is authorization for fresh redo. A successful replacement updates the chart
   and closes redo; an unsuccessful one preserves the prior chart. In particular, a failed redo
   chart-storage write leaves redo open with its previous chart retained; the
   intake displays the failure and `Return to my chart` remains available.
6. Identity and chart ownership travel together. Remove the separate effect
   which writes whichever in-memory chart exists under whichever auth object
   just arrived. The shell keeps a UID-tagged chart snapshot, loads it together
   with auth restoration, and only renders/commits it for that same UID. A live
   UID ref plus the wrapper's mounted/attempt guard rejects stale calculation
   completions after sign-out, account switch, cancellation or a newer attempt.
   Same-UID auth refresh does not discard an in-memory chart or active draft.
7. Preserve the existing questionnaire art, prompt order, input masks, birth
   date picker, gazetteer, voice admission and elapsed-time presentation. Reuse
   AccountPanel's existing buttons and inline confirmation, with accessible
   labels and ordinary keyboard focus. This is an existing-surface correction,
   not a novel screen requiring a new design comp. Do not globally intercept
   Backspace: normal input deletion remains native. Browser navigation stays
   usable and safe because progress is durable.

### Exact entity contracts

All paths below are relative to `src/`. New module-scope symbols are limited to
the §16.4 additions; component-local state, callbacks 
remain private implementation details of their named owning entity.

| Exact entity | Target and signature/fields | Responsibility |
| --- | --- | --- |
| `ONBOARDING_PROGRESS_PREFIX` | `services/onboardingProgress.ts:1`; string `natally.onboarding.v2:` | key suffix is `encodeURIComponent(accountUid)`; no anonymous/shared record |
| `ONBOARDING_STEPS`, `OnboardingStep` | same module; readonly ordered `['name','date','place','time','currentPlace']`; union of those names | mirrors existing `QUESTION_SEQUENCE`; integer indices only |
| `OnboardingAnswers` | same module; `{name:string,date:string,place:string,time:string,currentPlace:string}` | existing questionnaire field values, including incomplete text |
| `OnboardingProgress` | same module; `{version:1, accountUid:string, mode:'initial'\|'redo', status:'draft'\|'submitted'\|'complete', answers:OnboardingAnswers, unknownTime:boolean, deviceLocation:CurrentLocation\|null, skipLocation:boolean, completed:Record<OnboardingStep,boolean>}` | account-owned answer snapshot and explicitly accepted sections |
| `OnboardingLoadResult` | same module; `{progress:OnboardingProgress\|null,error:string\|null}` | recovery and persistence problems are visible |
| `createOnboardingProgress` | same module; `(accountUid:string, mode:'initial'\|'redo' = 'initial'):OnboardingProgress` | empty answers, all five completion flags false, draft status, false choices; rejects empty UID |
| `onboardingSectionValid` | same module; `(progress:OnboardingProgress, step:OnboardingStep, gazetteer:readonly GazetteerEntry[]):boolean` | same name/date/place/time/location rules as the actual questionnaire, including duplicate place labels and finite coordinates/time zone |
| `normalizeOnboardingProgress` | same module; `(value:unknown,accountUid:string,gazetteer:readonly GazetteerEntry[]):OnboardingProgress\|null` | validate owner/version; recover independent typed fields; retain a true completion flag only for a valid accepted section; submitted/complete require all five true flags |
| `firstMissingOnboardingStep` | same module; `(progress:OnboardingProgress,gazetteer:readonly GazetteerEntry[]):number` | check all five flags, then return the first false/invalid step, or `ONBOARDING_STEPS.length` when every flag is true and valid |
| `loadOnboardingProgress` | same module; `(accountUid:string,gazetteer:readonly GazetteerEntry[],storage:Storage = localStorage):OnboardingLoadResult` | guarded JSON parse/read; preserve stored bytes on failure; no legacy draft adoption |
| `saveOnboardingProgress` | same module; `(progress:OnboardingProgress,storage:Storage = localStorage):string\|null` | synchronous write; return truthful error on failure, null on success |
| `intakeDraftFromProgress` | same module; `(progress:OnboardingProgress,gazetteer:readonly GazetteerEntry[]):IntakeDraft\|null` | exact validated submission mapping; preserves explicit optional choices |
| `completeOnboardingProgress` | same module; `(progress:OnboardingProgress,storage:Storage = localStorage):string\|null` | save complete status only after chart write success, retaining every answer |
| `OnboardingProps` | `app/onboarding/FirstLight.tsx:60`; `{accountUid:string,initialProgress:OnboardingProgress\|null,storageError:string\|null,onSitDown:(chart:NatalChart)=>boolean,onCancel?:()=>void,onStorageError?:(message:string)=>void}` | keyed by UID + explicit redo entry; true handoff result means chart persisted; false retains submitted snapshot |
| questionnaire `FirstLightProps.initialProgress`, `.onProgress` | `onboarding-original/FirstLight.tsx:13`; optional `OnboardingProgress`, optional `(progress:OnboardingProgress)=>void` | hydrate once, synchronously report edits/accepted sections/submission; wrapper owns persistence |
| `AccountPanel.onRedoOnboarding`, `.onResumeOnboarding`, `.canRedoOnboarding` | `app/AppShell.tsx:195`; `()=>void`, optional `()=>void`, boolean | show redo only with an existing chart; offer saved redo resume; second confirmation required before reset |
| existing `App`, `AuthState`, `loadStoredChart`, `CHART_STORE_PREFIX` | `app/AppShell.tsx:380,86,368,260` | UID-tagged chart restore and guarded synchronous commit; component-local state for chart readiness, redo, warning and ownership |

### Scope, evidence and preparation judgment

Ranked criteria: (1) preserve user work and account ownership, (2) fulfill the
requested intentional redo and missing-only recovery, (3) keep the correction
small and reviewable. Short horizon is this browser session; medium is later
visits/account switches; long is future PR maintenance. Per-account incremental
progress plus existing-chart precedence satisfies all three at every horizon.
A shared session-only submitted draft loses partial work immediately and cannot
prove ownership later. A completion boolean without answers cannot recover an
interruption or reconstruct a lost chart. Neither alternative meets (1)/(2).
Cloud persistence would change the product's data boundary and is outside this
request; origin/device-local persistence is the stated scope of this PR.

CodeGraph was synchronized before mapping. Its long `App` source result was
capped before the auth/return branches; its named original-questionnaire query
returned the wrapper instead, and its service query returned another preserved
tree. Targeted reads of only `AppShell.tsx` auth/return branches,
`onboarding-original/FirstLight.tsx` and `services/onboarding.ts` closed those
specific coverage gaps. `PROJECT_INDEX.*` is absent. No other repository's
source or original/abandoned Natally implementation was consulted.

**Current acceptance — Robin's explicit prohibition, 2026-11-12:** all tests and browser
recordings are prohibited for this fix. The mechanism below, its
setters and its gates are the proof to inspect. Existing browser artifacts are
preserved locally as historical operational output, excluded from this PR, and
make no correctness claim. Acceptance is direct semantic source inspection of the flag writes and
the entry/advance guards. No test result is acceptance evidence. No deployment or packaging occurs.

### Explicit per-step completion flags and entry invariant

`OnboardingProgress.completed` is a persisted boolean record, not a numeric
step cursor. Its five exact variables are:

| Persisted variable | Only set true when | Checked before showing |
| --- | --- | --- |
| `completed.name` | valid name is accepted with Next | the name question |
| `completed.date` | validated birth date is accepted with Next | the birth-date question |
| `completed.place` | a gazetteer birthplace is accepted with Next | the birthplace question |
| `completed.time` | valid time or explicit unknown-time choice is accepted with Next | the birth-time question |
| `completed.currentPlace` | valid location or explicit Skip location is accepted with Begin | the current-location question |

All five start false. The questionnaire's accepted-step handler sets exactly
`completed[current.kind] = true` in an immutable copy and persists that snapshot
before changing screens. Valid completed flags and other answers are retained.
Editing an answer to an invalid value clears only that section's flag. Normal
navigation never clears the record. Fresh flags are created only for a genuinely
new account or the confirmed profile redo action.

`firstMissingOnboardingStep` checks **every** variable above against true and
validity, using `ONBOARDING_STEPS.filter`, then selects the first missing step in
that same explicit order. This one function is called (1) by the wrapper before
rendering any questionnaire, (2) by the questionnaire when selecting its initial
question, and (3) by its accepted-step handler before selecting the next question.
The wrapper does not mount `OriginalFirstLight` when this check reports no
missing step. For such a complete record it restores/casts the chart directly;
a computation/save error presents Retry and the error, without re-asking a
completed question. This also holds if interruption occurred after the final
flag write but before `status` changed: all five flags, not `status`, decide
whether questions are needed. `status` records computation progress only.

A valid existing chart still bypasses the wrapper in App. The only exception is
an explicit profile redo/resume. Source review must trace every assignment of
`redoRequested`: only confirmed profile redo and explicit profile resume set it
true; history/auth/restore paths cannot do so. The final review maps each of the
five variables to its accepted-step setter and to all three checks above, and
checks the all-true branch before the questionnaire mount. Inspect the same gate for every flag combination and for the all-true/draft-status
interruption case by following its logic. Do not write or execute tests, browser
checks, recordings, or verification suites. Previously generated test artifacts
are preserved outside the PR and are not part of this contract.

### Inspected setter and gate references — 2026-11-12

Source inspection of the implemented mechanism (no tests or compiler execution):

| Flag | True assignment | Restored value/validity | Pre-question check |
| --- | --- | --- | --- |
| `completed.name` | `src/onboarding-original/FirstLight.tsx:183`, current kind `name` | `src/services/onboardingProgress.ts:89`, name validity at `:62` | `src/services/onboardingProgress.ts:97` |
| `completed.date` | same setter, current kind `date` | same restore, date validity at `:65` | same all-five check |
| `completed.place` | same setter, current kind `place` | same restore, place validity at `:67` | same all-five check |
| `completed.time` | same setter, current kind `time` | same restore, known/unknown validity at `:68` | same all-five check |
| `completed.currentPlace` | same setter, current kind `currentPlace` | same restore, selected/skipped validity at `:69` | same all-five check |

- All flags initialize false at `src/services/onboardingProgress.ts:34`.
- The setter calls the progress callback at questionnaire `:168`; the wrapper
  saves at `src/app/onboarding/FirstLight.tsx:114`; the service writes the full
  UID-owned record at `src/services/onboardingProgress.ts:121`. This completes
  before questionnaire `:184` selects the next missing step.
- The wrapper calls the all-five check at `:40` and uses its result as the
  conditional mount at `:220`. No missing flag means that component is absent.
  Questionnaire `:58` selects its initial missing question; `:184` selects the
  next missing question; `:224` is the defensive all-complete return.
- All-true records, including draft status, reconstruct the chart at wrapper
  `:161–162`. Failure/retry stays outside the questionnaire at `:230–241`.
- `src/app/AppShell.tsx:1483` bypasses the wrapper for a valid existing chart.
  The two writes setting redo true are `:1072` (confirmed profile redo) and
  `:1081` (explicit profile resume). The profile actions are `:256` and `:261`.
  Auth, history and restore paths do not set redo true. Questionnaire Back at
  `:511–514` changes the review cursor only; it never resets completion flags.

The logical argument is finite and independent of example journeys: the filter
reads the same five named booleans on every entry, all true produces no missing
step, and every other combination can select only a flag that is false or whose
stored answer is invalid. Acceptance sets that flag and saves before consulting
the same filter again. A final flag followed by an interrupted status write
still takes the all-true branch. Persistence requires successful browser storage;
a failed write is reported and cannot be represented as a durable completion.


## INTEGRATION-2026-11-13 — current approved execution contract

This section supersedes older conflicting onboarding/UI/source-selection tasks.
Use only this repository and its local tracked UI exports. No sibling checkout,
outside code path, remote code file or new architecture/provider is an input.
Root performs the selected-source Git merge; coders then resolve only their owned
files to the frozen contract below. You are not alone; preserve concurrent work.
No tests, smoke tests, fixtures, mock services, browser automation, lint/compiler
verification or native packages. Source re-reading is required. The real
web-only release is a later explicit operation after all source is complete.
No coder commits/pushes or mutates the shared Git index; parent publishes each
completed logical task. No new UI, payment provider, PHP layer or fake result.

- [X] **UI-FRAME** — integrate approved frame and retain account/onboarding flow.
  **Own:** src/app/AppShell.tsx, src/app/SignInPanel.tsx, src/app/TopUpSheet.tsx,
  src/app/VersionBadge.tsx, src/app/VoiceDownloadStatus.tsx,
  src/app/app-shell.css, src/app/sign-in.css, src/app/chat/ChatPanel.tsx,
  src/app/chat/chat.css, src/app/chat/useChat.ts,
  src/app/landing/LandingCards.tsx, src/app/landing/landing.css,
  src/app/prototype/ImmersiveLayout.tsx, src/app/prototype/atelier-frozen.css,
  src/app/stage/Inset.tsx, src/landing/main.tsx, src/main.tsx,
  src/platform/nativeAuthPage.ts, src/platform/version.ts, src/shared/tokens.css,
  src/souvenir/SouvenirDialog.tsx, src/souvenir/SouvenirViewer.tsx,
  app.html,index.html,landing.html,auth/native.html.
  **Read-only support:** LIBS/UI/STITCH/DESIGN.md, PRD.md,
  IMPLEMENTATION-ADAPTERS-2026-11-13.md and screens/*/state-manifest.json /
  templates; src/shared/types.ts, src/chart/astrolabeInput.ts,
  src/services/gazetteer.ts, src/services/onboardingProgress.ts,
  src/app/onboarding/FirstLight.tsx, src/platform/firebase.ts.
  **Do:** Preserve the exact imported UI hierarchy/styles/real callbacks. In App,
  merge back the UID-owned chart/progress and Account redo callbacks from the
  already merged local commit 5a2b4d26760bc02c7941e88a772170e822aefd0e
  (git show of this exact local tracked AppShell.tsx is permitted). This keeps
  previous behavior while applying the approved task rail, never an overlay.
  Restore Firebase progress using loadFirebaseOnboardingProgress(uid,gazetteer)
  BEFORE mounting FirstLight when there is no existing chart. Hold a per-UID
  restore generation and ready/error state. A read failure displays inline
  restoration error + Retry; it does not instantiate empty onboarding.
  A successful result populates OnboardingLoadResult and the latest UID-owned
  in-memory draft. Ignore stale UID/generation completions. A valid cached chart
  bypasses questions. Do not let storage/pageshow/popstate replace an active
  initial intake or redo. Same-UID auth refresh retains the local active draft.
  Pass accountUid,initialProgress,storageError,onSitDown,onStorageError,onProgress,
  onCancel to FirstLight; exact interface is in UI-DATA below.
  Keep onProgress snapshots in a UID-owned ref as well as state; Return, Account
  and Resume use that ref, never overwrite it with a failed/older cache read.
  Confirmed Start again creates createOnboardingProgress(uid,'redo'), awaits
  saveFirebaseOnboardingProgress before opening it, with duplicate-submit and
  UID guards. Failure preserves previous chart and confirmation with error.
  Resume enters the retained unfinished redo. Existing chart commit synchronously
  persists same-UID chart, preserves prior chart on failed redo, and returns bool.
  Keep confirmed Redo/Resume in the imported Account rail with existing labels.
  No automatic redo. All imports resolve to tracked local code.
  **Accept:** direct semantic trace: one persistent scene; exported rail owns
  forms; date/place saved => no intake questions; read error => no false empty
  account; explicit profile reset only; current UID/attempt and latest draft
  preserved through Return/Resume/external storage. Read edited regions and
  report file:line anchors, not pass counts. Do not execute verification.

  **Source evaluation — 2026-11-14:** implementation e3f0d1e was committed
  and pushed before source evaluation. Traced UID-tagged chart state, restored
  full chart validator, cloud-ready/error gate before FirstLight, same-UID auth
  preservation, per-entry callback guards, awaited confirmed redo reset, and
  latest-draft Return/Resume without cache reload. External chart events cannot
  replace active initial intake or redo. Corrected rail navigation while reset
  is pending and cleared an information rail when intake is entered, retaining
  the single imported scene. No test/compiler/browser execution was used.

- [X] **UI-DATA** — Firebase accepted-page checkpoints in approved intake markup.
  **Own:** src/platform/firebase.ts, src/services/onboardingProgress.ts,
  src/app/onboarding/FirstLight.tsx, src/app/onboarding/onboarding.css,
  src/onboarding-original/FirstLight.tsx,
  src/onboarding-original/BirthDateFields.tsx,
  src/onboarding-original/CalendarPicker.tsx,
  src/onboarding-original/first-light.css.
  **Read-only support:** src/services/onboarding.ts, src/services/gazetteer.ts,
  src/services/birthDate.ts, src/services/transits.ts, src/shared/types.ts,
  src/voice/index.ts, src/services/supertonicTts.ts,
  LIBS/UI/STITCH/screens/d69e9b3247ff40fa90415cc2ca24abe4/templates/S03* and S04*
  plus S05*, and src/app/prototype/ImmersiveLayout.tsx.
  **Do:** Implement exact §24/25 copied below. Keep the imported Firebase Google,
  email and SMS exports intact; add accountFirestore against requireAuth's
  same current UID/app/configured named database. Do not import the old Firebase
  module/connection probe. Implement the named queued Firestore load, reset,
  accepted-step and completion functions with partial field merge masks.
  Keep existing pure validation, five-value data shape and cache helpers.
  Normal initial firstMissingOnboardingStep checks accepted valid date/place
  only. Confirmed redo checks name/date/place/time only, matching approved four
  pages; currentPlace is retained optional data, no added page or fabricated
  consent. Normalize valid stored initial date/place into accepted flags even
  for older records. Derive legacy values from actual Firebase intake fields.
  No cloud read failure falls back to a new account. If cloud has neither
  representation, migrate an existing valid UID local draft through awaited
  cloud save. Optional absent time maps to null/unknown for initial chart.
  Preserve this repository's progress-aware wrapper/handlers from local tracked
  commit 5a2b4d26760bc02c7941e88a772170e822aefd0e while using the incoming exact
  AtelierRail/question markup. No wrapper-owned scene, duplicate mascot/welcome
  overlay or unowned sessionStorage draft. Initial completed record casts without
  questionnaire. Keep onCreate calculation/attempt guards and Retry outside
  questionnaire. saveFirebaseOnboardingStep is awaited by wrapper onAccept before
  reporting an accepted snapshot to shell/cache. Child must not set true accepted
  flags, advance or invoke onCreate before that succeeds. Pending save disables
  input/Back/submit; error retains answer on same question for retry.
  FirstLightProps keeps incoming optional onBack and adds optional onAccept:
  (progress:OnboardingProgress,step:OnboardingStep)=>Promise<void>, plus existing
  initialProgress and onProgress. Active wrapper always supplies onAccept.
  OnboardingProps is exactly {accountUid:string,initialProgress:OnboardingProgress|null,
  storageError:string|null,onSitDown:(chart:NatalChart)=>boolean,onCancel?:()=>void,
  onStorageError?:(message:string)=>void,onProgress?:(progress:OnboardingProgress)=>void}.
  Parent onProgress reports ALL local edits to preserve in-memory recovery.
  Wrapper reportProgress rejects after cancellation/unmount before any write.
  Guard any remaining async location result, plus all calculation/save callbacks.
  Match complete sentinel with service ONBOARDING_STEPS.length (not the four
  visual pages). Complete cloud status merges only status after chart handoff;
  per-UID queued writes ensure it cannot overwrite a new redo map.
  **Accept:** direct source trace from cloud read/normalization through required
  date/place gate and each accepted value+flag backend acknowledgment BEFORE
  next page; failed save stays put; optional data retained; all-complete bypass;
  stale callbacks do not write; no local cache is the authority. Read changed
  regions and report exact anchors/remaining uncertainty. No tests/commands.

  **Source evaluation — 2026-11-14:** implementation e658fcb was committed
  and pushed before evaluation. Read accountFirestore's current-UID/named-app
  binding; the service's date/place versus four-page-redo required sets,
  per-UID write queue, legacy recovery, migration and partial merge masks;
  the questionnaire's awaited acceptance and wrapper cancellation guards.
  Added synchronous in-flight guards against edits/Back before React rerenders.
  Cloud read rejection is preserved; all-required-present bypasses questions.
  This is source conformance, not observed runtime behavior. Shell entry and
  profile integration remain UI-FRAME's separate task. No tests/checks ran.

- [ ] **WEB-CONFIG** — existing configuration and explicit web-only release lane.
  **Own:** build_all.sh, scripts/build-environment.mjs, .env.example, README.md.
  Local ignored .env may only receive the existing VITE_CHARGEBEE_SITE pointer
  already in .env.example; do not print or commit credential values.
  **Do:** Implement the §25 existing build entry's explicit --web-only
  --web-domain astronatally.com lane. Unknown args fail before stamping.
  Web-only requires one explicit owned domain, uses the existing automatic
  shared stamp/commit/push and web build, publishes only that domain, and exits
  before native packaging. Keep default full-matrix behavior. Do not copy
  upstream versions or manually set version numbers.
  Build environment order: missing public VITE defaults from .env.example,
  then .env, then process.env. Resolve the existing KStore pointers, including
  Chargebee site; web-only does not require native signer values or keystore.
  Preserve .env pointer-only handling, no private data in browser artifacts.
  Remove the retired hardcoded Netlify example URL: VITE_BILLING_API_URL must
  be the operator-configured actual HTTPS existing billing endpoint. In web-only
  publication mode, reject empty/pointer/unapproved Netlify billing URL or empty
  Chargebee site before build/publication; don't invent an endpoint, use another
  provider, implement PHP, make a dummy page or claim billing worked.
  Document exact env and web-only invocation. Do NOT execute it or publish yet;
  parent freezes a completed source commit first. No tests/lint/compiler runs.
  **Accept:** read script argument branches, env precedence/pointer resolution,
  retained automatic stamp and explicit one-domain publish/native skip. Confirm
  source has no baked secret and no configured Netlify fallback by inspecting
  edited regions, not running test/search proxies. Report exact source anchors
  and missing actual deployment configuration truthfully.

### Exact architecture contract copied for coder execution (§24–25)

## 24. Firebase checkpoints before onboarding navigation — FROZEN 2026-11-13

Authority: Robin's explicit corrections in this session. This amendment
supersedes §23's browser-only persistence boundary and five-required-field entry
gate. It changes only onboarding. Key expiry/exhaustion, lore storage/embedding
and billing are subjects for an architectural audit, not additions to this PR.

### Finished behavior

1. On sign-in, read the current UID's existing Firebase private intake document
   before mounting any questionnaire. The normal entry requirements are a valid
   birth date and a resolved birthplace. When both are saved, do not ask any
   onboarding questions: restore the chart or calculate it from those values.
   When either is missing, ask only the missing required question, in date then
   place order. Name, birth time and current location do not force normal
   onboarding. Retain supplied optional values; absent birth time means unknown,
   null time with the existing unknown-time chart behavior, never invented time.
2. Before Next/Begin changes the page, save that page's accepted value and its
   completion flag together to Firestore and await backend acknowledgment.
   Disable duplicate submission and editing while that write is pending. A
   rejected write leaves the same question and entered value visible with an
   inline error and a retry through the same action. Never advance on a local
   cache write alone. Cloud reads/writes use the already installed Firebase SDK,
   active Firebase app/auth UID and configured firestoreDatabaseId.
3. Reuse the existing users/<uid>/private/intake document, adding only its
   onboardingProgress map. Existing root intake fields and all unrelated
   fields/collections are preserved. Read that map first; if absent, derive
   existing saved values from the legacy intake fields described below. Only
   when neither cloud representation exists may the existing UID-owned local
   draft be migrated, awaiting its initial Firestore write before presenting it.
   A failed cloud read is shown as a restoration error with Retry, not treated
   as an empty account and not allowed to mount a fresh questionnaire.
4. All five existing answers/completion flags remain representable. For initial
   mode only date and place are required by firstMissingOnboardingStep; for an
   explicitly confirmed redo retain the existing five-step review flow. Cloud
   restoration treats valid stored date/place values as accepted initial data
   even for an older record without those two flags. Optional empty values do
   not force re-entry. Normal history/auth/storage events never initiate redo.
5. Redo remains only the existing confirmed Account action. Await the new redo
   snapshot's Firebase write before opening it. Keep the existing chart and
   latest UID-owned in-memory draft when returning/resuming, including if the
   browser cache failed. Resume uses that retained draft rather than replacing
   it with an older cache snapshot. Redo failure retains the old chart.
6. Ignore location, load, save and calculation continuations after cancellation,
   unmount or account/attempt change. In particular the questionnaire guards
   device-location success/error/finally before editing or reporting progress;
   the wrapper guards reportProgress before any cache/cloud write. Serialize
   Firebase writes per UID so already queued completion precedes a fresh redo
   reset. Never enqueue from an invalidated component. Do not adopt an external
   chart while either initial intake or redo is active locally.
7. Keep localStorage only as a best-effort cache, with the existing truthful
   warning. Keep the latest draft in the shell as well as the wrapper so closing
   the wrapper cannot lose it. Firestore success permits progression even when
   browser storage fails. Existing valid cached charts still bypass questions;
   otherwise all entry checks wait for Firebase restoration. Cloud all-complete
   answers reconstruct a chart without replaying intake if its local cache is
   absent. Completion updates are queued immediately with the current accepted
   snapshot; stale completion/UI callbacks do not mutate a newer draft.

### Exact entities — engaged by ONBOARDING-FIREBASE

All source paths are repo-relative. Component-local refs/state/handlers remain
private to the named component; no other public/module entities are introduced.

| Exact entity | Target and signature | Frozen responsibility |
| --- | --- | --- |
| accountFirestore | src/platform/firebase.ts:250; export (accountUid:string):Firestore | Call existing requireAuth(); require currentUser.uid === accountUid; getFirestore(auth.app, configured firestoreDatabaseId), default only if config omits that ID. Never initialize a second app or import the legacy Firebase module and its connection probe. |
| firebaseOnboardingWrites | src/services/onboardingProgress.ts:1; private Map<string,Promise<void>> | Per-UID ordered write tails; a failed tail does not poison later writes. |
| enqueueFirebaseOnboardingWrite | same file; private (uid:string,write:()=>Promise<void>):Promise<void> | Chain behind that UID's tail, preserve original rejection for caller, retire only the current tail. Resolve the authenticated account reference when executing the write. |
| progressFromFirebaseIntake | same file; private (value:unknown,uid:string,gazetteer:readonly GazetteerEntry[]):OnboardingProgress\|null | Derive initial progress from actual legacy name/birthDate/birthTime/birthTimeUnknown/placeName/latitude/longitude/currentLocationName/currentLatitude/currentLongitude/currentTimezoneId. Resolve birthplace against existing gazetteer coordinates/name; retain selected disambiguated label. Set date/place accepted only when valid. Do not fabricate missing fields or customer data. |
| loadFirebaseOnboardingProgress | same file; export async (uid:string,gazetteer:readonly GazetteerEntry[]):Promise<OnboardingLoadResult> | Wait for that UID's pending writes; getDocFromServer(doc(accountFirestore(uid),'users',uid,'private','intake')); normalize onboardingProgress when present, else derive legacy values, else use/migrate the existing UID local cache. Cloud errors reject. A missing document is an empty account; malformed fields recover independently without deleting bytes. |
| saveFirebaseOnboardingProgress | same file; export (progress:OnboardingProgress):Promise<void> | Ordered setDoc(...,{onboardingProgress:progress},{mergeFields:['onboardingProgress']}); only explicit redo reset or one-time local migration replaces the whole map. |
| saveFirebaseOnboardingStep | same file; export (progress:OnboardingProgress,step:OnboardingStep):Promise<void> | Ordered setDoc with mergeFields for onboardingProgress.version/accountUid/mode/status/answers.<step>/completed.<step>. Time also includes unknownTime; currentPlace also includes deviceLocation/skipLocation. Merge only these fields so other accepted pages survive. Payload contains only defined values. |
| completeFirebaseOnboardingProgress | same file; export (progress:OnboardingProgress):Promise<void> | Ordered merge of onboardingProgress.status='complete' only, after accepted values and successful chart handoff. No whole-draft replacement from a delayed completion. |
| normalizeOnboardingProgress | same file; existing signature | Preserve all independently valid values; valid saved initial date/place are accepted even if an older cloud snapshot lacks their flags. |
| firstMissingOnboardingStep | same file; existing signature | Initial mode checks date/place only; explicit redo checks all five. Return original ONBOARDING_STEPS index or its length; only genuinely missing/invalid required fields are selected. |
| intakeDraftFromProgress | same file; existing signature | Permit initial date/place-only chart reconstruction; preserve supplied name/time/location; missing/invalid optional time yields unknownTime:true,time:null. Redo retains its explicit optional-answer semantics. |
| FirstLightProps.onAccept | src/onboarding-original/FirstLight.tsx:14; optional (progress:OnboardingProgress,step:OnboardingStep)=>Promise<void> | Required by the active wrapper; advance awaits it before updating accepted refs, changing question or onCreate. Remove synchronous flushSync from post-await transitions. Keep non-owned presentation unchanged. |
| questionnaire FirstLight | same file:54; existing component | Keep current accepted-step snapshot separate from an unacknowledged candidate; never persist/advertise its true flag locally before backend success. Mounted/location-generation guards reject cancelled location callbacks. Busy save disables field edits, Back and duplicate submits; error keeps answer for retry. |
| OnboardingProps.onProgress | src/app/onboarding/FirstLight.tsx:30; optional (progress:OnboardingProgress)=>void | Report each local edit and each acknowledged checkpoint to the shell's UID-owned in-memory draft; local cache errors cannot erase it. |
| wrapper FirstLight | same file:38; existing component | onAccept awaits saveFirebaseOnboardingStep, validates mounted/current attempt before/after awaiting, then reports accepted progress. No unconditional cloud writes per keystroke. Guard reportProgress after unmount; queued completion errors are forwarded only for the active UID/attempt. |
| App | src/app/AppShell.tsx:414; existing component | Async UID/generation-guarded Firebase restoration gate before FirstLight; visible restoration error/Retry; keep latest UID-owned draft ref; beginRedo awaits cloud reset; return/resume/openAccount preserve that draft; reconcile ignores active initial intake as well as redo. Existing-chart and confirmed-profile-action rules retained. |

Legacy Firebase configuration was mapped through CodeGraph in
src/platform/firebase.ts and src/landing-original/services/firebase.ts and
onboarding.ts. VITE_FIREBASE_CONFIG already identifies the existing project and
named Firestore database. The legacy private intake path is exact source evidence,
not a newly invented collection. No billing/credit/key/lore schema is changed.

The worktree CodeGraph database could not open (literal error: unable to open
database file). Its PROJECT_INDEX files are absent. Targeted reads only of
the named service, questionnaire/wrapper, App auth/reconcile/profile regions and
this architecture closed that tooling gap; no original/abandoned repo was read.

### Source-level acceptance

Read each changed region. Trace date and place from cloud read through validation,
entry gate, awaited backend write, accepted flag and next-question selection.
Trace initial all-required-present to the chart without a questionnaire.
Trace optional empty time to the existing unknown-time input.
Trace profile confirmation to awaited reset; cancellation, stale GPS, failed
cache and external chart events must preserve current user work.
No test, smoke test, compiler run, browser automation, fixture or mock customer
is authorized for this correction. Retain the separately required merged-product
demonstration obligation; it is not replaced by tests or added as PR policy work.

## 25. Permanent integration of the existing approved UI — FROZEN 2026-11-13

Authority: Robin explicitly selects the existing first-party Astronatally UI
and requests normal permanent integration, with all due work merged to master.
This records the selected implementation; it does not authorize another UI,
payment provider, hosting design or PHP implementation. The complete structured
source, styles, templates, fonts, images, original PRD, rubric and adapters are
already tracked under LIBS/UI/STITCH. UPSTREAM.json pins commit
1b4b65c8badf6c5e079fc346bc33de789dd8ecf4 and file hashes. Version badges are
not used to identify input because they collided across earlier builds.

### Integration closure

Preserve the published onboarding merge 5a2b4d2 and subsequent work-record
commits. Integrate the selected UI's Git ancestry with a normal merge commit;
only the approved UI and its supporting auth code are selected from that
lineage. Retain this product's billing server, private configuration, namespace,
canonical versions and packaging policy. No rebase, squash, new payment/hosting
provider or duplicate runnable repository is part of this integration.

The incoming source set is: app.html, index.html, landing.html, auth/native.html;
src/app/AppShell.tsx, SignInPanel.tsx, TopUpSheet.tsx, VersionBadge.tsx,
VoiceDownloadStatus.tsx, app-shell.css, sign-in.css; src/app/chat/ChatPanel.tsx,
chat.css, useChat.ts; src/app/landing/LandingCards.tsx, landing.css;
src/app/prototype/ImmersiveLayout.tsx, atelier-frozen.css;
src/app/stage/Inset.tsx; src/app/onboarding/FirstLight.tsx, onboarding.css;
src/onboarding-original/FirstLight.tsx, BirthDateFields.tsx, first-light.css;
src/landing/main.tsx, src/main.tsx; src/platform/firebase.ts, nativeAuthPage.ts,
version.ts; src/shared/tokens.css; src/souvenir/SouvenirDialog.tsx,
SouvenirViewer.tsx. Preserve required existing native authentication support
when integrating the incoming phone helper, without native packaging.
All runtime code is normal tracked source in this repository. No sibling
checkout, temporary workspace or remote source file is a runtime/build input.

The imported state-manifest.json is the exhaustive S01-S11 UI vocabulary:
its 52 exact state IDs, template files, component names, service bindings and
data/action hooks are binding. The exact shared.css remains byte-identical as
src/app/prototype/atelier-frozen.css. ImmersiveLayout owns header, stage,
caption, rail, status and footer; one real scene survives rail transitions.
No blocking welcome overlay or duplicate mascot is reintroduced.
UI styles/markup are selected from the approved source, not recreated.

### Entities and existing contracts

| Entity | Target / frozen interface | Responsibility |
| --- | --- | --- |
| ImmersiveLayoutProps, ImmersiveLayout | src/app/prototype/ImmersiveLayout.tsx:6; header,stage,rail:ReactNode; caption?,status?:ReactNode | Exact imported shared frame and slots; real scene/chart bind to stage. |
| AtelierRailProps, AtelierRail | same file:52; title:string,onClose?,onBack?,children:ReactNode,labelledBy?:string | Exact imported task heading/Back/Close markup; no extra modal or shell. |
| StageHeader, AccountPanel, App | src/app/AppShell.tsx | Incoming compact header/rail and all real actions, plus this repository's UID/chart/progress ownership and confirmed redo callbacks. Retain the §24 Firebase restoration gate and in-memory draft. |
| AuthMethod, PhoneSignInSession, isNativeAuth, emailSignIn, emailSignUp, resetEmailPassword, createPhoneSignInSession, startPhoneSignIn, nativePhoneSignIn, cancelNativeSignIn | src/platform/firebase.ts; exact incoming exports/signatures | Preserve existing Google/native auth while integrating the already implemented email/SMS services used by SignInPanel. accountFirestore remains the §24 addition on the same app/UID/database. |
| SignInPanel | src/app/SignInPanel.tsx | Existing real Google/email/SMS/reset callbacks and actual reCAPTCHA; exact S02 templates, no fake provider results. |
| OnboardingProps, FirstLightProps, FirstLight, OriginalFirstLight, BirthDateFields, CalendarPicker | §24 paths and signatures plus imported optional onBack callback | Incoming rail markup with the §24 accepted-step persistence contract. Keep current chart and draft; do not restore the incoming unowned sessionStorage stash. |
| ONBOARDING_STEPS, firstMissingOnboardingStep, intakeDraftFromProgress | src/services/onboardingProgress.ts | Keep the five-value data shape. Initial entry requires only saved valid date/place. Explicit profile redo uses the approved four question pages name/date/place/time; currentPlace remains optional retained data and cannot force another page. This selection supersedes §24's reference to a five-page redo. |
| useAllowance, ChatPanel, LandingCards, TopUpSheet, SouvenirDialog, SouvenirViewer, Inset, VoiceDownloadStatus | incoming paths above; exact existing exports | Preserve actual conversation/allowance, purchases, reports, voice/renderer events and manual geometry; only approved UI composition changes. |
| displayVersion | src/platform/version.ts | Imported display projection reads this repository's canonical version data. No copied upstream version.json/version.txt becomes this product's identity. |
| bootstrapNativeAuth | src/platform/nativeAuthPage.ts | Imported S10 markup; preserve credential/state/origin validation and actual auth protocol. |
| build_all.sh --web-only --web-domain astronatally.com | build_all.sh | Explicit current operator release lane. Parse before stamping. Retain existing automatic version stamp/commit/push, generate web once, publish only the named domain, exit before native packaging. Default full-matrix behavior remains as previously architected. |
| scripts/build-environment.mjs existing env/example/resolution | scripts/build-environment.mjs | Inherit missing public VITE settings from tracked .env.example, then .env, then process.env; resolve existing KStore pointers. Web-only mode does not require native signing secrets. No secret or pointer is baked into public JS. |
| checkoutAvailable, chargebeeSite, buyCredits, buySouvenir, createCheckout, openCheckout | existing src/commerce and platform/env paths | Use the real existing Chargebee connector and configured site/API. VITE_CHARGEBEE_SITE comes from its existing private-authority pointer. No replacement checkout/provider or synthetic success. |
| VITE_BILLING_API_URL | .env.example / runtime build environment | Must name the actual approved HTTPS billing endpoint; no retired Netlify default or invented deployment. Required deployment configuration is reported as configuration, never silently substituted. |

The normal entry date/place rule is independent of optional values, while
intentional redo retains all supplied values. OriginalFirstLight must await its
onAccept checkpoint before updating accepted flags or selecting the next page.
App must restore Firebase before mounting intake, guard UID/generation races,
retain in-memory drafts across Return/Resume, and keep a local initial edit from
being replaced by an external chart. These are §24 implementation requirements,
not new provider or product behavior.

### Fixed release sequence

Complete and publish the integration commits first. Fix the selected source
commit for one web-only canonical invocation. No code/configuration/provider
changes occur between producing that bundle and publishing that same bundle.
Destination: astronatally.com only, Surge; no asknatally.online publication,
Netlify deployment or native packaging. Do not identify the source by its badge.
The separately required final integrated-product demonstration is distinct from
prohibited unit/smoke/fixture tests. Do not run or introduce such tests.

Key/lore/billing audit is a conformance report against the existing architecture.
It is not authority to invent PHP endpoints, another provider, placeholder
fulfillment or a different key/lore design. Any missing end-to-end contract must
be made explicit before that work can be assigned; no coder fills it in ad hoc.

## PROMPT-CANON — DRAFT, NOT ASSIGNED IN THIS EXECUTION

- [ ] **PROMPT-CANON** — wire the tracked authored persona and reading rubric.
  **Own:** src/content/persona.ts and src/app/chat/context.ts only.
  **Inputs:** tracked root SOUL.md and READING_RUBRIC.md; no src/ duplicates.
  **Do:** Execute the frozen contract below. Import the two root Markdown files
  with Vite ?raw as NATALLY_SOUL and NATALLY_READING_RUBRIC. Replace the manually
  maintained NATALLY_SYSTEM_PROMPT summary with their trimmed texts joined by
  two newlines. Preserve NATALLY_PARAMETERS, NATALLY_EXAMPLES, PersonaExample,
  the existing exports and buildMessages' measured-context/backstory/history
  construction. In existing chartFacts and chartTargets, guard all angle/house
  facts and targets on chart.input.timeIso !== null. Unknown time omits angle
  coordinates, houses, and natal/current-to-natal aspects involving Ascendant
  or Midheaven. Preserve body sign/longitude and non-angle aspect facts/targets.
  No provider, inference transport, lore persistence, new source module or
  alternate authored copy changes. No new module-scope symbols beyond the two
  named raw imports; component/function local variables stay local.
  **Accept:** direct source reading traces both root raw imports through
  NATALLY_SYSTEM_PROMPT into buildMessages; the null-time branch cannot emit
  angle/house facts or target names in any enumeration. Known-time behavior is
  retained. No tests, syntax/type checks, scripts, build or browser execution.
  **Handback:** reread edited source; return written file:line anchors and any
  source mismatch. Root owns checklist markers, Git commit/push and integration.
  You are not alone in this checkout; preserve every other agent's edits.

### Exact frozen contract — ARCHITECTURE.md §26

## 26. Existing authored prompt wiring — DRAFT, NOT ASSIGNED

Authority: Robin requires Natally's prompting to be final before publication and
forbids replacing the settled design. This is an exact wiring correction for
the already tracked SOUL.md and READING_RUBRIC.md, not new persona wording,
lore infrastructure, provider selection or inference hosting. Those root files
remain the sole authored texts; their untracked src/ duplicates are not inputs.
The existing observation rubrics' spoken-reading and actual-calculation clauses
remain applicable to the final merged product.

| Exact entity | Target and signature / source | Frozen responsibility |
| --- | --- | --- |
| NATALLY_SOUL | src/content/persona.ts:1; private default raw import from ../../SOUL.md?raw | Include the tracked root character document, without a separately maintained summary. |
| NATALLY_READING_RUBRIC | same file:2; private default raw import from ../../READING_RUBRIC.md?raw | Include the tracked root reading requirements in every model system prompt. |
| NATALLY_SYSTEM_PROMPT | same file:19; existing exported string | Join NATALLY_SOUL.trim() and NATALLY_READING_RUBRIC.trim() with two newlines. Preserve the existing public export, parameters, examples and PersonaExample interface. |
| buildMessages | src/app/chat/context.ts:206; existing (history:ChatMessage[],chart:NatalChart,sky?:SkyPlacement[]\|null):ContextMessage[] | Continue including NATALLY_SYSTEM_PROMPT, measured chart facts, actual stage target inventory, authored backstory and last 20 messages. No lore-persistence or key-lifecycle claim is added. |
| chartFacts | src/app/chat/context.ts:66; existing (chart:NatalChart):string | When input.timeIso is null, state birth time unknown, omit Ascendant/Midheaven coordinates and every house assertion. Keep calculated body sign/longitude and supplied aspects between non-angle bodies; omit aspects involving Ascendant/Midheaven as well. Known birth time retains the existing facts. |
| chartTargets | same file:142; existing (chart:NatalChart,sky?:SkyPlacement[]\|null):Set<string> | Unknown birth time excludes angle bodies Ascendant/Midheaven, House targets and aspect targets involving those angles. Apply the same exclusion to current-to-natal target enumeration; retain existing measured body/aspect targets and known-time behavior. |

Only src/content/persona.ts and src/app/chat/context.ts change. No new source
module or alternate authored document is introduced. A reliable birth time is
required for angle/house claims by the existing reading rubric; a noon fallback
used to compute other chart positions is not evidence of the visitor's birth
time. The same exclusion is used by chartFacts and chartTargets so the prompt
cannot invite an unsupported angle/house explanation.

Source acceptance is direct semantic tracing from the two tracked raw imports
to NATALLY_SYSTEM_PROMPT to buildMessages, then tracing the null-time branch in
chartFacts and all three target enumeration loops. No test, compiler check,
fixture, fake reading, browser automation or detached demonstration is run.
The separately mandated final product recording remains unobserved until it is
actually made.

## Current execution amendment — ARCHITECTURE.md §27

The three UI-FRAME/UI-DATA/WEB-CONFIG tasks above are resumed. PROMPT-CANON
and later proposals remain unassigned drafts. For WEB-CONFIG, replace the
prior purchased-domain destination with natally.robin.mba only in existing
argument validation, default web destinations and documentation. Keep explicit
web-only native skip and default web-deploy-before-native ordering. Do not
execute either lane. Root commits/pushes each implementation before semantic
evaluation and commits/pushes the evaluated result; root merges/pushes master,
then the other session PR, then deploys web before starting native builds.

Exact operator architecture contract:

## 27. Operator-directed completion and release — FROZEN 2026-11-13

Authority: Robin explicitly resumes coding the three tasks already published in
b5259dd, selects ACP-controlled GLM-4.7-Flash through zclaude with the explicit
--model glm-4.7-flash selection, requires task commits/pushes before and after
semantic evaluation, and directs all completed work to master. The other session
is waiting for this master integration before its own branch/PR can be merged.
This is the current execution authority; earlier architecture-only restrictions
remain applicable to later proposals, not these three already selected tasks.

1. Execute UI-FRAME, UI-DATA and WEB-CONFIG from the committed checklist. Each
   coder receives only that exact task, its copied contract and named local
   tracked inputs. No 5.x substitution, historical context recovery, broad source
   survey, test/smoke/fixture/browser/compiler/lint execution, Git mutations,
   builds or deployment by coders. Parent owns Git and semantic evaluation.
2. Commit and push each implementation before semantic evaluation. Read its
   actual changed source against the contract; return corrections to the same
   bounded ACP session. Commit and push the evaluated result and checklist
   progress. Do not substitute test counts for this source evaluation.
3. Merge this completed integration to master and push master, then merge the
   other session's completed PR in chronological order. Preserve concurrent
   edits and Git ancestry. Source completion includes master publication.
4. The current public destination is natally.robin.mba ONLY. It supersedes the
   astronatally.com/asknatally.online destinations for this release. WEB-CONFIG's
   existing --web-only --web-domain interface accepts natally.robin.mba; the
   existing default web destination list contains only that domain. Change only
   existing argument/domain branches and their documented invocation. Do not
   invent a new deployment transport or billing endpoint during that edit.
5. After completed checklist work is on master, generate and deploy the web
   bundle first, then begin native builds. The deployed web app is available
   while Robin can still stop the expensive native build. Keep explicit
   web-only native skip as an available lane. No source/configuration/provider
   changes are introduced between generating a bundle and publishing it.
6. §26's prompt proposal and later private-key/lore/hosting proposals are not
   implementation assignments in this three-task run. Preserve them as drafts;
   do not silently implement them. The physical hosting facts and actual
   publication route are established before deployment; a domain string does
   not authorize guessing a server, replacing a provider or configuring Netlify.

Exact changed existing entity: build_all.sh's --web-domain argument validation
and existing web destination list; target natally.robin.mba. Existing automatic
version stamping, same-bundle publication and web-before-native ordering are
retained. No new public source entity is introduced by this amendment.
