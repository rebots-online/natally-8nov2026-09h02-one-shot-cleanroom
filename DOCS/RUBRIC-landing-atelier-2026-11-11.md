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
   cards room to breathe. The floating chart starts at the top-left at about 400 CSS px on
   desktop and 180 CSS px on a phone. The operator-sized top-left inset in
   Screenshot from 2026-11-11 04-02-51.png is the geometry reference,
   subject to the available stage. Drag a
   corner down to 96 CSS px: no old body-count or glyph-size calculation
   forces it larger, no automatic view inversion defeats the choice, and the
   compact geometry survives reload. Below 160 px it is a clean thumbnail;
   focus or selection restores detailed annotations without crowding it.
9. **Crisp chart.** Observe floating, minimum-size, focused, and swapped-back
   states at device pixel ratios 1 and 2. The canvas is rendered at its actual
   displayed size and pixel ratio; glyphs, degree text and Earth are crisp.
   Compact presentation may defer crowded degree annotations until focus or
   selection, but visible glyphs remain distinct and their labels accessible. At the
   approximately 400 px reference size, overlapping sign/body/house badges and
   degree labels are still a failure: simplify the visual hierarchy and reveal
   secondary annotations on hover/selection rather than draw a jumble.
    Markers retain their sculpted three-dimensional bead/medallion appearance:
    smaller high-contrast glyphs, no large flat cartoon stickers. Close bodies
    may occupy different modest heights above the ecliptic with fine leaders
    to their true longitudes. Every body remains visible and selectable.
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
    Captions show the current sentence (at most one adjacent sentence if it
    fits), capped at two actual text lines and rolling with the active word;
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
15. **Cards are short spoken steps.** After a real audio-admitting gesture,
    settle on each landing card: Natally reads that card with mouth movement
    and bright word-synced karaoke. Cards carry one idea in no more than two
    short sentences; prices and required facts remain exact. Move quickly
    across cards: only the settled card speaks, with no stale queue or second
    simultaneous voice. The active card's text highlights in time and the
    stage caption remains the two-line current-sentence window. Returning to
    a card reads it again after a real leave/re-entry; stationary cards do
    not repeat. A chart selection outranks automatic card narration.
16. **Slow, irregular presence.** Observe at rest and with slow/fast pointer
    movement. Natally's decorative gestures run at half their former baseline
    speed, with smooth bounded irregular variations rather than a short
    repeating loop or jitter. Pointer/touch activity gradually influences
    movement and the time between spontaneous stories. Lipsync stays in real
    speech time; reduced motion, pause and hidden-tab behaviour still work.
17. **Optional device seed.** Pointer/touch input and fresh local randomness
    work without sensor permission. On a supporting secure device, explicitly
    enable device motion once: actual events perturb the same local seed.
    Denial, unsupported sensors and no events retain working behaviour; no
    automatic or repeated permission prompt. No raw pointer/sensor trail is
    stored or transmitted. Record an actual device grant separately from
    synthetic development probes.
18. **Varied stories with continuing lore.** Across repeated quiet episodes,
    observe different story premises and internal details in Natally's voice.
    An actually completed spoken story records its exact resolved version in
    her character lore; cancelled/never-spoken stories do not. Reload and ask
    about that episode: its recorded detail remains consistent. Guest and
    signed-in accounts have separate local lore; account change never exposes
    another account's lore. Storage failure is reported honestly. Stories
    yield to questions, chart explanations and card narration, never overlap,
    and do not reveal the room's discoverable mechanics.
19. **Table sign and brief marquee.** Outside seasonal cookie periods, the
    proportional idle sign reads “FREE FRESH MACARONS”. During a reading it
    briefly becomes the cinema-style souvenir marquee, with visible lights
    and a short original parade-music flourish when room sound is admitted;
    the real offer is US$30. Clicking opens the existing souvenir flow; no
    invented coupon or payment success. It returns to the idle sign, fits the
    table in full and inset rooms, respects mute/reduced motion, and leaves
    Natally, her caption and the chart usable.
20. **Status never moves the viewport.** Observe real voice download,
    preparation and synthesis start/finish. The small status/progress surface
    superimposes as translucent acrylic. Stage/inset bounds and scrollY stay
    unchanged as it appears/disappears; the MB/percentage and retry remain
    truthful. No whole-viewport reflow or jarring jump.
21. **Reading cleanup.** Complete a planet/aspect explanation, interrupt one
    with a new card/selection, then switch back to the atelier. At completion
    the old explanation's selection/highlights/dimming clear and the whole
    wheel returns to its neutral presentation. A stale completion never clears
    the newer interaction's highlights. Verify in focused and floating views.
22. **Real prebilling checkpoint.** In a normal supported browser, Google
    sign-in reaches the app in one flow. With zero Natally allowance, a
    model-backed question is denied without a grant/key spend. Redeem the
    operator's actual deployed admin code through the account UI: the real
    balance appears immediately, even before a managed key exists. Submit a
    chart question: a real per-user key is provisioned and a complete readable
    `openrouter/free` reply is spoken with karaoke. The key has a zero-dollar
    provider spend limit; no purchased credit or redemption is fabricated.
    Chargebee checkout remains unconnected for this checkpoint.
23. **Rate-limit distinction.** A temporary upstream 429 retains the question
    and yields a brief authored acknowledgement without invented chart
    analysis or charging for a failed completion. Retry honours Retry-After.
    Neither a 429 nor the provider's zero cost bypasses Natally's paid-or-admin
    redemption gate. The requested model remains exactly `openrouter/free`.
24. **Atelier pronunciation.** Hear a real generated sentence with “atelier”:
    speech says “ah-tell-YAY”; captions and visible copy retain “atelier”,
    and the active-word alignment remains correct.
25. **Checkpoint artifact set before billing connection.** After checkpoint22
    works, invoke the sole entry `build_all.sh` once. It stamps one version,
    deploys both purchased web domains first, then produces all available
    Linux/Windows/Android artifacts in `dist/natally-v<version>/` with the
    shared version and SHA-256 inventory. Observe login/redemption/read on
    the deployed build. Report missing/failed platform outputs explicitly;
    a successful web publish alone is not an all-platform build.
26. **Purchased-product native identity.** The canonical Tauri identifier, Android
    namespace/applicationId, Kotlin activity/plugin package and generated native
    bridge all resolve to `mba.robin.astronatally`. The production APK reports
    that application ID and the release inventory identifies the same bundle.
    The shared version is still assigned only by `build_all.sh`.
