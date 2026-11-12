# Additional build-success MINOR increment observations

Observed on asrock, 2026-11-12. Executable change: f1b1dab, only build_all.sh.
Shell acceptance evidence: shell-regression.json, published in f306287.
Desktop/phone live version evidence: published in 7efd9f1.

| Rubric checkpoint | Observed evidence | Status |
| --- | --- | --- |
| 1: preserve existing numbering/code | Regression receipt prefixByteIdentical=true against f1b1dab parent; source diff only build_all.sh | Passed |
| 2: success boundary | Actual tail executed after simulated native return0; return37 exits before it | Passed isolated behavior |
| 3: automatic increment/BUILD | Success fixture1.31.768→1.32.769; current epoch days%10000=769, canonical files agree | Passed isolated behavior |
| 4: built versus next source | Fixture console names both; builtAt=null for next state | Passed isolated behavior; real full build pending |
| 5: persistence/publication | Real fixture Git commit reached its local bare remote; implementation/evidence pushed to GitHub | Passed |
| 6: regression shell run | bash -n exited0; success exited0 and failure37, no failure writes or extra commit | Passed |
| 7: real canonical invocation | ./build_all.sh launched on asrock; actual stamp1.32.769, automatic commit9a2945e pushed | Started; native pipeline running |
| 8: badge observation | Both live purchased domains HTTP200, badges v1.32.769; screenshots inspected | Passed version observation |
| 9: change table | DOCS/build-all-success-minor-increment-changes-2026-11-12T20-03-00Z.md (root-owned) | Published separately |

| Recording | Seek point | Observation |
| --- | --- | --- |
| [Terminal observations](terminal-version-observations-running.mp4#t=7) | 00:07 | Actual previously recorded regression receipt displayed in a real terminal; tests are not rerun |
| [Terminal observations](terminal-version-observations-running.mp4#t=12) | 00:12 | Real canonical build transcript and running-pipeline attribution |
| [Terminal observations](terminal-version-observations-running.mp4#t=15) | 00:15 | Current canonical version and native inventory; completed success is not claimed |
| [Published badge walkthrough](published-version-walkthrough.mp4#t=6) | 00:06 | astronatally.com at1280×720, visible v1.32.769 |
| [Published badge walkthrough](published-version-walkthrough.mp4#t=10) | 00:10 | asknatally.online at390×844, visible v1.32.769 |

The terminal video is an observation of actual receipt/log/files while the full
build is running; it does not claim the success tail has run in that pipeline.
The native helper writes separate per-target logs in dist/natally-v1.32.769/logs/.
The continuous actual command output and timing are canonical-build-terminal.txt
and canonical-build-terminal.timing; these remain live until the pipeline exits.
No unrelated layout repair or product journey acceptance is asserted.
