You are the coder for task AUDIT2-LANDING in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §12.1, src/app/AppShell.tsx and src/app/landing/landing.css (owned), read-only callees.
HARD RULES: edit only src/app/AppShell.tsx (landing branch only) and src/app/landing/landing.css. No placeholders. `npx tsc --noEmit` clean. Do not commit. Use `npx vite --port 5193 --strictPort`.

THE ORCHESTRATOR OBSERVED THIS FAILURE AFTER THE LAST PASS:
On a phone (390×844), scrolling to the chart cards (#your-chart) shows ONLY the cards — the chart is gone. §12.1 4/5a: in chart view the chart is visible and the cards never cover it. On narrow screens the stage (atelier/chart) must stay visible in the top part of the viewport (sticky) while the cards scroll below it; in chart view that stage shows the focused chart (with the room as its small card), and scrolling out returns the atelier there. Desktop behaviour (1440×900, 1280×720) must stay exactly as it is now.
VERIFY at 390×844 and 1440×900: first load, chart view, back; state what you observed.
