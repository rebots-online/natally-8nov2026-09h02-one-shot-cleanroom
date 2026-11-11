# Independent speech completion observation — 2026-11-11

Source checkpoint: `4e19107`, published to GitHub before these observations.
Runtime: fresh Vite `http://localhost:5192/app.html`, isolated installed Chrome,
1440 × 1000 CSS pixels, DPR 1. The actual local speech engine downloaded its
models, prepared speech and played the existing landing welcome and chart
explanations. Chart targets were selected with real pointer clicks. No
karaoke event, auth state, model response or completion was fabricated.

## Automated acceptance

- `node --experimental-vm-modules --test src/voice/index.test.mjs`: exit 0,
  11 tests passed. The actual controller module and exact production
  pronunciation region execute through Node 24.18.0 in-memory TypeScript
  stripping and controlled VM imports. These isolated tests cover successful
  final-queue completion once, unfinished-stream gaps, unadmitted speech,
  false/error including continuation before final flush, stop, supersession,
  idle-listener supersession, and pronunciation/source offsets beside degrees.
- `npx tsc --noEmit`: exit 0.
- The optional factory is captured immediately after streamed reply begin;
  signed-in, opening and landing paths pass their own captured completion.
  Reducer clear empties both target arrays and increments sequence even
  when already empty; view/follow fields remain unchanged by that action.

## Actual visual speech observation

`voice-complete-real-desktop.mp4` is the real screen recording (83.8 seconds,
5 frames/second). Capture ran while observation calls were active, so pauses
between calls are compressed; its playback time is not an elapsed-time or
speech-rate measurement. It contains these actual observations:

| Approximate video position | Observed behavior |
| --- | --- |
| 30 seconds | The House 9 explanation reaches its last sentence while its chart is foregrounded. |
| 36 seconds | The explanation has completed: the wheel is floating at the top left, no component is highlighted, and its caption is gone. |
| 54 seconds | The real Sun explanation advances original-word karaoke while the Sun is highlighted. |
| 60 seconds | A real click has interrupted the Sun and selected House 5; the replacement explanation advances with the Moon/house focus. |
| 66–72 seconds | The replacement explanation has completed; the floating wheel has no remaining target focus and the caption has cleared. |

Live read-only chart-prop observation during the first pass returned targets
`[]` / sequence 7 after House 9, `[Sun]` / sequence 11 during the Sun reading,
`[House 5]` / sequence 16 after interruption, then `[]` / sequence 20 after the
replacement reading. The attempted final timeline/audio export for that pass
stalled while closing the ad hoc encoder; these reported values are tool
observations, not a claimed successfully exported first-pass event file.
The MP4 itself is complete and readable by ffprobe.

`voice-complete-first-neutral.png` and
`voice-complete-neutral-after-interruption.png` are frames at 36 and 69 seconds
of that MP4. `voice-complete-sun-active.png` and
`voice-complete-interrupted-new-target.png` are actual browser screenshots
from the same interaction sequence. The latter is during replacement speech
preparation, before its first spoken words.

## Original atelier word during real speech

`voice-complete-atelier-live-caption.mp4` is a 16-second extract of a native
browser recording around the real welcome. Unlike the sampled first video,
this extract retains native recording time. At original browser time
41761.3 ms, the actual `natally-karaoke` event reports source word index 8
in the unchanged welcome sentence. The passive DOM sample at 41770 ms reports
`glowing: "atelier."`; the displayed word remains atelier.
`voice-complete-atelier-current-word.png` captures that active yellow glow.

`voice-complete-atelier-observations.jsonl` contains the exact incremental
passive source-word/DOM/target records from the additional welcome through
its completion. It is a literal successful-welcome segment of the original
observation log. The subsequent repeat browser was deliberately stopped to
avoid repeating the already successful chart protocol; that partial chart
reading and shutdown record are not used as completion evidence.

## Explicit remaining verification limits

Neither saved recording has an audio track. The WebAudio recording attempt did
not yield a usable audio export. The test proves atelier is sent to speech as
`ah-tell-yay` with source offsets preserved, and the real engine/DOM observation
proves its original displayed word is tracked; pronunciation sound quality has
not been auditioned. No signed-in Google/OpenRouter conversation was performed
in this independent voice task. No phone-specific speech recording, full
product build, deployment, billing or provisioning change is claimed here.
