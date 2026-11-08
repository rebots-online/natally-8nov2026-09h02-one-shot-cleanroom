# Handoff — 2026-11-08 Natally pause (operator switching projects; resume in a few hours)

Repo: ~/natally-current → ~/github/natally-8nov2026-09h02-yetanothercleanroomrestart
(origin github.com/rebots-online/natally-8nov2026-09h02-one-shot-cleanroom, PUBLIC;
staging https://natally-8nov2026.robin.mba + https://natally-8nov2026.surge.sh, last
deployed build v1.12.765; journey screencast still pending Robin's sign-in.)

## In flight at pause (self-committing, no deploy after)

- W15Onboarding2-2/3 (landing): PARITY REBUILD directive — landing becomes the
  original's minimal product architecture (scene + inset example chart with
  ⠿ Move-chart handle + sound toggle + 'Explore a placement' selector over the
  Aurelia example chart + single CTA 'Create your natal chart ↗' + badge),
  marketing sections removed. Queue also: inset-vanishes-on-scroll (top),
  wordmark brand-size, callout tether+proximity, inset full-viewport drag,
  inset resize, scroll cue, copy contrast panels, in-app top menu bar.
- W17Voice (src/voice): ?voice= audition override, non-accented high kawaii
  speaker default, rate 1.15, VOICE_CANDIDATES export.

## Resumption sequence

1. git pull; check both slices landed (individual commits).
2. npm run lint → bash build_all.sh → dual-publish both hosts (version stamp
   auto-increments).
3. Live-verify against https://natally.robin.mba (the parity bar): scene,
   inset present at all scrolls, explore-placement selector works, CTA,
   badge; then Robin auditions voices via ?voice=FN.
4. Then the F-journey screencast (sign-in authorized on staging).

## Known open beyond that

- Chargebee keys absent from KStore → purchase UI truthful-unconfigured;
  redemption (Ch4n3l.C3351) path live.
- Ephemeris API parked (auth removed; engine loader uncommitted-work is in
  the tree? no — committed as labeled checkpoint 92abdc3).
- Original repo (CascadeProjects/natally-ai-studio) untouched since the
  billing-repair morning; its own CHECKLIST items (BILLING-HOST purchase
  proof etc.) remain as recorded there.
