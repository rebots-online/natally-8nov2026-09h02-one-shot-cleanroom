# Merged-master web publication attempt — 2026-11-15

Operator instruction: merge outstanding PRs and deploy the site as is from merged master.

GitHub showed zero open PRs. PR 2 was already merged into the build branch rather than master. The guided-character branch contained the completed source and was 102 commits ahead of origin/master with no divergence. Master was fast-forwarded to 5f32892 and pushed to the configured GitHub origin.

The existing sole entry was invoked: `./build_all.sh --web-only --web-domain natally.robin.mba`. This domain is the current frozen release destination in DOCS/ARCHITECTURE.md, superseding earlier domains.

- First invocation stamped and pushed 3b47ee7, v1.52.12960. Credential validation rejected the local retired Netlify billing URL before building.
- KStore admin-manual record PROJECTS/Natally/INFRA/billing-runtime.md identifies the existing service https://natally-billing-bd2e6ftjfq-uw.a.run.app. Its /billing/health endpoint returned HTTP 200 and service status ok. This establishes availability only, not checkout compatibility or successful purchase.
- Second invocation supplied that recorded endpoint through process-only VITE_BILLING_API_URL. It stamped and pushed 743f90c, v1.53.12961. Vite completed the production web build.
- Surge authenticated as robinsai.world@gmail.com and rejected publication: "you do not have permission to publish to natally.robin.mba". The account project list does not include natally.robin.mba.
- The web output, archive and pending publication inventory remain under dist/natally-v1.53.12961/. No native packaging was requested or run. The post-success source advance did not run.

No application implementation was changed. Existing untracked work and historical artifacts were preserved. The requested deployment has not completed; the public site was not updated by this attempt. Next action is authorizing the configured Surge account for natally.robin.mba, or supplying the existing owner account through private credential configuration, then rerunning the canonical entry. No temporary alternate domain was substituted.
