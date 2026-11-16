# Proposed missing Chargebee publication contract — 2026-11-16

Status: proposed operational amendment; not frozen, not permission to implement. Existing product behavior remains DOCS/ARCHITECTURE.md section9 and BILL-1. This fills the missing production placement of the already implemented current Node Chargebee router. Never overwrite the existing RevenueCat/Stripe service.

## Proposed exact deployment

- Existing Google project: rochemediaservices-infra.
- Existing region: us-west1.
- Separate Cloud Run service: natally-chargebee.
- Existing Artifact Registry repository: us-west1-docker.pkg.dev/rochemediaservices-infra/natally-billing.
- New image name: chargebee; immutable image digest and source commit recorded per release.
- Actual service URL is read from the successful Cloud Run publication response and propagated to VITE_BILLING_API_URL; never guess the generated URL.
- Runtime entry: existing node billing/server.mjs, PORT supplied by Cloud Run, startup on0.0.0.0. Existing current router and billing modules only, no code from an earlier repository.
- Current declared ledger target: FIREBASE_SERVICE_ACCOUNT_JSON.project_id, Firestore(default), existing collections per billing/ledger.mjs. Verify this matches the frozen account/ledger identity before publication; no database migration or switching.
- Existing actual private values: CHARGEBEE_SITE, CHARGEBEE_API_KEY, CHARGEBEE_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT_JSON, OPENROUTER_ADMIN_KEY, BILLING_KEY_ENCRYPTION_KEY; existing redemption values retained. Cloud Run references private Secret Manager versions. Public BILLING_ALLOWED_ORIGIN includes the approved natally.robin.mba origin. Preserve existing legacy service settings and secrets.
- The single canonical build entry stamps/pushes, publishes/validates the current backend before producing its frontend bundle, then publishes web and packages Android/Linux/Windows with one source identity. A backend failure stops web/native production. This is an explicit amendment to the current pipeline, which currently publishes only static frontend and native artifacts.

## Proposed entities and ownership

| Exact entity | Target | Role and exact contract |
|---|---|---|
| Chargebee image definition | billing/Dockerfile:1 | Node24 runtime; copy current billing directory and netlify/functions/chargebee.mjs; run existing billing/server.mjs. No dependency on a sibling checkout. |
| publishBillingRuntime | scripts/deploy-billing-runtime.mjs:1 | async publishBillingRuntime({sourceCommit,version}):Promise<{url,revision,imageDigest,sourceArchiveSha256}>. Build current committed source, publish separate service, verify public OPTIONS/auth behavior and actual provider configuration without synthetic payments; write truthful immutable publication inventory. Resolve existing operator cloud session and existing private settings; report actual provider failures. |
| canonical release backend stage | build_all.sh:1 | Invoke the one backend publisher after source identity/configuration is established and before Vite. Use returned public URL in that same build process. Existing automatic version/cross-platform order and post-success source advance remain. |
| backend publication inventory | dist/natally-vVERSION/billing-inventory.json | Public-only version, sourceCommit, source archive digest, imageDigest, revision, actual URL, publication state and observation times. No secret material. |

## Required acceptance

Preauthored billing-release-observation-rubric.md governs customer behavior. The existing product purchase amounts and flow remain unchanged. A current deployment does not itself certify a paid Chargebee invoice, actual webhook grant, allowance refresh/resend or souvenir delivery. An actual payment is separately approved at its concrete checkout; no invented customer/payment or manual grant stands in for it.

Before coder assignment: operator confirms this missing runtime placement, architecture is amended/frozen, checklist translates the exact entities and deployment environment, and independent semantic review is recorded. This proposal intentionally does not run a new production service or author shipping deployment implementation before that boundary.
