# Onboarding continuity observation rubric — 2026-11-12

**CANCELLED as an acceptance gate by Robin, 2026-11-12.** Browser examples
cannot guarantee non-repetition. Current authority is ARCHITECTURE.md §23
explicit per-step boolean flags and its pre-questionnaire entry invariant.
The original observation protocol below is historical; no more browser work.


Authority: Robin's request to prevent accidental repeated onboarding, retain
finished sections after interruptions, and allow redo only through the profile.
Authored before the architecture amendment and implementation. Scope is the
isolated `codex/onboarding-resume` PR, not a web publication or native release.

Record the browser journey in `DOCS/DEMONSTRATIONS/onboarding-resume-2026-11-12/`.
Every checkpoint needs an observed result and a recording time reference. Test
identities and intercepted dependencies belong only to the verification harness;
label them explicitly. Such evidence does not certify live Google sign-in.

| ID | Setup and action | Required visible observation |
| --- | --- | --- |
| ONB-R1 | Open an account with its existing valid saved chart; reload, navigate away/back/forward, and exercise `pageshow` recovery. | The account opens its reading, without a welcome/questionnaire flash or repeated chart questions. No chart or progress is erased. |
| ONB-R2 | Begin with no chart; submit name and date, partly type a birthplace, then reload and reopen in a fresh tab of the same browser origin. | Resume at birthplace with the typed value retained. Name/date are retained and are not asked again. Complete only the missing sections. |
| ONB-R3 | Choose unknown birth time and explicitly skip current location; interrupt at final submission/casting. | These are saved answers, not missing data. Resume casting or the first genuinely missing section; no forced time/location question. |
| ONB-R4 | Type and delete text using Backspace; use the questionnaire's Back control, browser Back/Forward and a bfcache/page restoration. | Backspace edits the field. Deliberate backward navigation preserves answers and completion. Returning never starts a fresh questionnaire for a completed account. |
| ONB-R5 | Open Account, choose Redo onboarding, cancel its confirmation; then confirm a redo, interrupt it, and cancel it back to the existing chart. | Redo requires the explicit profile action plus confirmation. The existing chart remains available until replacement succeeds. Cancel preserves that chart. A confirmed interrupted redo retains its answers. |
| ONB-R6 | Switch between isolated accounts while a chart calculation is pending; resolve the old calculation afterward. | Each account has its own saved progress/chart. The old completion never changes the newly active account or writes its chart under the other UID. |
| ONB-R7 | Restore a record with one invalid section, malformed JSON, and denied/quota-exhausted storage in separate cases. | Retain independently valid sections where recoverable; ask for invalid/missing data only. Storage failures are visible and never falsely described as durable saves. |
| ONB-R8 | Successfully complete initial onboarding and a confirmed redo; reopen both. Include a legacy saved chart without a progress record and an unowned legacy session draft. | Completed accounts skip onboarding; legacy charts remain valid completion evidence. An unowned session draft is never attributed to whichever account signs in next. |
| ONB-R9 | Repeat the questionnaire, profile confirmation, and cancellation at 1440×900 and 390×844, including scroll to the final controls. | Prompts, answers, progress notice and all controls remain visible/reachable. Existing Natally styling and keyboard text editing remain intact. |

The coder's deterministic regression tests cover progress validation, first
missing section, UID isolation, durable-write failures and completion ordering.
Their exit status is supporting evidence; the recorded observations above remain
the behavioral acceptance protocol. Report any unobserved checkpoint plainly.
