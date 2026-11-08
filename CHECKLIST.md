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
