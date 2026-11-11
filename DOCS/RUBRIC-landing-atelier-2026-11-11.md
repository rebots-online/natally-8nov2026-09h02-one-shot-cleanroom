# Rubric — landing is the atelier (ARCHITECTURE §12.1) — 2026-11-11

Observation checklist for the acceptance screencast only (AGENTS.md rule 10).
Each checkpoint is one item of §12.1, observed on the deployed build and
recorded in `DOCS/DEMONSTRATIONS/`. Static inspection and lint never substitute.

1. **§12.1-1 — the landing is the atelier.** Opening `https://astronatally.com/`
   shows the app's signed-out page: the big Natally in her atelier, the app
   header — not the old marketing layout.
2. **§12.1-2 — one click, one sign-in.** One click on Sign In opens Google's
   account chooser at once. At no point after that click does any screen, card
   or button ask to click to sign in again.
3. **§12.1-3 — all text on paginated dark-purple cards.** Every piece of landing
   copy appears as short card pages with the dark purple background of the app's
   sign-in card, scrolling by; no plain scrolling text remains.
4. **§12.1-4 — entering the natal-chart content swaps to the chart**, shown both
   ways: by scrolling into it, and by choosing its menu item.
5. **§12.1-5 — leaving the natal-chart content swaps back to the atelier**, shown
   both ways: by scrolling out of it, and by choosing a menu item outside it.
6. **§12.1-6 — roles by domain.** `https://asknatally.online/` serves the app at
   `/`; every way into the app from the landing goes to asknatally.online.
7. **§12.1-7 — sign-in works on both domains.** Sign In on astronatally.com
   (one click) ends on asknatally.online already signed in — no second sign-in
   click — and the address bar carries no token afterwards.
