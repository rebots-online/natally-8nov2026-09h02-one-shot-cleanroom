You are the coder for task LANDING-A (fix 1) in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §12.1, src/app/landing/landing.css (owned), src/app/landing/LandingCards.tsx (read-only), src/app/app-shell.css (read-only).

HARD RULES
- Edit only src/app/landing/landing.css. No placeholders. Do not commit or push. `npx tsc --noEmit` stays clean.

THE DEFECT (judged against ARCHITECTURE §12.1 item 5a)
The cards are centred (`.landing-cards { max-width: 720px; margin: 0 auto }`, sections `justify-items: center`), so they sit in the middle of the stage over Natally and over the focused chart.

REQUIRED (§12.1 5a, operator's words: "big atelier; cards like the sign-in card, off to the side, not obscuring the main view")
- The atelier fills the stage, big. The card column sits off to the side — the right edge of the viewport on wide screens (column width ≈ the `.card` width, min(400px, 34vw)), with a gutter from the edge — never centred and never over Natally's face or the middle of the stage.
- In both states (atelier on the stage, or the focused chart on the stage) the column stays at the side and never covers the main view.
- Narrow screens (≤ 760px): the column runs along the bottom portion as a horizontally scrollable/paged strip or below the stage — never covering her face.
- Cards keep the sign-in card's dark-purple `.card` look unchanged.

VERIFY: `npm run dev`, open /app.html signed out at 1440×900 and 390×844; state what you observed for both, in both states.
