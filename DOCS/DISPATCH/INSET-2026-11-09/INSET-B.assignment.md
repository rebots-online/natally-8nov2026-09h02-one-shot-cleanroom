You are the coder for task INSET-B in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §16 (entity registry) for names, and the files you own plus the files you must call into (read-only). Never read git history, dist/, other repositories, or any *-original/** file you do not own.

HARD RULES
- Edit only your owned files: src/app/presentation/explain.ts, src/app/chat/context.ts. Any other change is rejected.
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
| INSET-B | `src/app/presentation/explain.ts` (new): `ExplainSource`, `aspectTargetName`, `involvedElements`, `explainTarget` per the interfaces; passage composed from `content/lessons` + `chart/liveReading` placement statement (authored; no inference; no placeholders) with cues for every involved element, moving element by element, `[[chart:clear]]` at the end. `src/app/chat/context.ts`: `chartTargets` enumerates aspect lines via `aspectTargetName` (natal and now↔natal); `presentationBlock` tells her to bring the chart forward, highlight involved elements, clear between emphases. Register nothing beyond §16 rows. | `src/app/presentation/explain.ts`, `src/app/chat/context.ts` | ⬜ |

ARCHITECTURE CONTEXT (target state; behaviour authority)
- `state.ts` — `presentationReducer` over `PresentationState {chartKey,
  focusTargets, view, follow, sequence}`: `focus`/`clear` set highlights, `view`
  swaps chart⇄atelier, **a manual view choice sets `follow:false` and automatic
  view cues stop**; `chart` resets on a new chart key. **Target:** `focusTargets`
  reach the wheel as its highlight list (`Astrolabe3D` `highlightedComponents`),
  not only as one `selectedPlanetName`; targets include aspect lines
  (`"Sun trine Moon"`, `"now Mars square Venus"`) so she can highlight and
  explain relationship lines (natal↔natal and now↔natal only — now↔now is
  excluded by design: the current sky aspects itself continuously and would
  cover the wheel with lines carrying no personal information).
- `explain.ts` — **new** `explainTarget(target, chart, sky)`: composes her
  spoken passage for a tapped component (`content/lessons` +
  `chart/liveReading` placement statement) with cues for every involved
  element (`involvedElements(target, chart)`: the body, its house, its sign,
  its aspect lines), then hands it to the same driver as a reply so `view:
  chart`, highlights and speech move together. No inference. Used by the
  shell's tap handler and available to the opening.
- `context.ts` — builds the OpenRouter wire messages: persona system prompt
  (`content/persona`), chart facts, target inventory + cue instructions
  (`presentationBlock`), backstory answers, last `MAX_CONTEXT_MESSAGES` (20)
  turns. **Target (inset):** `chartTargets` also enumerates aspect lines
  (`aspectTargetName`, natal↔natal and now↔natal) so her cues can address
  them; `presentationBlock` instructs her to bring the chart forward,
  highlight the involved elements and clear between emphases. The information
  levels (unpaid/paid) are a separate issue.


VERIFY: for behaviour you own, run the dev server (`npm run dev`, port shown in output) and exercise the contract in a browser or by targeted reasoning over the actual code path; state exactly what you observed. Acceptance is by observed behaviour, not by code presence.
