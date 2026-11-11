# POLISH-CHART-3D — recorded observations, 2026-11-11

Renderer source: `b6b1b88` (preceding geometry checkpoint `109e40e`).
Actual development origin: `http://127.0.0.1:5192/app.html`.
This is a renderer task record, not product-wide acceptance or a deployment.

The recordings use real Chromium rendering and pointer/keyboard actions. They
have no audio track and do not establish auditory speech-quality acceptance.
The two matrix captures precede the final secondary-label snap correction;
the minimum-size/Neptune-selection capture includes that correction. The 3D
marker geometry is the same in all three recordings.

## Observed

- Small transparent glyph faces sit over actual dark, lit 3D jewels. The
  painted flat-circle/crown treatment has been removed. The rounded purple
  torus, reflected sun glint and exact surface-following gold ticks remain.
- The neighbouring Saturn/Uranus/Neptune markers all remain visible. Height
  lanes separate close bodies; fine leaders retain their true longitude
  anchors. Secondary labels can yield space; bodies do not enter the
  suppressible declutter registry.
- All three viewport sizes rendered in floating and focused states at DPR 1
  and 2. Backing pixels follow the displayed box and DPR, including
  398×367 → 796×734 at DPR 2 and 178×147 → 356×294 on the phone inset.
- Real Alt+Left resizing reached a 96×96 outer inset at (12,63). A normal
  reload restored that exact size and position.
- A real pointer hovered the close Neptune marker at approximately
  (254.8,513.8) in the focused desktop view. The actual tooltip identified
  `NATAL ♆ Neptune (7° Cap)` and `07°30' Capricorn (Rx) in House 1`. Clicking
  selected that marker. The selected screenshot retains contrast on the
  surrounding glyphs and the wheel structure.
- `npx tsc --noEmit` exited 0 after the completed renderer edits.

## Recording navigation

Times below are approximate capture points, within about one second. Seek
slightly earlier to see the transition rather than just the still frame.

| Recording | 1440 floating | 1440 focused | 1280 floating | 1280 focused | 390 floating | 390 focused |
| --- | --- | --- | --- | --- | --- | --- |
| [DPR 1](chart-3d-dpr1.mp4) (33.16 s) | [0:07](chart-3d-dpr1.mp4#t=7) | [0:12](chart-3d-dpr1.mp4#t=12) | [0:18](chart-3d-dpr1.mp4#t=18) | [0:25](chart-3d-dpr1.mp4#t=25) | [0:28](chart-3d-dpr1.mp4#t=28) | [0:32](chart-3d-dpr1.mp4#t=32) |
| [DPR 2](chart-3d-dpr2.mp4) (88.60 s) | [0:21](chart-3d-dpr2.mp4#t=21) | [0:45](chart-3d-dpr2.mp4#t=45) | [1:00](chart-3d-dpr2.mp4#t=60) | [1:18](chart-3d-dpr2.mp4#t=78) | [1:23](chart-3d-dpr2.mp4#t=83) | [1:27](chart-3d-dpr2.mp4#t=87) |

[Minimum-size, reload and Neptune selection](chart-3d-minimum-selection.mp4)
records the additional real interactions. Representative stills:
[400 px floating](chart-3d-first-1440.png),
[96 px minimum](chart-3d-minimum96.png),
[selected Neptune](chart-3d-neptune-selected.png),
[phone focused at DPR 2](chart-3d-390-dpr2-focused.png).

## Pending integration observation

The renderer now clears its `localAspectFocus` latch when `focusSequence`
changes with empty external highlighted/selected/selectedPlanet props. A real
speech-completion → shell clear → neutral-wheel recording remains pending the
shell integration. The selection recording reaches actual speech preparation;
it is not claimed as proof of completed playback or neutral reset. No synthetic
reset event or injected component props were used to manufacture that proof.

## Secondary annotation follow-up

Self-review of the preceding matrix identified crowded Saturn/Uranus degree
strings and oversized IC text. The follow-up keeps the same 3D marker style
and exact anchors. It projects label bounds using camera-space depth, the
camera projection matrix and world scale, reserves six CSS pixels between
boxes, includes visible endpoint cards as obstacles and defers secondary text
when no in-canvas slot is clear. IC/ASC labels use a smaller authored size;
body markers never enter this suppression pass.

Actual before/after captures were taken on port 5192 at 1440×900, DPR 2, with
the browser's reduced-motion preference enabled so the wheel holds the same
orientation for comparison:

| State | Before | After |
| --- | --- | --- |
| 400 px floating inset | [Before](chart-labels-before-floating-1440-dpr2.png) | [After](chart-labels-after-floating-1440-dpr2.png) |
| Focused chart | [Before](chart-labels-before-focused-1440-dpr2.png) | [After](chart-labels-after-focused-1440-dpr2.png) |

The after-focused capture shows the 27° Sag and 25° Sag strings in distinct,
clear slots, with IC at a comparable scale to neighbouring labels. The
Saturn/Uranus/Neptune bodies remain visible. `npx tsc --noEmit` exited 0 after
this follow-up. This is annotation-layout proof; the speech-completion reset
integration remains the separate pending observation described above.
