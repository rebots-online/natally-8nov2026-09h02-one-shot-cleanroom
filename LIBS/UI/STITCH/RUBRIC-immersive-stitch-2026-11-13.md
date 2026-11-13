# Observation rubric — immersive Stitch implementation

Repository: **rebots-online/astronatally**. Base: `04322e9a0647ab17cb20eb342f493f20c05bc1cb`.
Authored before revised design or implementation. The operator's 2026-11-13
instructions supersede conflicting historical composition and build rules.

## Design and implementation evidence

1. Preserve a new Stitch representation of the current UI, including the
   obstructing first-light screen. Label it baseline, never revised or frozen.
2. Write a PRD covering every existing screen and state, its function, exact
   copy, each element's reason for existing, position, appearance, and failure
   behavior. Record the target-market rationale as a hypothesis, not proof of
   adoption or recommendation.
3. Translate every PRD requirement into the architecture and checklist. Record
   the actual Stitch project/screen identifiers and downloaded HTML/images.
   Freeze those exports with SHA-256 hashes before implementation begins.
4. Implement the actual exported screen structures, tokens, assets and copy.
   Record each required adaptation for React, live canvas, secure native auth
   or numeric package versions. Do not redesign the frozen prototype while
   wiring it. Retain the original exports unchanged beside the implementation.
5. Capture desktop 1440×900, short desktop 1280×720, phone 390×844 and narrow
   phone 360×640. Compare each implemented state with its corresponding
   exported prototype. Record mismatches; do not call a mismatch faithful.

## Observable product contracts

6. First paint shows the live atelier. Header is compact, account photo bounded,
   no duplicate Natally portrait, welcome modal or opaque marketing gate.
   Natally's face, crystal ball, chart and caption keep separate usable space.
7. Existing stage swaps, wheel selection and explanations, speech boundaries,
   lipsync, inset movement/docking/resizing, gestures and reduced motion retain
   their existing service contracts. No instructional copy reveals room secrets.
8. Guest, invitation, intake, casting, sign-in, reading, account, top-up and
   keepsake surfaces preserve the visible interactive scene. On phones forms
   use a separate page region below the room; the keyboard must not force a
   form across Natally. No whole-screen backdrop blocks the experience.
9. Walk all Google/email/registration/reset/SMS/code states, all existing birth
   fields and unknown-time choice, chart calculation, casting failure/retry,
   reading/composer, account, prices, checkout, keepsake/PDF and native handoff.
   Report unconfigured external services honestly; never simulate a success.
10. Status is concise, truthful and nonblocking. Check voice download size and
    percentage, preparation, synthesis, error/retry and auth/network errors.
    Transient status never changes stage bounds or document scroll position.
11. Every visible word and control maps to a stated purpose. No unimplemented
    promises, invented testimonials, duplicate headlines, unnecessary logos,
    fake balance, paid grant, reading or purchase receipt. Customer chart and
    conversation remain real; a demonstration chart is not customer evidence.

## Build identity and delivery

12. The build field is `floor(epochMilliseconds / 60000) % 10000`; display it
    with five digits, including a leading zero. SemVer/native package metadata
    uses the equivalent integer. Never substitute epoch days, a counter, or a
    different modulo. Capture the epoch minute used by the build.
13. A build uses the source's current MAJOR.MINOR, shared by every artifact.
    Only after the entire required pipeline succeeds does source MINOR advance
    by one. A failed type gate, deployment or native target cannot advance it.
    Confirm the resulting source identity is ahead of the built release.
14. Run the canonical `build_all.sh` entry. Required existing matrix: both
    purchased web hosts, Linux x64 AppImage/deb/rpm, Windows x64 executable,
    NSIS and MSI, production-signed Android arm64 APK/AAB/native symbols.
    No macOS/iOS release target is defined by this repository.
15. Inventory actual files, sizes, hashes, release identity, per-target command
    results and logs. Earlier checked-in inventories cannot certify a new
    build. Distinguish compilation/package evidence, deployment evidence and
    live external-service observations. A missing target is incomplete.

## Recording

Save observations, screenshots and screencasts under
`DOCS/DEMONSTRATIONS/immersive-stitch-2026-11-13/`. Automated checks may
substantiate a contract but cannot replace the visual walkthrough. No claim
that the product has achieved market success follows from conformance alone.
