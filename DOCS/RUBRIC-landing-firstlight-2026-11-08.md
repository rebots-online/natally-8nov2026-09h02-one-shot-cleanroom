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

## Current repair acceptance — latest operator corrections

These are pending behaviors, not evidence of completion. This section
supersedes the earlier per-route recording format: acceptance requires ONE
continuous recording of the real interactions, with every checkpoint mapped
to a timestamp. No tests substitute for this recording.

R1. Double-click and rapidly select different placements while Natally speaks:
only one utterance is audible; the previous voice, mouth and karaoke timeline
stop before the replacement starts. Streaming chunks of one utterance remain
continuous rather than cancelling one another.
R2. In automatic presentation, explain successive wheel elements: after each
explanation settles, focus returns to Natally between explanations. An explicit
manual view selection is not overridden by late speech callbacks.
R3. House-division bars, degree numbers and gold structural dividers remain
bright and visible both at rest and during placement emphasis.
R4. Hover an aspect chord: identify both bodies, aspect kind and orb. Click it:
the selected relationship drives Natally's explanation and chart focus.
R5. The header remains compact and aligned, without wasted vertical space;
wordmark and primary action remain readable on narrow and wide screens.
R6. Greeting, lesson and closing speech do not contain the immersion-breaking
example/prediction disclaimers or pitch framing the operator ordered out.
R7. Each finished change has its own meaningful commit and confirmed GitHub
push. Only build_all.sh generates the next version; both dated staging hosts
receive the same build. natally.robin.mba remains untouched.

## Native packaging run

N1. One canonical invocation stamps once, builds web and publishes the same
version to both dated staging hosts before starting any native compiler.
A web build or either publish failure exits before native jobs start.
N2. Linux produces AppImage, deb and rpm; Windows produces its executable
and NSIS installer; Android produces a production-signed APK, AAB and matching
native debug symbols. Every available artifact is staged under root dist
in the version's own directory with SHA-256 and honest per-target status.
N3. Native windows open app.html from the bundled current frontend, not an old
hosted application. Existing product identity, mascot and signing certificate
are preserved. Packaging success does not imply the reading/purchase gauntlet
has passed.
