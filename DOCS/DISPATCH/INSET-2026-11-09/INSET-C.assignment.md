You are the coder for task INSET-C in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §16 (entity registry) for names, and the files you own plus the files you must call into (read-only). Never read git history, dist/, other repositories, or any *-original/** file you do not own.

HARD RULES
- Edit only your owned files: src/atelier-original/components/Astrolabe3D.tsx. Any other change is rejected.
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
| INSET-C | `Astrolabe3D` (deliberate local additions to the frozen port, §16.12): mark house spokes, house numbers, sign ring/ticks, degree marks `userData.wheelStructure` and exempt them in the focus-dim traverse so only bodies, glyphs and aspect lines de-emphasise; add `onComponentTap` fired from the existing click/tap path on a hovered component (never on drag), reporting target names per the interfaces (aspect lines included); make `highlightedComponents` accept those names (map internally where ids differ). Keep raycast selectability and callouts of aspect lines. | `src/atelier-original/components/Astrolabe3D.tsx` | ⬜ |

ARCHITECTURE CONTEXT (target state; behaviour authority)
- `atelier-original/components/Astrolabe3D.tsx` — the original three.js wheel
  (117 symbols): tiered renderer (WebGL/SVG fallback), pointer picking with
  hover analytics episodes, inset-aware layout, callouts. **Target (deliberate
  local additions to the frozen port, registered in §16.12):** the focus-dim
  traverse exempts the whole wheel structure — house spokes, house numbers,
  sign ring and ticks, degree marks — by `userData.wheelStructure`, so only
  bodies, glyphs and aspect lines de-emphasise; `highlightedComponents` is
  driven from `presentation.focusTargets`; aspect lines keep their raycast
  selectability and callouts (natal↔natal solid, now↔natal dashed; no now↔now
  by design); a click on a hovered component reports the hit to the shell,
  which swaps the view and speaks (§4), instead of selection only.



VERIFY: for behaviour you own, run the dev server (`npm run dev`, port shown in output) and exercise the contract in a browser or by targeted reasoning over the actual code path; state exactly what you observed. Acceptance is by observed behaviour, not by code presence.
