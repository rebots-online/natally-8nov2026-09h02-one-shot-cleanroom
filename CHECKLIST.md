# Checklist — 2026-11-08 (clean-room one-shot)

1:1 translation of DOCS/ARCHITECTURE.md. One coder per task, disjoint files,
frozen contracts. ⬜ · 🔧 · ✅ · 🛑. Acceptance: section complete, `tsc
--noEmit` clean, owned files only, no placeholders, commit+push.

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

### POLISH-LAYOUT — compact sizing, calmer cards, visible karaoke

Ownership: `src/app/stage/Inset.tsx`, `src/app/stage/inset.css`,
`src/app/AppShell.tsx` (landing branch/wiring only),
`src/app/landing/LandingCards.tsx`, `src/app/landing/landing.css`,
`src/app/app-shell.css` (karaoke selector rules only; append if absent),
`src/app/karaokeCaption.tsx` (rolling two-line caption window).
The renderer is another coder's file: do not edit it. No new module-scope
entities except those named below.

Do:
- Add `InsetProps.compact?: boolean`, default false; private constants
  `COMPACT_INSET_MIN_PX = 96`, `COMPACT_INSET_DEFAULT_PX = 220`. When compact,
  preferred first-load width is 220 CSS px on wide screens or 180 px through
  760 px, floor 96, bounded by the actual stage. Pass `compact={true}` and a
  `:compact-v1` storage-key suffix from the landing's chart `Inset` only.
  Consistently use the compact floor in `clampGeometry`, drag/grips, Alt+arrow,
  restore, resize and automatic placement. Initial compact placement floats at
  the preferred size at the TOP LEFT, with the existing margin and below
  the header; do not auto-enlarge/dock/invert
  using the body-count/glyph floor. Persist manual geometry; after the customer
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

### POLISH-CHART — sharp renderer and exact gold spokes

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
  No overlapping label pile-ups, no darker chart, no new obsolete arc.
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

### DOMAIN-RETIREMENT — pending after the landing corrections

Retire the old personal-domain URLs throughout first-party tracked repository
text/configuration and scripts, including historical prose. Runtime landing
entries use astronatally.com/www.astronatally.com and app entries use
asknatally.online; historical prose uses `retired-product-host` rather than
rewriting history. Preserve `mba.robin.natally` package identity. No product
deployment may target an unrelated personal-domain host. The exact migration
and release assignment follows the landing correction review; no placeholder
backend destination or unapproved backup-domain role may be invented.
