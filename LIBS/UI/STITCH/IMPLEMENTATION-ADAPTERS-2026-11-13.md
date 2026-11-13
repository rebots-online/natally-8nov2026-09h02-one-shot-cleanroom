# Frozen Stitch implementation adapters

Repository: rebots-online/astronatally. Authority: ARCHITECTURE §24.6 and the
52-state export in DOCS/STITCH/2026-11-13/revised at commit1f9c12a.
The frozen exports are unchanged. This file records bindings, not new design.

- `src/app/prototype/atelier-frozen.css` is the byte-identical exported
  `shared.css` (SHA2563d8dcfc54ce9243685c26960894ab31ba1ca97892eb59ebdc49233e674287c32).
  React syntax/event/data bindings replace the HTML prototype router. The shared
  wrapper owns header/stage/caption/status/rail/footer; task components emit only
  their exported heading and contents. Existing Back and Close get their exact
  arrow/name through the registered optional onBack binding.
- The image-only stage content becomes the existing live AtelierScene and
  Astrolabe3D/Inset. One AtelierScene DOM instance survives rail navigation;
  account UID, real calculated chart and presentation props update in place.
  Onboarding and conversation remain mounted but hidden while another task is
  active, preserving existing input/history. Actual auth/account changes still
  change the chart storage scope. No fake identity, allowance or paid record.
- Registered room/character composition keeps its existing2048×1280 calibration
  and bottom-contained1.6 aspect. CSS container sizing maps it to the exported
  image region; it adds no new art or motion. Existing scene animation timings,
  word/lipsync events and discoverable objects are preserved. The source room's
  old sound badge is visually replaced by the exported interaction-sounds button.
  That button writes only the existing `natally.atelier.sound-muted` foley gate;
  it does not claim to mute the independently hardcoded ambience engine.
- Existing Inset compact initial geometry becomes square260px at left16/top76
  desktop and132px at left12/top12 phone, with its original30px grip chrome and
 96px minimum. Existing stored manual geometry, docking, keyboard move/resize,
  wheel gestures and click/swap/highlight callbacks remain. Renderer-owned
  classes are mapped to the export's borders/chrome/focused area by shell CSS;
  the frozen stylesheet itself is unchanged. Actual moving3D contents naturally
  differ from the static renderer preview; no screenshot covers the live canvas.
- The old separate stage/conversation layout becomes the exported side/below
  task rail. Guest six-section content, header/menu/account and reading use exact
  exported words/classes. The existing authored notebook lives under Chart notes.
  A failed send retains the unanswered draft in the composer; the request/SSE,
  allowance and provider algorithms are unchanged.
- The registered AllowanceView loading/error fields and existing micros formatter
  now expose actual pending/failure/zero separately, with the required
  `natally-allowance-changed` refresh listener. There is no change to API calls,
  request bodies, grants, paid access, model choice or allowance policy.
- Existing voice download/preparation/MB/percentage/retry logic stays intact.
  Its compact status presentation uses the frozen size/tokens and44px Retry;
  existing placement now also avoids the new header and actual artwork region.
  The64px caption region remains borderless/transparent while empty and uses the
  existing measured two-line real-word events while speaking.
- index.html, app.html and legacy landing.html resolve to the same AppShell.
  Existing query/fragment auth handoffs and padded displayVersion remain. The
  retired marketing source is preserved and is not another live app entry.
  Initial HTML shows the actual room in the same frozen frame while auth/script
  loading resolves; it contains no independent mascot splash or welcome blocker.

Initial development observations at1440×900 and390×844 match exported header,
stage/rail and inset geometry, with one scene, no horizontal overflow and no page
errors. Save-Data was enabled for those composition captures to avoid an unrelated
voice-model download. They are UI observations, not external login, payment,
completed spoken-reading or packaged-build certification.

Final QA corrections: the focused room inset scales the entire existing
2048×1280 scene, including HTML object labels, into the exported140×88 /
116×74 region. Only containment CSS changes; it remains the same live scene.
The existing guest chart-focused view renders the already frozen S01-chart
rail with its explicit demonstration context. Returning to the room restores
the prior landing task; authored explanations and manual view pins are unchanged.
