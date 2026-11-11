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

## Landing correction observations — operator 2026-11-11

Record the following in one continuous screencast at 1440×900, 1280×720,
and 390×844 before publication. These are observation requirements, not
claims that the current page passes.

8. **Compact wheel and usable resizing.** First load leaves Natally and the
   cards room to breathe. The floating chart starts at the top-left at about 220 CSS px on
   desktop and 180 CSS px on a phone (about half to a third of its prior size),
   subject to the available stage. Drag a
   corner down to 96 CSS px: no old body-count or glyph-size calculation
   forces it larger, no automatic view inversion defeats the choice, and the
   compact geometry survives reload. Below 160 px it is a clean thumbnail;
   focus or selection restores detailed annotations without crowding it.
9. **Crisp chart.** Observe floating, minimum-size, focused, and swapped-back
   states at device pixel ratios 1 and 2. The canvas is rendered at its actual
   displayed size and pixel ratio; glyphs, degree text and Earth are crisp.
   Compact presentation may defer crowded degree annotations until focus or
   selection, but visible glyphs remain distinct and their labels accessible.
10. **Precise gold structure.** Turn and resize the wheel. Gold sign ticks and
    house spokes meet their intended rings at the exact calculated angles,
    especially across the top/back, with no detached bars, protruding ends,
    duplicate arcs or flickering. Zodiac badge glyphs contrast at least 4.5:1
    against their fills. The smooth, thick 3D UFO/doughnut profile, tilted
    rounded rim and moving sun/specular glint remain visible while rotating;
    a flat disc is a failure.
11. **Visible constellations.** Both the compact and focused chart have a black
    sky with distinguishable stars and constellation lines at ordinary screen
    brightness, subdued behind the wheel rather than bright foreground zigzags.
    Their visibility persists during motion; labels retain priority.
12. **Bright yellow karaoke.** Let Natally speak on the landing and in the app.
    The current word is bright warm yellow, visibly higher contrast than the
    surrounding words, with a clear luminous halo and a crisp letter edge.
    The highlight follows real speech; reduced motion preserves the contrast.
    Captions show at most two actual text lines, rolling with the active word;
    long passages never become a wall of text or clip the speaking word.
13. **Uncrowded cards with directional guidance.** First load visibly offers
    “Scroll down ↓”; after scrolling, guidance indicates the available up/down
    directions and the end stops offering a nonexistent next card. Cards have
    at least 48 CSS px between pages and 96 CSS px between sections on desktop
    (32/64 on phones), clear stage gutters, and no overlap with Natally, the
    wheel, captions or loading bar. Keyboard and touch scrolling work.
14. **Purchased-domain independence.** Navigate landing → app and inspect the
    address bar and requests. Only the purchased product domains are used for
    product entry/deployment; no retired personal-domain host is requested.
    Normal HTTPS validation succeeds for the apex and www forms of both sites.
