# Checklist — 2026-11-08 (clean-room one-shot)

1:1 translation of DOCS/ARCHITECTURE.md. One coder per task, disjoint files,
frozen contracts. ⬜ · 🔧 · ✅ · 🛑. Acceptance: section complete, `tsc
--noEmit` clean, owned files only, no placeholders, commit+push.

| ID | Task | Owned files (exclusive) | Depends | Status |
| --- | --- | --- | --- | --- |
| W0 | SHELL | package.json, tsconfig.json, vite.config.ts, landing.html, app.html, .env.example, version.json, build_all.sh, .gitignore | — | ⬜ |
| W1 | SHARED | src/shared/** | W0 | ⬜ |
| W2 | PLATFORM | src/platform/** | W0 | ⬜ |
| W3 | ASTRO | src/astro/** | W1 | ⬜ |
| W4 | CHART | src/chart/** | W1, W3 | ⬜ |
| W5 | BILLING-SERVER | netlify/**, billing/** | W2 | ⬜ |
| W6 | COMMERCE-CLIENT | src/commerce/** | W2 (runtime W5) | ⬜ |
| W7 | VOICE | src/voice/** | W1 | ⬜ |
| W8 | CHAT | src/app/chat/** | W2, W6 | ⬜ |
| W9 | CONTENT | src/content/** | W1 | ⬜ |
| W10 | APP-SHELL | src/app/** except chat/** | W2–W6, W9 | ⬜ |
| W11 | LANDING | src/landing/** | W3, W4, W9 | ⬜ |
| W12 | SOUVENIR | src/souvenir/** | W4, W6, W8 | ⬜ |
| W13 | ENTRY-RELEASE | src/main.tsx, src/platform/{pwa,version}.ts | all | ⬜ |
| W14 | JOURNEY-PROOF | DOCS/DEMONSTRATIONS/** | all | ⬜ |

Waves: W0 → {W1, W2} → {W3, W7, W9} + {W5, W6, W4} → {W8} → {W10, W11, W12}
→ W13 → W14.
