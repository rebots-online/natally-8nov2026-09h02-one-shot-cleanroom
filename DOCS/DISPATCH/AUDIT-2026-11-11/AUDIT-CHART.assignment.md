You are the coder for task AUDIT-CHART in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §12.1 and §16, your owned files and read-only callees.

HARD RULES: edit only src/atelier-original/components/Astrolabe3D.tsx. No placeholders. `npx tsc --noEmit` clean. Do not commit or push. Never make anything darker, blurrier or smaller than it is now. Use your own dev server: `npx vite --port 5191 --strictPort` (5180 is the orchestrator's). Report changed paths, checks run with exit status, and anything undecided.

OBSERVED DEFECTS (orchestrator's audit, all must be gone for your part)
Observed defects (screens in /tmp/claude-1000/review/A-*.png): zodiac-ring signs are pale glyphs on pale baubles — illegible; planet glyphs and degree text too small and soft; the gold sign ticks are cylinders that cross the ring and stick out on both sides ("gold bars floating"); callouts sit on top of what they describe; selecting an aspect does not highlight it; on the phone the atelier floats mid-screen with an empty band above, the floating chart is missing at first load, and in chart view the cards cover the wheel; at 1280×720 the voice bar covers the bottom of the floating chart; scene meta labels ("Here with you", "An imagined sky"), the dev "Rehearse breakage" control and the "Tap a cookie · take a bite" instruction point at the room's magic; the treat is cookies out of season; the swap snaps instead of gliding; she never switches the view with her words; she has no welcome or stories on the landing.



YOUR TASK (CHECKLIST.md)
| AUDIT-CHART | `Astrolabe3D` (deliberate local additions): sign baubles a saturated fill with a dark, outlined glyph (legible at every size); all glyph/label textures drawn at 256 px × devicePixelRatio and sprites held to a minimum on-screen size (glyph ≥ 14 CSS px, degree/house text ≥ 11 px) from the renderer's pixel size, never darker or blurrier; sign-boundary ticks become short lines confined to the ring's width (no cylinders crossing it); house cusp separators run between the rings, attached; callouts placed clear of the hovered element with a visible gap on the side with room; selecting an aspect line highlights it and its two bodies; the Earth label crisp. | `src/atelier-original/components/Astrolabe3D.tsx` | ⬜ |

ARCHITECTURE §12.1
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
   reply driver path the signed-in stage uses. This includes relationships:
   selecting an aspect line highlights that line (and its two bodies) exactly
   as a planet is highlighted — operator observed it does not.
4c. **The swap is smooth and the atelier inset well placed.** Focusing and
   unfocusing glide — no broken or jarring zoom, no jump, no flash of an
   empty stage, never sudden: both panes animate together over ~450 ms
   (eased) — the chart grows from its floating card to the full stage while
   the room shrinks from the full stage into its corner card, and the reverse
   on the way back. While Natally explains, the view switches back and forth
   with her words — to the chart when she points at it, back to her when she
   speaks to you — driven by her passage's cues, as on the signed-in stage. When the atelier is the inset it shows Natally whole and
   readable (her face never cropped), in a corner that covers neither the
   chart's wheel nor the cards.
   Both insets — the chart and Natally's card — are movable and resizable
   (drag to move, corner grips to resize, same card behaviour as §4) so it can always be moved out of the way. The focused
   chart is sized to the visible window: the whole wheel fits, nothing cut
   off at the bottom. Behind the wheel is black space with stars and
   constellations floating by — never purple — focused or floating.
   Every inset — the floating chart and Natally's card — sits wholly inside
   the visible window, never cut off at the bottom or any edge.
   Every symbol on the wheel — planet glyphs, sign glyphs, house numbers,
   degree labels — is legible at every inset size, floating or focused: glyph
   sprites keep a minimum on-screen size (≥ 14 CSS px for glyphs, ≥ 11 px for
   degree text) with enough contrast, never shrinking with the canvas into
   illegibility (operator: "the symbols are illegible"). Every glyph and
   label is crisp, never blurry: label textures are drawn at the on-screen
   size × devicePixelRatio (redrawn when the inset is resized or focused) and
   sampled without upscaling blur (operator: "typeface is blurry"). Named
   explicitly by the operator: the degree numbers beside each body and cusp,
   and the Earth label at the centre — both crisp and readable. A component's callout
   never covers the component it describes or its neighbours: it sits clear
   of the hovered element with a visible gap, on the side with room, inside
   the inset (operator: "callout covers, too close"). The golden house
   separators are part of the wheel: each cusp line runs between the wheel's
   rings, attached to them — never floating apart, detached or off the wheel
   (operator observed them floating apart off the wheel).
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
5b. **Her ethos is present — she is a character, not a widget.** On the
   landing Natally is alive in her room exactly as the original landing had
   her (`src/landing-original/marketing.tsx`) and as `src/SOUL.md` defines
   her: her welcome spoken once voice is on — with NO reference to her
   shelves, the things on them, grabbing, breaking or rehearsing; her authored stories and asides arriving when the room is quiet
   (`authoredNudges` / `content/backstory` `nextSpontaneousStory`), spoken
   with lipsync and shown as her words; her voice and register in every line.
   The scene, the swap and the cards never replace her presence.
5c. **Immersion: nothing points at the room's magic (standing operator
   rule).** The shelf items, grabbing them and their breakage — and the room's
   other discoverable delights — are immersion, and immersion dies the moment
   it is pointed at. Nothing anywhere names, labels, hints at or exposes them:
   no "Rehearse breakage" control (not even in dev builds); no meta captions
   or status labels on the scene ("Here with you", "An imagined sky" and the
   like); no copy, welcome, greeting, card, story or caption mentioning
   shelves, trinkets, grabbing or breaking. Discovery is the customer's.
5d. **Seasonal treats.** Cookies are only seasonal (Halloween, Christmas);
   outside those seasons her table offers macarons instead — the treat, its
   bite sound and its sign follow the season (operator: this part was lost).
   The wheel's legibility work never makes the chart darker or blurrier than
   before (operator observed a coder's interim build doing both).
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



VERIFY at 1440×900, 1280×720 and 390×844 in the dev server (/app.html signed out): floating and focused states; state exactly what you observed for each defect you own.
