You are the coder for task INSET-D in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §16 (entity registry) for names, and the files you own plus the files you must call into (read-only). Never read git history, dist/, other repositories, or any *-original/** file you do not own.

HARD RULES
- Edit only your owned files: src/app/AppShell.tsx. Any other change is rejected.
- New module-scope names must already appear in DOCS/ARCHITECTURE.md §16 (pending INSET rows). Do not invent other names.
- No placeholders, no TODOs, no mock data, no fake success paths. Anything unconfigured fails visibly.
- `npx tsc --noEmit` must be clean for the whole tree when you finish (do not edit other files to make it so; report a conflict instead).
- Do not commit or push. Report paths changed, a unified diff summary, the checks you actually ran with their exit status, and any decision you could not make (escalate instead of guessing).

FIXED INTERFACES (binding on every task; implement your side exactly)
## INSET — derived 1:1 from DOCS/ARCHITECTURE.md §4 inset card, §5 state/explain, §6 context target, §7 Astrolabe3D target, §16 pending INSET rows (commit c50a55c). Supersedes STAGE-6 (2) and (3); STAGE-6 (1) orientation panel stays separate.

Fixed interfaces (every task implements its side exactly; nobody edits another task's files):
- Target names: bodies `Sun`…; signs `Aries`…; houses `House 1`…`House 12`; aspect lines `aspectTargetName(a, kind, b, now)` → natal `"Sun trine Moon"`, now↔natal `"now Mars square Venus"` (kind lower-case; no now↔now lines exist by design).
- `InsetProps.onSwap?: () => void` (tap on the inset with no component hit) · `InsetProps.onComponentTap?: (target: string) => void` (forwarded to the chart's `onComponentTap`).
- `Astrolabe3DProps.onComponentTap?: (target: string) => void` fires on a click/tap over a hovered component (not drag) with the target name above; `highlightedComponents: string[]` accepts those same names.
- `explainTarget(target: string, chart: NatalChart, sky: SkyPlacement[] | null): string` returns her passage as reply text with embedded cues (`[[view:chart]]`, `[[chart:A;B]]`, `[[chart:clear]]`) so it flows through `parseReply` and the existing playback driver unchanged; `involvedElements(target, chart): string[]`; `ExplainSource = 'tap' | 'cue'`.
- `userData.wheelStructure = true` on house spokes, house numbers, sign ring/ticks, degree marks; the focus-dim traverse never dims objects carrying it.



YOUR TASK (from CHECKLIST.md)
| INSET-D | `AppShell.tsx` wiring: pass `highlightedComponents={presentation.focusTargets}`; `onComponentTap(target)` → `explainTarget(target, chart, skyToday)` fed to the same reply driver as a chat reply (view→chart, highlights, speech with lipsync) and ignore an `onSwap` arriving from the same pointer sequence; `onSwap` → `{type:'view', view: other, manual:true}`. No change to what she says beyond calling `explainTarget`. | `src/app/AppShell.tsx` | ⬜ |

ARCHITECTURE CONTEXT (target state; behaviour authority)
**The inset card** (`stage/Inset.tsx`) is the heart of the stage. Target
mechanics (INSET revision, 2026-11-09 — behaviour authority: Robin's rows in
`DOCS/TODO-LEDGER.md`; anchors: `DOCS/CODEMAP/inset-anchors-3f00f98.md`):

- **Two views, one stage.** The atelier (Natally) and her chart; one fills the
  stage, the other is the inset. `presentation.view` decides which; the chart
  is always rendered by `Astrolabe3D` inside `Inset`, Natally by the atelier
  pane, so a swap is a re-layout, never a remount.
- **Click acts on what hover has shown.** Pointer over a chart component
  (planet, sign, house, aspect line) highlights it; a click/tap on a
  highlighted component swaps the views (chart to the stage, Natally to the
  inset) and **Natally speaks** about that component, with lipsync, while the
  chart highlights every involved element (the planet, its house, its sign,
  its aspect lines) and the highlight moves with her words (§5). A click where
  nothing is highlighted swaps the views only. A drag moves the card and never
  swaps or selects. What she says, and how far (the unpaid/paid information
  levels), is a separate issue tracked in the ledger, not part of the inset.
- `explain.ts` — **new** `explainTarget(target, chart, sky)`: composes her
  spoken passage for a tapped component (`content/lessons` +
  `chart/liveReading` placement statement) with cues for every involved
  element (`involvedElements(target, chart)`: the body, its house, its sign,
  its aspect lines), then hands it to the same driver as a reply so `view:
  chart`, highlights and speech move together. No inference. Used by the
  shell's tap handler and available to the opening.


VERIFY: for behaviour you own, run the dev server (`npm run dev`, port shown in output) and exercise the contract in a browser or by targeted reasoning over the actual code path; state exactly what you observed. Acceptance is by observed behaviour, not by code presence.
