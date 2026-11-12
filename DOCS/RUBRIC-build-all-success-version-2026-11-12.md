# build_all additional success increment — observation rubric

Authored before architecture and implementation, 2026-11-12.
Authority: Robin's current instruction; Admin-Manual CC2 v1.1, commit 55d6662.

1. The executable diff changes only `build_all.sh`: keep all existing increments,
   epoch-day `% 10000` computation, preparation, publication and packaging intact.
2. The final native child returns to the shell. Only a zero exit from the entire
   existing pipeline reaches the additional automatic MINOR increment.
3. The extra increment reads the canonical version, retains MAJOR, adds exactly
   one to MINOR and recalculates BUILD from UTC epoch days `% 10000`. It takes no
   manually supplied version. Persist `version.json` and `version.txt` together.
4. Built artifacts keep their build-time version. The next source version has
   `builtAt: null`. Console output distinguishes the built and next source values.
5. Commit and push the extra increment immediately. Do not suppress either
   failure. Do not change numbering code in any helper or other repository.
6. An isolated shell regression run observes one success increment and observes
   no extra increment on native failure, preserving its nonzero status. Observe
   the computed BUILD and both canonical files, plus commit/push behavior.
7. Run only `./build_all.sh` for the real pipeline on asrock; record the actual
   automatic stamp and build log. Distinguish started, published and completed.
8. Observe the published badge in a browser and record a screencast of the
   terminal/build-version observations under `DOCS/DEMONSTRATIONS/`. No claim
   that the unrelated layout defects in the operator's screenshots are fixed.
9. Save the requested timestamped change table in `DOCS/`, with repositories,
   files, changes, commits, KStore receipt and actual build/next-source status.

Command checks support these observations; they do not substitute for the real
build or the observed terminal/browser evidence. A running build is reported as
running, never as a completed success increment.
