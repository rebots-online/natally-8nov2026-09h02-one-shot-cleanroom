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
