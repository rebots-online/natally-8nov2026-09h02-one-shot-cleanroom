You are the coder for task LANDING-B (fix 1) in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §12.1 and §4 (inset/stage swap), src/app/AppShell.tsx (owned), and read-only callees (src/app/stage/Inset.tsx, src/atelier-original/components/ReadingStage.tsx, src/atelier-original/components/atelier/AtelierScene.tsx, src/app/app-shell.css). Never edit src/app/landing/** (another coder owns it) or landing.html / src/landing-original/**.

HARD RULES
- Edit only src/app/AppShell.tsx, and only its signed-out (landing) branch plus the landing constants/state it uses. No change to the signed-in app.
- No placeholders. `npx tsc --noEmit` stays clean. Do not commit or push.

DEFECTS (judged against ARCHITECTURE §12.1 — fix both)
KEEP: a tap focuses the chart (§12.1 4a, primary behaviour) — leave the landing Inset's onSwap/onComponentTap tap-to-focus in place.
1. The landing chart carries a person's name: `EXAMPLE_BIRTH.name = 'Aurelia'` and the inset label "Aurelia’s example wheel". Remove the name from EXAMPLE_BIRTH (omit `name`) and label the inset "Natal chart". No "Aurelia" and no "example" text anywhere on screen or in visible labels; update the comments to match.
2. When the chart is focused it fills the stage but the atelier just stays behind it. §12.1 item 4: the chart takes focus and fills the stage AND the atelier becomes the inset — the same swap the signed-in stage shows (there `ReadingStage` floats Natally's room as the small pane when `view === 'chart'`). Implement that for the landing: atelier big with the chart floating (face-aware inset placement) when not focused; chart filling the stage with the atelier as the floating pane when focused; swapping back when the chart cards leave view. Neither ever covers Natally's face (§12.1 5a).

VERIFY: `npm run dev`, open /app.html signed out at 1440×900; scroll into and out of the chart cards and use the menu items both ways; state exactly what you observed in each state.
