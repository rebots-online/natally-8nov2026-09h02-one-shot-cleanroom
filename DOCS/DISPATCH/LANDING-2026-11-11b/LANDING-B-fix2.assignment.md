You are the coder for task LANDING-B (fix 2) in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §4 and §12.1, src/app/AppShell.tsx (owned), and read-only callees (src/app/stage/Inset.tsx, src/app/presentation/explain.ts, src/app/presentation/*, src/atelier-original/components/ReadingStage.tsx, AtelierScene.tsx, src/app/app-shell.css, src/app/landing/LandingCards.tsx). Never edit Inset.tsx/inset.css (another coder owns them) or src/app/landing/**.

HARD RULES: edit only src/app/AppShell.tsx, its signed-out (landing) branch and the landing state/constants. No change to signed-in behaviour. No placeholders. `npx tsc --noEmit` clean. Do not commit or push.

PRINCIPLE: the signed-in stage already has the working arrangement (stage-inset-root, ReadingStage floating Natally when the chart is focused, Inset with fillHeight from useStageVisualHeight, onAutoInvert). The landing must REUSE that same arrangement, not a new one.

DEFECTS (operator observed; judged against §12.1)
1. 4b: clicking an element on the chart gives no description. A click/tap on a hovered component must bring the chart forward AND make Natally speak her passage about it with the element(s) highlighted — the same explainTarget → reply driver → voice path the signed-in stage uses (explainTap). The landing chart is a NatalChartResult from computeAstrolabeChart(EXAMPLE_BIRTH); compute the clean-room NatalChart for EXAMPLE_BIRTH through the same pipeline the app uses for a birth input so explainTarget can run.
2. 4/4a: a tap focuses the chart (keep); chart cards in view / menu jumps focus it; leaving swaps back. At first load (meet-natally card in view) the ATELIER is on the stage, not the chart.
3. 4c: the swap glides — no broken/jarring zoom, no jump, no empty-stage flash. When focused, the atelier is the floating inset showing Natally whole (face never cropped), movable and resizable, wholly inside the window, in a corner clear of the wheel and the cards. First load: the floating chart sits in a corner on the LEFT (away from the right-side cards), clear of her face, wholly inside the window.
4. 5a: the atelier is sized to the visible window height — Natally and her crystal ball never cut off by the bottom of the window; cards stay off to the right and never obscure the main view in either state.
5. The inset label is "Natal chart"; no "Aurelia"/"example" anywhere.

ARCHITECTURE §12.1:
### 12.1 Landing target state (operator 2026-11-11 — FROZEN on Robin's order "assign to coders from checklist")

1. **The landing is the atelier — the app's own signed-out page.** Visitors
   land on the page that comes up today when you click Sign In: `AppShell`'s
   signed-out branch (`src/app/AppShell.tsx`), the big Natally in her atelier
   (`AtelierScene`) with the sign-in card. That page, not `landing.html` /
   `src/landing-original/marketing.tsx`, is the landing: astronatally.com `/`
   serves `app.html`. The marketing port is retired from the landing role.
2. **One click, one sign-in (hard rule).** Sign In launches Google's account
   chooser on that same click. No screen, card or button ever asks someone to
   click to sign in after they already clicked Sign In — offering sign-in and
   then presenting another "click here to sign in" taunts them. A blocked
   popup falls back to Google's redirect from that same click, never to a
   second prompt.
3. **All scrolling text is paginated onto cards.** Every piece of landing copy
   is divided into pages, each page its own small card with the dark purple
   background of the card that today carries the second "click here to sign
   in" (that card's look is kept; its second-click role is removed per item
   2). The cards scroll by; no landing copy remains as plain scrolling text.
4. **Entering the natal-chart content swaps the atelier for the focused
   chart** — when the cards talking about the chart scroll into view (or its
   menu item is chosen), the chart takes focus and fills the stage and the
   atelier becomes the inset (the existing swap, `swapInsetView`).
4a. **A tap focuses the chart** — primary inset behaviour (§4): a tap on the
   floating chart brings it to focus, filling the stage, with the atelier as
   the inset; scrolling and menu items drive the same swap.
4b. **Clicking an element on the chart makes Natally explain it** (§4): a
   click/tap on a hovered planet, sign, house or aspect line brings the chart
   forward and she speaks her passage about that element, highlighting it
   (and every element involved) as she goes — the same `explainTarget` →
   reply driver path the signed-in stage uses.
4c. **The swap is smooth and the atelier inset well placed.** Focusing and
   unfocusing glide — no broken or jarring zoom, no jump, no flash of an
   empty stage. When the atelier is the inset it shows Natally whole and
   readable (her face never cropped), in a corner that covers neither the
   chart's wheel nor the cards.
   Both insets — the chart and Natally's card — are movable and resizable
   (drag to move, corner grips to resize, same card behaviour as §4) so it can always be moved out of the way. The focused
   chart is sized to the visible window: the whole wheel fits, nothing cut
   off at the bottom. The wheel's background is black, not purple — focused
   or floating.
   Every inset — the floating chart and Natally's card — sits wholly inside
   the visible window, never cut off at the bottom or any edge.
   From first load, the floating chart is placed just as well: a corner on
   the side away from the cards, clear of Natally's face, at a size where
   every glyph reads (§4 face-aware placement, measured with the card column
   counted as occupied).
5. **Leaving the natal-chart content swaps back** — scrolling out of it or
   choosing a menu item outside it returns the big atelier to the stage and
   the chart to the inset.
5a. **Layout: big atelier, cards off to the side.** The atelier fills the
   stage, big, and fits inside the window: Natally and her crystal ball are
   always whole — never cut off by the bottom of the window (the atelier is
   sized to the visible window height, not taller), nor by the card column
   or the inset. The cards look like the sign-in card and sit off to the side —
   never in the middle over Natally — and neither the cards nor the chart
   cover her; the chart inset keeps its face-aware placement (§4). In both
   states — atelier on the stage or the focused chart on the stage — the cards
   stay off to the side and never obscure the main view.
6. **Roles by domain.** astronatally.com is the landing; the webapp lands on
   asknatally.online. Every way into the app from the landing — Sign In,
   create-your-chart, Top Up, open-my-atelier, the `?app=1` entry — routes to
   asknatally.online, and asknatally.online serves the app at `/`.
7. **Sign-in works on both domains.** Firebase authorized domains include
   astronatally.com, asknatally.online and their `www` hosts (added
   2026-11-11; snapshot in `DOCS/DOMAINS/`). Item 2 holds across the domain
   change: Sign In on astronatally.com runs the Google popup on that click
   (redirect fallback when blocked); on success the visitor continues on
   asknatally.online already signed in — the Google ID token travels in the
   URL fragment (`#gid=…`, never sent to a server), asknatally.online signs in
   with it (`signInWithCredential`) and strips the fragment at once. No second
   sign-in click anywhere.

## 13. Preserved trees (`*-original/`) — frozen ports

VERIFY: npm run dev, /app.html signed out at 1440×900 and 1280×720: first load, scroll into/out of the chart cards, menu jumps, tap the wheel, click a planet (she must speak and highlight it), move/resize both insets; state exactly what you observed.
