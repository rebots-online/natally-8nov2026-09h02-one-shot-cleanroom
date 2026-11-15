# Canonical build-script observation rubric — 2026-11-15

Operator scope: compliant scripts, global reusable template, full build.
This replaces the obsolete epoch-day clauses in the November12 rubric for
this repair. Authoring records source contract; no observation is claimed here.

1. Canonical stamp increments MINOR; BUILD is epoch minutes modulo100000,
   padded five digits; version.txt authority and JSON/manifest projections agree.
2. Each stamp commits/pushes immediately with version prefix; failures stop.
3. Invalid arguments fail before writes; web-only skips native prerequisites.
4. Exactly one web bundle publishes to the configured current release domain
   before native packaging; actual publication outcome is recorded truthfully.
5. Native artifacts retain that shared identity, configured production Android
   signer, monotonic code and legal MSI projection; all target outcomes retained.
6. Whole-pipeline success alone advances next source; builtAt is null for source.
7. Global template retains the implemented control flow and canonical stamper
   lineage; project settings are explicit; future agents reuse the template.
8. Actual full-build log and resulting inventory distinguish produced, failed,
   pending and unobserved states. Screencast evidence is required for acceptance;
   a script change or successful syntax check does not imply product acceptance.
