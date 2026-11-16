# Natally v1.57.13281 — actual full build result

The canonical full entry `./build_all.sh` exited0 on asrock, finishing 2026-11-16. Source commit: 10f49ba11fa16cb1fe474b68fa2cd0a4670be19a. The same source/version produced every listed artifact. Web publication to https://natally.robin.mba succeeded before native packaging. The pipeline automatically advanced the next editable source to v1.58.13296 and pushed commit0cf9292. That next identity is not a built release.

Produced and retained under dist/natally-v1.57.13281:

- Web archive and published frontend.
- Android arm64 release APK and AAB, plus native debug-symbol ZIP.
- Linux x64 AppImage, DEB and RPM.
- Windows x64 application EXE and NSIS installer EXE, cross-compiled on Linux.

The generated inventory records nine artifacts, sizes, SHA256 values and packaged target states. Native Windows MSI/MSIX is conditional on the separate native-Windows continuation; this Linux invocation did not execute that host-specific path. Binaries remain in the local versioned release home; GitHub publication here is metadata/source only. No Forgejo contact was made.

Actual terminal recording: LOGS/canonical-full-build-2026-11-16T024141262Z.txt and its timing sidecar. The named build/natally-full-build-20261115.log retains this invocation appended after any earlier evidence. The first full attempt, v1.56.13280, failed a signing credential-pointer resolution before packaging; it is not represented as a successful build.

## Billing is not accepted

The process-only billing URL for this release was the existing Cloud Run service https://natally-billing-bd2e6ftjfq-uw.a.run.app, recovered from an authoritative deployment record. Direct authenticated Cloud Run metadata inspection identifies ready revision natally-billing-00006-6mh and RevenueCat/Stripe settings, with no Chargebee settings. This current rewrite's frozen client/server purchase contract requires Chargebee. Therefore the successful frontend upload and native packaging do not establish working billing, and the release is not100percent product acceptance.

The current repository includes the standalone Node Chargebee router, but the existing release pipeline does not publish that backend. Authoritative Astronatally client settings still reference the old Netlify URL, which the frozen build rejects. The missing production placement must be made explicit in architecture/checklist before shipping deployment implementation. The existing older runtime must be preserved for its consumers. A staged concrete proposal and observation rubric are recorded separately for review; no new service, synthetic payment, customer or ledger grant was created.

The operator reports v1.42 at the public URL. Version/cache investigation was stopped on the operator's instruction. The observation was retained without assuming a browser cache cause.
