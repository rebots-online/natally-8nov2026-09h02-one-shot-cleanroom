# Request for token/quota credit — 2026-11-08 session

**Account holder:** Robin Cheung
**Date of session:** 8 November 2026 (America/Toronto)
**Project:** Natally clean-room rewrite — repository `rebots-online/natally-8nov2026-09h02-one-shot-cleanroom`
**Agent:** coding-agent orchestrator plus spawned coder subagents

## Summary

A large share of the session's token spend went to work the agent itself caused to be wasted or repeated: it acted outside the operator's stated process, made claims it had not verified, and redid the same work several times. The operator corrected these repeatedly. I am requesting credit for the wasted portion.

## What happened (factual, from the repository and session record)

1. **Process not followed.** The operator's standing rule is architecture first, then checklist, then coders implementing only what is written. The agent repeatedly wrote code itself, edited copied files and changed behaviour outside the architecture. Each instance was later reverted or redone.
2. **Clean-room violations.** The agent copied internals from the original codebase into the clean-room repository (the presentation and chat parser modules), which defeats the purpose of the clean room. The copies were reverted uncommitted, and the work was redone from the architecture.
3. **Unverified claims presented as fact.** Examples the operator caught: a production landing reported as "broken" when it had simply not finished loading; a double-image defect attributed to an agent's in-progress work when the repository contained none of that work; a "best candidate" demo date that was not the top-scored result; a billing-server "not configured" finding repeated from a sub-agent without checking the live site.
4. **Invented mechanisms.** The agent added a commit-hash label to the version badge and then proposed a source-hash scheme, instead of using the established `version.json` stamp. Both were reverted (commit `0aa4385`).
5. **Duplicate and orphaned coder runs.** A coder worked in an untracked `/tmp` copy, so its correct result never reached the repository. Two coders were active on the same component at once. Coders were killed and re-dispatched several times because of rate limits and mis-scoped tasks.
6. **Specs written as literal rules, then corrected repeatedly.** The inset placement rule went through several amendments in sequence (fixed corner → face-avoidance → minimal overlap → intent with ranges → size floor → card movement → docked layout) because the first versions stated fixed numbers instead of intent.
7. **Native packaging run on known-defective builds.** Full platform builds were run while open product defects remained, against the operator's instruction.

## Evidence

- Commit history of `rebots-online/natally-8nov2026-09h02-one-shot-cleanroom`, 8 November 2026: the many "Architecture+Checklist" amendment commits, the revert commits and the "Checkpoint (NOT complete)" commits.
- `DOCS/INCIDENTS/2026-11-08-orchestrator-unverified-completion-claims.md` and `2026-11-08-enforcement-derivation.md` in the operator's Admin-Manual.

## Request

Credit for the tokens consumed by the reverted, duplicated and redone work described above. The session's own usage records will show the totals; the operator can supply the session identifier on request.
