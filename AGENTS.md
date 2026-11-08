# Clean-room one-shot Natally rewrite — rules

1. Clean room: implement from DOCS/ARCHITECTURE.md and public API knowledge
   only. Never read source of `natally-ai-studio` or any `abandoned-*` repo.
2. Media assets imported byte-for-byte from the original `public/**` are the
   only reuse; no code reuse.
3. Billing: Chargebee. Credentials resolve at runtime via `kstore://`
   pointers; `.env` stays pointer-only; unconfigured billing errors
   truthfully — never a dummy flow.

10. Rubric before architecting; screencast-demonstrated proof: every feature
    gets a preauthored observation rubric (DOCS/RUBRIC-*.md) BEFORE design or
    code; acceptance is a recorded screencast against every rubric checkpoint
    (DOCS/DEMONSTRATIONS/). Static inspection and lint never substitute.

11. Every web publish goes to BOTH the dated custom domain and its
    surge.sh alias simultaneously (e.g. natally-8nov2026.robin.mba AND
    natally-8nov2026.surge.sh) — the alias is the fallback that keeps the
    site reachable when the custom domain has cert/DNS trouble.
4. No placeholder functionality, mock customer experiences, dummy payments,
   or invented customer data.
5. No greps; no verification runs by the orchestrator; coders locate only
   what they edit within owned files.
6. Commit and push after every completed task (provisional, walkable back).
7. Staging-domain deploys only until a real purchase works end-to-end.
8. Do not look, do not check, do not remove: write what is correct,
   idempotently.
