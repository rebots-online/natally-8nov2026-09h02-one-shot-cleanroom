# Observation rubric — landing + first light (2026-11-08)

Preauthored BEFORE architecting (operator order). A checkpoint passes only when
observed live at http://localhost:5199 in a recorded screencast; static
inspection never substitutes. Screencasts land in
DOCS/DEMONSTRATIONS/<journey>-<date>/.

## LANDING (route /)

L1. Above the fold is the full interactive atelier: room scene visible with
    Natally present (not a plain image or empty backdrop).
L2. An inset natal chart panel floats over the scene, draggable, rendering the
    example chart (bodies, zodiac ring, aspect chords visible).
L3. While the explanation sections scroll, the inset visibly zooms/switches
    focus (at least two distinct zoom/switch moments choreographed to the
    copy); with prefers-reduced-motion it holds a composed static layout.
L4. Credit packs ($5/$10/$25) and souvenir ($30) render with correct Cr amounts
    (formatCr), CTAs lead into the app.
L5. No console errors; no failed network calls (except truthful 401s before
    sign-in).

## FIRST LIGHT (route /app.html, signed in, no chart yet)

F1. Welcome stage: full atelier scene, mascot, Natally's greeting line.
F2. Intake: birth date/time/place with live place search (real suggestions),
    confirmed place chip showing timezone.
F3. Casting: while the chart computes, an honest casting moment over the scene.
F4. Reveal: AstroChart appears with a warm one-line Sun/Moon/Ascendant reading;
    a single button enters the chat.
F5. Voice: after any user gesture, Natally's greeting/reveal line is spoken
    (streaming TTS); without a gesture the UI states voice is not admitted —
    never silently missing.
F6. Sign-in works end-to-end (Google popup returns into the app); billing calls
    from localhost pass CORS (no opaque CORS failures in console).
F7. Nothing covers or blocks interaction (all panels reachable, no full-screen
    overlay trapping input).

## Demonstration format

One screencast per route (landing, first-light), 30–90 s, showing every
checkpoint above in order, saved as DOCS/DEMONSTRATIONS/landing-8nov2026/ and
first-light-8nov2026/ with a one-line README per checkpoint timestamp.
